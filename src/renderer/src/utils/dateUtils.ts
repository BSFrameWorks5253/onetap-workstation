/**
 * Hijri (Islamic) calendar conversion utilities.
 * Ported from mumineen_calendar_js by mygulamali (MIT License).
 * Source: https://github.com/mygulamali/mumineen_calendar_js/blob/main/source/assets/javascripts/_lib/hijri_date.js
 */

// Hijri year remainders that identify Kabisa (leap) years within each 30-year cycle
const KABISA_YEAR_REMAINDERS = [2, 5, 8, 10, 13, 16, 19, 21, 24, 27, 29];

// Cumulative days in a Hijri year per month (0-indexed, 11 entries for months 0-10; month 11 derived)
const DAYS_IN_YEAR = [30, 59, 89, 118, 148, 177, 207, 236, 266, 295, 325];

// Cumulative days in each 30-year Hijri cycle, per year within cycle (30 entries)
const DAYS_IN_30_YEARS = [
     354,  708, 1063, 1417, 1771, 2126, 2480, 2834,  3189,  3543,
    3898, 4252, 4606, 4961, 5315, 5669, 6024, 6378,  6732,  7087,
    7441, 7796, 8150, 8504, 8859, 9213, 9567, 9922, 10276, 10631,
];

export const HIJRI_MONTH_NAMES_SHORT = [
    'Moharram', 'Safar', 'Rabi I', 'Rabi II',
    'Jumada I', 'Jumada II', 'Rajab', 'Sha\'baan',
    'Ramadaan', 'Shawwal', 'Zilqadah', 'Zilhaj',
];

export const HIJRI_MONTH_NAMES_LONG = [
    'Moharram al-Haraam', 'Safar al-Muzaffar', "Rabi' al-Awwal", "Rabi' al-Aakhar",
    'Jumada al-Ula', 'Jumada al-Ukhra', 'Rajab al-Asab', "Sha'baan al-Karim",
    'Ramadaan al-Moazzam', 'Shawwal al-Mukarram', 'Zilqadah al-Haraam', 'Zilhaj al-Haraam',
];

export const HIJRI_MONTH_NAMES_ARABIC = [
    'محرم الحرام', 'صفر المظفر', 'ربيع الأوَّل', 'ربيع الآخر',
    'جمادى الأولى', 'جمادى الاخرى', 'رجب الاصب', 'شعبان الكريم',
    'رمضان المعظم', 'شوال المكرم', 'ذي القعدة الحرام', 'ذي الحجة الحرام',
];

/** Arabic-Indic digit lookup (Unicode code points \u0660–\u0669) */
export const ARABIC_INDIC_DIGITS = [
    '\u0660', '\u0661', '\u0662', '\u0663', '\u0664',
    '\u0665', '\u0666', '\u0667', '\u0668', '\u0669',
];

/** Hijri year suffix "هـ" as Unicode escapes */
export const HIJRI_YEAR_SUFFIX_AR = '\u0647\u0640';

/** Page title "التقويم الهجري" as Unicode escapes */
export const HIJRI_CALENDAR_TITLE_AR = '\u0627\u0644\u062a\u0642\u0648\u064a\u0645 \u0627\u0644\u0647\u062c\u0631\u064a';

/** Arabic weekday names Sun–Sat (0-indexed) */
export const HIJRI_WEEK_DAYS_ARABIC = [
    '\u0627\u0644\u0623\u062d\u062f',           // الأحد
    '\u0627\u0644\u0627\u062b\u0646\u064a\u0646', // الاثنين
    '\u0627\u0644\u062b\u0644\u0627\u062b\u0627\u0621', // الثلاثاء
    '\u0627\u0644\u0623\u0631\u0628\u0639\u0627\u0621', // الأربعاء
    '\u0627\u0644\u062e\u0645\u064a\u0633',     // الخميس
    '\u0627\u0644\u062c\u0645\u0639\u0629',     // الجمعة
    '\u0627\u0644\u0633\u062b',           // السبت
];

export interface HijriDateObj {
    /** Full Hijri year, e.g. 1447 */
    year: number;
    /** 0-indexed month (0 = Moharram … 11 = Zilhaj) */
    month: number;
    /** Day of month, 1-indexed */
    day: number;
}

// ------------------------------------------------------------------
// Internal helpers
// ------------------------------------------------------------------

function isKabisa(year: number): boolean {
    return KABISA_YEAR_REMAINDERS.some((r) => year % 30 === r);
}

/** Cumulative day-of-year within the Hijri calendar (1-indexed day within month) */
function dayOfHijriYear(month: number, day: number): number {
    return month === 0 ? day : DAYS_IN_YEAR[month - 1] + day;
}

/**
 * Returns the Astronomical Julian Date corresponding to a Gregorian `Date`.
 * Uses the proleptic Gregorian calendar for dates after 1582.
 */
function gregorianToAJD(date: Date): number {
    let year = date.getFullYear();
    let month = date.getMonth() + 1;
    const day = date.getDate();

    if (month < 3) {
        year--;
        month += 12;
    }

    let b: number;
    // Julian calendar before Gregorian adoption (Oct 15, 1582)
    if (
        year < 1582 ||
        (year === 1582 && month < 10) ||
        (year === 1582 && month === 10 && day < 15)
    ) {
        b = 0;
    } else {
        const a = Math.floor(year / 100);
        b = 2 - a + Math.floor(a / 4);
    }

    return (
        Math.floor(365.25 * (year + 4716)) +
        Math.floor(30.6001 * (month + 1)) +
        day +
        b -
        1524.5
    );
}

/** Returns a Gregorian `Date` from an Astronomical Julian Date. */
function ajdToGregorian(ajd: number): Date {
    const z = Math.floor(ajd + 0.5);
    const f = ajd + 0.5 - z;

    let a: number;
    if (z < 2299161) {
        a = z;
    } else {
        const alpha = Math.floor((z - 1867216.25) / 36524.25);
        a = z + 1 + alpha - Math.floor(0.25 * alpha);
    }

    const b = a + 1524;
    const c = Math.floor((b - 122.1) / 365.25);
    const d = Math.floor(365.25 * c);
    const e = Math.floor((b - d) / 30.6001);

    const dayFrac = b - d - Math.floor(30.6001 * e) + f;
    const day = Math.floor(dayFrac);
    const month = e < 14 ? e - 2 : e - 14;
    const year = month < 2 ? c - 4715 : c - 4716;

    return new Date(year, month, day);
}

// ------------------------------------------------------------------
// Public API
// ------------------------------------------------------------------

/** Returns `true` if the given Hijri year is a Kabisa (leap) year. */
export function isHijriKabisa(year: number): boolean {
    return isKabisa(year);
}

/**
 * Returns the number of days in the given Hijri month.
 * @param year  Full Hijri year (e.g. 1447)
 * @param month 0-indexed month (0 = Moharram)
 */
export function daysInHijriMonth(year: number, month: number): number {
    return ((month === 11) && isKabisa(year)) || month % 2 === 0 ? 30 : 29;
}

/**
 * Converts a Gregorian `Date` to a `HijriDateObj`.
 * Uses the tabular Hijri calendar (same algorithm as mumineen_calendar_js).
 */
export function hijriFromGregorian(date: Date): HijriDateObj {
    const ajd = gregorianToAJD(date);
    let left = Math.floor(ajd - 1948083.5);

    const y30 = Math.floor(left / 10631.0);
    left -= y30 * 10631;

    let i = 0;
    while (i < DAYS_IN_30_YEARS.length && left > DAYS_IN_30_YEARS[i]) {
        i++;
    }

    const year = Math.round(y30 * 30.0 + i);
    if (i > 0) left -= DAYS_IN_30_YEARS[i - 1];

    i = 0;
    while (i < DAYS_IN_YEAR.length && left > DAYS_IN_YEAR[i]) {
        i++;
    }

    const month = Math.round(i);
    const day = i > 0 ? Math.round(left - DAYS_IN_YEAR[i - 1]) : Math.round(left);

    return { year, month, day };
}

/**
 * Converts a `HijriDateObj` back to a Gregorian `Date`.
 */
export function hijriToGregorian(hd: HijriDateObj): Date {
    const y30 = Math.floor(hd.year / 30.0);
    let ajd = 1948083.5 + y30 * 10631 + dayOfHijriYear(hd.month, hd.day);
    if (hd.year % 30 !== 0) {
        ajd += DAYS_IN_30_YEARS[hd.year - y30 * 30 - 1];
    }
    return ajdToGregorian(ajd);
}

/** Helper: format a Gregorian `Date` as `"YYYY-MM-DD"`. */
export function formatISODate(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

/** Navigate to the previous Hijri month (handles month 0 → month 11 / year rollback). */
export function prevHijriMonth(year: number, month: number): { year: number; month: number } {
    if (month === 0) return { year: year - 1, month: 11 };
    return { year, month: month - 1 };
}

/** Navigate to the next Hijri month (handles month 11 → month 0 / year rollback). */
export function nextHijriMonth(year: number, month: number): { year: number; month: number } {
    if (month === 11) return { year: year + 1, month: 0 };
    return { year, month: month + 1 };
}

// ---------------------------------------------------------------------------
// Calendar grid helpers
// ---------------------------------------------------------------------------

/** Converts an integer to Arabic-Indic numeral string (e.g. 27 \u2192 "\u0662\u0667") */
export function toArabicNumerals(n: number): string {
    return String(n).replace(/\d/g, (d) => ARABIC_INDIC_DIGITS[+d]);
}

const GREG_MONTHS_SHORT = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/** Returns a Gregorian date-range subtitle for a Hijri month (e.g. "Feb \u2013 Mar 2026") */
export function gregSubtitle(hYear: number, hMonth: number): string {
    const firstGreg = hijriToGregorian({ year: hYear, month: hMonth, day: 1 });
    const lastDay = daysInHijriMonth(hYear, hMonth);
    const lastGreg = hijriToGregorian({ year: hYear, month: hMonth, day: lastDay });
    const fm = firstGreg.getMonth(), fy = firstGreg.getFullYear();
    const lm = lastGreg.getMonth(), ly = lastGreg.getFullYear();
    if (fm === lm && fy === ly) return `${GREG_MONTHS_SHORT[fm]} ${fy}`;
    if (fy === ly) return `${GREG_MONTHS_SHORT[fm]} \u2013 ${GREG_MONTHS_SHORT[lm]} ${fy}`;
    return `${GREG_MONTHS_SHORT[fm]} ${fy} \u2013 ${GREG_MONTHS_SHORT[lm]} ${ly}`;
}

/** A single cell in the Hijri calendar grid */
export type HijriCalendarCell =
    | { type: 'empty'; key: string }
    | { type: 'day'; hijriDay: number; isoDate: string; gregDay: number };

/** Builds the full grid of cells for a given Hijri month, plus today's ISO date string */
export function buildCalendarCells(
    hYear: number,
    hMonth: number,
): { cells: HijriCalendarCell[]; todayISO: string } {
    const totalDays = daysInHijriMonth(hYear, hMonth);
    const firstGreg = hijriToGregorian({ year: hYear, month: hMonth, day: 1 });
    const startOffset = firstGreg.getDay();
    const todayISO = formatISODate(new Date());
    const cells: HijriCalendarCell[] = [];
    for (let i = 0; i < startOffset; i++) cells.push({ type: 'empty', key: `e${i}` });
    for (let d = 1; d <= totalDays; d++) {
        const greg = hijriToGregorian({ year: hYear, month: hMonth, day: d });
        cells.push({ type: 'day', hijriDay: d, isoDate: formatISODate(greg), gregDay: greg.getDate() });
    }
    return { cells, todayISO };
}

// ---------------------------------------------------------------------------
// Compatibility layer for existing reference usages
// ---------------------------------------------------------------------------

/**
 * Compatibility helper to format date into Misri Hijri string.
 */
export function toMisriHijri(dateInput: Date | number): string {
  const d = typeof dateInput === 'number' ? new Date(dateInput) : dateInput;
  if (isNaN(d.getTime())) return "Invalid Date";
  const hd = hijriFromGregorian(d);
  return `${hd.day} ${HIJRI_MONTH_NAMES_LONG[hd.month]} ${hd.year}`;
}

/**
 * Compatibility helper to format Gregorian date with Hijri date.
 */
export function formatGregorianWithHijri(dateInput: Date | number): string {
  const d = typeof dateInput === 'number' ? new Date(dateInput) : dateInput;
  const greg = d.toLocaleDateString();
  const hijri = toMisriHijri(d);
  return `${greg} (${hijri})`;
}
