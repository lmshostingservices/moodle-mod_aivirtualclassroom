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
 * Activity settings form.
 *
 * @package    mod_aivirtualclassroom
 * @copyright  2026 LMS Hosting Services
 * @license    https://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

defined('MOODLE_INTERNAL') || die();

require_once($CFG->dirroot . '/course/moodleform_mod.php');

/**
 * AI Virtual Classroom settings form.
 */
class mod_aivirtualclassroom_mod_form extends moodleform_mod {
    /**
     * Form definition.
     */
    public function definition() {
        $mform = $this->_form;

        $mform->addElement('header', 'general', get_string('general', 'form'));
        $mform->addElement('text', 'name', get_string('name'), ['size' => 64]);
        $mform->setType('name', PARAM_TEXT);
        $mform->addRule('name', null, 'required', null, 'client');
        $mform->addRule('name', get_string('maximumchars', '', 255), 'maxlength', 255, 'client');
        $this->standard_intro_elements();

        $mform->addElement('header', 'schedulehdr', get_string('schedule', 'mod_aivirtualclassroom'));
        $mform->setExpanded('schedulehdr');
        $mform->addElement('date_time_selector', 'timeopen', get_string('timeopen', 'mod_aivirtualclassroom'), ['optional' => true]);
        $mform->addHelpButton('timeopen', 'timeopen', 'mod_aivirtualclassroom');
        $mform->addElement('text', 'duration', get_string('duration', 'mod_aivirtualclassroom'), ['size' => 5]);
        $mform->setType('duration', PARAM_INT);
        $mform->setDefault('duration', 60);

        $mform->addElement('header', 'bandwidthhdr', get_string('bandwidth', 'mod_aivirtualclassroom'));
        $mform->addElement('select', 'videopolicy', get_string('videopolicy', 'mod_aivirtualclassroom'), [
            'teachers' => get_string('videopolicy_teachers', 'mod_aivirtualclassroom'),
            'all' => get_string('videopolicy_all', 'mod_aivirtualclassroom'),
            'none' => get_string('videopolicy_none', 'mod_aivirtualclassroom'),
        ]);
        $mform->setDefault('videopolicy', 'teachers');
        $mform->addHelpButton('videopolicy', 'videopolicy', 'mod_aivirtualclassroom');

        $mform->addElement('header', 'guesthdr', get_string('accessheader', 'mod_aivirtualclassroom'));
        $mform->addElement('select', 'waitingroom', get_string('waitingroom', 'mod_aivirtualclassroom'), [
            0 => get_string('waitingroom_off', 'mod_aivirtualclassroom'),
            1 => get_string('waitingroom_guests', 'mod_aivirtualclassroom'),
            2 => get_string('waitingroom_all', 'mod_aivirtualclassroom'),
        ]);
        $mform->setDefault('waitingroom', 1);
        $mform->addHelpButton('waitingroom', 'waitingroom', 'mod_aivirtualclassroom');
        $mform->addElement('advcheckbox', 'guestaccess', get_string('guestaccess', 'mod_aivirtualclassroom'));
        $mform->addHelpButton('guestaccess', 'guestaccess', 'mod_aivirtualclassroom');

        $mform->addElement('header', 'breakouthdr', get_string('breakouts', 'mod_aivirtualclassroom'));
        $options = [];
        if ($this->context) {
            $users = get_enrolled_users($this->context, 'mod/aivirtualclassroom:moderate', 0, 'u.*', 'u.lastname, u.firstname', 0, 0, true);
            foreach ($users as $u) {
                $options[$u->id] = fullname($u);
            }
        }
        $mform->addElement(
            'autocomplete',
            'breakoutteachers',
            get_string('breakoutteachers', 'mod_aivirtualclassroom'),
            $options,
            ['multiple' => true, 'noselectionstring' => get_string('allteachers', 'mod_aivirtualclassroom')]
        );
        $mform->addHelpButton('breakoutteachers', 'breakoutteachers', 'mod_aivirtualclassroom');

        $mform->addElement('header', 'captionshdr', get_string('captions', 'mod_aivirtualclassroom'));
        $mform->addElement('textarea', 'keyterms', get_string('keyterms', 'mod_aivirtualclassroom'), ['rows' => 3, 'cols' => 60,
            'placeholder' => get_string('keyterms_placeholder', 'mod_aivirtualclassroom')]);
        $mform->setType('keyterms', PARAM_TEXT);
        $mform->addHelpButton('keyterms', 'keyterms', 'mod_aivirtualclassroom');

        $mform->addElement('header', 'recordinghdr', get_string('recordings', 'mod_aivirtualclassroom'));
        $mform->addElement('advcheckbox', 'emailrecordings', get_string('emailrecordings', 'mod_aivirtualclassroom'));
        $mform->addHelpButton('emailrecordings', 'emailrecordings', 'mod_aivirtualclassroom');
        $mform->setDefault('emailrecordings', 1);

        $this->standard_coursemodule_elements();
        $this->add_action_buttons();
    }

    /**
     * Prepare stored values for the form.
     *
     * @param array $defaultvalues
     */
    public function data_preprocessing(&$defaultvalues) {
        parent::data_preprocessing($defaultvalues);
        if (isset($defaultvalues['breakoutteachers']) && is_string($defaultvalues['breakoutteachers'])) {
            $defaultvalues['breakoutteachers'] = array_filter(explode(',', $defaultvalues['breakoutteachers']));
        }
        $suffix = $this->get_suffix();
        foreach (['completionattendance' => 30, 'completionhandraises' => 1] as $rule => $fallback) {
            $value = $defaultvalues[$rule . $suffix] ?? ($defaultvalues[$rule] ?? 0);
            $defaultvalues[$rule . 'enabled' . $suffix] = !empty($value) ? 1 : 0;
            if (empty($value)) {
                $defaultvalues[$rule . $suffix] = $fallback;
            }
        }
    }

    /**
     * Custom completion rules: minutes attended and number of hand raises.
     *
     * @return array
     */
    public function add_completion_rules() {
        $mform = $this->_form;
        $suffix = $this->get_suffix();
        $groups = [];
        foreach (['completionattendance', 'completionhandraises'] as $rule) {
            $enabled = $rule . 'enabled' . $suffix;
            $value = $rule . $suffix;
            $group = [
                $mform->createElement('checkbox', $enabled, '', get_string($rule, 'mod_aivirtualclassroom')),
                $mform->createElement('text', $value, '', ['size' => 3]),
            ];
            $mform->setType($value, PARAM_INT);
            $groupname = $rule . 'group' . $suffix;
            $mform->addGroup($group, $groupname, get_string($rule . 'group', 'mod_aivirtualclassroom'), ' ', false);
            $mform->addHelpButton($groupname, $rule . 'group', 'mod_aivirtualclassroom');
            $mform->hideIf($value, $enabled, 'notchecked');
            $groups[] = $groupname;
        }
        return $groups;
    }

    /**
     * Is any custom rule enabled?
     *
     * @param array $data
     * @return bool
     */
    public function completion_rule_enabled($data) {
        $suffix = $this->get_suffix();
        foreach (['completionattendance', 'completionhandraises'] as $rule) {
            if (!empty($data[$rule . 'enabled' . $suffix]) && (int)($data[$rule . $suffix] ?? 0) > 0) {
                return true;
            }
        }
        return false;
    }

    /**
     * Clean submitted data.
     *
     * @param stdClass $data
     */
    public function data_postprocessing($data) {
        parent::data_postprocessing($data);
        if (!isset($data->breakoutteachers)) {
            $data->breakoutteachers = '';
        }
        $suffix = $this->get_suffix();
        if (!empty($data->completionunlocked)) {
            $auto = !empty($data->{'completion' . $suffix}) && $data->{'completion' . $suffix} == COMPLETION_TRACKING_AUTOMATIC;
            foreach (['completionattendance', 'completionhandraises'] as $rule) {
                if (!$auto || empty($data->{$rule . 'enabled' . $suffix})) {
                    $data->{$rule . $suffix} = 0;
                }
            }
        }
    }

    /**
     * Validation.
     *
     * @param array $data
     * @param array $files
     * @return array
     */
    public function validation($data, $files) {
        $errors = parent::validation($data, $files);
        if ((int)$data['duration'] < 1 || (int)$data['duration'] > 1440) {
            $errors['duration'] = get_string('err_duration', 'mod_aivirtualclassroom');
        }
        $suffix = $this->get_suffix();
        foreach (['completionattendance', 'completionhandraises'] as $rule) {
            if (!empty($data[$rule . 'enabled' . $suffix]) && (int)($data[$rule . $suffix] ?? 0) < 1) {
                $errors[$rule . 'group' . $suffix] = get_string('err_positive', 'mod_aivirtualclassroom');
            }
        }
        return $errors;
    }
}
