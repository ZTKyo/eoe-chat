import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";

const sources = [
  resolve("artifacts/benchmarks/m2.4.2-focused-probe-cycle-1-report.md"),
  resolve("artifacts/benchmarks/m2.4.2-focused-targeted-affected-report.md"),
];
const rows = [];

for (const source of sources) {
  const contents = await readFile(source, "utf8");
  const sections = contents.split(/^### /gmu).slice(1);
  for (const section of sections) {
    const newline = section.indexOf("\n");
    const scenarioId = section.slice(0, newline).trim();
    const encoded = section.match(/^- Provider outputs: (.+)$/mu)?.[1];
    if (!encoded || encoded === "none") continue;
    const outputs = encoded.split(" \\|\\| ").map((value) =>
      value.replaceAll("<br>", "\n").replaceAll("\\|", "|"));
    outputs.forEach((output, index) => {
      rows.push({
        source: basename(source),
        scenarioId,
        outputNumber: index + 1,
        sha256: createHash("sha256").update(output, "utf8").digest("hex"),
      });
    });
  }
}

const target = resolve("artifacts/benchmarks/m2.4.2-focused-provider-output-hashes.md");
await writeFile(target, [
  "# M2.4.2 Focused Provider Output Hashes",
  "",
  "SHA-256 is calculated after losslessly reversing the report's newline and Markdown-pipe escaping. Timeout attempts have no Provider output and therefore no hash.",
  "",
  "| Source | Scenario | Output | SHA-256 |",
  "|---|---|---:|---|",
  ...rows.map((row) => `| ${row.source} | ${row.scenarioId} | ${row.outputNumber} | \`${row.sha256}\` |`),
  "",
].join("\n"), "utf8");

console.log(`Wrote ${rows.length} Provider output hashes to ${target}`);
