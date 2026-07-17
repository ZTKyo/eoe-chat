import { spawn } from "node:child_process";
import { join, resolve } from "node:path";
import {
  assertPortAvailable,
  pipeChildOutput,
  removeRuntimeState,
  startNextServer,
  stopOwnedServer,
  waitForIdentity,
  writeSafeRuntimeState,
} from "./lib/isolated-server.mjs";

const cwd = process.cwd();
const port = 3100;
const runId = `mock-e2e-${crypto.randomUUID()}`;
const startedAt = new Date().toISOString();
const statePath = resolve(cwd, ".eoe-runtime", `${runId}.json`);
const explicitEnvironment = {
  ...process.env,
  EOE_EXECUTION_MODE: "mock_e2e",
  USE_MOCK_PROVIDER: "true",
  EOE_ALLOW_LIVE_PROVIDER: "false",
  EOE_ENABLE_IMAGE_INPUT: "false",
  EOE_SERVER_PORT: String(port),
  EOE_SERVER_RUN_ID: runId,
  EOE_SERVER_STARTED_AT: startedAt,
  EOE_TEST_PORT: String(port),
  EOE_EXPECTED_SERVER_MODE: "mock_e2e",
  EOE_EXPECTED_SERVER_RUN_ID: runId,
  EOE_EXPECTED_PROVIDER_MODE: "MockProvider",
  PLAYWRIGHT_EXTERNAL_SERVER: "true",
};

let server;
let exitCode = 1;
try {
  await assertPortAvailable(port);
  server = startNextServer({ cwd, port, env: explicitEnvironment });
  pipeChildOutput(server, "mock-e2e-server");
  const identity = await waitForIdentity({
    port,
    expected: {
      executionMode: "mock_e2e",
      runId,
      port,
      providerMode: "MockProvider",
    },
  });
  await writeSafeRuntimeState(statePath, identity);

  const playwrightCli = join(cwd, "node_modules", "@playwright", "test", "cli.js");
  const tests = spawn(process.execPath, [playwrightCli, "test"], {
    cwd,
    env: explicitEnvironment,
    stdio: "inherit",
    windowsHide: true,
  });
  exitCode = await new Promise((resolveExit, reject) => {
    tests.once("error", reject);
    tests.once("exit", (code) => resolveExit(code ?? 1));
  });

  const finalIdentity = await waitForIdentity({
    port,
    expected: {
      executionMode: "mock_e2e",
      runId,
      port,
      providerMode: "MockProvider",
    },
  });
  if (finalIdentity.liveRequests !== 0) throw new Error("MOCK_E2E_LIVE_REQUESTS_DETECTED");
  console.log("EOE_EXECUTION_MODE=mock_e2e");
  console.log("Provider=MockProvider");
  console.log("Live requests=0");
} finally {
  if (server) await stopOwnedServer(server, port);
  await removeRuntimeState(statePath);
}

process.exitCode = exitCode;
