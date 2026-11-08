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
 * Activity landing page: join button, schedule, recordings, links for teachers.
 *
 * @package    mod_aivirtualclassroom
 * @copyright  2026 LMS Hosting Services
 * @license    https://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

use mod_aivirtualclassroom\local\meet;

require(__DIR__ . '/../../config.php');
require_once($CFG->libdir . '/completionlib.php');

$id = required_param('id', PARAM_INT);
$deleterec = optional_param('deleterec', 0, PARAM_INT);
$confirm = optional_param('confirm', 0, PARAM_BOOL);

[$course, $cm] = get_course_and_cm_from_cmid($id, 'aivirtualclassroom');
$aivirtualclassroom = $DB->get_record('aivirtualclassroom', ['id' => $cm->instance], '*', MUST_EXIST);
require_login($course, true, $cm);
$context = context_module::instance($cm->id);
require_capability('mod/aivirtualclassroom:view', $context);

$url = new moodle_url('/mod/aivirtualclassroom/view.php', ['id' => $cm->id]);
$PAGE->set_url($url);
$PAGE->set_title(format_string($aivirtualclassroom->name));
$PAGE->set_heading(format_string($course->fullname));

$canmoderate = has_capability('mod/aivirtualclassroom:moderate', $context);

// Delete a recording (moderators).
if ($deleterec && $canmoderate) {
    $rec = $DB->get_record('aivirtualclassroom_rec', ['id' => $deleterec, 'aivirtualclassroomid' => $aivirtualclassroom->id], '*', MUST_EXIST);
    if ($confirm && confirm_sesskey()) {
        meet::delete_remote($rec->storagekey);
        $DB->delete_records('aivirtualclassroom_rec', ['id' => $rec->id]);
        redirect($url, get_string('recordingdeleted', 'mod_aivirtualclassroom'), null, \core\output\notification::NOTIFY_SUCCESS);
    }
    echo $OUTPUT->header();
    echo $OUTPUT->confirm(
        get_string('confirmdeleterecording', 'mod_aivirtualclassroom', userdate($rec->timecreated)),
        new moodle_url($url, ['deleterec' => $rec->id, 'confirm' => 1, 'sesskey' => sesskey()]),
        $url
    );
    echo $OUTPUT->footer();
    exit;
}

$event = \mod_aivirtualclassroom\event\course_module_viewed::create(['objectid' => $aivirtualclassroom->id, 'context' => $context]);
$event->add_record_snapshot('course', $course);
$event->add_record_snapshot('aivirtualclassroom', $aivirtualclassroom);
$event->trigger();
$completion = new completion_info($course);
$completion->set_module_viewed($cm);

echo $OUTPUT->header();

if (!meet::is_configured()) {
    echo $OUTPUT->notification(get_string(
        \mod_aivirtualclassroom\local\meet::has_credentials() ? 'waitingforlmslabs' : 'notconfigured',
        'mod_aivirtualclassroom'
    ), 'warning');
}

// Schedule.
$now = time();
if ($aivirtualclassroom->timeopen) {
    $end = $aivirtualclassroom->timeopen + $aivirtualclassroom->duration * 60;
    $a = (object)['start' => userdate($aivirtualclassroom->timeopen), 'duration' => format_time($aivirtualclassroom->duration * 60)];
    echo html_writer::tag('p', get_string('scheduledfor', 'mod_aivirtualclassroom', $a), ['class' => 'lead']);
    if ($now > $end) {
        echo $OUTPUT->notification(get_string('sessionended', 'mod_aivirtualclassroom'), 'info');
    }
}

// Join button. Students can join from 15 minutes before the scheduled start; moderators any time.
$early = $aivirtualclassroom->timeopen && $now < $aivirtualclassroom->timeopen - 900;
if (has_capability('mod/aivirtualclassroom:join', $context) && meet::is_configured()) {
    if ($early && !$canmoderate) {
        echo $OUTPUT->notification(get_string('notopenyet', 'mod_aivirtualclassroom', userdate($aivirtualclassroom->timeopen - 900)), 'info');
    } else {
        $joinurl = new moodle_url('/mod/aivirtualclassroom/room.php', ['id' => $cm->id]);
        echo html_writer::div(
            html_writer::link($joinurl, get_string('join', 'mod_aivirtualclassroom'), ['class' => 'btn btn-primary btn-lg']),
            'mb-4 mt-2'
        );
    }
}

// Guest invite link for moderators.
if ($canmoderate && $aivirtualclassroom->guestaccess && $aivirtualclassroom->guestkey) {
    $guesturl = \mod_aivirtualclassroom\local\meet::guest_url($cm->id, $aivirtualclassroom->guestkey)->out(false);
    $copy = get_string('copylink', 'mod_aivirtualclassroom');
    $copied = get_string('copied', 'mod_aivirtualclassroom');
    echo html_writer::div(
        html_writer::tag('label', get_string('guestlink', 'mod_aivirtualclassroom'), ['for' => 'aivirtualclassroom-guestlink', 'class' => 'form-label']) .
        html_writer::div(
            html_writer::empty_tag('input', ['type' => 'text', 'readonly' => 'readonly', 'id' => 'aivirtualclassroom-guestlink',
                'value' => $guesturl, 'class' => 'form-control', 'onclick' => 'this.select()']) .
            html_writer::tag(
                'button',
                $OUTPUT->pix_icon('t/copy', '') . ' ' . html_writer::span($copy),
                ['type' => 'button', 'class' => 'btn btn-primary', 'id' => 'aivirtualclassroom-copyguest', 'title' => $copy,
                'aria-label' => $copy]
            ),
            'input-group'
        ),
        'mb-3',
        ['style' => 'max-width:720px']
    );
    $PAGE->requires->js_amd_inline("
        (function () {
            var b = document.getElementById('aivirtualclassroom-copyguest');
            var i = document.getElementById('aivirtualclassroom-guestlink');
            if (!b || !i) { return; }
            b.addEventListener('click', function () {
                var done = function () {
                    var s = b.querySelector('span');
                    s.textContent = " . json_encode($copied) . ";
                    b.classList.replace('btn-primary', 'btn-success');
                    setTimeout(function () { s.textContent = " . json_encode($copy) . "; b.classList.replace('btn-success', 'btn-primary'); }, 2000);
                };
                if (navigator.clipboard && window.isSecureContext) {
                    navigator.clipboard.writeText(i.value).then(done, function () { i.select(); document.execCommand('copy'); done(); });
                } else {
                    i.select(); document.execCommand('copy'); done();
                }
            });
        })();
    ");
}

// Personal progress against completion rules.
if (!$canmoderate && ($aivirtualclassroom->completionattendance || $aivirtualclassroom->completionhandraises)) {
    $a = (object)[
        'minutes' => floor(meet::seconds_attended($aivirtualclassroom->id, $USER->id) / 60),
        'hands' => meet::hand_raises($aivirtualclassroom->id, $USER->id),
    ];
    echo html_writer::tag('p', get_string('yourprogress', 'mod_aivirtualclassroom', $a), ['class' => 'text-muted']);
}

// AI class summaries (written at the end of each class from the captions).
$summaries = $DB->get_records_select(
    'aivirtualclassroom_snote',
    "aivirtualclassroomid = ? AND " . $DB->sql_like('roomkey', '?'),
    [$aivirtualclassroom->id, 'sum-%'],
    'session DESC, roomkey ASC',
    '*',
    0,
    3
);
if ($summaries) {
    $out = html_writer::tag('h3', get_string('aisummary', 'mod_aivirtualclassroom'), ['class' => 'h5']);
    foreach ($summaries as $s) {
        $title = s($s->roomname) . ' · ' . userdate($s->session ?: $s->timemodified, get_string('strftimedatetimeshort', 'core_langconfig'));
        $out .= html_writer::tag('div', html_writer::tag('div', $title, ['class' => 'small text-muted mb-1']) .
            html_writer::tag('div', nl2br(s($s->content))), ['class' => 'border rounded p-3 mb-2 bg-light']);
    }
    $out .= html_writer::tag('p', get_string('aisummarynote', 'mod_aivirtualclassroom'), ['class' => 'small text-muted']);
    echo html_writer::div($out, 'mb-4', ['style' => 'max-width:820px']);
}

// Teacher tools.
$links = [];
if (has_capability('mod/aivirtualclassroom:managebreakouts', $context)) {
    $links[] = html_writer::link(
        new moodle_url('/mod/aivirtualclassroom/breakouts.php', ['id' => $cm->id]),
        get_string('managebreakouts', 'mod_aivirtualclassroom'),
        ['class' => 'btn btn-secondary mr-2 me-2']
    );
}
$links[] = html_writer::link(
    new moodle_url('/mod/aivirtualclassroom/export.php', ['id' => $cm->id, 'type' => 'mine']),
    get_string('exportmynotes', 'mod_aivirtualclassroom'),
    ['class' => 'btn btn-outline-secondary mr-2 me-2']
);
if ($DB->record_exists('aivirtualclassroom_snote', ['aivirtualclassroomid' => $aivirtualclassroom->id])) {
    $links[] = html_writer::link(
        new moodle_url('/mod/aivirtualclassroom/export.php', ['id' => $cm->id, 'type' => 'shared']),
        get_string('exportsharednotes', 'mod_aivirtualclassroom'),
        ['class' => 'btn btn-outline-secondary mr-2 me-2']
    );
}
if (has_capability('mod/aivirtualclassroom:viewreport', $context)) {
    $links[] = html_writer::link(
        new moodle_url('/mod/aivirtualclassroom/report.php', ['id' => $cm->id]),
        get_string('attendancereport', 'mod_aivirtualclassroom'),
        ['class' => 'btn btn-secondary']
    );
}
if ($links) {
    echo html_writer::div(implode('', $links), 'mb-4');
}

// Recordings.
$recs = $DB->get_records('aivirtualclassroom_rec', ['aivirtualclassroomid' => $aivirtualclassroom->id], 'timecreated DESC');
echo $OUTPUT->heading(get_string('recordings', 'mod_aivirtualclassroom'), 3);
if (!$recs) {
    echo html_writer::tag('p', get_string('norecordings', 'mod_aivirtualclassroom'), ['class' => 'text-muted']);
} else {
    $table = new html_table();
    $table->head = [get_string('date'), get_string('recordinglength', 'mod_aivirtualclassroom'), get_string('size'), ''];
    foreach ($recs as $rec) {
        $actions = html_writer::link(
            new moodle_url('/mod/aivirtualclassroom/play.php', ['id' => $cm->id, 'r' => $rec->id]),
            get_string('watchrecording', 'mod_aivirtualclassroom'),
            ['class' => 'btn btn-sm btn-outline-primary']
        );
        if ($canmoderate) {
            $actions .= ' ' . html_writer::link(
                new moodle_url($url, ['deleterec' => $rec->id]),
                get_string('delete'),
                ['class' => 'btn btn-sm btn-outline-danger']
            );
        }
        $table->data[] = [userdate($rec->timestarted ?: $rec->timecreated), format_time($rec->seconds),
            display_size($rec->bytes), $actions];
    }
    echo html_writer::table($table);
}

echo $OUTPUT->footer();
