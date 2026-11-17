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

use mod_aivirtualclassroom\local\meet;
use PHPUnit\Framework\Attributes\CoversClass;

#[CoversClass(meet::class)]
#[CoversClass(completion\custom_completion::class)]
#[CoversClass(task\send_recording_notification::class)]
/**
 * Tests for webhook event processing, attendance, hand raises and completion.
 *
 * @package    mod_aivirtualclassroom
 * @category   test
 * @copyright  2026 LMS Hosting Services
 * @license    https://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 * @covers     \mod_aivirtualclassroom\local\meet
 */
final class meet_test extends \advanced_testcase {
    /**
     * Use a fixed test connection so nothing calls LMS Labs.
     */
    protected function setUp(): void {
        global $CFG;
        parent::setUp();
        $this->resetAfterTest();
        $CFG->aivirtualclassroom_siteid = 'test.example.com';
        $CFG->aivirtualclassroom_secret = 'testsecret';
        $reset = new \ReflectionProperty(meet::class, 'cfg');
        $reset->setValue(null, null);
    }

    /**
     * Attendance and hand raises are stored once per event id and counted per user.
     */
    public function test_process_events_is_idempotent(): void {
        global $DB;
        $course = $this->getDataGenerator()->create_course();
        $student = $this->getDataGenerator()->create_and_enrol($course, 'student');
        $mod = $this->getDataGenerator()->create_module('aivirtualclassroom', ['course' => $course->id]);
        $events = [
            ['type' => 'attendance', 'uid' => $student->id, 'eid' => 'a1', 'joined' => 100, 'left' => 700, 'seconds' => 600],
            ['type' => 'attendance', 'uid' => $student->id, 'eid' => 'a2', 'joined' => 800, 'left' => 1100, 'seconds' => 300],
            ['type' => 'hand', 'uid' => $student->id, 'eid' => 'h1', 'ts' => 200],
            ['type' => 'hand', 'uid' => 0, 'eid' => 'h2', 'ts' => 200],
        ];
        $this->assertSame(3, meet::process_events((int)$mod->cmid, $events));
        $this->assertSame(0, meet::process_events((int)$mod->cmid, $events));
        $this->assertSame(900, meet::seconds_attended((int)$mod->id, (int)$student->id));
        $this->assertSame(1, meet::hand_raises((int)$mod->id, (int)$student->id));
        $this->assertSame(2, $DB->count_records('aivirtualclassroom_att', ['aivirtualclassroomid' => $mod->id]));
    }

    /**
     * A recording is only accepted under this site's and this activity's storage prefix.
     */
    public function test_process_events_recording_prefix(): void {
        global $DB;
        $course = $this->getDataGenerator()->create_course();
        $teacher = $this->getDataGenerator()->create_and_enrol($course, 'editingteacher');
        $mod = $this->getDataGenerator()->create_module('aivirtualclassroom', ['course' => $course->id, 'emailrecordings' => 0]);
        $good = ['type' => 'recording', 'uid' => $teacher->id, 'eid' => 'r1', 'key' => 'test.example.com/' . $mod->cmid . '/a.webm',
            'bytes' => 10, 'seconds' => 5, 'started' => 1, 'mime' => 'video/webm'];
        $bad = ['key' => 'other.example.com/' . $mod->cmid . '/b.webm', 'eid' => 'r2'] + $good;
        $this->assertSame(1, meet::process_events((int)$mod->cmid, [$good, $bad]));
        $this->assertSame(1, $DB->count_records('aivirtualclassroom_rec', ['aivirtualclassroomid' => $mod->id]));
    }

    /**
     * A new recording sends one message to each enrolled person, once.
     */
    public function test_recording_notification(): void {
        global $DB;
        $course = $this->getDataGenerator()->create_course();
        $teacher = $this->getDataGenerator()->create_and_enrol($course, 'editingteacher');
        $student = $this->getDataGenerator()->create_and_enrol($course, 'student');
        $mod = $this->getDataGenerator()->create_module('aivirtualclassroom', ['course' => $course->id, 'emailrecordings' => 1]);
        $this->expectOutputRegex('/notification sent to 2 users/');
        $sink = $this->redirectMessages();
        meet::process_events((int)$mod->cmid, [['type' => 'recording', 'uid' => $teacher->id, 'eid' => 'r1',
            'key' => 'test.example.com/' . $mod->cmid . '/a.webm', 'bytes' => 10, 'seconds' => 65, 'started' => 1000,
            'mime' => 'video/webm']]);
        $this->runAdhocTasks('\\mod_aivirtualclassroom\\task\\send_recording_notification');
        $messages = $sink->get_messages();
        $this->assertCount(2, $messages);
        $this->assertEqualsCanonicalizing(
            [(int)$teacher->id, (int)$student->id],
            array_map('intval', array_column($messages, 'useridto'))
        );
        $this->assertSame(1, (int)$DB->get_field('aivirtualclassroom_rec', 'notified', ['aivirtualclassroomid' => $mod->id]));
        $sink->clear();
        $this->runAdhocTasks('\\mod_aivirtualclassroom\\task\\send_recording_notification');
        $this->assertCount(0, $sink->get_messages());
    }

    /**
     * Custom completion: attended minutes and hand raises.
     */
    public function test_custom_completion(): void {
        $course = $this->getDataGenerator()->create_course(['enablecompletion' => 1]);
        $student = $this->getDataGenerator()->create_and_enrol($course, 'student');
        $mod = $this->getDataGenerator()->create_module('aivirtualclassroom', [
            'course' => $course->id,
            'completion' => COMPLETION_TRACKING_AUTOMATIC,
            'completionattendance' => 10,
            'completionhandraises' => 1,
        ]);
        $cm = get_fast_modinfo($course)->get_cm($mod->cmid);
        $completion = new completion\custom_completion($cm, (int)$student->id);
        $this->assertSame(COMPLETION_INCOMPLETE, $completion->get_state('completionattendance'));
        meet::process_events((int)$mod->cmid, [
            ['type' => 'attendance', 'uid' => $student->id, 'eid' => 'a1', 'joined' => 1, 'left' => 700, 'seconds' => 660],
            ['type' => 'hand', 'uid' => $student->id, 'eid' => 'h1', 'ts' => 5],
        ]);
        $this->assertSame(COMPLETION_COMPLETE, $completion->get_state('completionattendance'));
        $this->assertSame(COMPLETION_COMPLETE, $completion->get_state('completionhandraises'));
    }

    /**
     * Join tokens are signed with the site secret and carry the right role.
     */
    public function test_join_token(): void {
        $course = $this->getDataGenerator()->create_course();
        $student = $this->getDataGenerator()->create_and_enrol($course, 'student');
        $mod = $this->getDataGenerator()->create_module('aivirtualclassroom', ['course' => $course->id]);
        $cm = get_coursemodule_from_id('aivirtualclassroom', $mod->cmid);
        $token = meet::join_token($cm, \context_module::instance($cm->id), $student, '');
        [$header, $payload, $sig] = explode('.', $token);
        $this->assertSame(meet::b64url(hash_hmac('sha256', $header . '.' . $payload, 'testsecret', true)), $sig);
        $claims = json_decode(base64_decode(strtr($payload, '-_', '+/')), true);
        $this->assertSame('att', $claims['role']);
        $this->assertSame((string)$student->id, $claims['sub']);
    }

    /**
     * Interface strings for the room are the js_* strings only.
     */
    public function test_js_strings(): void {
        $strings = meet::js_strings();
        $this->assertArrayHasKey('js_mute', $strings);
        $this->assertSame('Mute', $strings['js_mute']);
        foreach (array_keys($strings) as $key) {
            $this->assertStringStartsWith('js_', $key);
        }
    }
}
