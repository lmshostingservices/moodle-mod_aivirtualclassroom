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
 * Watch a recording. Access is checked here; the video streams from R2 via a signed, expiring link.
 *
 * @package    mod_aivirtualclassroom
 * @copyright  2026 LMS Hosting Services
 * @license    https://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

use mod_aivirtualclassroom\local\meet;

require(__DIR__ . '/../../config.php');

$id = required_param('id', PARAM_INT);
$rid = required_param('r', PARAM_INT);

[$course, $cm] = get_course_and_cm_from_cmid($id, 'aivirtualclassroom');
$aivirtualclassroom = $DB->get_record('aivirtualclassroom', ['id' => $cm->instance], '*', MUST_EXIST);
require_login($course, false, $cm);
$context = context_module::instance($cm->id);
require_capability('mod/aivirtualclassroom:view', $context);
$rec = $DB->get_record('aivirtualclassroom_rec', ['id' => $rid, 'aivirtualclassroomid' => $aivirtualclassroom->id], '*', MUST_EXIST);

$PAGE->set_url('/mod/aivirtualclassroom/play.php', ['id' => $cm->id, 'r' => $rec->id]);
$PAGE->set_title(format_string($aivirtualclassroom->name));
$PAGE->set_heading(format_string($course->fullname));

$PAGE->activityheader->set_attrs(['description' => '', 'hidecompletion' => true]);
echo $OUTPUT->header();
echo $OUTPUT->heading(get_string('recordingof', 'mod_aivirtualclassroom', userdate($rec->timestarted ?: $rec->timecreated)), 3);
echo html_writer::tag('video', '', [
    'src' => meet::playback_url($rec->storagekey),
    'controls' => 'controls',
    'preload' => 'metadata',
    'playsinline' => 'playsinline',
    'style' => 'width:100%;max-width:1100px;max-height:72vh;background:#000;border-radius:8px',
]);
echo html_writer::div(
    html_writer::link(meet::playback_url($rec->storagekey, true), get_string('download'), ['class' => 'btn btn-secondary mr-2 me-2']) .
    html_writer::link(new moodle_url('/mod/aivirtualclassroom/view.php', ['id' => $cm->id]), get_string('back'), ['class' => 'btn btn-link']),
    'mt-3'
);
echo $OUTPUT->footer();
