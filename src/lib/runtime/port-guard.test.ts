import { createServer, type Server } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import {
  assertPortAvailable,
  assertServerIdentity,
  isPortAvailable,
  waitForPortReleased,
} from "./port-guard";

describe.sequential("isolated server identity and port ownership", () => {
  let server: Server | undefined;

  afterEach(async () => {
    if (server?.listening) {
      await new Promise<void>((resolve, reject) =>
        server?.close((error) => (error ? reject(error) : resolve())),
      );
    }
    server = undefined;
  });

  it("rejects an unknown process already occupying a requested port", async () => {
    server = createServer();
    await new Promise<void>((resolve) => server?.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("missing test port");
    await expect(assertPortAvailable(address.port)).rejects.toThrow("PORT_ALREADY_IN_USE");
  });

  it("detects a server identity mismatch before reuse", () => {
    expect(() =>
      assertServerIdentity(
        {
          executionMode: "production",
          runId: "unknown",
          pid: 1,
          port: 3100,
          providerMode: "Blocked",
          startTimestamp: new Date().toISOString(),
          liveRequests: 0,
        },
        {
          executionMode: "mock_e2e",
          runId: "expected",
          port: 3100,
          providerMode: "MockProvider",
        },
      ),
    ).toThrow("SERVER_IDENTITY_MISMATCH");
  });

  it("confirms the owned server port is released after shutdown", async () => {
    server = createServer();
    await new Promise<void>((resolve) => server?.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("missing test port");
    const port = address.port;
    expect(await isPortAvailable(port)).toBe(false);
    await new Promise<void>((resolve, reject) =>
      server?.close((error) => (error ? reject(error) : resolve())),
    );
    server = undefined;
    await expect(waitForPortReleased(port)).resolves.toBeUndefined();
  });
});
