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
 * Serves a class picture. Links are signed, so pictures show to the class and to guests without a login.
 *
 * @package    mod_aivirtualclassroom
 * @copyright  2026 LMS Hosting Services
 * @license    https://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

use mod_aivirtualclassroom\local\meet;

// pipeline-no-login: Class pictures are loaded by the live classroom without a Moodle session; each URL carries a signed key checked below.
define('NO_MOODLE_COOKIES', true);
require(__DIR__ . '/../../config.php');
require_once($CFG->libdir . '/filelib.php');

$userid = required_param('u', PARAM_INT);
$rev = required_param('r', PARAM_INT);
$key = required_param('k', PARAM_ALPHANUM);

$file = meet::avatar_file($userid);
if (!$file || (int)$file->get_timemodified() !== $rev || !hash_equals(meet::avatar_key($userid, $rev), $key)) {
    send_file_not_found();
}
send_stored_file($file, YEARSECS, 0, false, ['cacheability' => 'public', 'immutable' => true]);
