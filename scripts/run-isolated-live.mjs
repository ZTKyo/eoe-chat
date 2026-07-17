import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import {
  assertPortAvailable,
  pipeChildOutput,
  removeRuntimeState,
  startNextServer,
  stopOwnedServer,
  waitForIdentity,
  writeSafeRuntimeState,
} from "./lib/isolated-server.mjs";

function parseLocalEnvironment(contents) {
  const values = {};
  for (const line of contents.split(/\r?\n/u)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/u);
    if (!match) continue;
    values[match[1]] = match[2].replace(/^(['"])(.*)\1$/u, "$2").trim();
  }
  return values;
}

async function loadLocalEnvironment(cwd) {
  const path = join(cwd, ".env.local");
  if (!existsSync(path)) return {};
  return parseLocalEnvironment(await readFile(path, "utf8"));
}

async function createFreshLedger({ path, runId, mode, limits, startedAt }) {
  await mkdir(dirname(path), { recursive: true });
  const ledger = {
    schemaVersion: "eoe.live-budget.v2",
    runId,
    executionMode: mode,
    startedAt,
    requestBudget: limits.requestBudget,
    tokenBudget: limits.tokenBudget,
    runtimeBudgetMs: limits.runtimeBudgetMs,
    requestCount: 0,
    tokenCount: 0,
    providerRuntimeMs: 0,
    attempts: [],
  };
  await writeFile(path, `${JSON.stringify(ledger, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
}

export async function runIsolatedLive(options) {
  const cwd = process.cwd();
  const localEnvironment = await loadLocalEnvironment(cwd);
  const ledgerPath = resolve(cwd, options.ledgerPath);
  const existingLedger = options.resumeLedger && existsSync(ledgerPath)
    ? JSON.parse(await readFile(ledgerPath, "utf8"))
    : undefined;
  const startedAt = existingLedger?.startedAt ?? new Date().toISOString();
  const runId = existingLedger?.runId ?? `${options.runPrefix}-${startedAt.replace(/[:.]/gu, "-")}`;
  const statePath = resolve(cwd, ".eoe-runtime", `${runId}.json`);
  const keys = {
    GLM_API_KEY: process.env.GLM_API_KEY || localEnvironment.GLM_API_KEY || "",
    DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY || localEnvironment.DEEPSEEK_API_KEY || "",
  };

  if (!keys.GLM_API_KEY.trim() || !keys.DEEPSEEK_API_KEY.trim()) {
    throw new Error("LIVE_PROVIDER_BLOCKED_BY_EXECUTION_GUARD: provider keys are missing");
  }
  if (!options.resumeLedger && existsSync(ledgerPath)) {
    throw new Error(`LIVE_PROVIDER_BLOCKED_BY_EXECUTION_GUARD: fresh Ledger already exists: ${ledgerPath}`);
  }
  if (options.resumeLedger && !existingLedger) {
    throw new Error(`LIVE_PROVIDER_BLOCKED_BY_EXECUTION_GUARD: resumable Ledger is missing: ${ledgerPath}`);
  }
  if (
    existingLedger &&
    (
      existingLedger.executionMode !== options.mode ||
      existingLedger.requestBudget !== options.limits.requestBudget ||
      existingLedger.tokenBudget !== options.limits.tokenBudget ||
      existingLedger.runtimeBudgetMs !== options.limits.runtimeBudgetMs
    )
  ) {
    throw new Error("LIVE_PROVIDER_BLOCKED_BY_EXECUTION_GUARD: resumable Ledger identity or budgets do not match");
  }

  await assertPortAvailable(options.port);
  if (!existingLedger) {
    await createFreshLedger({
      path: ledgerPath,
      runId,
      mode: options.mode,
      limits: options.limits,
      startedAt,
    });
  }

  const explicitEnvironment = {
    ...process.env,
    ...localEnvironment,
    ...keys,
    EOE_EXECUTION_MODE: options.mode,
    EOE_ALLOW_LIVE_PROVIDER: "true",
    EOE_LIVE_RUN_ID: runId,
    EOE_LIVE_LEDGER_PATH: ledgerPath,
    EOE_SERVER_PORT: String(options.port),
    EOE_SERVER_RUN_ID: runId,
    EOE_SERVER_STARTED_AT: startedAt,
    EOE_TEST_PORT: String(options.port),
    EOE_EXPECTED_SERVER_MODE: options.mode,
    EOE_EXPECTED_SERVER_RUN_ID: runId,
    EOE_EXPECTED_PROVIDER_MODE: "LiveProvider",
    USE_MOCK_PROVIDER: "false",
    EOE_ENABLE_IMAGE_INPUT: options.imageInputEnabled === true ? "true" : "false",
    [options.enableVariable]: "true",
    ...(options.extraEnvironment ?? {}),
  };

  console.log(`Run ID=${runId}`);
  console.log(`Execution Mode=${options.mode}`);
  console.log(`Port=${options.port}`);
  console.log(`Ledger Path=${ledgerPath}`);
  console.log(`Request Budget=${options.limits.requestBudget}`);
  console.log(`Token Budget=${options.limits.tokenBudget}`);
  console.log(`Runtime Budget=${options.limits.runtimeBudgetMs}`);
  console.log(`Current Request Count=${existingLedger?.requestCount ?? 0}`);
  console.log(`Current Token Count=${existingLedger?.tokenCount ?? 0}`);
  console.log(`Current Runtime=${existingLedger?.providerRuntimeMs ?? 0}`);
  console.log(`Provider keys present=${Boolean(keys.GLM_API_KEY.trim() && keys.DEEPSEEK_API_KEY.trim())}`);

  let server;
  let exitCode = 1;
  try {
    server = startNextServer({ cwd, port: options.port, env: explicitEnvironment });
    pipeChildOutput(server, `${options.mode}-server`);
    const identity = await waitForIdentity({
      port: options.port,
      expected: {
        executionMode: options.mode,
        runId,
        port: options.port,
        providerMode: "LiveProvider",
      },
    });
    await writeSafeRuntimeState(statePath, identity);

    const vitest = join(cwd, "node_modules", "vitest", "vitest.mjs");
    const tests = spawn(
      process.execPath,
      [vitest, "run", options.testFile, "--reporter=verbose"],
      {
        cwd,
        env: explicitEnvironment,
        stdio: "inherit",
        windowsHide: true,
      },
    );
    exitCode = await new Promise((resolveExit, reject) => {
      tests.once("error", reject);
      tests.once("exit", (code) => resolveExit(code ?? 1));
    });
  } finally {
    if (existsSync(ledgerPath)) {
      const ledger = JSON.parse(await readFile(ledgerPath, "utf8"));
      ledger.completedAt = new Date().toISOString();
      const temporary = `${ledgerPath}.${process.pid}.complete.tmp`;
      await writeFile(temporary, `${JSON.stringify(ledger, null, 2)}\n`, "utf8");
      await rename(temporary, ledgerPath);
    }
    if (server) await stopOwnedServer(server, options.port);
    await removeRuntimeState(statePath);
  }
  return exitCode;
}
