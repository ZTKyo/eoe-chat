import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("M2.4 privacy-free vision fixtures", () => {
  it.each([
    "m2.4-geometry.svg",
    "m2.4-ui-text.svg",
    "m2.4-multi-object.svg",
    "m2.4-uncertain.svg",
  ])("contains a self-contained synthetic SVG: %s", (name) => {
    const text = readFileSync(join(process.cwd(), "tests", "fixtures", name), "utf8");
    expect(text).toContain("<svg");
    expect(text).not.toMatch(/https?:\/\//u);
    expect(text).not.toMatch(/C:\\Users|\/Users\//u);
  });
});
