import { NextResponse } from "next/server";
import { getDB } from "@/lib/mongodb";

export async function GET() {
  try {
    const db = await getDB();
    const latest = await db
      .collection("ai_advice")
      .find({})
      .sort({ createdAt: -1 })
      .limit(5)
      .toArray();
    return NextResponse.json(latest);
  } catch {
    return NextResponse.json([]);
  }
}
