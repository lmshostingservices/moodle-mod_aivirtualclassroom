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
 * Breakout rooms: one room per teacher, students assigned to teachers.
 *
 * @package    mod_aivirtualclassroom
 * @copyright  2026 LMS Hosting Services
 * @license    https://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

use mod_aivirtualclassroom\local\meet;

require(__DIR__ . '/../../config.php');

$id = required_param('id', PARAM_INT);
$action = optional_param('action', '', PARAM_ALPHA);

[$course, $cm] = get_course_and_cm_from_cmid($id, 'aivirtualclassroom');
$aivirtualclassroom = $DB->get_record('aivirtualclassroom', ['id' => $cm->instance], '*', MUST_EXIST);
require_login($course, false, $cm);
$context = context_module::instance($cm->id);
require_capability('mod/aivirtualclassroom:managebreakouts', $context);

$url = new moodle_url('/mod/aivirtualclassroom/breakouts.php', ['id' => $cm->id]);
$PAGE->set_url($url);
$PAGE->set_title(get_string('managebreakouts', 'mod_aivirtualclassroom'));
$PAGE->set_heading(format_string($course->fullname));
$PAGE->activityheader->disable();

$teachers = meet::teachers($aivirtualclassroom, $context);
$students = meet::students($aivirtualclassroom, $context);

if ($action && confirm_sesskey()) {
    if ($action === 'auto' || $action === 'rebalance') {
        $n = meet::auto_assign($aivirtualclassroom, $context, $course->id, $action === 'rebalance');
        redirect($url, get_string('autoassigned', 'mod_aivirtualclassroom', $n), null, \core\output\notification::NOTIFY_SUCCESS);
    }
    if ($action === 'clear') {
        $DB->delete_records('aivirtualclassroom_bo', ['aivirtualclassroomid' => $aivirtualclassroom->id]);
        redirect($url, get_string('assignmentscleared', 'mod_aivirtualclassroom'));
    }
    if ($action === 'save') {
        $assign = optional_param_array('assign', [], PARAM_INT);
        foreach ($students as $s) {
            $tid = (int)($assign[$s->id] ?? 0);
            meet::set_assignment($aivirtualclassroom->id, $s->id, isset($teachers[$tid]) ? $tid : 0);
        }
        redirect($url, get_string('changessaved'), null, \core\output\notification::NOTIFY_SUCCESS);
    }
}

echo $OUTPUT->header();
echo $OUTPUT->heading(get_string('managebreakouts', 'mod_aivirtualclassroom') . ': ' . format_string($aivirtualclassroom->name));
echo html_writer::tag('p', get_string('breakouts_intro', 'mod_aivirtualclassroom'));

if (!$teachers) {
    echo $OUTPUT->notification(get_string('noteachers', 'mod_aivirtualclassroom'), 'warning');
    echo $OUTPUT->footer();
    exit;
}

$current = $DB->get_records_menu('aivirtualclassroom_bo', ['aivirtualclassroomid' => $aivirtualclassroom->id], '', 'userid, teacherid');

// Room summary.
$summary = new html_table();
$summary->head = [get_string('room', 'mod_aivirtualclassroom'), get_string('students')];
$unassigned = 0;
$counts = array_fill_keys(array_keys($teachers), 0);
foreach ($students as $s) {
    $tid = $current[$s->id] ?? 0;
    if (isset($counts[$tid])) {
        $counts[$tid]++;
    } else {
        $unassigned++;
    }
}
foreach ($teachers as $t) {
    $summary->data[] = [get_string('roomname', 'mod_aivirtualclassroom', fullname($t)), $counts[$t->id]];
}
$summary->data[] = [html_writer::tag('em', get_string('mainroomunassigned', 'mod_aivirtualclassroom')), $unassigned];
echo html_writer::table($summary);

// Bulk actions.
$btn = function ($action, $label, $class = 'btn-secondary') use ($url) {
    return html_writer::link(
        new moodle_url($url, ['action' => $action, 'sesskey' => sesskey()]),
        $label,
        ['class' => "btn $class mr-2 me-2 mb-2"]
    );
};
echo html_writer::div(
    $btn('auto', get_string('autoassign', 'mod_aivirtualclassroom'), 'btn-primary') .
    $btn('rebalance', get_string('rebalance', 'mod_aivirtualclassroom')) .
    $btn('clear', get_string('clearassignments', 'mod_aivirtualclassroom'), 'btn-outline-danger'),
    'mb-3'
);

// Manual assignment form.
$options = [0 => get_string('mainroomunassigned', 'mod_aivirtualclassroom')];
foreach ($teachers as $t) {
    $options[$t->id] = get_string('roomname', 'mod_aivirtualclassroom', fullname($t));
}
echo html_writer::start_tag('form', ['method' => 'post', 'action' => $url->out(false)]);
echo html_writer::empty_tag('input', ['type' => 'hidden', 'name' => 'sesskey', 'value' => sesskey()]);
echo html_writer::empty_tag('input', ['type' => 'hidden', 'name' => 'action', 'value' => 'save']);
$table = new html_table();
$table->head = [get_string('fullname'), get_string('groups'), get_string('room', 'mod_aivirtualclassroom')];
foreach ($students as $s) {
    $groups = groups_get_all_groups($course->id, $s->id);
    $table->data[] = [
        fullname($s),
        s(implode(', ', array_map(function ($g) {
            return format_string($g->name);
        }, $groups))),
        html_writer::select($options, "assign[{$s->id}]", $current[$s->id] ?? 0, false, ['class' => 'custom-select form-select']),
    ];
}
echo html_writer::table($table);
echo html_writer::empty_tag('input', ['type' => 'submit', 'value' => get_string('savechanges'), 'class' => 'btn btn-primary']);
echo ' ' . html_writer::link(
    new moodle_url('/mod/aivirtualclassroom/view.php', ['id' => $cm->id]),
    get_string('back'),
    ['class' => 'btn btn-link']
);
echo html_writer::end_tag('form');

echo $OUTPUT->footer();
