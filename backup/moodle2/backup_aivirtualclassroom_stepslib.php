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
 * Backup steps for AI Virtual Classroom.
 *
 * @package    mod_aivirtualclassroom
 * @category   backup
 * @copyright  2026 LMS Hosting Services
 * @license    https://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

/**
 * Defines the structure of an AI Virtual Classroom backup.
 *
 * Activity settings are always included. With user data: attendance, hand raises, breakout room assignments,
 * private notes and shared notes (including caption transcripts and AI class summaries).
 * Recordings are not included: they are kept in LMS Labs cloud storage for the original activity only.
 * The guest invite key is not included, so a restored activity gets a new guest link.
 *
 * @package    mod_aivirtualclassroom
 * @copyright  2026 LMS Hosting Services
 * @license    https://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class backup_aivirtualclassroom_activity_structure_step extends backup_activity_structure_step {
    /**
     * Defines the backup structure.
     *
     * @return backup_nested_element
     */
    protected function define_structure() {
        $userinfo = $this->get_setting_value('userinfo');

        $root = new backup_nested_element('aivirtualclassroom', ['id'], [
            'name', 'intro', 'introformat', 'timeopen', 'duration', 'breakoutteachers', 'videopolicy', 'waitingroom',
            'guestaccess', 'keyterms', 'emailrecordings', 'completionattendance', 'completionhandraises',
            'timecreated', 'timemodified',
        ]);

        $atts = new backup_nested_element('attendances');
        $att = new backup_nested_element('attendance', ['id'], [
            'userid', 'eid', 'timejoined', 'timeleft', 'seconds', 'bytesrx', 'bytestx',
        ]);
        $hands = new backup_nested_element('hands');
        $hand = new backup_nested_element('hand', ['id'], ['userid', 'eid', 'timecreated']);
        $bos = new backup_nested_element('breakouts');
        $bo = new backup_nested_element('breakout', ['id'], ['userid', 'teacherid']);
        $notes = new backup_nested_element('notes');
        $note = new backup_nested_element('note', ['id'], ['userid', 'content', 'timemodified']);
        $snotes = new backup_nested_element('sharednotes');
        $snote = new backup_nested_element('sharednote', ['id'], [
            'session', 'roomkey', 'roomname', 'content', 'editedby', 'timemodified',
        ]);

        $root->add_child($atts);
        $atts->add_child($att);
        $root->add_child($hands);
        $hands->add_child($hand);
        $root->add_child($bos);
        $bos->add_child($bo);
        $root->add_child($notes);
        $notes->add_child($note);
        $root->add_child($snotes);
        $snotes->add_child($snote);

        $root->set_source_table('aivirtualclassroom', ['id' => backup::VAR_ACTIVITYID]);
        if ($userinfo) {
            $byactivity = ['aivirtualclassroomid' => backup::VAR_PARENTID];
            $att->set_source_table('aivirtualclassroom_att', $byactivity, 'id ASC');
            $hand->set_source_table('aivirtualclassroom_hand', $byactivity, 'id ASC');
            $bo->set_source_table('aivirtualclassroom_bo', $byactivity, 'id ASC');
            $note->set_source_table('aivirtualclassroom_note', $byactivity, 'id ASC');
            $snote->set_source_table('aivirtualclassroom_snote', $byactivity, 'id ASC');
        }

        $att->annotate_ids('user', 'userid');
        $hand->annotate_ids('user', 'userid');
        $bo->annotate_ids('user', 'userid');
        $bo->annotate_ids('user', 'teacherid');
        $note->annotate_ids('user', 'userid');
        $snote->annotate_ids('user', 'editedby');

        $root->annotate_files('mod_aivirtualclassroom', 'intro', null);

        return $this->prepare_activity_structure($root);
    }
}
