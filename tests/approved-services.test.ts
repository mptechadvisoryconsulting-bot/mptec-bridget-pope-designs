import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const dataSource = readFileSync(path.join(process.cwd(), "lib", "data.ts"), "utf8");

describe("approved public service wording", () => {
  it("does not reintroduce removed service phrases in the landing-page data source", () => {
    for (const phrase of ["curated rentals", "cake displays", "lounge vignettes", "ceiling moments", "payment milestones"]) {
      expect(dataSource.toLowerCase(), phrase).not.toContain(phrase);
    }
  });

  it("keeps exactly the approved public service categories", () => {
    for (const service of ["Weddings", "Baby Showers", "Birthdays", "Corporate Events", "Luxury Balloons", "Full Planning"]) {
      expect(dataSource).toContain(service);
    }

    for (const removed of ["Graduations", "Rentals", "Custom Signage"]) {
      expect(dataSource).not.toContain(removed);
    }
  });
});
