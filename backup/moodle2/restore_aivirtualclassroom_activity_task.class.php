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
 * Restore task for AI Virtual Classroom.
 *
 * @package    mod_aivirtualclassroom
 * @category   backup
 * @copyright  2026 LMS Hosting Services
 * @license    https://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

defined('MOODLE_INTERNAL') || die();

require_once($CFG->dirroot . '/mod/aivirtualclassroom/backup/moodle2/restore_aivirtualclassroom_stepslib.php');

/**
 * Provides the steps to restore one AI Virtual Classroom activity.
 *
 * @package    mod_aivirtualclassroom
 * @copyright  2026 LMS Hosting Services
 * @license    https://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class restore_aivirtualclassroom_activity_task extends restore_activity_task {
    /**
     * No particular settings for this activity.
     */
    protected function define_my_settings() {
    }

    /**
     * Defines the restore steps.
     */
    protected function define_my_steps() {
        $this->add_step(new restore_aivirtualclassroom_activity_structure_step(
            'aivirtualclassroom_structure',
            'aivirtualclassroom.xml'
        ));
    }

    /**
     * Contents that may hold encoded links.
     *
     * @return restore_decode_content[]
     */
    public static function define_decode_contents() {
        return [new restore_decode_content('aivirtualclassroom', ['intro'], 'aivirtualclassroom')];
    }

    /**
     * Rules to decode links to this activity's pages.
     *
     * @return restore_decode_rule[]
     */
    public static function define_decode_rules() {
        return [
            new restore_decode_rule('AIVIRTUALCLASSROOMVIEWBYID', '/mod/aivirtualclassroom/view.php?id=$1', 'course_module'),
            new restore_decode_rule('AIVIRTUALCLASSROOMINDEX', '/mod/aivirtualclassroom/index.php?id=$1', 'course'),
        ];
    }

    /**
     * Restore log rules for this activity.
     *
     * @return restore_log_rule[]
     */
    public static function define_restore_log_rules() {
        return [
            new restore_log_rule('aivirtualclassroom', 'add', 'view.php?id={course_module}', '{aivirtualclassroom}'),
            new restore_log_rule('aivirtualclassroom', 'update', 'view.php?id={course_module}', '{aivirtualclassroom}'),
            new restore_log_rule('aivirtualclassroom', 'view', 'view.php?id={course_module}', '{aivirtualclassroom}'),
        ];
    }

    /**
     * Restore log rules for the course.
     *
     * @return restore_log_rule[]
     */
    public static function define_restore_log_rules_for_course() {
        return [new restore_log_rule('aivirtualclassroom', 'view all', 'index.php?id={course}', null)];
    }
}
