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
 * Signed webhook from the edge Worker: attendance, hand raises and recordings.
 *
 * @package    mod_aivirtualclassroom
 * @copyright  2026 LMS Hosting Services
 * @license    https://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

// phpcs:disable moodle.Files.RequireLogin.Missing -- authenticated by HMAC signature.
// Public on purpose: called by the AI Virtual Classroom Worker, not a browser. No require_login();
// every request must carry an HMAC-SHA256 signature made with the site secret, checked below.
define('NO_MOODLE_COOKIES', true);
define('AJAX_SCRIPT', true);

require(__DIR__ . '/../../config.php');

use mod_aivirtualclassroom\local\meet;

$body = file_get_contents('php://input');
$signature = $_SERVER['HTTP_X_LMSLIVELAB_SIGNATURE'] ?? '';

header('Content-Type: application/json');

if (!meet::is_configured() || $body === '' || !hash_equals(meet::sign($body), (string)$signature)) {
    http_response_code(403);
    echo json_encode(['ok' => false, 'error' => 'bad signature']);
    die;
}

$data = json_decode($body, true);
if (!is_array($data) || ($data['site'] ?? '') !== meet::config()->siteid || empty($data['cmid']) ||
        !isset($data['events']) || !is_array($data['events'])) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'bad payload']);
    die;
}

$stored = meet::process_events((int)$data['cmid'], $data['events']);
echo json_encode(['ok' => true, 'stored' => $stored]);
