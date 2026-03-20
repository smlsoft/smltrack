import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { channelAccessToken } = await req.json();

  if (!channelAccessToken) {
    return NextResponse.json({ ok: false, error: "กรุณากรอก Channel Access Token" }, { status: 400 });
  }

  try {
    const res = await fetch("https://api.line.me/v2/bot/info", {
      headers: { Authorization: `Bearer ${channelAccessToken}` },
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      return NextResponse.json({
        ok: false,
        error: errBody.message || `LINE API ตอบ ${res.status}`,
      }, { status: res.status });
    }

    const botInfo = await res.json();
    return NextResponse.json({
      ok: true,
      botName: botInfo.displayName,
      botId: botInfo.userId,
      pictureUrl: botInfo.pictureUrl,
      premium: botInfo.premiumId || null,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "เชื่อมต่อ LINE API ไม่ได้";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
