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
 * Convert an uploaded PowerPoint (or other presentation) to PDF for presenting in the room.
 *
 * Uses LibreOffice on this server when it is installed (keeps the slide text for captions), otherwise the
 * LMS Labs conversion service with the site's Central Config credentials (sent server-side, never to the browser).
 *
 * @package    mod_aivirtualclassroom
 * @copyright  2026 LMS Hosting Services
 * @license    https://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

define('NO_DEBUG_DISPLAY', true);
require(__DIR__ . '/../../config.php');

use mod_aivirtualclassroom\local\meet;
use mod_aivirtualclassroom\local\pptx;

$id = required_param('id', PARAM_INT);
$cm = get_coursemodule_from_id('aivirtualclassroom', $id, 0, false, MUST_EXIST);
$context = context_module::instance($cm->id);
require_login($cm->course, false, $cm);
require_sesskey();
require_capability('mod/aivirtualclassroom:join', $context);
core\session\manager::write_close();

$fail = function (string $msg, int $code = 400) {
    http_response_code($code);
    header('Content-Type: application/json');
    echo json_encode(['error' => $msg]);
    exit;
};

if (empty($_FILES['file']) || !is_uploaded_file($_FILES['file']['tmp_name'])) {
    $fail(get_string('pptx_nofile', 'mod_aivirtualclassroom'));
}
$name = clean_param($_FILES['file']['name'], PARAM_FILE);
$ext = strtolower(pathinfo($name, PATHINFO_EXTENSION));
if (!in_array($ext, array_merge(pptx::SHOWS, pptx::DOCS), true)) {
    $fail(get_string('pptx_type', 'mod_aivirtualclassroom'));
}
if ($_FILES['file']['size'] > pptx::MAX_BYTES) {
    $fail(get_string('pptx_toobig', 'mod_aivirtualclassroom'));
}

try {
    [$type, $data, $pages] = pptx::convert($_FILES['file']['tmp_name'], $ext);
} catch (\moodle_exception $e) {
    $fail($e->getMessage(), 502);
} catch (\Throwable $e) {
    debugging($e->getMessage(), DEBUG_DEVELOPER);
    $fail(get_string('pptx_failed', 'mod_aivirtualclassroom'), 502);
}

header('Content-Type: ' . ($type === 'show' ? 'image/svg+xml' : 'application/pdf'));
header('X-LiveLab-Type: ' . $type);
header('X-LiveLab-Pages: ' . $pages);
header('Content-Length: ' . strlen($data));
header('Cache-Control: no-store');
echo $data;
