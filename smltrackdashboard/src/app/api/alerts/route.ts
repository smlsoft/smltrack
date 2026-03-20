import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/mongodb";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const db = await getDB();
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get("limit") || "20");
    const unreadOnly = url.searchParams.get("unread") === "1";

    const query: any = {};
    if (unreadOnly) query.read = false;

    const alerts = await db
      .collection("alerts")
      .find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();

    const unreadCount = await db.collection("alerts").countDocuments({ read: false });

    return NextResponse.json({
      alerts: alerts.map((a) => ({ ...a, _id: a._id.toString() })),
      unreadCount,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
