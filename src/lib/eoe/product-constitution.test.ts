import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("Product Constitution", () => {
  it("keeps task quality above Overlay and Adaptive Progression disabled in M2.4", () => {
    const text = readFileSync(join(process.cwd(), "docs", "PRODUCT_CONSTITUTION.md"), "utf8");
    expect(text).toContain("General assistant first");
    expect(text.toLocaleLowerCase()).toContain("task completeness");
    expect(text).toContain("English is an overlay");
    expect(text).toContain("does not start Adaptive Progression");
  });
});
