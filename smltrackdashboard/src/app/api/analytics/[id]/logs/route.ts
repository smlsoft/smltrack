import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/mongodb";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: sourceId } = await params;
    const db = await getDB();

    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get("limit") || "20");

    const logs = await db
      .collection("analysis_logs")
      .find({ sourceId })
      .sort({ analyzedAt: -1 })
      .limit(limit)
      .toArray();

    return NextResponse.json(
      logs.map((l) => ({
        ...l,
        _id: l._id.toString(),
      }))
    );
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
