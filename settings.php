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
 * Admin settings for AI Virtual Classroom.
 *
 * @package    mod_aivirtualclassroom
 * @copyright  2026 LMS Hosting Services
 * @license    https://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

defined('MOODLE_INTERNAL') || die();

if ($ADMIN->fulltree) {
    $centralinstalled = file_exists($CFG->dirroot . '/local/aiconfig/version.php');
    $central = (new moodle_url('/admin/settings.php', ['section' => 'local_aiconfig']))->out();
    $box = function (string $kind, string $html): string {
        $styles = [
            'ok' => 'background:#d4edda;border:1px solid #c3e6cb;color:#155724;',
            'warn' => 'background:#fff3cd;border:1px solid #ffeaa7;color:#856404;',
            'info' => 'background:#f8f9fa;border:1px solid #dee2e6;color:#383d41;',
        ];
        return '<div style="' . $styles[$kind] . 'padding:10px 14px;border-radius:4px;margin-bottom:12px;">' . $html . '</div>';
    };
    $html = '';
    if (!during_initial_install() && !empty($CFG->version)) {
        try {
            [$siteid, $apikey] = \mod_aivirtualclassroom\local\meet::credentials();
            $ok = \mod_aivirtualclassroom\local\meet::is_configured();
            $err = (string)get_config('mod_aivirtualclassroom', 'sitekeyerror');
        } catch (\Throwable $e) {
            $siteid = $apikey = '';
            $ok = false;
            $err = $e->getMessage();
        }
        // 1. Central Config, shown the same way as every LMS Labs plugin.
        $centralok = false;
        if ($centralinstalled) {
            require_once($CFG->dirroot . '/local/aiconfig/lib.php');
            $centralok = function_exists('local_aiconfig_get_siteid') && function_exists('local_aiconfig_get_apikey')
                && trim((string)local_aiconfig_get_siteid()) !== '' && trim((string)local_aiconfig_get_apikey()) !== '';
        }
        if ($centralok) {
            $html .= $box('ok', get_string('central_active', 'mod_aivirtualclassroom', $central));
        } else if ($centralinstalled) {
            $html .= $box('warn', get_string('central_incomplete', 'mod_aivirtualclassroom', $central));
        } else {
            $html .= $box('info', get_string('central_missing', 'mod_aivirtualclassroom'));
        }
        // 2. AI Virtual Classroom connection (the site key issued by lms-labs.com).
        if ($ok) {
            $html .= $box('ok', get_string('connected', 'mod_aivirtualclassroom', s($siteid)));
        } else if ($siteid !== '' && $apikey !== '') {
            $reason = $err === '' ? '' : (preg_match('/not recognised|401/i', $err)
                ? get_string('err_badkey', 'mod_aivirtualclassroom') : get_string('err_service', 'mod_aivirtualclassroom'));
            $html .= $box('warn', get_string('notconnected', 'mod_aivirtualclassroom') . ($reason !== '' ? ' ' . $reason : ''));
        }
    }
    $settings->add(new admin_setting_heading(
        'mod_aivirtualclassroom/connection',
        get_string('settings_connection', 'mod_aivirtualclassroom'),
        $html . get_string('settings_central', 'mod_aivirtualclassroom', $central)
    ));
    if (!$centralinstalled) {
        $settings->add(new admin_setting_configtext(
            'mod_aivirtualclassroom/siteid',
            get_string('settings_siteid', 'mod_aivirtualclassroom'),
            get_string('settings_siteid_desc', 'mod_aivirtualclassroom'),
            '',
            PARAM_TEXT
        ));
        $settings->add(new admin_setting_configpasswordunmask(
            'mod_aivirtualclassroom/apikey',
            get_string('settings_apikey', 'mod_aivirtualclassroom'),
            get_string('settings_apikey_desc', 'mod_aivirtualclassroom'),
            ''
        ));
    }
    $settings->add(new admin_setting_configcheckbox(
        'mod_aivirtualclassroom/studentscreenshare',
        get_string('settings_studentscreenshare', 'mod_aivirtualclassroom'),
        get_string('settings_studentscreenshare_desc', 'mod_aivirtualclassroom'),
        0
    ));
}
