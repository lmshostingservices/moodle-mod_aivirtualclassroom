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

namespace mod_aivirtualclassroom\completion;

use core_completion\activity_custom_completion;
use mod_aivirtualclassroom\local\meet;

/**
 * Custom completion: minutes attended and hand raises.
 *
 * @package    mod_aivirtualclassroom
 * @copyright  2026 LMS Hosting Services
 * @license    https://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class custom_completion extends activity_custom_completion {
    /**
     * Completion state for a rule.
     *
     * @param string $rule
     * @return int
     */
    public function get_state(string $rule): int {
        global $DB;
        $this->validate_rule($rule);
        $aivirtualclassroom = $DB->get_record(
            'aivirtualclassroom',
            ['id' => $this->cm->instance],
            'id, completionattendance, completionhandraises',
            MUST_EXIST
        );
        if ($rule === 'completionattendance') {
            $done = meet::seconds_attended(
                $aivirtualclassroom->id,
                $this->userid
            ) >= $aivirtualclassroom->completionattendance * 60;
        } else {
            $done = meet::hand_raises($aivirtualclassroom->id, $this->userid) >= $aivirtualclassroom->completionhandraises;
        }
        return $done ? COMPLETION_COMPLETE : COMPLETION_INCOMPLETE;
    }

    /**
     * Rules defined by this module.
     *
     * @return array
     */
    public static function get_defined_custom_rules(): array {
        return ['completionattendance', 'completionhandraises'];
    }

    /**
     * Human readable rule descriptions.
     *
     * @return array
     */
    public function get_custom_rule_descriptions(): array {
        $rules = $this->cm->customdata['customcompletionrules'] ?? [];
        return [
            'completionattendance' => get_string(
                'completiondetail:attendance',
                'mod_aivirtualclassroom',
                $rules['completionattendance'] ?? 0
            ),
            'completionhandraises' => get_string(
                (int)($rules['completionhandraises'] ?? 0) === 1 ? 'completiondetail:handraise' : 'completiondetail:handraises',
                'mod_aivirtualclassroom',
                $rules['completionhandraises'] ?? 0
            ),
        ];
    }

    /**
     * Display order.
     *
     * @return array
     */
    public function get_sort_order(): array {
        return ['completionview', 'completionattendance', 'completionhandraises'];
    }
}
