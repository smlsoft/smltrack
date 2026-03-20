import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/mongodb";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: sourceId } = await params;
    const db = await getDB();

    const skills = await db
      .collection("user_skills")
      .find({ sourceId })
      .sort({ updatedAt: -1 })
      .toArray();

    return NextResponse.json(
      skills.map((s) => ({
        ...s,
        _id: s._id.toString(),
      }))
    );
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
