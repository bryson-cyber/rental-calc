/**
 * Area Code → Timezone Lookup
 * 
 * Maps US/Canadian phone area codes to timezone labels.
 * Used to personalize SMS messages with the webinar time in the registrant's local timezone.
 * 
 * The webinar is at 4 PM Pacific / 7 PM Eastern. This module converts that to:
 * - Eastern: "7 PM your time"
 * - Central: "6 PM your time"
 * - Mountain: "5 PM your time"
 * - Pacific: "4 PM your time"
 * - Alaska/Hawaii: "3 PM / 2 PM your time"
 */

export type USTimezone = 'Eastern' | 'Central' | 'Mountain' | 'Pacific' | 'Alaska' | 'Hawaii';

/**
 * Given a webinar start hour in Pacific time (24h format), return the equivalent hour
 * in the target timezone.
 */
function pacificToLocal(pacificHour: number, tz: USTimezone): number {
  const offsets: Record<USTimezone, number> = {
    Pacific: 0,
    Mountain: 1,
    Central: 2,
    Eastern: 3,
    Alaska: -1,
    Hawaii: -2,
  };
  return pacificHour + offsets[tz];
}

/**
 * Format a 24h hour as a friendly 12h time string.
 * e.g., 16 → "4 PM", 19 → "7 PM", 13 → "1 PM"
 */
function formatHour(hour24: number): string {
  if (hour24 === 0 || hour24 === 24) return '12 AM';
  if (hour24 === 12) return '12 PM';
  if (hour24 > 12) return `${hour24 - 12} PM`;
  return `${hour24} AM`;
}

/**
 * Get the webinar time string personalized to the registrant's timezone.
 * 
 * @param phone - The registrant's phone number (any format)
 * @param pacificHour - The webinar start hour in Pacific time (24h), default 16 (4 PM)
 * @returns A string like "4 PM Pacific" or "7 PM Eastern" or "6 PM your time"
 */
export function getLocalWebinarTime(phone: string, pacificHour: number = 16): string {
  const tz = getTimezoneFromPhone(phone);
  if (!tz) {
    // Unknown area code — show both Pacific and Eastern
    return `${formatHour(pacificHour)} Pacific / ${formatHour(pacificHour + 3)} Eastern`;
  }
  const localHour = pacificToLocal(pacificHour, tz);
  return `${formatHour(localHour)} ${tz}`;
}

/**
 * Get the timezone label from a phone number's area code.
 * Returns null if the area code is not recognized.
 */
export function getTimezoneFromPhone(phone: string): USTimezone | null {
  const digits = phone.replace(/\D/g, '');
  // Handle +1 prefix
  const normalized = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
  if (normalized.length < 3) return null;
  const areaCode = normalized.slice(0, 3);
  return AREA_CODE_MAP[areaCode] || null;
}

/**
 * Comprehensive US area code to timezone mapping.
 * Sources: NANPA area code assignments, FCC data.
 * 
 * This covers all major US area codes. Some overlay codes share geography
 * with existing codes — we map them to the same timezone.
 */
const AREA_CODE_MAP: Record<string, USTimezone> = {
  // ===== EASTERN TIME =====
  // Connecticut
  '203': 'Eastern', '475': 'Eastern', '860': 'Eastern',
  // Delaware
  '302': 'Eastern',
  // District of Columbia
  '202': 'Eastern', '771': 'Eastern',
  // Florida (most)
  '239': 'Eastern', '305': 'Eastern', '321': 'Eastern', '352': 'Eastern',
  '386': 'Eastern', '407': 'Eastern', '561': 'Eastern', '689': 'Eastern',
  '727': 'Eastern', '754': 'Eastern', '772': 'Eastern', '786': 'Eastern',
  '813': 'Eastern', '863': 'Eastern', '904': 'Eastern', '941': 'Eastern',
  '954': 'Eastern',
  // Georgia
  '229': 'Eastern', '404': 'Eastern', '470': 'Eastern', '478': 'Eastern',
  '678': 'Eastern', '706': 'Eastern', '762': 'Eastern', '770': 'Eastern',
  '912': 'Eastern', '943': 'Eastern',
  // Indiana (most)
  '317': 'Eastern', '463': 'Eastern', '574': 'Eastern', '765': 'Eastern',
  '812': 'Eastern', '930': 'Eastern',
  // Kentucky (eastern)
  '502': 'Eastern', '606': 'Eastern', '859': 'Eastern',
  // Maine
  '207': 'Eastern',
  // Maryland
  '240': 'Eastern', '301': 'Eastern', '410': 'Eastern', '443': 'Eastern',
  '667': 'Eastern',
  // Massachusetts
  '339': 'Eastern', '351': 'Eastern', '413': 'Eastern', '508': 'Eastern',
  '617': 'Eastern', '774': 'Eastern', '781': 'Eastern', '857': 'Eastern',
  '978': 'Eastern',
  // Michigan (most)
  '231': 'Eastern', '248': 'Eastern', '269': 'Eastern', '313': 'Eastern',
  '517': 'Eastern', '586': 'Eastern', '616': 'Eastern', '734': 'Eastern',
  '810': 'Eastern', '947': 'Eastern', '989': 'Eastern',
  // New Hampshire
  '603': 'Eastern',
  // New Jersey
  '201': 'Eastern', '551': 'Eastern', '609': 'Eastern', '732': 'Eastern',
  '848': 'Eastern', '856': 'Eastern', '862': 'Eastern', '908': 'Eastern',
  '973': 'Eastern',
  // New York
  '212': 'Eastern', '315': 'Eastern', '332': 'Eastern', '347': 'Eastern',
  '516': 'Eastern', '518': 'Eastern', '585': 'Eastern', '607': 'Eastern',
  '631': 'Eastern', '646': 'Eastern', '680': 'Eastern', '716': 'Eastern',
  '718': 'Eastern', '838': 'Eastern', '845': 'Eastern', '914': 'Eastern',
  '917': 'Eastern', '929': 'Eastern', '934': 'Eastern',
  // North Carolina
  '252': 'Eastern', '336': 'Eastern', '704': 'Eastern', '743': 'Eastern',
  '828': 'Eastern', '910': 'Eastern', '919': 'Eastern', '980': 'Eastern',
  '984': 'Eastern',
  // Ohio
  '216': 'Eastern', '220': 'Eastern', '234': 'Eastern', '283': 'Eastern',
  '326': 'Eastern', '330': 'Eastern', '380': 'Eastern', '419': 'Eastern',
  '440': 'Eastern', '513': 'Eastern', '567': 'Eastern', '614': 'Eastern',
  '740': 'Eastern', '937': 'Eastern',
  // Pennsylvania
  '215': 'Eastern', '223': 'Eastern', '267': 'Eastern', '272': 'Eastern',
  '412': 'Eastern', '445': 'Eastern', '484': 'Eastern', '570': 'Eastern',
  '582': 'Eastern', '610': 'Eastern', '717': 'Eastern', '724': 'Eastern',
  '814': 'Eastern', '835': 'Eastern', '878': 'Eastern',
  // Rhode Island
  '401': 'Eastern',
  // South Carolina
  '803': 'Eastern', '839': 'Eastern', '843': 'Eastern', '854': 'Eastern',
  '864': 'Eastern',
  // Tennessee (eastern)
  '423': 'Eastern', '865': 'Eastern',
  // Vermont
  '802': 'Eastern',
  // Virginia
  '276': 'Eastern', '434': 'Eastern', '540': 'Eastern', '571': 'Eastern',
  '703': 'Eastern', '757': 'Eastern', '804': 'Eastern',
  // West Virginia
  '304': 'Eastern', '681': 'Eastern',

  // ===== CENTRAL TIME =====
  // Alabama
  '205': 'Central', '251': 'Central', '256': 'Central', '334': 'Central',
  '659': 'Central', '938': 'Central',
  // Arkansas
  '479': 'Central', '501': 'Central', '870': 'Central',
  // Florida (panhandle - Central)
  '850': 'Central',
  // Illinois
  '217': 'Central', '224': 'Central', '309': 'Central', '312': 'Central',
  '331': 'Central', '447': 'Central', '464': 'Central', '618': 'Central',
  '630': 'Central', '708': 'Central', '773': 'Central', '779': 'Central',
  '815': 'Central', '847': 'Central', '872': 'Central',
  // Indiana (northwest/southwest - Central)
  '219': 'Central',
  // Iowa
  '319': 'Central', '515': 'Central', '563': 'Central', '641': 'Central',
  '712': 'Central',
  // Kansas (most)
  '316': 'Central', '620': 'Central', '785': 'Central', '913': 'Central',
  // Kentucky (western)
  '270': 'Central', '364': 'Central',
  // Louisiana
  '225': 'Central', '318': 'Central', '337': 'Central', '504': 'Central',
  '985': 'Central',
  // Michigan (western UP)
  '906': 'Central',
  // Minnesota
  '218': 'Central', '320': 'Central', '507': 'Central', '612': 'Central',
  '651': 'Central', '763': 'Central', '952': 'Central',
  // Mississippi
  '228': 'Central', '601': 'Central', '662': 'Central', '769': 'Central',
  // Missouri
  '314': 'Central', '417': 'Central', '573': 'Central', '636': 'Central',
  '660': 'Central', '816': 'Central',
  // Nebraska (most)
  '308': 'Central', '402': 'Central', '531': 'Central',
  // North Dakota (most)
  '701': 'Central',
  // Oklahoma
  '405': 'Central', '539': 'Central', '580': 'Central', '918': 'Central',
  // South Dakota (eastern)
  '605': 'Central',
  // Tennessee (central/western)
  '615': 'Central', '629': 'Central', '731': 'Central', '901': 'Central',
  // Texas
  '210': 'Central', '214': 'Central', '254': 'Central', '281': 'Central',
  '325': 'Central', '346': 'Central', '361': 'Central', '409': 'Central',
  '430': 'Central', '432': 'Central', '469': 'Central', '512': 'Central',
  '682': 'Central', '713': 'Central', '726': 'Central', '737': 'Central',
  '806': 'Central', '817': 'Central', '830': 'Central', '832': 'Central',
  '903': 'Central', '936': 'Central', '940': 'Central', '956': 'Central',
  '972': 'Central', '979': 'Central',
  // Wisconsin
  '262': 'Central', '274': 'Central', '414': 'Central', '534': 'Central',
  '608': 'Central', '715': 'Central', '920': 'Central',

  // ===== MOUNTAIN TIME =====
  // Arizona (no DST except Navajo Nation)
  '480': 'Mountain', '520': 'Mountain', '602': 'Mountain', '623': 'Mountain',
  '928': 'Mountain',
  // Colorado
  '303': 'Mountain', '719': 'Mountain', '720': 'Mountain', '970': 'Mountain',
  // Idaho (southern)
  '208': 'Mountain',
  // Montana
  '406': 'Mountain',
  // Nevada (rural)
  '775': 'Mountain',
  // New Mexico
  '505': 'Mountain', '575': 'Mountain',
  // Texas (El Paso - Mountain)
  '915': 'Mountain',
  // Utah
  '385': 'Mountain', '435': 'Mountain', '801': 'Mountain',
  // Wyoming
  '307': 'Mountain',

  // ===== PACIFIC TIME =====
  // California
  '209': 'Pacific', '213': 'Pacific', '279': 'Pacific', '310': 'Pacific',
  '323': 'Pacific', '341': 'Pacific', '350': 'Pacific', '408': 'Pacific',
  '415': 'Pacific', '424': 'Pacific', '442': 'Pacific', '510': 'Pacific',
  '530': 'Pacific', '559': 'Pacific', '562': 'Pacific', '619': 'Pacific',
  '626': 'Pacific', '628': 'Pacific', '650': 'Pacific', '657': 'Pacific',
  '661': 'Pacific', '669': 'Pacific', '707': 'Pacific', '714': 'Pacific',
  '747': 'Pacific', '760': 'Pacific', '805': 'Pacific', '818': 'Pacific',
  '820': 'Pacific', '831': 'Pacific', '840': 'Pacific', '858': 'Pacific',
  '909': 'Pacific', '916': 'Pacific', '925': 'Pacific', '949': 'Pacific',
  '951': 'Pacific',
  // Nevada (Las Vegas metro)
  '702': 'Pacific',
  // Oregon
  '458': 'Pacific', '503': 'Pacific', '541': 'Pacific', '971': 'Pacific',
  // Washington
  '206': 'Pacific', '253': 'Pacific', '360': 'Pacific', '425': 'Pacific',
  '509': 'Pacific', '564': 'Pacific',

  // ===== ALASKA =====
  '907': 'Alaska',

  // ===== HAWAII =====
  '808': 'Hawaii',
};

export { AREA_CODE_MAP };
