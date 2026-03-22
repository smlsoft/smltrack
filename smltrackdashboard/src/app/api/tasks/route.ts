import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/mongodb";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const db = await getDB();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const filter: any = {};
    if (status && status !== "all") filter.status = status;

    const tasks = await db
      .collection("tasks")
      .find(filter)
      .sort({ dueDate: 1, createdAt: -1 })
      .toArray();

    return NextResponse.json(
      tasks.map((t) => ({ ...t, _id: t._id.toString() }))
    );
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const db = await getDB();
    const body = await request.json();

    const task = {
      customerId: body.customerId || "",
      customerName: body.customerName || "",
      title: body.title || "งานใหม่",
      notes: body.notes || "",
      dueDate: body.dueDate ? new Date(body.dueDate) : null,
      priority: body.priority || "medium",
      status: "pending",
      assignee: body.assignee || "",
      createdBy: body.createdBy || "",
      createdAt: new Date(),
      completedAt: null,
    };

    const result = await db.collection("tasks").insertOne(task);
    return NextResponse.json({ _id: result.insertedId.toString(), ...task });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
