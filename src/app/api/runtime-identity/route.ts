import { NextResponse } from "next/server";
import { serverIdentityFromEnvironment } from "@/lib/runtime/server-identity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  try {
    return NextResponse.json(serverIdentityFromEnvironment(), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "SERVER_IDENTITY_INVALID",
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
