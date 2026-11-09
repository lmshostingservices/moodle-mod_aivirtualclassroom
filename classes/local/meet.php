<?php
// This file is part of Moodle - https://moodle.org/
//
// Moodle is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// Moodle is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with Moodle.  If not, see <https://www.gnu.org/licenses/>.

namespace mod_aivirtualclassroom\local;

use context_module;
use stdClass;

/**
 * Shared helpers: edge configuration, signing, breakout plans and webhook processing.
 *
 * @package    mod_aivirtualclassroom
 * @copyright  2026 LMS Hosting Services
 * @license    https://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class meet {
    /** @var int Token lifetime for a meeting page (seconds). */
    const TOKEN_TTL = 43200;

    /** @var string The AI Virtual Classroom live class service. The same for every LMS Labs client. */
    const WORKER_URL = 'https://lmslivelab.believe-c50.workers.dev';

    /** @var string LMS Labs, used when Central Config has no server URL. */
    const LMSLABS_URL = 'https://lms-labs.com';

    /** @var stdClass|null Request cache. */
    private static $cfg = null;

    /**
     * Site ID and API key, from LMS Labs Central Config (local_aiconfig) like every LMS Labs plugin,
     * with this plugin's own fallback settings if Central Config is not installed.
     *
     * @return array [siteid, apikey, serverurl]
     */
    public static function credentials(): array {
        global $CFG;
        $siteid = '';
        $apikey = '';
        if (file_exists($CFG->dirroot . '/local/aiconfig/lib.php')) {
            require_once($CFG->dirroot . '/local/aiconfig/lib.php');
        }
        if (function_exists('local_aiconfig_get_siteid')) {
            $siteid = (string)local_aiconfig_get_siteid('mod_aivirtualclassroom');
        } else if (file_exists($CFG->dirroot . '/local/aiconfig/version.php')) {
            $siteid = (string)get_config('local_aiconfig', 'siteid');
        }
        if (function_exists('local_aiconfig_get_apikey')) {
            $apikey = (string)local_aiconfig_get_apikey('mod_aivirtualclassroom');
        } else if (file_exists($CFG->dirroot . '/local/aiconfig/version.php')) {
            $apikey = (string)get_config('local_aiconfig', 'apikey');
        }
        if ($siteid === '' || $apikey === '') {
            $siteid = (string)get_config('mod_aivirtualclassroom', 'siteid');
            $apikey = (string)get_config('mod_aivirtualclassroom', 'apikey');
        }
        $server = '';
        if (file_exists($CFG->dirroot . '/local/aiconfig/version.php')) {
            $server = (string)get_config('local_aiconfig', 'serverurl');
        }
        // The Central Config Site ID is the site's host name; use one canonical form everywhere.
        $siteid = preg_replace('~^www\.~', '', preg_replace('~^https?://~', '', strtolower(trim($siteid))));
        $siteid = rtrim($siteid, '/');
        return [$siteid, trim($apikey), rtrim($server !== '' ? $server : self::LMSLABS_URL, '/')];
    }

    /**
     * The site's AI Virtual Classroom key. lms-labs.com issues it once for the Site ID and API key; it is then kept here.
     *
     * @param string $siteid
     * @param string $apikey
     * @param string $server
     * @return string Empty if it could not be fetched.
     */
    private static function site_key(string $siteid, string $apikey, string $server): string {
        global $CFG;
        $for = sha1($siteid . '|' . $apikey . '|' . $server);
        if (
            get_config(
                'mod_aivirtualclassroom',
                'sitekeyfor'
            ) === $for && ($k = (string)get_config('mod_aivirtualclassroom', 'sitekey')) !== ''
        ) {
            return $k;
        }
        $last = (int)get_config('mod_aivirtualclassroom', 'sitekeytried');
        if (get_config('mod_aivirtualclassroom', 'sitekeyfor') === $for && time() - $last < 120) {
            return '';
        }
        set_config('sitekeytried', time(), 'mod_aivirtualclassroom');
        set_config('sitekeyfor', $for, 'mod_aivirtualclassroom');
        set_config('sitekey', '', 'mod_aivirtualclassroom');
        require_once($CFG->libdir . '/filelib.php');
        $curl = new \curl();
        $body = json_encode(['siteId' => $siteid, 'apiKey' => $apikey, 'siteUrl' => $CFG->wwwroot]);
        $res = $curl->post($server . '/api/lmslivelab/sitekey', $body, [
            'CURLOPT_HTTPHEADER' => ['Content-Type: application/json'],
            'CURLOPT_TIMEOUT' => 15,
            'CURLOPT_CONNECTTIMEOUT' => 8,
        ]);
        $j = json_decode((string)$res, true);
        $key = is_array($j) && !empty($j['key']) && is_string($j['key']) ? $j['key'] : '';
        set_config('sitekeyerror', $key === '' ? (is_array($j) && !empty($j['error']) ? substr((string)$j['error'], 0, 200)
            : 'No answer from LMS Labs') : '', 'mod_aivirtualclassroom');
        if ($key !== '') {
            set_config('sitekey', $key, 'mod_aivirtualclassroom');
        }
        return $key;
    }

    /**
     * Plugin configuration with the connection details filled in.
     * workerurl is fixed, siteid comes from Central Config and secret is the site's AI Virtual Classroom key.
     * A developer can still point a test site elsewhere in config.php with
     * $CFG->aivirtualclassroom_workerurl, $CFG->aivirtualclassroom_siteid and $CFG->aivirtualclassroom_secret.
     *
     * @return stdClass
     */
    public static function config(): stdClass {
        global $CFG;
        if (self::$cfg !== null) {
            return self::$cfg;
        }
        $c = get_config('mod_aivirtualclassroom');
        $c->workerurl = !empty($CFG->aivirtualclassroom_workerurl) ? (string)$CFG->aivirtualclassroom_workerurl : self::WORKER_URL;
        $c->simulcast = 1;
        $c->maxvideo = 12;
        if (!empty($CFG->aivirtualclassroom_siteid) && !empty($CFG->aivirtualclassroom_secret)) {
            $c->siteid = (string)$CFG->aivirtualclassroom_siteid;
            $c->secret = (string)$CFG->aivirtualclassroom_secret;
        } else {
            [$siteid, $apikey, $server] = self::credentials();
            $c->siteid = $siteid;
            $c->secret = ($siteid !== '' && $apikey !== '') ? self::site_key($siteid, $apikey, $server) : '';
        }
        self::$cfg = $c;
        return $c;
    }

    /**
     * Is the site connected (Central Config set up and the AI Virtual Classroom key issued)?
     *
     * @return bool
     */
    public static function is_configured(): bool {
        $c = self::config();
        return !empty($c->siteid) && !empty($c->secret);
    }

    /**
     * Does the site have a Site ID and API key (Central Config or fallback)?
     *
     * @return bool
     */
    public static function has_credentials(): bool {
        [$siteid, $apikey] = self::credentials();
        return $siteid !== '' && $apikey !== '';
    }

    /**
     * Base URL of the Worker without trailing slash.
     *
     * @return string
     */
    public static function worker_url(): string {
        return rtrim((string)self::config()->workerurl, '/');
    }

    /**
     * Base64url encode.
     *
     * @param string $data
     * @return string
     */
    public static function b64url(string $data): string {
        return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
    }

    /**
     * HMAC-SHA256 hex signature with the site secret.
     *
     * @param string $data
     * @return string
     */
    public static function sign(string $data): string {
        return hash_hmac('sha256', $data, (string)self::config()->secret);
    }

    /**
     * Mint an HS256 JWT for the edge Worker.
     *
     * @param array $claims
     * @return string
     */
    public static function jwt(array $claims): string {
        $header = self::b64url(json_encode(['alg' => 'HS256', 'typ' => 'JWT']));
        $payload = self::b64url(json_encode($claims, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));
        $sig = self::b64url(hash_hmac('sha256', $header . '.' . $payload, (string)self::config()->secret, true));
        return $header . '.' . $payload . '.' . $sig;
    }

    /**
     * The class picture a person chose in the waiting room, if any (kept in their own user files).
     *
     * @param int $userid
     * @return \stored_file|null
     */
    public static function avatar_file(int $userid): ?\stored_file {
        $ctx = \context_user::instance($userid, IGNORE_MISSING);
        if (!$ctx) {
            return null;
        }
        $files = get_file_storage()->get_area_files($ctx->id, 'mod_aivirtualclassroom', 'avatar', 0, 'id DESC', false);
        return $files ? reset($files) : null;
    }

    /**
     * Signature for a class picture link, so pictures can be shown to the class (and guests) without a login.
     *
     * @param int $userid
     * @param int $rev
     * @return string
     */
    public static function avatar_key(int $userid, int $rev): string {
        return substr(hash_hmac('sha256', $userid . ':' . $rev, 'aivc-avatar:' . get_site_identifier()), 0, 20);
    }

    /**
     * Link to a person's class picture, or null when they use their Moodle picture.
     *
     * @param int $userid
     * @return string|null
     */
    public static function avatar_url(int $userid): ?string {
        $file = self::avatar_file($userid);
        if (!$file) {
            return null;
        }
        $rev = (int)$file->get_timemodified();
        return (new \moodle_url(
            '/mod/aivirtualclassroom/avatarimg.php',
            ['u' => $userid, 'r' => $rev, 'k' => self::avatar_key($userid, $rev)]
        ))->out(false);
    }

    /**
     * Build the join token for the current user.
     *
     * @param \cm_info|stdClass $cm
     * @param context_module $context
     * @param stdClass $user
     * @param string $picurl
     * @param string $videopolicy Who may send camera video: 'all', 'teachers' or 'none'
     * @param string|null $role Role override ('mod' or 'att'), or null to work it out from capabilities
     * @param bool $wait Whether the person waits in the lobby until a teacher lets them in
     * @param string $keyterms Course key terms that help speech recognition and translation
     * @param string $course Course name, used as context for captions and translation
     * @return string
     */
    public static function join_token(
        $cm,
        context_module $context,
        stdClass $user,
        string $picurl,
        string $videopolicy = 'teachers',
        ?string $role = null,
        bool $wait = false,
        string $keyterms = '',
        string $course = ''
    ): string {
        $now = time();
        return self::jwt([
            'iss' => (string)self::config()->siteid,
            'sub' => (string)$user->id,
            'cmid' => (string)$cm->id,
            'name' => $role === 'guest' ? $user->name : fullname($user),
            'pic' => $picurl,
            'role' => $role ?? (has_capability('mod/aivirtualclassroom:moderate', $context, $user) ? 'mod' : 'att'),
            'vp' => $videopolicy,
            'wr' => $wait,
            'kt' => \core_text::substr($keyterms, 0, 1500),
            'course' => $course,
            'cb' => (new \moodle_url('/mod/aivirtualclassroom/webhook.php'))->out(false),
            'iat' => $now,
            'exp' => $now + self::TOKEN_TTL,
        ]);
    }

    /**
     * Output the full-screen meeting page and stop.
     *
     * @param array $config Client configuration (window.AIVC_CONFIG).
     */
    public static function output_room(array $config): void {
        global $CFG;
        $v = (int)get_config('mod_aivirtualclassroom', 'version');
        $base = $CFG->wwwroot . '/mod/aivirtualclassroom/client/';
        $config['pdfjs'] = $base . 'vendor/';
        $config['v'] = $v;
        if (!empty($config['cmid'])) {
            $config['slidesUrl'] = (new \moodle_url('/mod/aivirtualclassroom/slides.php', ['id' => $config['cmid']]))->out(false);
        }
        header('Content-Type: text/html; charset=utf-8');
        header('Permissions-Policy: camera=(self), microphone=(self), display-capture=(self), autoplay=(self), fullscreen=(self)');
        header('Cache-Control: no-store');
        header('Referrer-Policy: same-origin');
        $title = s($config['title']);
        $lang = current_language();
        $json = json_encode($config, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_UNESCAPED_SLASHES);
        echo '<!DOCTYPE html><html lang="' . $lang . '"><head><meta charset="utf-8">' .
            '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">' .
            '<meta name="robots" content="noindex"><title>' . $title . '</title>' .
            '<link rel="stylesheet" href="' . $base . 'meet.css?v=' . $v . '"></head><body>' .
            '<div id="aivirtualclassroom-app"></div><script>window.AIVC_CONFIG = ' . $json . ';</script>' .
            '<script type="module" src="' . $base . 'meet.js?v=' . $v . '"></script></body></html>';
        die;
    }

    /**
     * Guest invite URL for an activity (only meaningful when guest access is on).
     *
     * @param int $cmid
     * @param string $guestkey
     * @return \moodle_url
     */
    public static function guest_url(int $cmid, string $guestkey): \moodle_url {
        return new \moodle_url('/mod/aivirtualclassroom/guest.php', ['id' => $cmid, 'k' => $guestkey]);
    }

    /**
     * Short-lived signed playback URL for a recording.
     *
     * @param string $key
     * @param bool $download
     * @param int $ttl
     * @return string
     */
    public static function playback_url(string $key, bool $download = false, int $ttl = 14400): string {
        $exp = time() + $ttl;
        $params = ['site' => self::config()->siteid, 'key' => $key, 'exp' => $exp, 'sig' => self::sign("get|$key|$exp")];
        if ($download) {
            $params['dl'] = 1;
        }
        return self::worker_url() . '/rec/get?' . http_build_query($params, '', '&');
    }

    /**
     * Delete a recording object from R2.
     *
     * @param string $key
     * @return bool
     */
    public static function delete_remote(string $key): bool {
        global $CFG;
        require_once($CFG->libdir . '/filelib.php');
        $exp = time() + 300;
        $body = json_encode(['site' => self::config()->siteid, 'key' => $key, 'exp' => $exp, 'sig' => self::sign("del|$key|$exp")]);
        $curl = new \curl(['ignoresecurity' => true]);
        $curl->setHeader(['Content-Type: application/json']);
        $res = $curl->post(self::worker_url() . '/rec/delete', $body);
        $info = $curl->get_info();
        return !empty($info['http_code']) && $info['http_code'] == 200 && strpos((string)$res, '"ok":true') !== false;
    }

    /**
     * Users who moderate this activity and get a breakout room.
     *
     * @param stdClass $aivirtualclassroom
     * @param context_module $context
     * @param bool $onlyroomholders If true, honour the "breakoutteachers" activity setting.
     * @return stdClass[]
     */
    public static function teachers(stdClass $aivirtualclassroom, context_module $context, bool $onlyroomholders = true): array {
        $all = get_enrolled_users($context, 'mod/aivirtualclassroom:moderate', 0, 'u.*', 'u.lastname, u.firstname', 0, 0, true);
        if ($onlyroomholders && !empty($aivirtualclassroom->breakoutteachers)) {
            $ids = array_map('intval', explode(',', $aivirtualclassroom->breakoutteachers));
            $all = array_filter($all, function ($u) use ($ids) {
                return in_array((int)$u->id, $ids, true);
            });
        }
        return $all;
    }

    /**
     * Participants who are not moderators.
     *
     * @param stdClass $aivirtualclassroom
     * @param context_module $context
     * @return stdClass[]
     */
    public static function students(stdClass $aivirtualclassroom, context_module $context): array {
        $mods = self::teachers($aivirtualclassroom, $context, false);
        $all = get_enrolled_users($context, 'mod/aivirtualclassroom:join', 0, 'u.*', 'u.lastname, u.firstname', 0, 0, true);
        return array_diff_key($all, $mods);
    }

    /**
     * Breakout plan sent to moderators' browsers: one room per teacher.
     *
     * @param stdClass $aivirtualclassroom
     * @param context_module $context
     * @return array ['rooms' => [key => name], 'assign' => [userid => key], 'counts' => [key => n]]
     */
    public static function breakout_plan(stdClass $aivirtualclassroom, context_module $context): array {
        global $DB;
        $rooms = [];
        $assign = [];
        $counts = [];
        foreach (self::teachers($aivirtualclassroom, $context) as $t) {
            $key = 't' . $t->id;
            $rooms[$key] = get_string('roomname', 'mod_aivirtualclassroom', fullname($t));
            $assign[(string)$t->id] = $key;
            $counts[$key] = 0;
        }
        $rows = $DB->get_records('aivirtualclassroom_bo', ['aivirtualclassroomid' => $aivirtualclassroom->id]);
        foreach ($rows as $r) {
            $key = 't' . $r->teacherid;
            if (isset($rooms[$key])) {
                $assign[(string)$r->userid] = $key;
                $counts[$key]++;
            }
        }
        return ['rooms' => $rooms, 'assign' => $assign, 'counts' => $counts];
    }

    /**
     * Automatically assign every unassigned student to a teacher's room.
     * Students who share a course group with a teacher go to that teacher; others are balanced.
     *
     * @param stdClass $aivirtualclassroom
     * @param context_module $context
     * @param int $courseid
     * @param bool $reassignall Also re-balance students that already have a room.
     * @return int Number of students assigned.
     */
    public static function auto_assign(
        stdClass $aivirtualclassroom,
        context_module $context,
        int $courseid,
        bool $reassignall = false
    ): int {
        global $DB;
        $teachers = self::teachers($aivirtualclassroom, $context);
        if (!$teachers) {
            return 0;
        }
        $existing = $DB->get_records_menu(
            'aivirtualclassroom_bo',
            ['aivirtualclassroomid' => $aivirtualclassroom->id],
            '',
            'userid, teacherid'
        );
        if ($reassignall) {
            $DB->delete_records('aivirtualclassroom_bo', ['aivirtualclassroomid' => $aivirtualclassroom->id]);
            $existing = [];
        }
        $counts = array_fill_keys(array_keys($teachers), 0);
        foreach ($existing as $tid) {
            if (isset($counts[$tid])) {
                $counts[$tid]++;
            }
        }
        $tgroups = [];
        foreach ($teachers as $t) {
            $g = groups_get_user_groups($courseid, $t->id);
            $tgroups[$t->id] = $g[0] ?? [];
        }
        $done = 0;
        foreach (self::students($aivirtualclassroom, $context) as $s) {
            if (isset($existing[$s->id]) && isset($counts[$existing[$s->id]])) {
                continue;
            }
            $sg = groups_get_user_groups($courseid, $s->id)[0] ?? [];
            $candidates = array_keys(array_filter($tgroups, function ($g) use ($sg) {
                return (bool)array_intersect($g, $sg);
            }));
            if (!$candidates) {
                $candidates = array_keys($teachers);
            }
            usort($candidates, function ($a, $b) use ($counts) {
                return $counts[$a] <=> $counts[$b];
            });
            $tid = $candidates[0];
            self::set_assignment($aivirtualclassroom->id, $s->id, $tid);
            $counts[$tid]++;
            $done++;
        }
        return $done;
    }

    /**
     * Set (or clear when $teacherid is 0) one student's room.
     *
     * @param int $aivirtualclassroomid
     * @param int $userid
     * @param int $teacherid
     */
    public static function set_assignment(int $aivirtualclassroomid, int $userid, int $teacherid): void {
        global $DB;
        $row = $DB->get_record('aivirtualclassroom_bo', ['aivirtualclassroomid' => $aivirtualclassroomid, 'userid' => $userid]);
        if (!$teacherid) {
            if ($row) {
                $DB->delete_records('aivirtualclassroom_bo', ['id' => $row->id]);
            }
        } else if ($row) {
            $DB->set_field('aivirtualclassroom_bo', 'teacherid', $teacherid, ['id' => $row->id]);
        } else {
            $DB->insert_record('aivirtualclassroom_bo', (object)['aivirtualclassroomid' => $aivirtualclassroomid,
                'userid' => $userid, 'teacherid' => $teacherid]);
        }
    }

    /**
     * Total seconds attended by a user.
     *
     * @param int $aivirtualclassroomid
     * @param int $userid
     * @return int
     */
    public static function seconds_attended(int $aivirtualclassroomid, int $userid): int {
        global $DB;
        return (int)$DB->get_field_sql(
            'SELECT COALESCE(SUM(seconds), 0) FROM {aivirtualclassroom_att} WHERE aivirtualclassroomid = ? AND userid = ?',
            [$aivirtualclassroomid, $userid]
        );
    }

    /**
     * Number of hand raises by a user.
     *
     * @param int $aivirtualclassroomid
     * @param int $userid
     * @return int
     */
    public static function hand_raises(int $aivirtualclassroomid, int $userid): int {
        global $DB;
        return $DB->count_records('aivirtualclassroom_hand', ['aivirtualclassroomid' => $aivirtualclassroomid,
            'userid' => $userid]);
    }

    /**
     * Process a signed batch of events from the edge. Idempotent.
     *
     * @param int $cmid
     * @param array $events
     * @return int Number of new events stored.
     */
    public static function process_events(int $cmid, array $events): int {
        global $CFG, $DB;
        require_once($CFG->libdir . '/completionlib.php');
        $cm = get_coursemodule_from_id('aivirtualclassroom', $cmid, 0, false, IGNORE_MISSING);
        if (!$cm) {
            return 0;
        }
        $aivirtualclassroom = $DB->get_record('aivirtualclassroom', ['id' => $cm->instance], '*', MUST_EXIST);
        $touched = [];
        $stored = 0;
        foreach ($events as $ev) {
            $ev = (object)$ev;
            $uid = (int)($ev->uid ?? 0);
            $eid = substr(clean_param((string)($ev->eid ?? ''), PARAM_ALPHANUMEXT), 0, 64);
            if (!$uid || $eid === '' || !$DB->record_exists('user', ['id' => $uid, 'deleted' => 0])) {
                continue;
            }
            switch ($ev->type ?? '') {
                case 'attendance':
                    if (
                        $DB->record_exists('aivirtualclassroom_att', ['aivirtualclassroomid' => $aivirtualclassroom->id,
                        'eid' => $eid])
                    ) {
                        break;
                    }
                    $DB->insert_record('aivirtualclassroom_att', (object)[
                        'aivirtualclassroomid' => $aivirtualclassroom->id, 'userid' => $uid, 'eid' => $eid,
                        'timejoined' => (int)$ev->joined, 'timeleft' => (int)$ev->left,
                        'seconds' => max(0, min(86400, (int)$ev->seconds)),
                        'bytesrx' => max(0, (int)($ev->rx ?? 0)), 'bytestx' => max(0, (int)($ev->tx ?? 0)),
                    ]);
                    $touched[$uid] = true;
                    $stored++;
                    break;
                case 'hand':
                    if (
                        $DB->record_exists('aivirtualclassroom_hand', ['aivirtualclassroomid' => $aivirtualclassroom->id,
                        'eid' => $eid])
                    ) {
                        break;
                    }
                    $DB->insert_record('aivirtualclassroom_hand', (object)[
                        'aivirtualclassroomid' => $aivirtualclassroom->id, 'userid' => $uid, 'eid' => $eid,
                        'timecreated' => (int)$ev->ts,
                    ]);
                    $touched[$uid] = true;
                    $stored++;
                    break;
                case 'notes':
                    $roomkey = substr(clean_param((string)($ev->room ?? ''), PARAM_ALPHANUMEXT), 0, 40);
                    if ($roomkey === '') {
                        break;
                    }
                    $params = ['aivirtualclassroomid' => $aivirtualclassroom->id, 'session' => (int)($ev->session ?? 0),
                        'roomkey' => $roomkey];
                    $row = $DB->get_record('aivirtualclassroom_snote', $params);
                    $fields = ['roomname' => substr(clean_param((string)($ev->name ?? ''), PARAM_TEXT), 0, 255),
                        'content' => clean_param(
                            (string)($ev->text ?? ''),
                            PARAM_TEXT
                        ), 'editedby' => $uid, 'timemodified' => time()];
                    if ($row) {
                        $DB->update_record('aivirtualclassroom_snote', (object)(['id' => $row->id] + $fields));
                    } else {
                        $DB->insert_record('aivirtualclassroom_snote', (object)($params + $fields));
                    }
                    $stored++;
                    break;
                case 'recording':
                    $key = (string)($ev->key ?? '');
                    if (
                        strpos($key, self::config()->siteid . '/' . $cmid . '/') !== 0 ||
                            $DB->record_exists('aivirtualclassroom_rec', ['aivirtualclassroomid' => $aivirtualclassroom->id,
                                'storagekey' => $key])
                    ) {
                        break;
                    }
                    $id = $DB->insert_record('aivirtualclassroom_rec', (object)[
                        'aivirtualclassroomid' => $aivirtualclassroom->id, 'storagekey' => $key, 'bytes' => (int)$ev->bytes,
                        'seconds' => (int)$ev->seconds, 'mimetype' => substr(clean_param(
                            (string)($ev->mime ?? ""),
                            PARAM_TEXT
                        ), 0, 100),
                        'createdby' => $uid, 'timestarted' => (int)$ev->started, 'timecreated' => time(), 'notified' => 0,
                    ]);
                    if (!empty($aivirtualclassroom->emailrecordings)) {
                        $task = new \mod_aivirtualclassroom\task\send_recording_notification();
                        $task->set_custom_data(['recordingid' => $id]);
                        \core\task\manager::queue_adhoc_task($task);
                    }
                    $stored++;
                    break;
            }
        }
        if ($touched) {
            $course = get_course($cm->course);
            $completion = new \completion_info($course);
            $cminfo = get_fast_modinfo($course)->get_cm($cm->id);
            if ($completion->is_enabled($cminfo) == COMPLETION_TRACKING_AUTOMATIC) {
                foreach (array_keys($touched) as $uid) {
                    $completion->update_state($cminfo, COMPLETION_UNKNOWN, $uid);
                }
            }
        }
        return $stored;
    }
}
