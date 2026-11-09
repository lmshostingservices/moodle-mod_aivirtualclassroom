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

namespace mod_aivirtualclassroom\privacy;

use core_privacy\local\metadata\collection;
use core_privacy\local\request\approved_contextlist;
use core_privacy\local\request\approved_userlist;
use core_privacy\local\request\contextlist;
use core_privacy\local\request\helper;
use core_privacy\local\request\userlist;
use core_privacy\local\request\writer;

/**
 * Privacy provider for AI Virtual Classroom.
 *
 * @package    mod_aivirtualclassroom
 * @copyright  2026 LMS Hosting Services
 * @license    https://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class provider implements
    \core_privacy\local\metadata\provider,
    \core_privacy\local\request\core_userlist_provider,
    \core_privacy\local\request\plugin\provider {
    /** @var array Tables keyed by user field. */
    const TABLES = [
        'aivirtualclassroom_att' => 'userid',
        'aivirtualclassroom_hand' => 'userid',
        'aivirtualclassroom_bo' => 'userid',
        'aivirtualclassroom_rec' => 'createdby',
        'aivirtualclassroom_note' => 'userid',
        'aivirtualclassroom_snote' => 'editedby',
    ];

    /**
     * Metadata.
     *
     * @param collection $collection
     * @return collection
     */
    public static function get_metadata(collection $collection): collection {
        $collection->add_database_table('aivirtualclassroom_att', [
            'userid' => 'privacy:metadata:userid', 'timejoined' => 'privacy:metadata:timejoined',
            'timeleft' => 'privacy:metadata:timeleft', 'seconds' => 'privacy:metadata:seconds',
        ], 'privacy:metadata:aivirtualclassroom_att');
        $collection->add_database_table('aivirtualclassroom_hand', [
            'userid' => 'privacy:metadata:userid', 'timecreated' => 'privacy:metadata:timecreated',
        ], 'privacy:metadata:aivirtualclassroom_hand');
        $collection->add_database_table('aivirtualclassroom_bo', [
            'userid' => 'privacy:metadata:userid', 'teacherid' => 'privacy:metadata:teacherid',
        ], 'privacy:metadata:aivirtualclassroom_bo');
        $collection->add_database_table('aivirtualclassroom_rec', [
            'createdby' => 'privacy:metadata:createdby', 'timecreated' => 'privacy:metadata:timecreated',
        ], 'privacy:metadata:aivirtualclassroom_rec');
        $collection->add_database_table('aivirtualclassroom_note', [
            'userid' => 'privacy:metadata:userid', 'content' => 'privacy:metadata:content',
            'timemodified' => 'privacy:metadata:timemodified',
        ], 'privacy:metadata:aivirtualclassroom_note');
        $collection->add_database_table('aivirtualclassroom_snote', [
            'editedby' => 'privacy:metadata:editedby', 'content' => 'privacy:metadata:content',
            'timemodified' => 'privacy:metadata:timemodified',
        ], 'privacy:metadata:aivirtualclassroom_snote');
        $collection->add_subsystem_link('core_files', [], 'privacy:metadata:core_files');
        $collection->add_external_location_link('cloudflare', [
            'fullname' => 'privacy:metadata:cloudflare:fullname',
            'picture' => 'privacy:metadata:cloudflare:picture',
            'media' => 'privacy:metadata:cloudflare:media',
        ], 'privacy:metadata:cloudflare');
        return $collection;
    }

    /**
     * SQL selecting aivirtualclassroom ids for a user.
     *
     * @return string
     */
    private static function user_instances_sql(): string {
        $parts = [];
        foreach (self::TABLES as $table => $field) {
            $parts[] = "SELECT aivirtualclassroomid FROM {{$table}} WHERE {$field} = :u_{$table}";
        }
        $parts[] = "SELECT aivirtualclassroomid FROM {aivirtualclassroom_bo} WHERE teacherid = :u_teacher";
        return implode(' UNION ', $parts);
    }

    /**
     * Contexts with user data.
     *
     * @param int $userid
     * @return contextlist
     */
    public static function get_contexts_for_userid(int $userid): contextlist {
        $params = ['modname' => 'aivirtualclassroom', 'ctxlevel' => CONTEXT_MODULE, 'u_teacher' => $userid];
        foreach (array_keys(self::TABLES) as $table) {
            $params['u_' . $table] = $userid;
        }
        $sql = "SELECT ctx.id
                  FROM {context} ctx
                  JOIN {course_modules} cm ON cm.id = ctx.instanceid AND ctx.contextlevel = :ctxlevel
                  JOIN {modules} m ON m.id = cm.module AND m.name = :modname
                 WHERE cm.instance IN (" . self::user_instances_sql() . ")";
        $list = new contextlist();
        $list->add_from_sql($sql, $params);
        // The class picture lives in the person's own user context.
        $list->add_from_sql(
            "SELECT DISTINCT ctx.id
                               FROM {context} ctx
                               JOIN {files} f ON f.contextid = ctx.id
                              WHERE ctx.contextlevel = :ulevel AND ctx.instanceid = :uid
                                AND f.component = :comp AND f.filearea = :area",
            ['ulevel' => CONTEXT_USER, 'uid' => $userid, 'comp' => 'mod_aivirtualclassroom', 'area' => 'avatar']
        );
        return $list;
    }

    /**
     * Users in a context.
     *
     * @param userlist $userlist
     */
    public static function get_users_in_context(userlist $userlist) {
        $context = $userlist->get_context();
        if ($context instanceof \context_user) {
            if (get_file_storage()->get_area_files($context->id, 'mod_aivirtualclassroom', 'avatar', 0, 'id', false)) {
                $userlist->add_user($context->instanceid);
            }
            return;
        }
        if (!$context instanceof \context_module) {
            return;
        }
        $cm = get_coursemodule_from_id('aivirtualclassroom', $context->instanceid);
        if (!$cm) {
            return;
        }
        foreach (self::TABLES as $table => $field) {
            $userlist->add_from_sql(
                $field,
                "SELECT {$field} FROM {{$table}} WHERE aivirtualclassroomid = :id",
                ['id' => $cm->instance]
            );
        }
        $userlist->add_from_sql(
            'teacherid',
            "SELECT teacherid FROM {aivirtualclassroom_bo} WHERE aivirtualclassroomid = :id",
            ['id' => $cm->instance]
        );
    }

    /**
     * Export.
     *
     * @param approved_contextlist $contextlist
     */
    public static function export_user_data(approved_contextlist $contextlist) {
        global $DB;
        $userid = $contextlist->get_user()->id;
        foreach ($contextlist->get_contexts() as $context) {
            if ($context instanceof \context_user && (int)$context->instanceid === (int)$userid) {
                writer::with_context($context)->export_area_files(
                    [get_string('pluginname', 'mod_aivirtualclassroom')],
                    'mod_aivirtualclassroom',
                    'avatar',
                    0
                );
                continue;
            }
            if (!$context instanceof \context_module) {
                continue;
            }
            $cm = get_coursemodule_from_id('aivirtualclassroom', $context->instanceid);
            if (!$cm) {
                continue;
            }
            $data = helper::get_context_data($context, $contextlist->get_user());
            $data->attendance = array_values(array_map(function ($r) {
                return ['joined' => \core_privacy\local\request\transform::datetime($r->timejoined),
                    'left' => \core_privacy\local\request\transform::datetime($r->timeleft), 'seconds' => $r->seconds];
            }, $DB->get_records('aivirtualclassroom_att', ['aivirtualclassroomid' => $cm->instance, 'userid' => $userid])));
            $data->handraises = array_values(array_map(function ($r) {
                return \core_privacy\local\request\transform::datetime($r->timecreated);
            }, $DB->get_records('aivirtualclassroom_hand', ['aivirtualclassroomid' => $cm->instance, 'userid' => $userid])));
            $data->notes = (string)$DB->get_field(
                'aivirtualclassroom_note',
                'content',
                ['aivirtualclassroomid' => $cm->instance, 'userid' => $userid]
            );
            $data->recordingscreated = $DB->count_records(
                'aivirtualclassroom_rec',
                ['aivirtualclassroomid' => $cm->instance, 'createdby' => $userid]
            );
            writer::with_context($context)->export_data([], $data);
        }
    }

    /**
     * Delete all data in a context.
     *
     * @param \context $context
     */
    public static function delete_data_for_all_users_in_context(\context $context) {
        global $DB;
        if ($context instanceof \context_user) {
            get_file_storage()->delete_area_files($context->id, 'mod_aivirtualclassroom', 'avatar');
            return;
        }
        if (!$context instanceof \context_module) {
            return;
        }
        $cm = get_coursemodule_from_id('aivirtualclassroom', $context->instanceid);
        if (!$cm) {
            return;
        }
        foreach (
            ['aivirtualclassroom_att', 'aivirtualclassroom_hand', 'aivirtualclassroom_bo',
            'aivirtualclassroom_note'] as $table
        ) {
            $DB->delete_records($table, ['aivirtualclassroomid' => $cm->instance]);
        }
        $DB->set_field('aivirtualclassroom_snote', 'editedby', 0, ['aivirtualclassroomid' => $cm->instance]);
        $DB->set_field('aivirtualclassroom_rec', 'createdby', 0, ['aivirtualclassroomid' => $cm->instance]);
    }

    /**
     * Delete one user's data.
     *
     * @param approved_contextlist $contextlist
     */
    public static function delete_data_for_user(approved_contextlist $contextlist) {
        $userid = $contextlist->get_user()->id;
        foreach ($contextlist->get_contexts() as $context) {
            self::delete_users($context, [$userid]);
        }
    }

    /**
     * Delete several users' data.
     *
     * @param approved_userlist $userlist
     */
    public static function delete_data_for_users(approved_userlist $userlist) {
        self::delete_users($userlist->get_context(), $userlist->get_userids());
    }

    /**
     * Shared deletion.
     *
     * @param \context $context
     * @param int[] $userids
     */
    private static function delete_users(\context $context, array $userids) {
        global $DB;
        if ($context instanceof \context_user) {
            if (in_array((int)$context->instanceid, array_map('intval', $userids), true)) {
                get_file_storage()->delete_area_files($context->id, 'mod_aivirtualclassroom', 'avatar');
            }
            return;
        }
        if (!$context instanceof \context_module || !$userids) {
            return;
        }
        $cm = get_coursemodule_from_id('aivirtualclassroom', $context->instanceid);
        if (!$cm) {
            return;
        }
        [$insql, $params] = $DB->get_in_or_equal($userids, SQL_PARAMS_NAMED);
        $params['id'] = $cm->instance;
        foreach (
            ['aivirtualclassroom_att', 'aivirtualclassroom_hand', 'aivirtualclassroom_bo',
            'aivirtualclassroom_note'] as $table
        ) {
            $DB->delete_records_select($table, "aivirtualclassroomid = :id AND userid $insql", $params);
        }
        $DB->set_field_select('aivirtualclassroom_snote', 'editedby', 0, "aivirtualclassroomid = :id AND editedby $insql", $params);
        $DB->delete_records_select('aivirtualclassroom_bo', "aivirtualclassroomid = :id AND teacherid $insql", $params);
        $DB->set_field_select('aivirtualclassroom_rec', 'createdby', 0, "aivirtualclassroomid = :id AND createdby $insql", $params);
    }
}
