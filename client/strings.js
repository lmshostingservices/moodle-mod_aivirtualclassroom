// Interface text for the meeting room, from the plugin's Moodle language file (lang/en/aivirtualclassroom.php,
// strings named js_*). Moodle passes them to the page in AIVC_CONFIG.strings in the user's language.
const STR = (window.AIVC_CONFIG && window.AIVC_CONFIG.strings) || {};

/**
 * A language string, with {$a} or {$a->name} filled in like Moodle's get_string().
 *
 * @param {string} key String name (without the component).
 * @param {*} [a] Value for {$a}, or an object for {$a->name}.
 * @returns {string}
 */
export function T(key, a) {
  let s = Object.prototype.hasOwnProperty.call(STR, key) ? String(STR[key]) : key;
  if (a !== undefined && a !== null) {
    if (typeof a === 'object') {
      s = s.replace(/\{\$a->(\w+)\}/g, (m, k) => (a[k] === undefined || a[k] === null ? m : String(a[k])));
    } else {
      s = s.split('{$a}').join(String(a));
    }
  }
  return s;
}
