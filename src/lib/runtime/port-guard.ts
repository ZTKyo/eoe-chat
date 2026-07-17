import { createServer } from "node:net";
import type { ServerIdentity } from "./server-identity";

export async function isPortAvailable(port: number, host = "127.0.0.1"): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", (error: NodeJS.ErrnoException) => {
      if (error.code === "EADDRINUSE") {
        resolve(false);
        return;
      }
      reject(error);
    });
    server.once("listening", () => {
      server.close((error) => {
        if (error) reject(error);
        else resolve(true);
      });
    });
    server.listen(port, host);
  });
}

export async function assertPortAvailable(port: number, host = "127.0.0.1"): Promise<void> {
  if (!(await isPortAvailable(port, host))) {
    throw new Error(`PORT_ALREADY_IN_USE:${host}:${port}`);
  }
}

export async function waitForPortReleased(
  port: number,
  options: { host?: string; timeoutMs?: number; pollMs?: number } = {},
): Promise<void> {
  const host = options.host ?? "127.0.0.1";
  const timeoutMs = options.timeoutMs ?? 10_000;
  const pollMs = options.pollMs ?? 100;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await isPortAvailable(port, host)) return;
    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }
  throw new Error(`PORT_NOT_RELEASED:${host}:${port}`);
}

export function assertServerIdentity(
  actual: ServerIdentity,
  expected: Pick<ServerIdentity, "executionMode" | "runId" | "port" | "providerMode">,
): void {
  for (const key of ["executionMode", "runId", "port", "providerMode"] as const) {
    if (actual[key] !== expected[key]) {
      throw new Error(`SERVER_IDENTITY_MISMATCH:${key}`);
    }
  }
}
