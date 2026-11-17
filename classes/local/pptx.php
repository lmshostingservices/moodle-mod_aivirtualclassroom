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

namespace mod_aivirtualclassroom\local;

/**
 * PowerPoint to PDF conversion.
 *
 * @package    mod_aivirtualclassroom
 * @copyright  2026 LMS Hosting Services
 * @license    https://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class pptx {
    /** @var int Largest presentation accepted (same limit as the LMS Labs converter). */
    const MAX_BYTES = 30 * 1024 * 1024;

    /** @var string[] Presentation files (shown page by page as PDF). */
    const SHOWS = ['pptx', 'ppt', 'pps', 'ppsx', 'pptm', 'odp', 'key'];

    /** @var string[] Documents and spreadsheets (shown as pages). */
    const DOCS = ['docx', 'doc', 'odt', 'rtf', 'txt', 'xlsx', 'xls', 'ods', 'csv'];

    /**
     * Convert a presentation or document for the room.
     *
     * The file is converted to PDF with Moodle's own document converters (Site administration > Plugins >
     * Document converters, for example unoconv or Google Drive) when one is enabled for this file type.
     * Otherwise the LMS Labs conversion service makes slide images, which are wrapped in a PDF here.
     *
     * @param string $path Uploaded file.
     * @param string $ext File extension.
     * @return array [type ('pdf'), data, pages]
     */
    public static function convert(string $path, string $ext): array {
        $pdf = self::core_converter($path, $ext);
        if ($pdf === null) {
            $pdf = self::lmslabs($path, $ext);
        }
        return ['pdf', $pdf, max(1, preg_match_all('~/Type\s*/Page[^s]~', $pdf))];
    }

    /**
     * Convert a presentation file to PDF bytes.
     *
     * @param string $path Uploaded file.
     * @param string $ext File extension.
     * @return string PDF data.
     */
    public static function to_pdf(string $path, string $ext): string {
        return self::convert($path, $ext)[1];
    }

    /**
     * Convert with Moodle's document converter API, if a converter for this file type is enabled.
     *
     * @param string $path Uploaded file.
     * @param string $ext File extension.
     * @return string|null PDF data, or null if no converter could do it.
     */
    protected static function core_converter(string $path, string $ext): ?string {
        global $USER;
        $converter = new \core_files\converter();
        if (!$converter->can_convert_format_to($ext, 'pdf')) {
            return null;
        }
        $fs = get_file_storage();
        $usercontext = \context_user::instance($USER->id);
        $draftid = file_get_unused_draft_itemid();
        $file = $fs->create_file_from_pathname([
            'contextid' => $usercontext->id,
            'component' => 'user',
            'filearea' => 'draft',
            'itemid' => $draftid,
            'filepath' => '/',
            'filename' => 'slides.' . $ext,
        ], $path);
        try {
            $conversion = $converter->start_conversion($file, 'pdf', true);
            // Some converters work in the background: wait up to two minutes for them.
            for ($i = 0; $i < 60; $i++) {
                $status = (int)$conversion->get('status');
                if ($status === \core_files\conversion::STATUS_COMPLETE || $status === \core_files\conversion::STATUS_FAILED) {
                    break;
                }
                sleep(2);
                $converter->poll_conversion($conversion);
            }
            $dest = $conversion->get_destfile();
            if ((int)$conversion->get('status') !== \core_files\conversion::STATUS_COMPLETE || !$dest) {
                return null;
            }
            return $dest->get_content();
        } catch (\Throwable $e) {
            debugging($e->getMessage(), DEBUG_DEVELOPER);
            return null;
        } finally {
            $fs->delete_area_files($usercontext->id, 'user', 'draft', $draftid);
        }
    }

    /**
     * Convert with the LMS Labs conversion service (slide images), then wrap the images in a PDF.
     *
     * @param string $path
     * @param string $ext
     * @return string PDF data.
     */
    protected static function lmslabs(string $path, string $ext): string {
        global $CFG;
        [$siteid, $apikey, $server] = meet::credentials();
        if ($siteid === '' || $apikey === '') {
            throw new \moodle_exception('pptx_nocredentials', 'mod_aivirtualclassroom');
        }
        require_once($CFG->libdir . '/filelib.php');
        $curl = new \curl();
        $res = $curl->post($server . '/api/moodle/slideshow/convert-pptx', [
            'file' => new \CURLFile($path, 'application/octet-stream', 'slides.' . $ext),
            'siteId' => $siteid,
            'apiKey' => $apikey,
        ], ['CURLOPT_TIMEOUT' => 240, 'CURLOPT_CONNECTTIMEOUT' => 10]);
        $j = json_decode((string)$res, true);
        if (!is_array($j) || empty($j['success']) || empty($j['slides'])) {
            throw new \moodle_exception(
                'pptx_failed',
                'mod_aivirtualclassroom',
                '',
                null,
                is_array($j) && !empty($j['error']) ? (string)$j['error'] : 'no response'
            );
        }
        if (method_exists('\\local_clientportal\\api', 'record_lmslabs_call')) {
            global $USER;
            // Client Portal (when installed) bills the client when the service says it charged.
            \local_clientportal\api::record_lmslabs_call(
                (int)$USER->id,
                (int)\context_system::instance()->id,
                'mod_aivirtualclassroom',
                $j,
                0,
                get_string('clientportal_slides', 'mod_aivirtualclassroom')
            );
        }
        $images = [];
        foreach ($j['slides'] as $s) {
            $data = base64_decode((string)($s['data'] ?? ''), true);
            if ($data !== false && strlen($data) > 100) {
                $images[] = $data;
            }
        }
        if (!$images) {
            throw new \moodle_exception('pptx_failed', 'mod_aivirtualclassroom');
        }
        return self::images_to_pdf($images);
    }

    /**
     * Build a PDF with one JPEG (or PNG converted to JPEG) per page, each page sized to its image.
     *
     * @param string[] $images Image file data.
     * @return string
     */
    public static function images_to_pdf(array $images): string {
        $objs = [];
        $pages = [];
        $n = 3; // 1 catalog, 2 pages tree.
        foreach ($images as $data) {
            $info = @getimagesizefromstring($data);
            if (!$info) {
                continue;
            }
            if ($info[2] !== IMAGETYPE_JPEG) {
                $im = @imagecreatefromstring($data);
                if (!$im) {
                    continue;
                }
                ob_start();
                imagejpeg($im, null, 88);
                $data = ob_get_clean();
                imagedestroy($im);
            }
            [$w, $h] = $info;
            $img = $n++;
            $content = $n++;
            $page = $n++;
            $objs[$img] = "<< /Type /XObject /Subtype /Image /Width $w /Height $h /ColorSpace /DeviceRGB " .
                "/BitsPerComponent 8 /Filter /DCTDecode /Length " . strlen($data) . " >>\nstream\n" . $data . "\nendstream";
            $draw = "q $w 0 0 $h 0 0 cm /Im0 Do Q";
            $objs[$content] = "<< /Length " . strlen($draw) . " >>\nstream\n$draw\nendstream";
            $objs[$page] = "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 $w $h] /Resources << /XObject << /Im0 $img 0 R >> >> " .
                "/Contents $content 0 R >>";
            $pages[] = "$page 0 R";
        }
        $objs[1] = "<< /Type /Catalog /Pages 2 0 R >>";
        $objs[2] = "<< /Type /Pages /Kids [" . implode(' ', $pages) . "] /Count " . count($pages) . " >>";
        ksort($objs);
        $out = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n";
        $offsets = [];
        foreach ($objs as $i => $body) {
            $offsets[$i] = strlen($out);
            $out .= "$i 0 obj\n$body\nendobj\n";
        }
        $xref = strlen($out);
        $out .= "xref\n0 " . (count($objs) + 1) . "\n0000000000 65535 f \n";
        foreach ($offsets as $o) {
            $out .= sprintf("%010d 00000 n \n", $o);
        }
        $out .= "trailer\n<< /Size " . (count($objs) + 1) . " /Root 1 0 R >>\nstartxref\n$xref\n%%EOF\n";
        return $out;
    }
}
