import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getPhraseById } from "../registry/phrase-registry";
import { getPhraseRealizationProfile } from "../registry/phrase-realization";
import { liveAttemptCaptureSchema } from "./live-capture";
import { replayLiveAttempt, sameCodeMultiset } from "./live-replay";
import { parseProviderResponseTemplate } from "./parser";
import { validateProviderResponseTemplate } from "./validator";

interface M22Fixture {
  fixtureVersion: string;
  rawProviderText: string;
  expectedM23Code: string;
}

const root = process.cwd();
const legacyDirectory = join(root, "artifacts", "regressions", "m2.2-live-failures");
const legacyFiles = existsSync(legacyDirectory)
  ? readdirSync(legacyDirectory).filter((name) => name.endsWith(".json"))
  : [];
const liveDirectory = join(root, "artifacts", "regressions", "m2.3-live-captures");
const liveDirectoryAvailable = existsSync(liveDirectory);
const liveFiles = liveDirectoryAvailable
  ? readdirSync(liveDirectory).filter((name) => name.endsWith(".json"))
  : [];

describe("M2.3.1 replayable live failure evidence", () => {
  it.skipIf(legacyFiles.length === 0).each(legacyFiles)("replays legacy redacted evidence: %s", (name) => {
    const fixture = JSON.parse(readFileSync(join(legacyDirectory, name), "utf8")) as M22Fixture;
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

  it.skipIf(!liveDirectoryAvailable)("keeps the historical M2.3 raw-capture gap explicit until a new live run", () => {
    if (liveFiles.length === 0) {
      const note = readFileSync(join(liveDirectory, "README.md"), "utf8");
      expect(note).toContain("not available");
      expect(note).toContain("不会反向构造");
    }
  });

  it.skipIf(liveFiles.length === 0).each(liveFiles)("replays exact live Template evidence: %s", (name) => {
    const raw = JSON.parse(readFileSync(join(liveDirectory, name), "utf8"));
    const fixture = liveAttemptCaptureSchema.parse(raw);
    const replay = replayLiveAttempt(fixture);
    expect(replay.rawHashMatches).toBe(true);
    expect(replay.outcome).toBe(fixture.observed.outcome);
    expect(replay.pipelineStage).toBe(fixture.observed.pipelineStage);
    expect(replay.pipeline).toEqual(fixture.observed.pipeline);
    expect(sameCodeMultiset(replay.violationCodes, fixture.observed.violationCodes)).toBe(true);
    expect(sameCodeMultiset(replay.pipelineCodes, fixture.observed.pipelineCodes)).toBe(true);
  });
});
