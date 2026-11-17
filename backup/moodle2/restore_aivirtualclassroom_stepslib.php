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
 * Restore steps for AI Virtual Classroom.
 *
 * @package    mod_aivirtualclassroom
 * @category   backup
 * @copyright  2026 LMS Hosting Services
 * @license    https://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

/**
 * Restores one AI Virtual Classroom activity and, with user data, its attendance, hand raises, breakouts and notes.
 *
 * @package    mod_aivirtualclassroom
 * @copyright  2026 LMS Hosting Services
 * @license    https://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class restore_aivirtualclassroom_activity_structure_step extends restore_activity_structure_step {
    /**
     * Defines the paths to process.
     *
     * @return restore_path_element[]
     */
    protected function define_structure() {
        $userinfo = $this->get_setting_value('userinfo');
        $paths = [new restore_path_element('aivirtualclassroom', '/activity/aivirtualclassroom')];
        if ($userinfo) {
            $base = '/activity/aivirtualclassroom/';
            $paths[] = new restore_path_element('aivirtualclassroom_att', $base . 'attendances/attendance');
            $paths[] = new restore_path_element('aivirtualclassroom_hand', $base . 'hands/hand');
            $paths[] = new restore_path_element('aivirtualclassroom_bo', $base . 'breakouts/breakout');
            $paths[] = new restore_path_element('aivirtualclassroom_note', $base . 'notes/note');
            $paths[] = new restore_path_element('aivirtualclassroom_snote', $base . 'sharednotes/sharednote');
        }
        return $this->prepare_activity_structure($paths);
    }

    /**
     * Restores the activity record.
     *
     * @param array $data
     */
    protected function process_aivirtualclassroom($data) {
        global $DB;
        $data = (object)$data;
        $data->course = $this->get_courseid();
        $data->timeopen = $this->apply_date_offset($data->timeopen);
        // Teachers chosen to hold breakout rooms: keep only those who exist on this site.
        $teachers = [];
        foreach (array_filter(array_map('intval', explode(',', (string)$data->breakoutteachers))) as $olduserid) {
            if ($newuserid = $this->get_mappingid('user', $olduserid)) {
                $teachers[] = $newuserid;
            }
        }
        $data->breakoutteachers = implode(',', $teachers);
        // A restored activity always gets its own new guest link.
        $data->guestkey = random_string(32);
        $newid = $DB->insert_record('aivirtualclassroom', $data);
        $this->apply_activity_instance($newid);
    }

    /**
     * Restores one attendance row.
     *
     * @param array $data
     */
    protected function process_aivirtualclassroom_att($data) {
        $this->insert_user_row('aivirtualclassroom_att', $data, ['userid']);
    }

    /**
     * Restores one hand raise.
     *
     * @param array $data
     */
    protected function process_aivirtualclassroom_hand($data) {
        $this->insert_user_row('aivirtualclassroom_hand', $data, ['userid']);
    }

    /**
     * Restores one breakout room assignment.
     *
     * @param array $data
     */
    protected function process_aivirtualclassroom_bo($data) {
        $this->insert_user_row('aivirtualclassroom_bo', $data, ['userid', 'teacherid']);
    }

    /**
     * Restores one private note.
     *
     * @param array $data
     */
    protected function process_aivirtualclassroom_note($data) {
        $this->insert_user_row('aivirtualclassroom_note', $data, ['userid']);
    }

    /**
     * Restores one shared note.
     *
     * @param array $data
     */
    protected function process_aivirtualclassroom_snote($data) {
        $data = (object)$data;
        // Breakout room keys hold the room teacher's user ID ("t12", "tx-t12"): point them at the restored user.
        $data->roomkey = preg_replace_callback('/(^|-)t(\d+)$/', function ($m) {
            $newid = $this->get_mappingid('user', (int)$m[2]);
            return $m[1] . 't' . ($newid ?: (int)$m[2]);
        }, (string)$data->roomkey);
        $this->insert_user_row('aivirtualclassroom_snote', $data, ['editedby']);
    }

    /**
     * Inserts a user data row for the new activity, mapping its user fields. Rows whose users are missing are skipped.
     *
     * @param string $table
     * @param array $data
     * @param string[] $userfields
     */
    protected function insert_user_row(string $table, $data, array $userfields): void {
        global $DB;
        $data = (object)$data;
        foreach ($userfields as $field) {
            $data->$field = $this->get_mappingid('user', $data->$field);
            if (!$data->$field) {
                return;
            }
        }
        unset($data->id);
        $data->aivirtualclassroomid = $this->get_new_parentid('aivirtualclassroom');
        $DB->insert_record($table, $data);
    }

    /**
     * Restores the intro files.
     */
    protected function after_execute() {
        $this->add_related_files('mod_aivirtualclassroom', 'intro', null);
    }
}
