import { NextResponse } from "next/server";
import { getDB } from "@/lib/mongodb";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const db = await getDB();
    const customers = await db.collection("customers").find().sort({ updatedAt: -1 }).toArray();
    return NextResponse.json(customers.map((c) => ({ ...c, _id: c._id.toString() })));
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
