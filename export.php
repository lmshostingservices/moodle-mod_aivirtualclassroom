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
 * Export notes: a user's own private notes, or the shared notes of every room.
 *
 * Moderators get the shared notes of every room in every session. Students get the main room and
 * the breakout room they were assigned to.
 *
 * @package    mod_aivirtualclassroom
 * @copyright  2026 LMS Hosting Services
 * @license    https://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

require(__DIR__ . '/../../config.php');

$id = required_param('id', PARAM_INT);
$type = optional_param('type', 'mine', PARAM_ALPHA);
$format = optional_param('format', 'md', PARAM_ALPHA);

[$course, $cm] = get_course_and_cm_from_cmid($id, 'aivirtualclassroom');
$aivirtualclassroom = $DB->get_record('aivirtualclassroom', ['id' => $cm->instance], '*', MUST_EXIST);
require_login($course, false, $cm);
$context = context_module::instance($cm->id);
require_capability('mod/aivirtualclassroom:view', $context);

$title = format_string($aivirtualclassroom->name, true, ['context' => $context]);
$sections = [];
if ($type === 'shared') {
    $ismod = has_capability('mod/aivirtualclassroom:moderate', $context);
    $rows = $DB->get_records(
        'aivirtualclassroom_snote',
        ['aivirtualclassroomid' => $aivirtualclassroom->id],
        'session ASC, roomkey ASC'
    );
    $myroom = 't' . (int)$DB->get_field(
        'aivirtualclassroom_bo',
        'teacherid',
        ['aivirtualclassroomid' => $aivirtualclassroom->id, 'userid' => $USER->id]
    );
    foreach ($rows as $r) {
        $basekey = preg_replace('/^tx-/', '', $r->roomkey);
        if (!$ismod && $basekey !== 'main' && $basekey !== $myroom) {
            continue;
        }
        if (trim((string)$r->content) === '') {
            continue;
        }
        $sections[] = [userdate($r->session ?: $r->timemodified) . ' — ' . $r->roomname, (string)$r->content];
    }
    $label = get_string('sharednotes', 'mod_aivirtualclassroom');
} else {
    $content = (string)$DB->get_field(
        'aivirtualclassroom_note',
        'content',
        ['aivirtualclassroomid' => $aivirtualclassroom->id, 'userid' => $USER->id]
    );
    $sections[] = [fullname($USER), $content];
    $label = get_string('mynotes', 'mod_aivirtualclassroom');
}

$filename = clean_filename($title . ' - ' . $label);
if ($format === 'html') {
    $html = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>' . s($title) . '</title></head><body>';
    $html .= '<h1>' . s($title) . ' — ' . s($label) . '</h1>';
    foreach ($sections as [$heading, $text]) {
        $html .= '<h2>' . s($heading) . '</h2><pre style="white-space:pre-wrap;font-family:inherit">' . s($text) . '</pre>';
    }
    $html .= '</body></html>';
    send_file($html, $filename . '.html', 0, 0, true, true, 'text/html');
}
$md = "# {$title} — {$label}\n\n";
foreach ($sections as [$heading, $text]) {
    $md .= "## {$heading}\n\n{$text}\n\n";
}
if (count($sections) === 0) {
    $md .= get_string('nonotes', 'mod_aivirtualclassroom') . "\n";
}
send_file($md, $filename . '.md', 0, 0, true, true, 'text/markdown');
