import { NextResponse } from "next/server";

import { getBackendConnectionErrorMessage, getServerApiBase } from "@/lib/backend-api";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ requestId: string }> },
) {
  const { requestId } = await context.params;
  try {
    const response = await fetch(
      `${getServerApiBase(request)}/api/review/submissions/${encodeURIComponent(requestId)}/heartbeat`,
      {
        method: "POST",
        headers: {
          cookie: request.headers.get("cookie") || "",
        },
      },
    );
    const payload = await response.json().catch(() => null);
    return NextResponse.json(payload || { error: "Unable to heartbeat review lock." }, { status: response.status });
  } catch {
    return NextResponse.json({ error: getBackendConnectionErrorMessage() }, { status: 503 });
  }
}
