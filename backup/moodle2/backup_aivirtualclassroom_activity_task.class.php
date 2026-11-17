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
 * Backup task for AI Virtual Classroom.
 *
 * @package    mod_aivirtualclassroom
 * @category   backup
 * @copyright  2026 LMS Hosting Services
 * @license    https://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

defined('MOODLE_INTERNAL') || die();

require_once($CFG->dirroot . '/mod/aivirtualclassroom/backup/moodle2/backup_aivirtualclassroom_stepslib.php');

/**
 * Provides the steps to back up one AI Virtual Classroom activity.
 *
 * @package    mod_aivirtualclassroom
 * @copyright  2026 LMS Hosting Services
 * @license    https://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class backup_aivirtualclassroom_activity_task extends backup_activity_task {
    /**
     * No particular settings for this activity.
     */
    protected function define_my_settings() {
    }

    /**
     * Defines the backup steps.
     */
    protected function define_my_steps() {
        $this->add_step(new backup_aivirtualclassroom_activity_structure_step(
            'aivirtualclassroom_structure',
            'aivirtualclassroom.xml'
        ));
    }

    /**
     * Encodes links to this activity's pages so they can be restored.
     *
     * @param string $content
     * @return string
     */
    public static function encode_content_links($content) {
        global $CFG;
        $base = preg_quote($CFG->wwwroot, '/');
        $content = preg_replace(
            '/(' . $base . '\/mod\/aivirtualclassroom\/index.php\?id\=)([0-9]+)/',
            '$@AIVIRTUALCLASSROOMINDEX*$2@$',
            $content
        );
        $content = preg_replace(
            '/(' . $base . '\/mod\/aivirtualclassroom\/view.php\?id\=)([0-9]+)/',
            '$@AIVIRTUALCLASSROOMVIEWBYID*$2@$',
            $content
        );
        return $content;
    }
}
