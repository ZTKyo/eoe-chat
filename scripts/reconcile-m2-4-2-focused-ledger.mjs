import { readFile, rename, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const path = resolve("artifacts/benchmarks/m2.4.2-focused-live-budget.json");
const ledger = JSON.parse(await readFile(path, "utf8"));
if (ledger.runId !== "m2-4-2-focused-2026-07-17T03-09-04-609Z" || ledger.attempts.length !== 14) {
  throw new Error("Refusing to reconcile an unexpected Focused Ledger.");
}

const cycleOne = [
  ["pass", ["template_boundary_invalid"], false],
  ["pass", ["template_boundary_invalid"], false],
  ["pass", [], false],
  ["fail", [], true],
  ["fail", [], true],
  ["pass", ["use_phrase_conflict"], false],
  ["pass", ["use_phrase_conflict"], false],
  ["pass", [], false],
  ["fail", ["domain_validator_failed", "grammatical_role_mismatch"], true],
  ["fail", ["domain_validator_failed", "grammatical_role_mismatch"], true],
];

for (const [index, [pipelineOutcome, violationCodes, naturalFallback]] of cycleOne.entries()) {
  Object.assign(ledger.attempts[index], {
    pipelineOutcome,
    violationCodes,
    fallback: false,
    naturalFallback,
    securityStop: false,
  });
}
ledger.completedAt = new Date().toISOString();
const temporary = `${path}.${process.pid}.reconciled.tmp`;
await writeFile(temporary, `${JSON.stringify(ledger, null, 2)}\n`, "utf8");
await rename(temporary, path);
console.log("M2.4.2 Focused Ledger annotations reconciled from preserved cycle-one evidence.");
