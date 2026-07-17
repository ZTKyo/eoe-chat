import { spawn, spawnSync } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import net from "node:net";
import { dirname, join, resolve } from "node:path";

const host = "127.0.0.1";

export async function isPortAvailable(port) {
  return new Promise((resolvePromise, reject) => {
    const server = net.createServer();
    server.once("error", (error) => {
      if (error.code === "EADDRINUSE") resolvePromise(false);
      else reject(error);
    });
    server.once("listening", () => {
      server.close((error) => {
        if (error) reject(error);
        else resolvePromise(true);
      });
    });
    server.listen(port, host);
  });
}

export async function assertPortAvailable(port) {
  if (!(await isPortAvailable(port))) throw new Error(`PORT_ALREADY_IN_USE:${host}:${port}`);
}

export async function waitForPortReleased(port, timeoutMs = 15_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await isPortAvailable(port)) return;
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 100));
  }
  throw new Error(`PORT_NOT_RELEASED:${host}:${port}`);
}

export async function waitForIdentity({ port, expected, timeoutMs = 120_000 }) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://${host}:${port}/api/runtime-identity`, {
        cache: "no-store",
      });
      if (response.ok) {
        const actual = await response.json();
        for (const key of ["executionMode", "runId", "port", "providerMode"]) {
          if (actual[key] !== expected[key]) {
            throw new Error(`SERVER_IDENTITY_MISMATCH:${key}`);
          }
        }
        return actual;
      }
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 250));
  }
  throw new Error(`SERVER_IDENTITY_UNAVAILABLE:${lastError instanceof Error ? lastError.message : "unknown"}`);
}

export function startNextServer({ cwd, port, env }) {
  const nextCli = join(cwd, "node_modules", "next", "dist", "bin", "next");
  return spawn(process.execPath, [nextCli, "dev", "--hostname", host, "--port", String(port)], {
    cwd,
    env,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
}

export function pipeChildOutput(child, prefix) {
  child.stdout?.on("data", (chunk) => process.stdout.write(`[${prefix}] ${chunk}`));
  child.stderr?.on("data", (chunk) => process.stderr.write(`[${prefix}] ${chunk}`));
}

export async function stopOwnedServer(child, port) {
  if (child.exitCode === null) child.kill("SIGTERM");
  try {
    await waitForPortReleased(port, 5_000);
  } catch {
    if (process.platform === "win32" && child.pid) {
      spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], {
        stdio: "ignore",
        windowsHide: true,
      });
    } else if (child.exitCode === null) {
      child.kill("SIGKILL");
    }
    await waitForPortReleased(port, 10_000);
  }
}

export async function writeSafeRuntimeState(path, identity) {
  const absolute = resolve(path);
  await mkdir(dirname(absolute), { recursive: true });
  await writeFile(absolute, `${JSON.stringify(identity, null, 2)}\n`, "utf8");
}

export async function removeRuntimeState(path) {
  await rm(resolve(path), { force: true });
}
