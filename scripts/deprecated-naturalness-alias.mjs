import { spawnSync } from "node:child_process";
import { join } from "node:path";

console.log("DEPRECATED_ALIAS — use benchmark:structure");
const vitest = join(process.cwd(), "node_modules", "vitest", "vitest.mjs");
const result = spawnSync(
  process.execPath,
  [vitest, "run", "src/lib/eoe/naturalness-benchmark.test.ts", "--reporter=verbose"],
  { cwd: process.cwd(), env: process.env, stdio: "inherit" },
);
process.exit(result.status ?? 1);
