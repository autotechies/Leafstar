import { describe, expect, it } from "vitest";
import { cameBackLabel, dayLabel, daysBetween, istDate, timeLabel } from "@/lib/when";

describe("India-time labels", () => {
  it("uses the India calendar day, not UTC", () => {
    expect(istDate("2026-11-08T20:00:00Z")).toBe("2026-11-09"); // 1:30 am on the 9th in India
  });
  it("says Today and Yesterday, otherwise the weekday and date", () => {
    const now = "2026-11-09T10:00:00Z";
    expect(dayLabel("2026-11-09T03:00:00Z", now)).toBe("Today");
    expect(dayLabel("2026-11-08T03:00:00Z", now)).toBe("Yesterday");
    expect(dayLabel("2026-11-01T03:00:00Z", now)).toBe("Sun, 1 Nov 2026");
  });
  it("counts calendar days apart", () => {
    expect(daysBetween("2026-11-01T18:00:00Z", "2026-11-02T01:00:00Z")).toBe(1);
  });
  it("describes how long a visitor was away", () => {
    expect(cameBackLabel("2026-11-01T05:00:00Z", "2026-11-01T11:00:00Z")).toBe("Came back later the same day");
    expect(cameBackLabel("2026-11-01T05:00:00Z", "2026-11-02T05:00:00Z")).toBe("Came back the next day");
    expect(cameBackLabel("2026-11-01T05:00:00Z", "2026-11-04T05:00:00Z")).toBe("Came back after 3 days");
    expect(cameBackLabel("2026-11-01T05:00:00Z", "2026-11-22T05:00:00Z")).toBe("Came back after 3 weeks");
  });
  it("formats the time in lowercase am/pm", () => {
    expect(timeLabel("2026-11-09T10:12:00Z")).toBe("3:42 pm");
  });
});
