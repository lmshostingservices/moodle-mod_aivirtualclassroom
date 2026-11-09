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
 * Make an AI quiz from the class slides (teachers only).
 *
 * The browser sends the slide text here; this server asks LMS Labs to write the questions with the site's
 * Central Config credentials, so the API key never reaches the browser. AI quizzes are included in the class price.
 *
 * @package    mod_aivirtualclassroom
 * @copyright  2026 LMS Hosting Services
 * @license    https://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

define('NO_DEBUG_DISPLAY', true);
require(__DIR__ . '/../../config.php');
require_once($CFG->libdir . '/filelib.php');

use mod_aivirtualclassroom\local\meet;

$id = required_param('id', PARAM_INT);
$cm = get_coursemodule_from_id('aivirtualclassroom', $id, 0, false, MUST_EXIST);
$context = context_module::instance($cm->id);
require_login($cm->course, false, $cm);
require_capability('mod/aivirtualclassroom:moderate', $context);

$out = function (array $data, int $code = 200) {
    http_response_code($code);
    header('Content-Type: application/json');
    header('Cache-Control: no-store');
    echo json_encode($data);
    exit;
};

$in = json_decode(file_get_contents('php://input'), true);
if (!is_array($in) || !confirm_sesskey((string)($in['sesskey'] ?? ''))) {
    $out(['error' => get_string('invalidsesskey', 'error')], 403);
}
core\session\manager::write_close();

$types = array_values(array_intersect((array)($in['types'] ?? []), ['mcq', 'truefalse', 'matching', 'categorysort',
    'ordering', 'tapcard']));
$body = [
    'title' => core_text::substr(clean_param((string)($in['title'] ?? 'Quiz'), PARAM_TEXT), 0, 200),
    'text' => core_text::substr(
        clean_param((string)($in['text'] ?? ''), PARAM_RAW_TRIMMED), // Pipeline-ignore: PARAM_RAW_TRIMMED AI only.
        0,
        60000
    ),
    'count' => max(1, min(20, (int)($in['count'] ?? 5))),
    'types' => $types ?: ['mcq'],
    'voice' => !empty($in['voice']),
    'language' => current_language(),
];
if (core_text::strlen($body['text']) < 80) {
    $out(['error' => get_string('quiz_notext', 'mod_aivirtualclassroom')], 400);
}

[$siteid, $apikey, $server] = meet::credentials();
if ($siteid === '' || $apikey === '') {
    $out(['error' => get_string('notconfigured', 'mod_aivirtualclassroom')], 400);
}
$body['siteId'] = $siteid;
$body['apiKey'] = $apikey;

$curl = new curl(['ignoresecurity' => true]);
$res = $curl->post($server . '/api/lmslivelab/quiz', json_encode($body), [
    'CURLOPT_HTTPHEADER' => ['Content-Type: application/json'],
    'CURLOPT_TIMEOUT' => 240,
    'CURLOPT_CONNECTTIMEOUT' => 10,
]);
$code = (int)($curl->get_info()['http_code'] ?? 0);
$j = json_decode((string)$res, true);
if ($code === 402) {
    $out(['error' => get_string('quiz_credits', 'mod_aivirtualclassroom', (object)[
        'needed' => (int)($j['needed'] ?? 0), 'balance' => (int)($j['balance'] ?? 0)])], 402);
}
if ($code !== 200 || !is_array($j) || empty($j['questions'])) {
    $out(['error' => get_string('quiz_failed', 'mod_aivirtualclassroom')], 502);
}
$out(['questions' => $j['questions'], 'charged' => (int)($j['charged'] ?? 0), 'balance' => $j['balance'] ?? null]);
