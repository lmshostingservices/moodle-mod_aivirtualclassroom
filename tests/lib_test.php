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

namespace mod_aivirtualclassroom;

use PHPUnit\Framework\Attributes\CoversFunction;

#[CoversFunction('aivirtualclassroom_add_instance')]
#[CoversFunction('aivirtualclassroom_delete_instance')]
#[CoversFunction('aivirtualclassroom_reset_userdata')]
/**
 * Tests for lib.php callbacks: instances, calendar events, course reset and backup/restore.
 *
 * @package    mod_aivirtualclassroom
 * @category   test
 * @copyright  2026 LMS Hosting Services
 * @license    https://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 * @covers     ::aivirtualclassroom_add_instance
 */
final class lib_test extends \advanced_testcase {
    /**
     * Load lib.php.
     */
    public static function setUpBeforeClass(): void {
        global $CFG;
        require_once($CFG->dirroot . '/mod/aivirtualclassroom/lib.php');
        parent::setUpBeforeClass();
    }

    /**
     * Use a fixed test connection so nothing calls LMS Labs.
     */
    protected function setUp(): void {
        global $CFG;
        parent::setUp();
        $this->resetAfterTest();
        $CFG->aivirtualclassroom_siteid = 'test.example.com';
        $CFG->aivirtualclassroom_secret = 'testsecret';
    }

    /**
     * Deletes a course module (format actions on Moodle 5.2+, the older function before).
     *
     * @param int $courseid
     * @param int $cmid
     */
    protected function delete_cm(int $courseid, int $cmid): void {
        if (method_exists(\core_courseformat\local\cmactions::class, 'delete')) {
            \core_courseformat\formatactions::cm($courseid)->delete($cmid);
        } else {
            course_delete_module($cmid);
        }
    }

    /**
     * Duplicates a course module (format actions on Moodle 5.2+, the older function before).
     *
     * @param \stdClass $course
     * @param int $cmid
     * @return \stdClass|\cm_info The new course module.
     */
    protected function duplicate_cm(\stdClass $course, int $cmid) {
        if (method_exists(\core_courseformat\local\cmactions::class, 'duplicate')) {
            return \core_courseformat\formatactions::cm($course->id)->duplicate($cmid);
        }
        return duplicate_module($course, get_fast_modinfo($course)->get_cm($cmid));
    }

    /**
     * Adds some user data to an activity.
     *
     * @param \stdClass $mod
     * @param \stdClass $student
     * @param \stdClass $teacher
     */
    protected function add_user_data(\stdClass $mod, \stdClass $student, \stdClass $teacher): void {
        global $DB;
        $id = $mod->id;
        $DB->insert_record('aivirtualclassroom_att', ['aivirtualclassroomid' => $id, 'userid' => $student->id, 'eid' => 'a1',
            'timejoined' => 1, 'timeleft' => 61, 'seconds' => 60, 'bytesrx' => 0, 'bytestx' => 0]);
        $DB->insert_record('aivirtualclassroom_hand', ['aivirtualclassroomid' => $id, 'userid' => $student->id, 'eid' => 'h1',
            'timecreated' => 1]);
        $DB->insert_record('aivirtualclassroom_bo', ['aivirtualclassroomid' => $id, 'userid' => $student->id,
            'teacherid' => $teacher->id]);
        $DB->insert_record('aivirtualclassroom_note', ['aivirtualclassroomid' => $id, 'userid' => $student->id,
            'content' => 'My note', 'timemodified' => 1]);
        $DB->insert_record('aivirtualclassroom_snote', ['aivirtualclassroomid' => $id, 'session' => 1,
            'roomkey' => 't' . $teacher->id, 'roomname' => 'Room', 'content' => 'Shared', 'editedby' => $student->id,
            'timemodified' => 1]);
    }

    /**
     * Adding an instance makes a guest key and a calendar event; deleting removes everything.
     */
    public function test_add_and_delete_instance(): void {
        global $DB;
        $course = $this->getDataGenerator()->create_course();
        $student = $this->getDataGenerator()->create_and_enrol($course, 'student');
        $teacher = $this->getDataGenerator()->create_and_enrol($course, 'editingteacher');
        $mod = $this->getDataGenerator()->create_module(
            'aivirtualclassroom',
            ['course' => $course->id, 'timeopen' => time() + 3600]
        );
        $record = $DB->get_record('aivirtualclassroom', ['id' => $mod->id]);
        $this->assertSame(32, strlen($record->guestkey));
        $this->assertTrue($DB->record_exists('event', ['modulename' => 'aivirtualclassroom', 'instance' => $mod->id]));
        $this->add_user_data($mod, $student, $teacher);
        $this->delete_cm((int)$course->id, (int)$mod->cmid);
        $this->assertFalse($DB->record_exists('aivirtualclassroom', ['id' => $mod->id]));
        $this->assertFalse($DB->record_exists('aivirtualclassroom_note', ['aivirtualclassroomid' => $mod->id]));
        $this->assertFalse($DB->record_exists('event', ['modulename' => 'aivirtualclassroom', 'instance' => $mod->id]));
    }

    /**
     * Course reset removes user data.
     */
    public function test_reset_userdata(): void {
        global $DB;
        $course = $this->getDataGenerator()->create_course();
        $student = $this->getDataGenerator()->create_and_enrol($course, 'student');
        $teacher = $this->getDataGenerator()->create_and_enrol($course, 'editingteacher');
        $mod = $this->getDataGenerator()->create_module('aivirtualclassroom', ['course' => $course->id]);
        $this->add_user_data($mod, $student, $teacher);
        $status = aivirtualclassroom_reset_userdata((object)['courseid' => $course->id, 'reset_aivirtualclassroom_all' => 1]);
        $this->assertCount(1, $status);
        foreach (['att', 'hand', 'bo', 'note', 'snote'] as $t) {
            $this->assertSame(0, $DB->count_records('aivirtualclassroom_' . $t, ['aivirtualclassroomid' => $mod->id]));
        }
    }

    /**
     * Duplicating an activity (backup and restore without user data) copies its settings and makes a new guest key.
     */
    public function test_duplicate(): void {
        global $DB;
        $this->setAdminUser();
        $course = $this->getDataGenerator()->create_course();
        $mod = $this->getDataGenerator()->create_module('aivirtualclassroom', ['course' => $course->id,
            'keyterms' => 'photosynthesis', 'videopolicy' => 'all', 'guestaccess' => 1, 'completionhandraises' => 2]);
        $newcm = $this->duplicate_cm($course, (int)$mod->cmid);
        $old = $DB->get_record('aivirtualclassroom', ['id' => $mod->id]);
        $new = $DB->get_record('aivirtualclassroom', ['id' => $newcm->instance]);
        foreach (['keyterms', 'videopolicy', 'guestaccess', 'completionhandraises', 'duration', 'waitingroom'] as $field) {
            $this->assertEquals($old->$field, $new->$field, $field);
        }
        $this->assertNotEquals($old->guestkey, $new->guestkey);
        $this->assertSame(32, strlen($new->guestkey));
    }

    /**
     * A course backup with user data restores attendance, hand raises, breakouts and notes into a new course.
     */
    public function test_backup_restore_with_userdata(): void {
        global $CFG, $DB, $USER;
        require_once($CFG->dirroot . '/backup/util/includes/backup_includes.php');
        require_once($CFG->dirroot . '/backup/util/includes/restore_includes.php');
        $this->setAdminUser();
        $CFG->enableavailability = true;
        $course = $this->getDataGenerator()->create_course();
        $student = $this->getDataGenerator()->create_and_enrol($course, 'student');
        $teacher = $this->getDataGenerator()->create_and_enrol($course, 'editingteacher');
        $mod = $this->getDataGenerator()->create_module('aivirtualclassroom', ['course' => $course->id,
            'breakoutteachers' => (string)$teacher->id]);
        $this->add_user_data($mod, $student, $teacher);

        $bc = new \backup_controller(
            \backup::TYPE_1COURSE,
            $course->id,
            \backup::FORMAT_MOODLE,
            \backup::INTERACTIVE_NO,
            \backup::MODE_GENERAL,
            $USER->id
        );
        $bc->get_plan()->get_setting('users')->set_value(true);
        $bc->execute_plan();
        $file = $bc->get_results()['backup_destination'];
        $bc->destroy();
        $dir = 'aivctest' . time();
        $file->extract_to_pathname(get_file_packer('application/vnd.moodle.backup'), make_backup_temp_directory($dir));

        $newcourseid = \restore_dbops::create_new_course('Restored', 'R1', $course->category);
        $rc = new \restore_controller(
            $dir,
            $newcourseid,
            \backup::INTERACTIVE_NO,
            \backup::MODE_GENERAL,
            $USER->id,
            \backup::TARGET_NEW_COURSE
        );
        $rc->get_plan()->get_setting('users')->set_value(true);
        $this->assertTrue($rc->execute_precheck());
        $rc->execute_plan();
        $rc->destroy();

        $new = $DB->get_record('aivirtualclassroom', ['course' => $newcourseid], '*', MUST_EXIST);
        $this->assertSame((string)$teacher->id, $new->breakoutteachers);
        foreach (['att', 'hand', 'bo', 'note', 'snote'] as $t) {
            $this->assertSame(1, $DB->count_records('aivirtualclassroom_' . $t, ['aivirtualclassroomid' => $new->id]), $t);
        }
        $snote = $DB->get_record('aivirtualclassroom_snote', ['aivirtualclassroomid' => $new->id]);
        $this->assertSame('t' . $teacher->id, $snote->roomkey);
        $this->assertSame(0, $DB->count_records('aivirtualclassroom_rec', ['aivirtualclassroomid' => $new->id]));
    }
}
