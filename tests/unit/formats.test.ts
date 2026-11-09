import { describe, expect, it } from "vitest";
import { formatDay, formatPhone, normalizeFacebook, normalizeGstin, normalizeInstagram, normalizePhone, safeAdminPath } from "@/lib/formats";

describe("phone numbers", () => {
  it.each([
    ["98765 43210", "919876543210"],
    ["+91 98765-43210", "919876543210"],
    ["09876543210", "919876543210"],
    ["0091 9876543210", "919876543210"],
    ["919876543210", "919876543210"],
    ["+971 50 123 4567", "971501234567"],
  ])("normalises %s to %s", (input, out) => {
    expect(normalizePhone(input)).toBe(out);
  });

  it.each(["", "12345", "phone", "+91 98765 43210 99999"])("rejects %s", (input) => {
    expect(normalizePhone(input)).toBeNull();
  });

  it("formats Indian numbers for display", () => {
    expect(formatPhone("919876543210")).toBe("+91 98765 43210");
    expect(formatPhone("971501234567")).toBe("+971501234567");
  });
});

describe("dates", () => {
  it("shows a date as 11 Nov 2026", () => {
    expect(formatDay("2026-11-11")).toBe("11 Nov 2026");
    expect(formatDay("2026-01-05T10:00:00+05:30")).toBe("5 Jan 2026");
  });
  it("leaves anything that is not a date alone", () => {
    expect(formatDay("tomorrow")).toBe("tomorrow");
    expect(formatDay("2026-13-01")).toBe("2026-13-01");
  });
});

describe("GSTIN", () => {
  it("accepts a well-formed GSTIN, in any case and with spaces", () => {
    expect(normalizeGstin("27aapfu0939f1zv")).toBe("27AAPFU0939F1ZV");
    expect(normalizeGstin(" 27AAPFU0939F1ZV ")).toBe("27AAPFU0939F1ZV");
  });
  it.each(["", "27AAPFU0939F1Z", "27AAPFU0939F1XV", "AAAPFU0939F1ZV1"])("rejects %s", (input) => {
    expect(normalizeGstin(input)).toBeNull();
  });
});

describe("Instagram handle", () => {
  it.each([
    ["@leaf.star_", "leaf.star_"],
    ["LeafStar", "leafstar"],
    ["https://www.instagram.com/leafstar/?hl=en", "leafstar"],
  ])("reads %s as %s", (input, out) => {
    expect(normalizeInstagram(input)).toBe(out);
  });
  it.each(["", "@", "leaf star", "a".repeat(31)])("rejects %s", (input) => {
    expect(normalizeInstagram(input)).toBeNull();
  });
});

describe("where to go after login", () => {
  it("keeps admin paths", () => {
    expect(safeAdminPath("/admin/settings")).toBe("/admin/settings");
    expect(safeAdminPath("/admin/inventory?filter=low")).toBe("/admin/inventory?filter=low");
  });
  it.each(["https://evil.example/admin", "//evil.example", "/catalog", "/admin\\..\\x", "/admin/login", "/admin/forgot-password", null, ""])(
    "refuses %s",
    (input) => {
      expect(safeAdminPath(input)).toBe("/admin");
    },
  );
});

describe("facebook page", () => {
  it("takes a page link, a profile.php link or the bare value", () => {
    expect(normalizeFacebook("https://www.facebook.com/100091435143951/")).toBe("100091435143951");
    expect(normalizeFacebook("https://www.facebook.com/profile.php?id=100091435143951")).toBe("100091435143951");
    expect(normalizeFacebook("https://facebook.com/leafstar.clothing?ref=x")).toBe("leafstar.clothing");
    expect(normalizeFacebook("leafstar.clothing")).toBe("leafstar.clothing");
  });
  it("refuses things that cannot be a page", () => {
    expect(normalizeFacebook("abc")).toBeNull();
    expect(normalizeFacebook("bad name!")).toBeNull();
  });
});
