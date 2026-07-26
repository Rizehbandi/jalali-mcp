import { describe, expect, it } from "vitest";
import {
  formatDate,
  gregorianToJalali,
  jalaliToGregorian,
  parseDate,
  validateGregorian,
  validateJalali,
} from "../src/calendar";

describe("Gregorian to Jalali", () => {
  it.each([
    [{ year: 2026, month: 7, day: 26 }, { year: 1405, month: 5, day: 4 }],
    [{ year: 2024, month: 3, day: 20 }, { year: 1403, month: 1, day: 1 }],
    [{ year: 2023, month: 3, day: 21 }, { year: 1402, month: 1, day: 1 }],
    [{ year: 2000, month: 1, day: 1 }, { year: 1378, month: 10, day: 11 }],
  ])("converts %o", (gregorian, jalali) => {
    expect(gregorianToJalali(gregorian)).toEqual(jalali);
    expect(jalaliToGregorian(jalali)).toEqual(gregorian);
  });
});

describe("input and formatting", () => {
  it("accepts Persian digits", () => {
    expect(parseDate("۱۴۰۵/۰۵/۰۴")).toEqual({ year: 1405, month: 5, day: 4 });
  });

  it("formats Persian digits", () => {
    expect(formatDate({ year: 1405, month: 5, day: 4 }, "/", true)).toBe(
      "۱۴۰۵/۰۵/۰۴",
    );
  });

  it("rejects impossible dates", () => {
    expect(() => validateGregorian({ year: 2025, month: 2, day: 29 })).toThrow();
    expect(() => validateJalali({ year: 1402, month: 12, day: 30 })).toThrow();
  });
});
