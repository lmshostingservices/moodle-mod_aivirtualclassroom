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
 * Library functions for AI Virtual Classroom.
 *
 * @package    mod_aivirtualclassroom
 * @copyright  2026 LMS Hosting Services
 * @license    https://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

/**
 * Supported features.
 *
 * @param string $feature
 * @return mixed
 */
function aivirtualclassroom_supports($feature) {
    switch ($feature) {
        case FEATURE_MOD_INTRO:
        case FEATURE_SHOW_DESCRIPTION:
        case FEATURE_COMPLETION_TRACKS_VIEWS:
        case FEATURE_COMPLETION_HAS_RULES:
            return true;
        case FEATURE_BACKUP_MOODLE2:
        case FEATURE_GRADE_HAS_GRADE:
        case FEATURE_GROUPS:
            return false;
        case FEATURE_MOD_PURPOSE:
            return MOD_PURPOSE_COMMUNICATION;
        default:
            return null;
    }
}

/**
 * Normalise form data before saving.
 *
 * @param stdClass $data
 */
function aivirtualclassroom_normalise(stdClass $data): void {
    if (isset($data->breakoutteachers) && is_array($data->breakoutteachers)) {
        $data->breakoutteachers = implode(',', array_map('intval', array_filter($data->breakoutteachers)));
    }
    $data->duration = max(1, (int)($data->duration ?? 60));
    $data->timeopen = (int)($data->timeopen ?? 0);
    $data->videopolicy = in_array($data->videopolicy ?? '', ['all', 'teachers', 'none']) ? $data->videopolicy : 'teachers';
    if (isset($data->keyterms)) {
        $data->keyterms = core_text::substr(trim((string)$data->keyterms), 0, 1500);
    }
    $data->waitingroom = max(0, min(2, (int)($data->waitingroom ?? 1)));
    $data->guestaccess = empty($data->guestaccess) ? 0 : 1;
    $data->emailrecordings = empty($data->emailrecordings) ? 0 : 1;
    // Completion rules are absent from the data when Moodle has locked completion (someone already has progress):
    // leave the stored values alone in that case.
    foreach (['completionattendance', 'completionhandraises'] as $rule) {
        if (isset($data->$rule)) {
            $data->$rule = max(0, (int)$data->$rule);
        }
    }
}

/**
 * Add an instance.
 *
 * @param stdClass $data
 * @param mod_aivirtualclassroom_mod_form|null $mform
 * @return int
 */
function aivirtualclassroom_add_instance($data, $mform = null) {
    global $DB;
    aivirtualclassroom_normalise($data);
    $data->guestkey = random_string(32);
    $data->timecreated = time();
    $data->timemodified = $data->timecreated;
    $data->id = $DB->insert_record('aivirtualclassroom', $data);
    aivirtualclassroom_refresh_event($data);
    return $data->id;
}

/**
 * Update an instance.
 *
 * @param stdClass $data
 * @param mod_aivirtualclassroom_mod_form|null $mform
 * @return bool
 */
function aivirtualclassroom_update_instance($data, $mform = null) {
    global $DB;
    $data->id = $data->instance;
    aivirtualclassroom_normalise($data);
    if (!$DB->get_field('aivirtualclassroom', 'guestkey', ['id' => $data->id])) {
        $data->guestkey = random_string(32);
    }
    $data->timemodified = time();
    $DB->update_record('aivirtualclassroom', $data);
    aivirtualclassroom_refresh_event($data);
    return true;
}

/**
 * Delete an instance and everything stored for it.
 *
 * @param int $id
 * @return bool
 */
function aivirtualclassroom_delete_instance($id) {
    global $DB;
    if (!$aivirtualclassroom = $DB->get_record('aivirtualclassroom', ['id' => $id])) {
        return false;
    }
    if (\mod_aivirtualclassroom\local\meet::is_configured()) {
        foreach ($DB->get_records('aivirtualclassroom_rec', ['aivirtualclassroomid' => $id]) as $rec) {
            \mod_aivirtualclassroom\local\meet::delete_remote($rec->storagekey);
        }
    }
    foreach (
        ['aivirtualclassroom_att', 'aivirtualclassroom_hand', 'aivirtualclassroom_rec', 'aivirtualclassroom_bo',
            'aivirtualclassroom_note',
            'aivirtualclassroom_snote'] as $table
    ) {
        $DB->delete_records($table, ['aivirtualclassroomid' => $id]);
    }
    $DB->delete_records('event', ['modulename' => 'aivirtualclassroom', 'instance' => $id]);
    $DB->delete_records('aivirtualclassroom', ['id' => $id]);
    return true;
}

/**
 * Create / update the calendar event for the scheduled session.
 *
 * @param stdClass $data
 */
function aivirtualclassroom_refresh_event(stdClass $data): void {
    global $CFG, $DB;
    require_once($CFG->dirroot . '/calendar/lib.php');
    $existing = $DB->get_record('event', ['modulename' => 'aivirtualclassroom', 'instance' => $data->id, 'eventtype' => 'meeting']);
    if (empty($data->timeopen)) {
        if ($existing) {
            calendar_event::load($existing)->delete();
        }
        return;
    }
    $event = (object)[
        'name' => $data->name,
        'description' => '',
        'format' => FORMAT_HTML,
        'courseid' => $data->course,
        'groupid' => 0,
        'userid' => 0,
        'modulename' => 'aivirtualclassroom',
        'instance' => $data->id,
        'eventtype' => 'meeting',
        'type' => CALENDAR_EVENT_TYPE_STANDARD,
        'timestart' => $data->timeopen,
        'timeduration' => $data->duration * 60,
        'visible' => instance_is_visible('aivirtualclassroom', $data),
    ];
    if ($existing) {
        $event->id = $existing->id;
        calendar_event::load($existing)->update($event, false);
    } else {
        calendar_event::create($event, false);
    }
}

/**
 * Course module info, including custom completion rules for the completion API.
 *
 * @param stdClass $coursemodule
 * @return cached_cm_info|false
 */
function aivirtualclassroom_get_coursemodule_info($coursemodule) {
    global $DB;
    $fields = 'id, name, intro, introformat, completionattendance, completionhandraises';
    if (!$rec = $DB->get_record('aivirtualclassroom', ['id' => $coursemodule->instance], $fields)) {
        return false;
    }
    $info = new cached_cm_info();
    $info->name = $rec->name;
    if ($coursemodule->showdescription) {
        $info->content = format_module_intro('aivirtualclassroom', $rec, $coursemodule->id, false);
    }
    if ($coursemodule->completion == COMPLETION_TRACKING_AUTOMATIC) {
        $info->customdata['customcompletionrules']['completionattendance'] = (int)$rec->completionattendance;
        $info->customdata['customcompletionrules']['completionhandraises'] = (int)$rec->completionhandraises;
    }
    return $info;
}

/**
 * Reset course data: remove attendance, hand raises and breakout assignments.
 *
 * @param stdClass $data
 * @return array
 */
function aivirtualclassroom_reset_userdata($data) {
    global $DB;
    $status = [];
    if (!empty($data->reset_aivirtualclassroom_all)) {
        $ids = $DB->get_fieldset_select('aivirtualclassroom', 'id', 'course = ?', [$data->courseid]);
        foreach ($ids as $id) {
            foreach (
                ['aivirtualclassroom_att', 'aivirtualclassroom_hand', 'aivirtualclassroom_bo',
                'aivirtualclassroom_note', 'aivirtualclassroom_snote'] as $table
            ) {
                $DB->delete_records($table, ['aivirtualclassroomid' => $id]);
            }
        }
        $status[] = ['component' => get_string('modulenameplural', 'mod_aivirtualclassroom'),
            'item' => get_string('resetall', 'mod_aivirtualclassroom'), 'error' => false];
    }
    return $status;
}

/**
 * Course reset form elements.
 *
 * @param MoodleQuickForm $mform
 */
function aivirtualclassroom_reset_course_form_definition(&$mform) {
    $mform->addElement('header', 'aivirtualclassroomheader', get_string('modulenameplural', 'mod_aivirtualclassroom'));
    $mform->addElement('advcheckbox', 'reset_aivirtualclassroom_all', get_string('resetall', 'mod_aivirtualclassroom'));
}

/**
 * Course reset defaults.
 *
 * @param stdClass $course
 * @return array
 */
function aivirtualclassroom_reset_course_form_defaults($course) {
    return ['reset_aivirtualclassroom_all' => 1];
}
