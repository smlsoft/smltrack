import { NextRequest, NextResponse } from "next/server";

const CONFIG_PASSWORD = process.env.CONFIG_PASSWORD || "12345";

export async function POST(req: NextRequest) {
  const { password } = await req.json();
  if (password === CONFIG_PASSWORD) {
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ ok: false, error: "รหัสผ่านไม่ถูกต้อง" }, { status: 401 });
}
