import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/mongodb";
import { ObjectId } from "mongodb";

export const dynamic = "force-dynamic";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = await getDB();
    const body = await request.json();

    const allowed = [
      "title", "notes", "dueDate", "priority", "status", "assignee",
      "customerId", "customerName",
    ];
    const updates: any = { updatedAt: new Date() };
    for (const key of allowed) {
      if (body[key] !== undefined) {
        if (key === "dueDate") {
          updates[key] = body[key] ? new Date(body[key]) : null;
        } else {
          updates[key] = body[key];
        }
      }
    }

    if (body.status === "completed" && !body.completedAt) {
      updates.completedAt = new Date();
    } else if (body.status && body.status !== "completed") {
      updates.completedAt = null;
    }

    await db.collection("tasks").updateOne(
      { _id: new ObjectId(id) },
      { $set: updates }
    );

    return NextResponse.json({ status: "ok" });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = await getDB();
    await db.collection("tasks").deleteOne({ _id: new ObjectId(id) });
    return NextResponse.json({ status: "ok" });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
