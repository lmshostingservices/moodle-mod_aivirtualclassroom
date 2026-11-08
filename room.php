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

/**
 * Full-screen meeting room. Mints a short-lived token and loads the browser client.
 *
 * @package    mod_aivirtualclassroom
 * @copyright  2026 LMS Hosting Services
 * @license    https://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

use mod_aivirtualclassroom\local\meet;

require(__DIR__ . '/../../config.php');

$id = required_param('id', PARAM_INT);
[$course, $cm] = get_course_and_cm_from_cmid($id, 'aivirtualclassroom');
$aivirtualclassroom = $DB->get_record('aivirtualclassroom', ['id' => $cm->instance], '*', MUST_EXIST);
require_login($course, false, $cm);
$context = context_module::instance($cm->id);
require_capability('mod/aivirtualclassroom:join', $context);

$PAGE->set_url('/mod/aivirtualclassroom/room.php', ['id' => $cm->id]);
$PAGE->set_context($context);

if (!meet::is_configured()) {
    throw new moodle_exception(meet::has_credentials() ? 'waitingforlmslabs' : 'notconfigured', 'mod_aivirtualclassroom');
}
$ismod = has_capability('mod/aivirtualclassroom:moderate', $context);
if (!$ismod && $aivirtualclassroom->timeopen && time() < $aivirtualclassroom->timeopen - 900) {
    redirect(new moodle_url('/mod/aivirtualclassroom/view.php', ['id' => $cm->id]));
}

$pic = (new user_picture($USER));
$pic->size = 100;
$moodlepic = $pic->get_url($PAGE)->out(false);
// A class picture chosen in the waiting room takes the place of the Moodle picture in class.
$custompic = meet::avatar_url($USER->id);
$picurl = $custompic ?: $moodlepic;
$cfg = meet::config();
$guesturl = ($ismod && $aivirtualclassroom->guestaccess) ? meet::guest_url($cm->id, $aivirtualclassroom->guestkey)->out(false) : null;

$config = [
    'worker' => meet::worker_url(),
    'token' => meet::join_token($cm, $context, $USER, $picurl, $aivirtualclassroom->videopolicy, null,
        !$ismod && (int)$aivirtualclassroom->waitingroom === 2, (string)$aivirtualclassroom->keyterms, format_string($course->fullname)),
    'videoPolicy' => $aivirtualclassroom->videopolicy,
    'myNotes' => (string)$DB->get_field('aivirtualclassroom_note', 'content', ['aivirtualclassroomid' => $aivirtualclassroom->id, 'userid' => $USER->id]),
    'notesUrl' => (new moodle_url('/mod/aivirtualclassroom/notes.php', ['id' => $cm->id]))->out(false),
    'exportUrl' => (new moodle_url('/mod/aivirtualclassroom/export.php', ['id' => $cm->id]))->out(false),
    'sesskey' => sesskey(),
    'cmid' => (int)$cm->id,
    'quizUrl' => $ismod ? (new moodle_url('/mod/aivirtualclassroom/quiz.php', ['id' => $cm->id]))->out(false) : null,
    'guestUrl' => $guesturl,
    'title' => format_string($aivirtualclassroom->name, true, ['context' => $context]),
    'course' => format_string($course->shortname, true, ['context' => context_course::instance($course->id)]),
    'returnUrl' => (new moodle_url('/mod/aivirtualclassroom/view.php', ['id' => $cm->id]))->out(false),
    'breakoutsUrl' => has_capability('mod/aivirtualclassroom:managebreakouts', $context)
        ? (new moodle_url('/mod/aivirtualclassroom/breakouts.php', ['id' => $cm->id]))->out(false) : null,
    'me' => ['uid' => (string)$USER->id, 'name' => fullname($USER), 'pic' => $picurl, 'mod' => $ismod],
    'avatarUrl' => (new moodle_url('/mod/aivirtualclassroom/avatar.php', ['id' => $cm->id]))->out(false),
    'moodlePic' => $moodlepic,
    'customPic' => (bool)$custompic,
    'maxVideo' => max(1, (int)($cfg->maxvideo ?? 12)),
    'studentScreenShare' => !empty($cfg->studentscreenshare),
    'simulcast' => true,
    'handGoal' => (int)$aivirtualclassroom->completionhandraises,
    'plan' => $ismod ? meet::breakout_plan($aivirtualclassroom, $context) : null,
];
meet::output_room($config);
