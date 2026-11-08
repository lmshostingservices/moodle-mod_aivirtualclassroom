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
 * Autosave endpoint for a user's private meeting notes (called from the meeting room).
 *
 * @package    mod_aivirtualclassroom
 * @copyright  2026 LMS Hosting Services
 * @license    https://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

define('AJAX_SCRIPT', true);

require(__DIR__ . '/../../config.php');

$id = required_param('id', PARAM_INT);
[$course, $cm] = get_course_and_cm_from_cmid($id, 'aivirtualclassroom');
require_login($course, false, $cm, false, true);
$context = context_module::instance($cm->id);
require_capability('mod/aivirtualclassroom:join', $context);
require_sesskey();

// Notes are plain text: tags are removed here and everything is escaped again on export.
$content = optional_param('content', '', PARAM_TEXT);
if (core_text::strlen($content) > 200000) {
    throw new moodle_exception('err_notestoolong', 'mod_aivirtualclassroom');
}

$row = $DB->get_record('aivirtualclassroom_note', ['aivirtualclassroomid' => $cm->instance, 'userid' => $USER->id]);
if ($row) {
    $DB->update_record('aivirtualclassroom_note', (object)['id' => $row->id, 'content' => $content, 'timemodified' => time()]);
} else {
    $DB->insert_record('aivirtualclassroom_note', (object)['aivirtualclassroomid' => $cm->instance, 'userid' => $USER->id,
        'content' => $content, 'timemodified' => time()]);
}
echo json_encode(['ok' => true, 'saved' => time()]);
