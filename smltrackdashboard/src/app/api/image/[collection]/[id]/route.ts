import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/mongodb";
import { ObjectId } from "mongodb";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ collection: string; id: string }> }
) {
  try {
    const { id } = await params;
    const db = await getDB();
    // ดึงจาก messages collection เดียว
    const doc = await db.collection("messages").findOne(
      { _id: new ObjectId(id) },
      { projection: { imageUrl: 1 } }
    );

    if (!doc?.imageUrl) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }

    const match = doc.imageUrl.match(/^data:(.+);base64,(.+)$/);
    if (!match) {
      return NextResponse.json({ error: "invalid format" }, { status: 400 });
    }

    const buffer = Buffer.from(match[2], "base64");
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": match[1],
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
