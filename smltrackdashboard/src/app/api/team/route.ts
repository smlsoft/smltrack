import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { getDB } from "@/lib/mongodb";

export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = await getDB();

    // หา team ของ user
    const membership = await db
      .collection("team_members")
      .findOne({ userId: user.id, role: "admin" });

    if (!membership) {
      // user ไม่ใช่ admin ของ team ไหนเลย → ดึง team ที่เป็นสมาชิก
      const myMembership = await db.collection("team_members").findOne({ userId: user.id });
      if (!myMembership) {
        return NextResponse.json({ members: [] });
      }
    }

    // ดึง team ที่ user เป็น admin หรือ owner
    const emailDoc = await db.collection("user_emails").findOne({ email: user.email });
    if (!emailDoc) return NextResponse.json({ members: [] });

    const team = await db.collection("teams").findOne({ ownerId: emailDoc.userId });
    if (!team) return NextResponse.json({ members: [] });

    // ดึง team_members ทั้งหมดใน team
    const teamMembers = await db
      .collection("team_members")
      .find({ teamId: team._id })
      .toArray();

    // ดึง user info สำหรับแต่ละ member
    const memberDetails = await Promise.all(
      teamMembers.map(async (m) => {
        const userDoc = await db.collection("users").findOne({ _id: m.userId });
        const emailEntry = await db.collection("user_emails").findOne({ userId: m.userId, isPrimary: true });
        return {
          _id: m._id.toString(),
          userId: m.userId,
          email: emailEntry?.email || "",
          name: userDoc?.name || "",
          image: userDoc?.image || "",
          role: m.role,
          addedAt: m.addedAt,
        };
      })
    );

    return NextResponse.json({ members: memberDetails, teamId: team._id });
  } catch (err) {
    console.error("[GET /api/team]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
