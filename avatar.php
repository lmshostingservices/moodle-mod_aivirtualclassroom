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
 * Save or remove the class picture a person chose in the waiting room. Returns the new picture link and a fresh
 * join token that carries it, so everyone in the class sees it.
 *
 * @package    mod_aivirtualclassroom
 * @copyright  2026 LMS Hosting Services
 * @license    https://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

use mod_aivirtualclassroom\local\meet;

define('AJAX_SCRIPT', true);
require(__DIR__ . '/../../config.php');

$id = required_param('id', PARAM_INT);
[$course, $cm] = get_course_and_cm_from_cmid($id, 'aivirtualclassroom');
$aivirtualclassroom = $DB->get_record('aivirtualclassroom', ['id' => $cm->instance], '*', MUST_EXIST);
require_login($course, false, $cm);
$context = context_module::instance($cm->id);
require_capability('mod/aivirtualclassroom:join', $context);
require_sesskey();

$out = function (array $data, int $code = 200) {
    http_response_code($code);
    header('Content-Type: application/json');
    echo json_encode($data);
    exit;
};

$usercontext = context_user::instance($USER->id);
$fs = get_file_storage();

if (optional_param('remove', 0, PARAM_BOOL)) {
    $fs->delete_area_files($usercontext->id, 'mod_aivirtualclassroom', 'avatar');
} else {
    $data = (string)optional_param('data', '', PARAM_RAW); // pipeline-ignore: PARAM_RAW base64 image data URL, decoded and redrawn by GD below.
    if (!preg_match('~^data:image/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$~', $data, $m)) {
        $out(['error' => get_string('avatar_bad', 'mod_aivirtualclassroom')], 400);
    }
    $bytes = base64_decode($m[2], true);
    if ($bytes === false || strlen($bytes) > 2 * 1024 * 1024) {
        $out(['error' => get_string('avatar_bad', 'mod_aivirtualclassroom')], 400);
    }
    // Re-draw the picture as a small square JPEG: strips any hidden data and keeps it light for everyone.
    $src = @imagecreatefromstring($bytes);
    if (!$src) {
        $out(['error' => get_string('avatar_bad', 'mod_aivirtualclassroom')], 400);
    }
    $w = imagesx($src);
    $h = imagesy($src);
    $side = min($w, $h);
    $dst = imagecreatetruecolor(192, 192);
    imagefill($dst, 0, 0, imagecolorallocate($dst, 255, 255, 255));
    imagecopyresampled($dst, $src, 0, 0, (int)(($w - $side) / 2), (int)(($h - $side) / 2), 192, 192, $side, $side);
    ob_start();
    imagejpeg($dst, null, 86);
    $jpeg = ob_get_clean();
    imagedestroy($src);
    imagedestroy($dst);
    $fs->delete_area_files($usercontext->id, 'mod_aivirtualclassroom', 'avatar');
    $fs->create_file_from_string([
        'contextid' => $usercontext->id, 'component' => 'mod_aivirtualclassroom', 'filearea' => 'avatar',
        'itemid' => 0, 'filepath' => '/', 'filename' => 'avatar.jpg', 'userid' => $USER->id,
    ], $jpeg);
}

$picurl = meet::avatar_url($USER->id);
if (!$picurl) {
    $pic = new user_picture($USER);
    $pic->size = 100;
    $picurl = $pic->get_url($PAGE)->out(false);
}
$ismod = has_capability('mod/aivirtualclassroom:moderate', $context);
$token = meet::join_token($cm, $context, $USER, $picurl, $aivirtualclassroom->videopolicy, null,
    !$ismod && (int)$aivirtualclassroom->waitingroom === 2, (string)$aivirtualclassroom->keyterms, format_string($course->fullname));
$out(['pic' => $picurl, 'token' => $token, 'custom' => !optional_param('remove', 0, PARAM_BOOL)]);
