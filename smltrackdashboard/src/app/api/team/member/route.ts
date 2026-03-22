import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { getDB } from "@/lib/mongodb";

// PUT — เปลี่ยน role
export async function PUT(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { userId, role } = await req.json();
    const validRoles = ["admin", "responder", "reviewer", "viewer"];
    if (!role || !validRoles.includes(role)) {
      return NextResponse.json({ error: "Role ไม่ถูกต้อง" }, { status: 400 });
    }

    const db = await getDB();
    const emailDoc = await db.collection("user_emails").findOne({ email: user.email });
    if (!emailDoc) return NextResponse.json({ error: "ไม่พบบัญชี" }, { status: 404 });

    const team = await db.collection("teams").findOne({ ownerId: emailDoc.userId });
    if (!team) return NextResponse.json({ error: "ไม่พบทีม" }, { status: 404 });

    // ห้ามเปลี่ยน role ของตัวเอง
    if (userId === emailDoc.userId) {
      return NextResponse.json({ error: "ไม่สามารถเปลี่ยน role ของตัวเองได้" }, { status: 400 });
    }

    await db.collection("team_members").updateOne(
      { teamId: team._id.toString(), userId },
      { $set: { role, updatedAt: new Date() } }
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[PUT /api/team/member]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// DELETE — ลบสมาชิก
export async function DELETE(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { userId } = await req.json();
    if (!userId) {
      return NextResponse.json({ error: "กรุณาระบุ userId" }, { status: 400 });
    }

    const db = await getDB();
    const emailDoc = await db.collection("user_emails").findOne({ email: user.email });
    if (!emailDoc) return NextResponse.json({ error: "ไม่พบบัญชี" }, { status: 404 });

    const team = await db.collection("teams").findOne({ ownerId: emailDoc.userId });
    if (!team) return NextResponse.json({ error: "ไม่พบทีม" }, { status: 404 });

    // ห้ามลบตัวเอง
    if (userId === emailDoc.userId) {
      return NextResponse.json({ error: "ไม่สามารถลบตัวเองออกได้" }, { status: 400 });
    }

    await db.collection("team_members").deleteOne({
      teamId: team._id.toString(),
      userId,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[DELETE /api/team/member]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
