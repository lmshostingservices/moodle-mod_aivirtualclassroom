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
 * Guest invite link: people without a Moodle account enter their name and join.
 * Guests never become moderators and their attendance is not stored in Moodle.
 *
 * @package    mod_aivirtualclassroom
 * @copyright  2026 LMS Hosting Services
 * @license    https://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

// phpcs:disable moodle.Files.RequireLogin.Missing -- access is granted by the secret invite key.
// Public on purpose: external guests have no Moodle account, so there is no require_login().
// Access needs the activity's secret guest key (k), guests must be enabled on the activity,
// and the guest gets a short-lived token with the guest role only.
define('NO_MOODLE_COOKIES', true);

require(__DIR__ . '/../../config.php');

use mod_aivirtualclassroom\local\meet;

$id = required_param('id', PARAM_INT);
$key = required_param('k', PARAM_ALPHANUM);
$name = trim(optional_param('name', '', PARAM_TEXT));

$cm = get_coursemodule_from_id('aivirtualclassroom', $id, 0, false, MUST_EXIST);
$aivirtualclassroom = $DB->get_record('aivirtualclassroom', ['id' => $cm->instance], '*', MUST_EXIST);
$context = context_module::instance($cm->id);
if (!$cm->visible || empty($aivirtualclassroom->guestaccess) || empty($aivirtualclassroom->guestkey) || !hash_equals($aivirtualclassroom->guestkey, $key) ||
        !meet::is_configured()) {
    throw new moodle_exception('guestlinkinvalid', 'mod_aivirtualclassroom');
}

$url = new moodle_url('/mod/aivirtualclassroom/guest.php', ['id' => $cm->id, 'k' => $key]);
$PAGE->set_url($url);
$PAGE->set_context($context);
$PAGE->set_pagelayout('popup');
$PAGE->set_title(format_string($aivirtualclassroom->name));

if ($name !== '' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $guest = (object)['id' => 'g-' . random_string(12), 'name' => core_text::substr($name, 0, 60) . ' (' .
        get_string('guest') . ')'];
    $config = [
        'worker' => meet::worker_url(),
        'token' => meet::join_token($cm, $context, $guest, '', $aivirtualclassroom->videopolicy, 'guest', (int)$aivirtualclassroom->waitingroom >= 1,
            (string)$aivirtualclassroom->keyterms, format_string(get_course($cm->course)->fullname)),
        'videoPolicy' => $aivirtualclassroom->videopolicy,
        'myNotes' => '',
        'notesUrl' => null,
        'exportUrl' => null,
        'sesskey' => null,
        'guestUrl' => null,
        'title' => format_string($aivirtualclassroom->name, true, ['context' => $context]),
        'course' => '',
        'returnUrl' => $url->out(false),
        'breakoutsUrl' => null,
        'me' => ['uid' => $guest->id, 'name' => $guest->name, 'pic' => '', 'mod' => false, 'guest' => true],
        'maxVideo' => max(1, (int)(meet::config()->maxvideo ?? 12)),
        'studentScreenShare' => false,
        'simulcast' => true,
        'handGoal' => 0,
        'plan' => null,
    ];
    meet::output_room($config);
}

echo $OUTPUT->header();
echo $OUTPUT->heading(format_string($aivirtualclassroom->name));
echo html_writer::start_tag('form', ['method' => 'post', 'action' => $url->out(false), 'class' => 'mt-3']);
echo html_writer::label(get_string('yourname', 'mod_aivirtualclassroom'), 'aivirtualclassroom-guestname', true, ['class' => 'form-label']);
echo html_writer::empty_tag('input', ['type' => 'text', 'name' => 'name', 'id' => 'aivirtualclassroom-guestname', 'required' => 'required',
    'maxlength' => 60, 'class' => 'form-control mb-3', 'autocomplete' => 'name']);
echo html_writer::empty_tag('input', ['type' => 'submit', 'value' => get_string('join', 'mod_aivirtualclassroom'),
    'class' => 'btn btn-primary']);
echo html_writer::end_tag('form');
echo $OUTPUT->footer();
