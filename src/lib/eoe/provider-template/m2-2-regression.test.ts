import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getPhraseById } from "../registry/phrase-registry";
import { getPhraseRealizationProfile } from "../registry/phrase-realization";
import { parseProviderResponseTemplate } from "./parser";
import { validateProviderResponseTemplate } from "./validator";

interface Fixture {
  fixtureVersion: string;
  failureClass: string;
  rawProviderText: string;
  expectedM23Code: string;
}

const directory = join(process.cwd(), "artifacts", "regressions", "m2.2-live-failures");
const fixturesAvailable = existsSync(directory);
const files = fixturesAvailable
  ? readdirSync(directory).filter((name) => name.endsWith(".json"))
  : [];

describe.skipIf(!fixturesAvailable)("redacted M2.2 live failure regression fixtures", () => {
  it("preserves four distinct redacted failure classes", () => {
    expect(files).toHaveLength(4);
    const fixtures = files.map((name) => JSON.parse(readFileSync(join(directory, name), "utf8")) as Fixture);
    expect(new Set(fixtures.map((item) => item.failureClass)).size).toBe(4);
    expect(fixtures.every((item) => item.fixtureVersion === "m2.2-live-failure.redacted.v1")).toBe(true);
  });

  it.each(files)("rejects %s for its expected M2.3 reason", (name) => {
    const fixture = JSON.parse(readFileSync(join(directory, name), "utf8")) as Fixture;
    const parsed = parseProviderResponseTemplate(fixture.rawProviderText);
    if (!parsed.success) {
      expect(parsed.diagnostics.map((item) => item.code)).toContain(fixture.expectedM23Code);
      return;
    }
    const phrase = getPhraseById("p-step-by-step")!;
    const validation = validateProviderResponseTemplate(parsed.template, {
      selectedPhrase: phrase,
      realizationProfile: getPhraseRealizationProfile(phrase.id),
      effectiveLevel: 2,
    });
    expect(validation.result.violations.map((item) => item.code)).toContain(fixture.expectedM23Code);
  });
});
