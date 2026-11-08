// Spoken languages and countries for captions, grouped by region.
// [BCP-47 code, language (English), native name, country, region, extra search words]
const L = [
  // Australia & Pacific
  ['en-AU', 'English', 'English', 'Australia', 'Australia & Pacific', 'aussie'],
  ['en-NZ', 'English', 'English', 'New Zealand', 'Australia & Pacific', 'kiwi aotearoa'],
  // Asia
  ['th-TH', 'Thai', 'ไทย', 'Thailand', 'Asia', 'siam'],
  ['vi-VN', 'Vietnamese', 'Tiếng Việt', 'Vietnam', 'Asia', ''],
  ['id-ID', 'Indonesian', 'Bahasa Indonesia', 'Indonesia', 'Asia', 'bahasa'],
  ['ms-MY', 'Malay', 'Bahasa Melayu', 'Malaysia', 'Asia', 'bahasa melayu'],
  ['fil-PH', 'Filipino', 'Filipino', 'Philippines', 'Asia', 'tagalog pilipino philipino'],
  ['en-PH', 'English', 'English', 'Philippines', 'Asia', ''],
  ['en-SG', 'English', 'English', 'Singapore', 'Asia', ''],
  ['zh-CN', 'Chinese (Mandarin, Simplified)', '普通话', 'China', 'Asia', 'mandarin putonghua simplified'],
  ['zh-TW', 'Chinese (Mandarin, Traditional)', '國語', 'Taiwan', 'Asia', 'mandarin traditional'],
  ['zh-HK', 'Chinese (Cantonese)', '粵語', 'Hong Kong', 'Asia', 'cantonese yue'],
  ['ja-JP', 'Japanese', '日本語', 'Japan', 'Asia', 'nihongo'],
  ['ko-KR', 'Korean', '한국어', 'South Korea', 'Asia', 'hangul korea'],
  ['hi-IN', 'Hindi', 'हिन्दी', 'India', 'Asia', ''],
  ['en-IN', 'English', 'English', 'India', 'Asia', ''],
  ['bn-BD', 'Bengali', 'বাংলা', 'Bangladesh', 'Asia', 'bangla'],
  ['bn-IN', 'Bengali', 'বাংলা', 'India', 'Asia', 'bangla'],
  ['ta-IN', 'Tamil', 'தமிழ்', 'India', 'Asia', ''],
  ['te-IN', 'Telugu', 'తెలుగు', 'India', 'Asia', ''],
  ['mr-IN', 'Marathi', 'मराठी', 'India', 'Asia', ''],
  ['gu-IN', 'Gujarati', 'ગુજરાતી', 'India', 'Asia', ''],
  ['kn-IN', 'Kannada', 'ಕನ್ನಡ', 'India', 'Asia', ''],
  ['ml-IN', 'Malayalam', 'മലയാളം', 'India', 'Asia', ''],
  ['pa-IN', 'Punjabi', 'ਪੰਜਾਬੀ', 'India', 'Asia', 'panjabi'],
  ['ur-PK', 'Urdu', 'اردو', 'Pakistan', 'Asia', ''],
  ['ne-NP', 'Nepali', 'नेपाली', 'Nepal', 'Asia', ''],
  ['si-LK', 'Sinhala', 'සිංහල', 'Sri Lanka', 'Asia', 'sinhalese'],
  ['km-KH', 'Khmer', 'ខ្មែរ', 'Cambodia', 'Asia', 'cambodian'],
  ['lo-LA', 'Lao', 'ລາວ', 'Laos', 'Asia', 'laotian'],
  ['my-MM', 'Burmese', 'မြန်မာ', 'Myanmar', 'Asia', 'burma'],
  ['mn-MN', 'Mongolian', 'Монгол', 'Mongolia', 'Asia', ''],
  ['kk-KZ', 'Kazakh', 'Қазақ', 'Kazakhstan', 'Asia', ''],
  ['uz-UZ', 'Uzbek', 'Oʻzbek', 'Uzbekistan', 'Asia', ''],
  // Middle East
  ['ar-SA', 'Arabic', 'العربية', 'Saudi Arabia', 'Middle East', 'ksa'],
  ['ar-AE', 'Arabic', 'العربية', 'United Arab Emirates', 'Middle East', 'uae dubai'],
  ['ar-JO', 'Arabic', 'العربية', 'Jordan', 'Middle East', ''],
  ['ar-LB', 'Arabic', 'العربية', 'Lebanon', 'Middle East', ''],
  ['he-IL', 'Hebrew', 'עברית', 'Israel', 'Middle East', ''],
  ['fa-IR', 'Persian', 'فارسی', 'Iran', 'Middle East', 'farsi'],
  ['tr-TR', 'Turkish', 'Türkçe', 'Türkiye', 'Middle East', 'turkey'],
  // Europe
  ['en-GB', 'English', 'English', 'United Kingdom', 'Europe', 'uk britain england scotland wales'],
  ['en-IE', 'English', 'English', 'Ireland', 'Europe', ''],
  ['fr-FR', 'French', 'Français', 'France', 'Europe', ''],
  ['de-DE', 'German', 'Deutsch', 'Germany', 'Europe', ''],
  ['de-AT', 'German', 'Deutsch', 'Austria', 'Europe', ''],
  ['de-CH', 'German', 'Deutsch', 'Switzerland', 'Europe', 'swiss'],
  ['it-IT', 'Italian', 'Italiano', 'Italy', 'Europe', ''],
  ['es-ES', 'Spanish', 'Español', 'Spain', 'Europe', 'castellano'],
  ['ca-ES', 'Catalan', 'Català', 'Spain', 'Europe', ''],
  ['pt-PT', 'Portuguese', 'Português', 'Portugal', 'Europe', ''],
  ['nl-NL', 'Dutch', 'Nederlands', 'Netherlands', 'Europe', 'holland'],
  ['nl-BE', 'Dutch (Flemish)', 'Nederlands', 'Belgium', 'Europe', 'flemish vlaams'],
  ['fr-BE', 'French', 'Français', 'Belgium', 'Europe', ''],
  ['sv-SE', 'Swedish', 'Svenska', 'Sweden', 'Europe', ''],
  ['da-DK', 'Danish', 'Dansk', 'Denmark', 'Europe', ''],
  ['nb-NO', 'Norwegian', 'Norsk', 'Norway', 'Europe', 'bokmal'],
  ['fi-FI', 'Finnish', 'Suomi', 'Finland', 'Europe', ''],
  ['is-IS', 'Icelandic', 'Íslenska', 'Iceland', 'Europe', ''],
  ['pl-PL', 'Polish', 'Polski', 'Poland', 'Europe', ''],
  ['cs-CZ', 'Czech', 'Čeština', 'Czechia', 'Europe', 'czech republic'],
  ['sk-SK', 'Slovak', 'Slovenčina', 'Slovakia', 'Europe', ''],
  ['hu-HU', 'Hungarian', 'Magyar', 'Hungary', 'Europe', ''],
  ['ro-RO', 'Romanian', 'Română', 'Romania', 'Europe', ''],
  ['bg-BG', 'Bulgarian', 'Български', 'Bulgaria', 'Europe', ''],
  ['el-GR', 'Greek', 'Ελληνικά', 'Greece', 'Europe', ''],
  ['hr-HR', 'Croatian', 'Hrvatski', 'Croatia', 'Europe', ''],
  ['sr-RS', 'Serbian', 'Српски', 'Serbia', 'Europe', ''],
  ['sl-SI', 'Slovenian', 'Slovenščina', 'Slovenia', 'Europe', ''],
  ['uk-UA', 'Ukrainian', 'Українська', 'Ukraine', 'Europe', ''],
  ['ru-RU', 'Russian', 'Русский', 'Russia', 'Europe', ''],
  ['lt-LT', 'Lithuanian', 'Lietuvių', 'Lithuania', 'Europe', ''],
  ['lv-LV', 'Latvian', 'Latviešu', 'Latvia', 'Europe', ''],
  ['et-EE', 'Estonian', 'Eesti', 'Estonia', 'Europe', ''],
  // Americas
  ['en-US', 'English', 'English', 'United States', 'Americas', 'usa america us'],
  ['en-CA', 'English', 'English', 'Canada', 'Americas', ''],
  ['fr-CA', 'French', 'Français', 'Canada', 'Americas', 'quebec quebecois'],
  ['es-MX', 'Spanish', 'Español', 'Mexico', 'Americas', 'latino'],
  ['es-US', 'Spanish', 'Español', 'United States', 'Americas', 'usa latino'],
  ['es-CO', 'Spanish', 'Español', 'Colombia', 'Americas', ''],
  ['es-AR', 'Spanish', 'Español', 'Argentina', 'Americas', ''],
  ['es-CL', 'Spanish', 'Español', 'Chile', 'Americas', ''],
  ['es-PE', 'Spanish', 'Español', 'Peru', 'Americas', ''],
  ['pt-BR', 'Portuguese', 'Português', 'Brazil', 'Americas', 'brasil brazilian'],
  // Africa
  ['en-ZA', 'English', 'English', 'South Africa', 'Africa', ''],
  ['af-ZA', 'Afrikaans', 'Afrikaans', 'South Africa', 'Africa', ''],
  ['zu-ZA', 'Zulu', 'isiZulu', 'South Africa', 'Africa', ''],
  ['en-NG', 'English', 'English', 'Nigeria', 'Africa', ''],
  ['en-KE', 'English', 'English', 'Kenya', 'Africa', ''],
  ['sw-KE', 'Swahili', 'Kiswahili', 'Kenya', 'Africa', ''],
  ['sw-TZ', 'Swahili', 'Kiswahili', 'Tanzania', 'Africa', ''],
  ['am-ET', 'Amharic', 'አማርኛ', 'Ethiopia', 'Africa', ''],
  ['ar-EG', 'Arabic', 'العربية', 'Egypt', 'Africa', ''],
  ['ar-MA', 'Arabic', 'العربية', 'Morocco', 'Africa', ''],
  ['fr-SN', 'French', 'Français', 'Senegal', 'Africa', ''],
];

export const REGIONS = ['Australia & Pacific', 'Asia', 'Middle East', 'Europe', 'Americas', 'Africa'];

const fold = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export const LANGUAGES = L.map(([code, name, native, country, region, extra]) => {
  const cc = code.split('-').pop();
  const flag = /^[A-Z]{2}$/.test(cc) ? String.fromCodePoint(...[...cc].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65)) : '';
  return { code, name, native, country, region, flag, cc, hay: fold(`${name} ${native} ${country} ${code} ${extra}`) };
});

export function findLang(code) {
  if (!code) return null;
  return LANGUAGES.find((l) => l.code.toLowerCase() === code.toLowerCase()) ||
    LANGUAGES.find((l) => l.code.split('-')[0] === code.split('-')[0].toLowerCase()) || null;
}

// Every word typed must match somewhere: "spanish mex" finds Spanish (Mexico).
export function searchLangs(q) {
  const words = fold(q).split(/\s+/).filter(Boolean);
  if (!words.length) return LANGUAGES;
  return LANGUAGES.filter((l) => words.every((w) => l.hay.includes(w)));
}

// The browser's own languages, best guesses first.
export function suggested() {
  const out = [];
  for (const n of navigator.languages || [navigator.language || 'en-AU']) {
    const l = findLang(n);
    if (l && !out.includes(l)) out.push(l);
  }
  return out.slice(0, 4);
}
