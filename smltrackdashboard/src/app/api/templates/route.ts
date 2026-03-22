import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/mongodb";
import { ObjectId } from "mongodb";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const db = await getDB();
    const templates = await db
      .collection("reply_templates")
      .find()
      .sort({ usageCount: -1, createdAt: -1 })
      .toArray();

    return NextResponse.json(
      templates.map((t) => ({ ...t, _id: t._id.toString() }))
    );
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const db = await getDB();
    const body = await request.json();

    const template = {
      title: body.title || "Template ใหม่",
      content: body.content || "",
      category: body.category || "custom",
      usageCount: 0,
      createdAt: new Date(),
    };

    const result = await db.collection("reply_templates").insertOne(template);
    return NextResponse.json({ _id: result.insertedId.toString(), ...template });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const db = await getDB();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    await db.collection("reply_templates").deleteOne({ _id: new ObjectId(id) });

    // bump usage count
    return NextResponse.json({ status: "ok" });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  // bump usageCount when template is used
  try {
    const db = await getDB();
    const body = await request.json();
    if (body.id) {
      await db.collection("reply_templates").updateOne(
        { _id: new ObjectId(body.id) },
        { $inc: { usageCount: 1 } }
      );
    }
    return NextResponse.json({ status: "ok" });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
