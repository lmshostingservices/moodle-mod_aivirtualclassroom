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
use core_privacy\local\request\userlist;
use core_privacy\local\request\writer;
use core_privacy\tests\provider_testcase;
use PHPUnit\Framework\Attributes\CoversClass;

#[CoversClass(provider::class)]
/**
 * Privacy provider tests.
 *
 * @package    mod_aivirtualclassroom
 * @category   test
 * @copyright  2026 LMS Hosting Services
 * @license    https://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 * @covers     \mod_aivirtualclassroom\privacy\provider
 */
final class provider_test extends provider_testcase {
    /** @var \stdClass Activity. */
    protected $mod;
    /** @var \stdClass Student with data. */
    protected $student;
    /** @var \stdClass Second student with data. */
    protected $other;

    /**
     * Make an activity with notes and attendance for two students.
     */
    protected function setUp(): void {
        global $DB;
        parent::setUp();
        $this->resetAfterTest();
        $course = $this->getDataGenerator()->create_course();
        $this->student = $this->getDataGenerator()->create_and_enrol($course, 'student');
        $this->other = $this->getDataGenerator()->create_and_enrol($course, 'student');
        $this->mod = $this->getDataGenerator()->create_module('aivirtualclassroom', ['course' => $course->id]);
        foreach ([$this->student, $this->other] as $u) {
            $DB->insert_record('aivirtualclassroom_note', ['aivirtualclassroomid' => $this->mod->id, 'userid' => $u->id,
                'content' => 'Note of ' . $u->id, 'timemodified' => 1]);
            $DB->insert_record('aivirtualclassroom_att', ['aivirtualclassroomid' => $this->mod->id, 'userid' => $u->id,
                'eid' => 'a' . $u->id, 'timejoined' => 1, 'timeleft' => 61, 'seconds' => 60, 'bytesrx' => 0, 'bytestx' => 0]);
        }
    }

    /**
     * Metadata lists the tables and every outside service.
     */
    public function test_get_metadata(): void {
        $items = provider::get_metadata(new collection('mod_aivirtualclassroom'))->get_collection();
        $names = array_map(function ($i) {
            return $i->get_name();
        }, $items);
        foreach (['aivirtualclassroom_att', 'aivirtualclassroom_note', 'cloudflare', 'lmslabs', 'google'] as $name) {
            $this->assertContains($name, $names);
        }
    }

    /**
     * Contexts, users, export and delete.
     */
    public function test_export_and_delete(): void {
        global $DB;
        $context = \context_module::instance($this->mod->cmid);
        $contextlist = provider::get_contexts_for_userid((int)$this->student->id);
        $this->assertContains((int)$context->id, array_map('intval', $contextlist->get_contextids()));

        $userlist = new userlist($context, 'mod_aivirtualclassroom');
        provider::get_users_in_context($userlist);
        $this->assertEqualsCanonicalizing(
            [(int)$this->student->id, (int)$this->other->id],
            array_map('intval', $userlist->get_userids())
        );

        $approved = new approved_contextlist($this->student, 'mod_aivirtualclassroom', [$context->id]);
        provider::export_user_data($approved);
        $this->assertTrue(writer::with_context($context)->has_any_data());

        provider::delete_data_for_user($approved);
        $this->assertFalse($DB->record_exists('aivirtualclassroom_note', ['userid' => $this->student->id]));
        $this->assertTrue($DB->record_exists('aivirtualclassroom_note', ['userid' => $this->other->id]));

        provider::delete_data_for_users(new approved_userlist($context, 'mod_aivirtualclassroom', [$this->other->id]));
        $this->assertFalse($DB->record_exists('aivirtualclassroom_note', ['userid' => $this->other->id]));
    }

    /**
     * Deleting a whole context removes everyone's data.
     */
    public function test_delete_all_users_in_context(): void {
        global $DB;
        provider::delete_data_for_all_users_in_context(\context_module::instance($this->mod->cmid));
        $this->assertSame(0, $DB->count_records('aivirtualclassroom_note', ['aivirtualclassroomid' => $this->mod->id]));
        $this->assertSame(0, $DB->count_records('aivirtualclassroom_att', ['aivirtualclassroomid' => $this->mod->id]));
    }
}
