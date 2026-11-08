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

namespace mod_aivirtualclassroom\task;

/**
 * Message (popup + email) everyone in the course that a recording is ready.
 *
 * @package    mod_aivirtualclassroom
 * @copyright  2026 LMS Hosting Services
 * @license    https://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class send_recording_notification extends \core\task\adhoc_task {
    /**
     * Run the task.
     */
    public function execute() {
        global $DB;
        $data = $this->get_custom_data();
        $rec = $DB->get_record('aivirtualclassroom_rec', ['id' => $data->recordingid]);
        if (!$rec || $rec->notified) {
            return;
        }
        $aivirtualclassroom = $DB->get_record('aivirtualclassroom', ['id' => $rec->aivirtualclassroomid], '*', MUST_EXIST);
        $course = get_course($aivirtualclassroom->course);
        $cm = get_fast_modinfo($course)->instances['aivirtualclassroom'][$aivirtualclassroom->id] ?? null;
        if (!$cm) {
            return;
        }
        $context = \context_module::instance($cm->id);
        $url = new \moodle_url('/mod/aivirtualclassroom/play.php', ['id' => $cm->id, 'r' => $rec->id]);
        $a = (object)[
            'name' => format_string($aivirtualclassroom->name, true, ['context' => $context]),
            'course' => format_string($course->fullname, true, ['context' => \context_course::instance($course->id)]),
            'url' => $url->out(false),
            'date' => userdate($rec->timestarted ?: $rec->timecreated),
            'duration' => format_time($rec->seconds),
        ];
        $users = get_enrolled_users($context, 'mod/aivirtualclassroom:view', 0, 'u.*', null, 0, 0, true);
        $sent = 0;
        foreach ($users as $user) {
            if (!\core_availability\info_module::is_user_visible($cm, $user->id, false)) {
                continue;
            }
            $message = new \core\message\message();
            $message->component = 'mod_aivirtualclassroom';
            $message->name = 'recordingavailable';
            $message->userfrom = \core_user::get_noreply_user();
            $message->userto = $user;
            $message->courseid = $course->id;
            $message->subject = get_string('recordingemail_subject', 'mod_aivirtualclassroom', $a);
            $message->fullmessage = get_string('recordingemail_body', 'mod_aivirtualclassroom', $a);
            $message->fullmessageformat = FORMAT_PLAIN;
            $message->fullmessagehtml = get_string('recordingemail_html', 'mod_aivirtualclassroom', $a);
            $message->smallmessage = get_string('recordingemail_small', 'mod_aivirtualclassroom', $a);
            $message->notification = 1;
            $message->contexturl = $a->url;
            $message->contexturlname = get_string('watchrecording', 'mod_aivirtualclassroom');
            if (message_send($message)) {
                $sent++;
            }
        }
        $DB->set_field('aivirtualclassroom_rec', 'notified', 1, ['id' => $rec->id]);
        mtrace("mod_aivirtualclassroom: recording {$rec->id} notification sent to {$sent} users");
    }
}
