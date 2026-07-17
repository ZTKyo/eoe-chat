const key = Symbol.for("eoe.live-request-monitor");

interface MonitorState {
  count: number;
}

function state(): MonitorState {
  const root = globalThis as typeof globalThis & { [key]?: MonitorState };
  root[key] ??= { count: 0 };
  return root[key];
}

export function recordNativeLiveRequest(): void {
  state().count += 1;
}

export function getNativeLiveRequestCount(): number {
  return state().count;
}

export function resetNativeLiveRequestCountForTest(): void {
  state().count = 0;
}
