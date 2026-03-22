import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/mongodb";

export const dynamic = "force-dynamic";

// Dashboard proxy: forward send request to Agent, then save to DB
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sourceId, platform, text, imageUrl, staffName } = body;

    if (!sourceId || !platform) {
      return NextResponse.json({ error: "sourceId and platform required" }, { status: 400 });
    }
    if (!text && !imageUrl) {
      return NextResponse.json({ error: "text or imageUrl required" }, { status: 400 });
    }

    // Forward to Agent (proxy) which has the actual LINE/Meta tokens
    const agentUrl = process.env.AGENT_URL || "http://localhost:3000";
    const agentRes = await fetch(`${agentUrl}/api/inbox/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sourceId, platform, text, imageUrl, staffName }),
    });

    if (!agentRes.ok) {
      const errText = await agentRes.text().catch(() => "agent error");
      return NextResponse.json({ error: errText }, { status: agentRes.status });
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
