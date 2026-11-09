# AI Virtual Classroom: live classroom for Moodle™

AI Virtual Classroom is a live class activity for Moodle™ from LMS Labs. Install it and teach: there is nothing to host and nothing to configure. Live audio, video and screen shares run on LMS Labs live class servers with smart load balancing, so a class of 1 and a class of 500 get the same Full HD quality.

## Pricing

Pay as you go from your LMS Labs credits. **1 credit (US$0.10) = 2 learner-hours (5¢ per learner-hour).** Trainers are never counted. One fee covers everything: Full HD video, recordings kept for 12 months, captions and translation, AI class summaries, AI note summaries, AI quizzes and every other feature. No subscription, no cap, and nothing to pay when you are not teaching.

Example: 2 learners in a 1-hour class = 1 credit; 30 learners for an hour = 15 credits (US$1.50).

## Setup (2 minutes)

1. **Site administration → Plugins → Install plugins**: upload the ZIP and run the upgrade.
2. If LMS Labs Central Config already has your Site ID and API key, you are done. If not, enter them once in **LMS Labs Central Config** (or in the AI Virtual Classroom settings if Central Config is not installed).
3. Make sure cron runs (it sends the recording emails) and outgoing email works.
4. In a course, add an **AI Virtual Classroom** activity.

**Site administration → Plugins → Activity modules → AI Virtual Classroom** shows whether the site is connected. The only option there is whether students may share their screen.

Supports Moodle™ 4.5 and later.

## Features

**Core:** Full HD 1080p trainer camera, HD 720p learner cameras, Full HD screen share, audio, mute and camera controls, gallery and speaker views, screen sharing, chat with private messages and links, participant roster. Works in a browser on desktop and mobile with no download, and uses a link-based guest invite.

**Classroom:**
- **Breakout rooms**, one per teacher.
  - Students are assigned in Moodle: automatically (by shared group, then balanced) or by hand.
  - Rooms can auto-close on a timer, extend +5 minutes, or be closed with one click.
  - Teachers can visit any room and broadcast messages to all rooms.
  - **Everything works inside breakouts:** whiteboard, slides, notes, Q&A, polls, chat and captions.
- **Whiteboard:** pen, highlighter, eraser, colours and undo; can be saved as PNG. Teachers control whether students can draw (on by default in breakouts).
- **Slides:** upload a PDF or image. Every browser renders it locally and the presenter's page turns sync to everyone. Teachers can annotate slides with the whiteboard tools.
- **Polls**, including a one-click "Did that make sense?". Results stay hidden until the teacher shares them.
- **Live Q&A** with upvotes, anonymous questions (the teacher still sees who asked) and "mark answered".
- **Notes:**
  - Shared live notes per room.
  - Private notes for each student, auto-saved to Moodle.
  - Export as Markdown or HTML: students export their own notes; teachers export every room's shared notes and caption transcripts (in the meeting or from the activity page).
- **Captions and translation in one click.** One pop-up asks "Which language do you want the class in?" (search by language or country, grouped by region). Words appear instantly from the browser, then each sentence is corrected by AI (primed with the activity's key terms and the slide on screen) and translated by AI once per language, with the previous sentence as context. Students can also **hear the class in their language** (the speaker is turned down under a synthetic voice). Transcripts are saved to Moodle.
- **Student boards:** the teacher sends a question and every student gets their own board. The teacher sees all boards split-screen, can **mark all correct** or mark one, and annotate with pen, ticks, crosses and stamps. Each tile shows the student's picture and name; a student can hide either. Marks use green for correct and amber for "nearly", never red.
- **Flying emoji reactions** and **hand raising**.
- **Waiting room:**
  - Settings: off, guests only, or everyone except teachers.
  - Teachers can admit or deny people, lock the meeting, mute one person or everyone, turn a camera off, spotlight a student, and remove someone (they can't rejoin that session).
- **Background blur and noise suppression.**

**Moodle integration:**
- **Activity completion:** require "attended at least N minutes" and/or "raised hand at least N times". Time from reconnections is added together.
- **Attendance report:** minutes, connections, hand raises, learner-hours and completion, with CSV export.
- **Recordings:** the teacher records in their browser and the file streams to LMS Labs cloud storage while recording. When it stops, **every student is emailed a link** (Moodle notification + email). Playback links are signed and expire, and Moodle checks access first.
- **AI class summary** at the end of each class (from the captions, shared notes and slides), and an **AI summary** button for each learner's private notes.
- Calendar event, privacy API (GDPR export and delete), course reset, guest invite links.

## Known limits / notes
- **Recording** happens in the recording teacher's browser: it captures what that teacher sees, plus everyone's audio. Keep that tab open until "Recording saved" appears (the tab warns you if you try to close it).
- **Captions:** instant words come from the browser's Web Speech API (in Chrome, processed by Google); corrected sentences, translations and AI summaries are processed by LMS Labs cloud AI. Tell schools this for Privacy Act purposes, or leave captions off.
- **Background blur** uses the device's built-in blur if there is one. Otherwise it loads Google MediaPipe from a CDN (CPU-heavy on old laptops).
- **Remote control** of a shared screen isn't possible from a browser.
- **Backup/restore** isn't implemented yet: AI Virtual Classroom activities are skipped when a course is backed up or imported. Re-add them after restoring.
- Shared notes are designed for one or two editors at a time. Concurrent typing resyncs automatically but isn't a full collaborative editor.

---

Moodle™ is a registered trademark of Moodle Pty Ltd. LMS Labs is not affiliated with or endorsed by Moodle Pty Ltd.
