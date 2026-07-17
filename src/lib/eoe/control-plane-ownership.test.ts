import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("M2.3 control-plane import boundary", () => {
  it("keeps the deprecated M2.2 Envelope out of the Engine and live runner", () => {
    for (const path of [
      "src/lib/eoe/engine.ts",
      "src/lib/eoe/directive-builder.ts",
      "src/lib/providers/mock-provider.ts",
      "src/lib/providers/live-provider-template.test.ts",
      "scripts/test-live-providers.mjs",
    ]) {
      const source = readFileSync(join(process.cwd(), path), "utf8");
      expect(source, path).not.toContain("provider-envelope");
      expect(source, path).not.toContain("eoe.provider-envelope.v1");
    }
  });

  it("retains the old schema only as an explicit deprecation artifact", () => {
    const source = readFileSync(join(process.cwd(), "src/lib/eoe/provider-envelope/schema.ts"), "utf8");
    expect(source).toContain("deprecated after M2.2");
  });
});
