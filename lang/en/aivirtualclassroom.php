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
 * English strings for AI Virtual Classroom.
 *
 * @package    mod_aivirtualclassroom
 * @copyright  2026 LMS Hosting Services
 * @license    https://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

defined('MOODLE_INTERNAL') || die();

$string['accessheader'] = 'Access and waiting room';
$string['aisummary'] = 'AI class summary';
$string['aisummarynote'] = 'Written automatically at the end of each class from the captions, shared notes and slides. Turn on captions during class for the fullest summary.';
$string['aivirtualclassroom:addinstance'] = 'Add a new AI Virtual Classroom activity';
$string['aivirtualclassroom:join'] = 'Join meetings';
$string['aivirtualclassroom:managebreakouts'] = 'Manage breakout room assignments';
$string['aivirtualclassroom:moderate'] = 'Moderate meetings (mute, breakouts, recording)';
$string['aivirtualclassroom:view'] = 'View AI Virtual Classroom activities and recordings';
$string['aivirtualclassroom:viewreport'] = 'View attendance report';
$string['allteachers'] = 'All teachers in the course';
$string['assignmentscleared'] = 'All breakout assignments were cleared.';
$string['attendancereport'] = 'Attendance report';
$string['autoassign'] = 'Auto-assign unassigned students';
$string['autoassigned'] = '{$a} students assigned.';
$string['avatar_bad'] = 'That picture could not be used. Try a JPG or PNG photo.';
$string['bandwidth'] = 'Bandwidth';
$string['breakouts'] = 'Breakout rooms';
$string['breakouts_intro'] = 'Each teacher gets their own breakout room. Assign students to a teacher below, or use auto-assign: students who share a course group with a teacher go to that teacher, everyone else is balanced evenly. When a moderator opens breakout rooms during the meeting, everyone is moved automatically and can be brought back with one click.';
$string['breakoutteachers'] = 'Teachers with a breakout room';
$string['breakoutteachers_help'] = 'Choose which teachers get their own breakout room. Leave empty to give every teacher (anyone who can moderate this activity) a room.';
$string['captions'] = 'Captions and translation';
$string['central_active'] = '<strong>&#10004; Central Config active</strong> &mdash; Site ID and API key are provided by <a href="{$a}">LMS Labs Central Config</a>.';
$string['central_incomplete'] = '<strong>&#9888; Central Config installed but incomplete</strong> &mdash; enter your Site ID and API key in <a href="{$a}">LMS Labs Central Config</a>.';
$string['central_missing'] = '<strong>Central Config not installed</strong> &mdash; install LMS Labs Central Config to share your Site ID and API key across all LMS Labs plugins, or enter them below.';
$string['clearassignments'] = 'Clear all assignments';
$string['completionattendance'] = 'Attend for at least (minutes)';
$string['completionattendancegroup'] = 'Require attendance';
$string['completionattendancegroup_help'] = 'The student must be connected to the meeting (main room or a breakout room) for at least this many minutes in total. Time from separate sessions and reconnections is added together.';
$string['completiondetail:attendance'] = 'Attend for {$a} minutes';
$string['completiondetail:handraise'] = 'Raise hand once';
$string['completiondetail:handraises'] = 'Raise hand {$a} times';
$string['completionhandraises'] = 'Raise hand at least (times)';
$string['completionhandraisesgroup'] = 'Require hand raises';
$string['completionhandraisesgroup_help'] = 'The student must raise their hand during the meeting at least this many times in total.';
$string['completionrules'] = 'Completion requires: {$a}';
$string['confirmdeleterecording'] = 'Delete the recording from {$a}? This cannot be undone.';
$string['connected'] = '<strong>&#10004; AI Virtual Classroom connected</strong> &mdash; live classes are ready for {$a} and are billed to your LMS Labs credits.';
$string['connections'] = 'Connections';
$string['copied'] = 'Copied';
$string['copylink'] = 'Copy link';
$string['datareceived'] = 'Data received (MB)';
$string['downloadcsv'] = 'Download CSV';
$string['duration'] = 'Duration (minutes)';
$string['emailrecordings'] = 'Email recordings to students';
$string['emailrecordings_help'] = 'When a moderator stops a recording, everyone who can see this activity receives a notification (email and Moodle notification by default) with a link to watch it.';
$string['err_badkey'] = 'LMS Labs did not recognise this Site ID and API key. Check them in Central Config.';
$string['err_duration'] = 'Enter a duration between 1 and 1440 minutes.';
$string['err_notestoolong'] = 'Your notes are too long to save.';
$string['err_positive'] = 'Enter a number greater than zero.';
$string['err_service'] = 'The LMS Labs service could not be reached. This page tries again automatically; refresh in a few minutes.';
$string['exportmynotes'] = 'Export my notes';
$string['exportsharednotes'] = 'Export shared notes & transcripts';
$string['firstjoined'] = 'First joined';
$string['guestaccess'] = 'Allow guests with an invite link';
$string['guestaccess_help'] = 'People without a Moodle account (parents, guest speakers) can join with a secret link shown to teachers on the activity page and in the meeting. Guests are never moderators and their attendance is not recorded in Moodle.';
$string['guestinvite'] = 'Copy invite';
$string['guestinvite_how'] = 'No account or login is needed: open the link, type your name and join. Please use Chrome, Edge or Safari and allow your camera and microphone when asked.';
$string['guestinvite_howwait'] = 'No account or login is needed: open the link, type your name and the teacher will let you in. Please use Chrome, Edge or Safari and allow your camera and microphone when asked.';
$string['guestinvite_intro'] = 'You are invited to join the live online class "{$a->title}" ({$a->course}).';
$string['guestinvite_link'] = 'Join here: {$a}';
$string['guestinvite_when'] = 'When: {$a}';
$string['guestinvitecopied'] = 'Invite copied. Paste it into an email or chat.';
$string['guestlink'] = 'Guest invite link (anyone with this link can join)';
$string['guestlinkinvalid'] = 'This invite link is not valid or guest access is turned off.';
$string['handraises'] = 'Hand raises';
$string['join'] = 'Join meeting';
$string['keyterms'] = 'Key terms';
$string['keyterms_help'] = 'Words and names that come up in this class, separated by commas: subject jargon, unit codes, product names, people\'s names. They are given to speech recognition and to the translator so captions spell them correctly and translations keep them consistent. Text on the slide being presented is used automatically too.';
$string['keyterms_placeholder'] = 'e.g. AVETMISS, BSBLDR811, Moodle, competency, RPL';
$string['lastleft'] = 'Last left';
$string['learnersummary'] = 'Learner time in this activity: {$a->hours} learner-hours, about {$a->credits} LMS Labs credits (1 credit = 2 learner-hours). Trainers are never counted.';
$string['mainroomunassigned'] = 'Main room (unassigned)';
$string['managebreakouts'] = 'Breakout rooms';
$string['messageprovider:recordingavailable'] = 'A meeting recording is available';
$string['minutesattended'] = 'Minutes';
$string['modulename'] = 'AI Virtual Classroom';
$string['modulename_help'] = 'AI Virtual Classroom is a live classroom for Moodle with Full HD video, screen sharing, whiteboard, PowerPoint and PDF slides with animations, breakout rooms, polls, Q&A, live captions and translation, AI class summaries, AI quizzes and recordings. Attendance and hand raises can be used for activity completion.';
$string['modulenameplural'] = 'AI Virtual Classrooms';
$string['mynotes'] = 'My notes';
$string['nonotes'] = 'No notes yet.';
$string['norecordings'] = 'No recordings yet.';
$string['notconfigured'] = 'AI Virtual Classroom needs your LMS Labs Site ID and API key. A site administrator enters them once in LMS Labs Central Config.';
$string['notconnected'] = '<strong>&#9888; AI Virtual Classroom not connected yet.</strong>';
$string['noteachers'] = 'There are no teachers with a breakout room. Enrol a teacher, or check the "Teachers with a breakout room" activity setting.';
$string['notopenyet'] = 'The meeting room opens at {$a}.';
$string['pluginadministration'] = 'AI Virtual Classroom administration';
$string['pluginname'] = 'AI Virtual Classroom';
$string['pptx_failed'] = 'The file could not be converted. Try again, or save it as PDF and upload that.';
$string['pptx_nocredentials'] = 'PowerPoint upload needs the LMS Labs Site ID and API key in Central Config.';
$string['pptx_nofile'] = 'No presentation was uploaded.';
$string['pptx_toobig'] = 'Files must be under 30 MB. Compress the pictures in it and try again.';
$string['pptx_type'] = 'Upload a PowerPoint, Word, Excel, OpenDocument, PDF or image file.';
$string['privacy:metadata:aivirtualclassroom_att'] = 'Times each user was connected to a meeting.';
$string['privacy:metadata:aivirtualclassroom_bo'] = 'Breakout room assignments.';
$string['privacy:metadata:aivirtualclassroom_hand'] = 'Hand raises during meetings.';
$string['privacy:metadata:aivirtualclassroom_note'] = 'Private notes each user writes during meetings.';
$string['privacy:metadata:aivirtualclassroom_rec'] = 'Recordings of meetings.';
$string['privacy:metadata:aivirtualclassroom_snote'] = 'Shared notes and caption transcripts of each room.';
$string['privacy:metadata:cloudflare'] = 'Live audio, video and screen shares are relayed through LMS Labs live class servers, and recordings are stored in LMS Labs cloud storage. Your name and profile picture are shown to other participants.';
$string['privacy:metadata:cloudflare:fullname'] = 'Your full name, shown to other participants.';
$string['privacy:metadata:cloudflare:media'] = 'Your audio, video and screen share while in the meeting, and the session recording if one is made.';
$string['privacy:metadata:cloudflare:picture'] = 'Your profile picture URL.';
$string['privacy:metadata:content'] = 'The note text.';
$string['privacy:metadata:core_files'] = 'The class picture a person chooses in the waiting room is kept in their own files and shown to others in their classes.';
$string['privacy:metadata:createdby'] = 'The user who made the recording.';
$string['privacy:metadata:editedby'] = 'The user who last edited the shared notes.';
$string['privacy:metadata:seconds'] = 'Number of seconds connected.';
$string['privacy:metadata:teacherid'] = 'The teacher whose room the user is assigned to.';
$string['privacy:metadata:timecreated'] = 'The time the record was created.';
$string['privacy:metadata:timejoined'] = 'The time the user joined.';
$string['privacy:metadata:timeleft'] = 'The time the user left.';
$string['privacy:metadata:timemodified'] = 'The time the note was last saved.';
$string['privacy:metadata:userid'] = 'The user ID.';
$string['quiz_credits'] = 'Not enough LMS Labs credits for this quiz: it needs {$a->needed} and the balance is {$a->balance}. Top up at lms-labs.com, or make a shorter quiz.';
$string['quiz_failed'] = 'The quiz could not be made just now. Please try again.';
$string['quiz_notext'] = 'These slides have too little text to make questions from.';
$string['rebalance'] = 'Re-balance everyone';
$string['recordingdeleted'] = 'Recording deleted.';
$string['recordingemail_body'] = 'Hi,

A recording of "{$a->name}" ({$a->course}) from {$a->date} is now available ({$a->duration}).

Watch it here: {$a->url}';
$string['recordingemail_html'] = '<p>Hi,</p><p>A recording of <strong>{$a->name}</strong> ({$a->course}) from {$a->date} is now available ({$a->duration}).</p><p><a href="{$a->url}">Watch the recording</a></p>';
$string['recordingemail_small'] = 'Recording of {$a->name} is ready to watch';
$string['recordingemail_subject'] = 'Recording available: {$a->name}';
$string['recordinglength'] = 'Length';
$string['recordingof'] = 'Recording from {$a}';
$string['recordings'] = 'Recordings';
$string['resetall'] = 'Delete attendance, hand raises and breakout assignments';
$string['room'] = 'Room';
$string['roomname'] = '{$a}\'s room';
$string['schedule'] = 'Schedule';
$string['scheduledfor'] = 'Scheduled for {$a->start} ({$a->duration})';
$string['sessionended'] = 'The scheduled session has finished. You can still watch any recordings below.';
$string['settings_apikey'] = 'API key';
$string['settings_apikey_desc'] = 'Your LMS Labs API key. Used only when Central Config is not installed.';
$string['settings_central'] = 'There is nothing else to set up. Classes are billed to your LMS Labs credits: 1 credit = 2 learner-hours, and trainers are never counted.';
$string['settings_connection'] = 'LMS Labs connection';
$string['settings_nocentral'] = 'Install LMS Labs Central Config (local_aiconfig) to manage the Site ID and API key once for all LMS Labs plugins, or enter them below.';
$string['settings_siteid'] = 'Site ID';
$string['settings_siteid_desc'] = 'Your LMS Labs Site ID. Used only when Central Config is not installed.';
$string['settings_studentscreenshare'] = 'Students can share their screen';
$string['settings_studentscreenshare_desc'] = 'If off, only moderators can share their screen.';
$string['sharednotes'] = 'Shared notes & transcripts';
$string['teacherrole'] = 'Teacher';
$string['timeopen'] = 'Start time';
$string['timeopen_help'] = 'Students can join from 15 minutes before this time. Teachers can join at any time. Leave disabled for an always-open room.';
$string['videopolicy'] = 'Cameras';
$string['videopolicy_all'] = 'Everyone can use their camera';
$string['videopolicy_help'] = 'The biggest bandwidth saver. With "Teachers only", student cameras are not sent at all, which typically cuts data use by 70–90% for a large class. Teachers can change this live for each room, and can spotlight one student\'s camera at any time.';
$string['videopolicy_none'] = 'Audio only (no cameras)';
$string['videopolicy_teachers'] = 'Teachers only (recommended for large classes)';
$string['waitingforlmslabs'] = 'AI Virtual Classroom is connecting to LMS Labs. There is nothing to enter: your Site ID and API key are already in Central Config. Please try again in a few minutes.';
$string['waitingroom'] = 'Waiting room';
$string['waitingroom_all'] = 'Everyone except teachers waits to be admitted';
$string['waitingroom_guests'] = 'Only guests wait to be admitted';
$string['waitingroom_help'] = 'People in the waiting room cannot see or hear the meeting until a teacher admits them. Attendance starts counting when they are admitted.';
$string['waitingroom_off'] = 'Off';
$string['watchrecording'] = 'Watch recording';
$string['yourname'] = 'Your name';
$string['yourprogress'] = 'You have attended {$a->minutes} minutes and raised your hand {$a->hands} times.';
