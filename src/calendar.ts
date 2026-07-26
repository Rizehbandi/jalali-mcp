export type CalendarDate = {
  year: number;
  month: number;
  day: number;
};

const PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const LATIN_DIGITS = "0123456789";

function div(a: number, b: number): number {
  return Math.trunc(a / b);
}

function mod(a: number, b: number): number {
  return a - Math.trunc(a / b) * b;
}

function jalCal(jy: number, withoutLeap = false) {
  const breaks = [
    -61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060,
    2097, 2192, 2262, 2324, 2394, 2456, 3178,
  ];
  const bl = breaks.length;
  const gy = jy + 621;
  let leapJ = -14;
  let jp = breaks[0]!;
  let jump = 0;

  if (jy < jp || jy >= breaks[bl - 1]!) {
    throw new RangeError(`Jalali year must be between ${jp} and ${breaks[bl - 1]! - 1}.`);
  }

  for (let i = 1; i < bl; i += 1) {
    const jm = breaks[i]!;
    jump = jm - jp;
    if (jy < jm) break;
    leapJ += div(jump, 33) * 8 + div(mod(jump, 33), 4);
    jp = jm;
  }

  let n = jy - jp;
  leapJ += div(n, 33) * 8 + div(mod(n, 33) + 3, 4);
  if (mod(jump, 33) === 4 && jump - n === 4) leapJ += 1;
  const leapG = div(gy, 4) - div((div(gy, 100) + 1) * 3, 4) - 150;
  const march = 20 + leapJ - leapG;
  if (withoutLeap) return { gy, march };

  if (jump - n < 6) n = n - jump + div(jump + 4, 33) * 33;
  let leap = mod(mod(n + 1, 33) - 1, 4);
  if (leap === -1) leap = 4;
  return { leap, gy, march };
}

function gregorianToJulianDay(gy: number, gm: number, gd: number): number {
  let d =
    div((gy + div(gm - 8, 6) + 100100) * 1461, 4) +
    div(153 * mod(gm + 9, 12) + 2, 5) +
    gd -
    34840408;
  d = d - div(div(gy + 100100 + div(gm - 8, 6), 100) * 3, 4) + 752;
  return d;
}

function julianDayToGregorian(jdn: number): CalendarDate {
  let j = 4 * jdn + 139361631;
  j += div(div(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908;
  const i = div(mod(j, 1461), 4) * 5 + 308;
  const day = div(mod(i, 153), 5) + 1;
  const month = mod(div(i, 153), 12) + 1;
  const year = div(j, 1461) - 100100 + div(8 - month, 6);
  return { year, month, day };
}

function jalaliToJulianDay(jy: number, jm: number, jd: number): number {
  const r = jalCal(jy, true);
  return (
    gregorianToJulianDay(r.gy, 3, r.march) +
    (jm - 1) * 31 -
    div(jm, 7) * (jm - 7) +
    jd -
    1
  );
}

function julianDayToJalali(jdn: number): CalendarDate {
  const g = julianDayToGregorian(jdn);
  let jy = g.year - 621;
  const r = jalCal(jy, false);
  const jdn1f = gregorianToJulianDay(g.year, 3, r.march);
  let k = jdn - jdn1f;

  if (k >= 0) {
    if (k <= 185) {
      return { year: jy, month: 1 + div(k, 31), day: mod(k, 31) + 1 };
    }
    k -= 186;
  } else {
    jy -= 1;
    k += 179;
    if (r.leap === 1) k += 1;
  }

  return { year: jy, month: 7 + div(k, 30), day: mod(k, 30) + 1 };
}

export function isGregorianLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

export function isJalaliLeapYear(year: number): boolean {
  return jalCal(year, false).leap === 0;
}

export function validateGregorian(date: CalendarDate): void {
  const lengths = [
    31,
    isGregorianLeapYear(date.year) ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];
  if (
    !Number.isInteger(date.year) ||
    !Number.isInteger(date.month) ||
    !Number.isInteger(date.day) ||
    date.year < 560 ||
    date.year > 3798 ||
    date.month < 1 ||
    date.month > 12 ||
    date.day < 1 ||
    date.day > lengths[date.month - 1]!
  ) {
    throw new RangeError("Invalid Gregorian date.");
  }
}

export function validateJalali(date: CalendarDate): void {
  const maxDay =
    date.month <= 6 ? 31 : date.month <= 11 ? 30 : isJalaliLeapYear(date.year) ? 30 : 29;
  if (
    !Number.isInteger(date.year) ||
    !Number.isInteger(date.month) ||
    !Number.isInteger(date.day) ||
    date.year < -61 ||
    date.year > 3177 ||
    date.month < 1 ||
    date.month > 12 ||
    date.day < 1 ||
    date.day > maxDay
  ) {
    throw new RangeError("Invalid Jalali date.");
  }
}

export function gregorianToJalali(date: CalendarDate): CalendarDate {
  validateGregorian(date);
  return julianDayToJalali(gregorianToJulianDay(date.year, date.month, date.day));
}

export function jalaliToGregorian(date: CalendarDate): CalendarDate {
  validateJalali(date);
  return julianDayToGregorian(jalaliToJulianDay(date.year, date.month, date.day));
}

export function normalizeDigits(value: string): string {
  return value
    .replace(/[۰-۹]/g, (digit) => String(PERSIAN_DIGITS.indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)));
}

export function parseDate(value: string): CalendarDate {
  const normalized = normalizeDigits(value.trim());
  const match = normalized.match(/^([+-]?\d{1,4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (!match) throw new RangeError("Date must use YYYY-MM-DD, YYYY/MM/DD, or YYYY.MM.DD.");
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
}

export function formatDate(
  date: CalendarDate,
  separator: "-" | "/",
  persianDigits: boolean,
): string {
  const result = `${String(date.year).padStart(4, "0")}${separator}${String(date.month).padStart(2, "0")}${separator}${String(date.day).padStart(2, "0")}`;
  if (!persianDigits) return result;
  return result.replace(/\d/g, (digit) => PERSIAN_DIGITS[LATIN_DIGITS.indexOf(digit)]!);
}
