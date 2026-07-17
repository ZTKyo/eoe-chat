import { assertMockE2eEnvironment, resolveExecutionMode } from "@/lib/runtime/execution-mode";

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs" && resolveExecutionMode() === "mock_e2e") {
    assertMockE2eEnvironment();
  }
}
