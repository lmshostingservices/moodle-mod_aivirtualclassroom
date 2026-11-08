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
 * Attendance and participation report.
 *
 * @package    mod_aivirtualclassroom
 * @copyright  2026 LMS Hosting Services
 * @license    https://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

use mod_aivirtualclassroom\local\meet;

require(__DIR__ . '/../../config.php');
require_once($CFG->libdir . '/completionlib.php');
require_once($CFG->libdir . '/csvlib.class.php');

$id = required_param('id', PARAM_INT);
$download = optional_param('download', 0, PARAM_BOOL);

[$course, $cm] = get_course_and_cm_from_cmid($id, 'aivirtualclassroom');
$aivirtualclassroom = $DB->get_record('aivirtualclassroom', ['id' => $cm->instance], '*', MUST_EXIST);
require_login($course, false, $cm);
$context = context_module::instance($cm->id);
require_capability('mod/aivirtualclassroom:viewreport', $context);

$url = new moodle_url('/mod/aivirtualclassroom/report.php', ['id' => $cm->id]);
$PAGE->set_url($url);
$PAGE->set_title(get_string('attendancereport', 'mod_aivirtualclassroom'));
$PAGE->set_heading(format_string($course->fullname));

$att = $DB->get_records_sql('SELECT userid, SUM(seconds) AS secs, COUNT(1) AS sessions, SUM(bytesrx) AS rx, MIN(timejoined) AS firstjoin,
                                    MAX(timeleft) AS lastleft
                               FROM {aivirtualclassroom_att} WHERE aivirtualclassroomid = ? GROUP BY userid', [$aivirtualclassroom->id]);
$hands = $DB->get_records_sql_menu('SELECT userid, COUNT(1) FROM {aivirtualclassroom_hand} WHERE aivirtualclassroomid = ? GROUP BY userid',
    [$aivirtualclassroom->id]);
$completion = new completion_info($course);
$tracking = $completion->is_enabled($cm) == COMPLETION_TRACKING_AUTOMATIC;

$users = get_enrolled_users($context, 'mod/aivirtualclassroom:join', 0, 'u.*', 'u.lastname, u.firstname', 0, 0, true);
$rows = [];
foreach ($users as $u) {
    $a = $att[$u->id] ?? null;
    $state = '';
    if (has_capability('mod/aivirtualclassroom:moderate', $context, $u)) {
        $state = get_string('teacherrole', 'mod_aivirtualclassroom');
    } else if ($tracking) {
        $data = $completion->get_data($cm, false, $u->id);
        $state = in_array($data->completionstate, [COMPLETION_COMPLETE, COMPLETION_COMPLETE_PASS])
            ? get_string('completion-y', 'completion') : get_string('completion-n', 'completion');
    }
    $rows[] = [
        fullname($u),
        $a ? round($a->secs / 60) : 0,
        $a ? (int)$a->sessions : 0,
        (int)($hands[$u->id] ?? 0),
        $a ? round($a->rx / 1048576, 1) : 0,
        $a ? userdate($a->firstjoin, get_string('strftimedatetimeshort', 'langconfig')) : '-',
        $a ? userdate($a->lastleft, get_string('strftimedatetimeshort', 'langconfig')) : '-',
        $state,
    ];
}
$head = [get_string('fullname'), get_string('minutesattended', 'mod_aivirtualclassroom'), get_string('connections', 'mod_aivirtualclassroom'),
    get_string('handraises', 'mod_aivirtualclassroom'), get_string('datareceived', 'mod_aivirtualclassroom'), get_string('firstjoined', 'mod_aivirtualclassroom'), get_string('lastleft', 'mod_aivirtualclassroom'),
    get_string('completion', 'completion')];

if ($download) {
    $csv = new csv_export_writer();
    $csv->set_filename(clean_filename(format_string($aivirtualclassroom->name) . '-attendance'));
    $csv->add_data($head);
    foreach ($rows as $r) {
        $csv->add_data($r);
    }
    $csv->download_file();
    exit;
}

$PAGE->activityheader->set_attrs(['description' => '', 'hidecompletion' => true]);
echo $OUTPUT->header();
echo $OUTPUT->heading(get_string('attendancereport', 'mod_aivirtualclassroom'));
$rules = [];
if ($aivirtualclassroom->completionattendance) {
    $rules[] = get_string('completiondetail:attendance', 'mod_aivirtualclassroom', $aivirtualclassroom->completionattendance);
}
if ($aivirtualclassroom->completionhandraises) {
    $rules[] = get_string('completiondetail:handraises', 'mod_aivirtualclassroom', $aivirtualclassroom->completionhandraises);
}
if ($rules) {
    echo html_writer::tag('p', get_string('completionrules', 'mod_aivirtualclassroom', implode('; ', $rules)), ['class' => 'text-muted']);
}
$trainerids = array_map('intval', array_keys(\mod_aivirtualclassroom\local\meet::teachers($aivirtualclassroom, $context, false)));
$learnersecs = 0;
foreach ($DB->get_records_sql('SELECT userid, SUM(seconds) AS secs FROM {aivirtualclassroom_att} WHERE aivirtualclassroomid = ? GROUP BY userid',
        [$aivirtualclassroom->id]) as $r) {
    if (!in_array((int)$r->userid, $trainerids, true)) {
        $learnersecs += (int)$r->secs;
    }
}
echo html_writer::tag('p', get_string('learnersummary', 'mod_aivirtualclassroom', (object)[
    'hours' => format_float($learnersecs / 3600, 1),
    'credits' => format_float($learnersecs / 10800, 1),
]), ['class' => 'alert alert-info']);
echo html_writer::div(html_writer::link(new moodle_url($url, ['download' => 1]), get_string('downloadcsv', 'mod_aivirtualclassroom'),
    ['class' => 'btn btn-secondary']), 'mb-3');
$table = new html_table();
$table->head = $head;
$table->data = $rows;
echo html_writer::table($table);
echo $OUTPUT->footer();
