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
 * Data generator for mod_aivirtualclassroom.
 *
 * @package    mod_aivirtualclassroom
 * @copyright  2026 LMS Hosting Services
 * @license    https://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class mod_aivirtualclassroom_generator extends testing_module_generator {
    /**
     * Create an instance with sensible defaults.
     *
     * @param array|stdClass|null $record
     * @param array|null $options
     * @return stdClass
     */
    public function create_instance($record = null, ?array $options = null) {
        $record = (object)(array)$record;
        $defaults = ['duration' => 60, 'timeopen' => 0, 'videopolicy' => 'teachers', 'waitingroom' => 1, 'guestaccess' => 0,
            'emailrecordings' => 1, 'breakoutteachers' => '', 'completionattendance' => 0, 'completionhandraises' => 0];
        foreach ($defaults as $k => $v) {
            if (!isset($record->$k)) {
                $record->$k = $v;
            }
        }
        return parent::create_instance($record, (array)$options);
    }
}
