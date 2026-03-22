import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { getDB } from "@/lib/mongodb";

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { email, role } = await req.json();

    if (!email || !role) {
      return NextResponse.json({ message: "กรุณากรอก email และ role" }, { status: 400 });
    }

    const validRoles = ["admin", "responder", "reviewer", "viewer"];
    if (!validRoles.includes(role)) {
      return NextResponse.json({ message: "Role ไม่ถูกต้อง" }, { status: 400 });
    }

    const db = await getDB();

    // หา team ที่ user เป็น owner
    const emailDoc = await db.collection("user_emails").findOne({ email: user.email });
    if (!emailDoc) {
      return NextResponse.json({ message: "ไม่พบบัญชีผู้ใช้" }, { status: 404 });
    }

    const team = await db.collection("teams").findOne({ ownerId: emailDoc.userId });
    if (!team) {
      return NextResponse.json({ message: "ไม่พบทีม" }, { status: 404 });
    }

    // ตรวจสอบว่า inviter เป็น admin
    const inviterMembership = await db.collection("team_members").findOne({
      teamId: team._id.toString(),
      userId: emailDoc.userId,
    });
    if (!inviterMembership || !["admin"].includes(inviterMembership.role)) {
      return NextResponse.json({ message: "ไม่มีสิทธิ์เชิญสมาชิก" }, { status: 403 });
    }

    // หา user ที่ถูกเชิญด้วย email
    const inviteeEmailDoc = await db.collection("user_emails").findOne({ email });

    if (!inviteeEmailDoc) {
      // ยังไม่ได้สมัคร → เก็บ pending invite
      await db.collection("pending_invites").updateOne(
        { email, teamId: team._id.toString() },
        {
          $set: {
            email,
            teamId: team._id.toString(),
            role,
            invitedBy: emailDoc.userId,
            updatedAt: new Date(),
          },
          $setOnInsert: { createdAt: new Date() },
        },
        { upsert: true }
      );
      return NextResponse.json({ message: `ส่งคำเชิญให้ ${email} แล้ว (จะเข้าร่วมอัตโนมัติเมื่อ Login ครั้งแรก)` });
    }

    // ตรวจว่าเป็นสมาชิกอยู่แล้ว
    const existingMember = await db.collection("team_members").findOne({
      teamId: team._id.toString(),
      userId: inviteeEmailDoc.userId,
    });

    if (existingMember) {
      return NextResponse.json({ message: `${email} เป็นสมาชิกทีมนี้อยู่แล้ว` }, { status: 400 });
    }

    // เพิ่มเป็นสมาชิกทันที
    await db.collection("team_members").insertOne({
      teamId: team._id.toString(),
      userId: inviteeEmailDoc.userId,
      role,
      addedAt: new Date(),
      addedBy: emailDoc.userId,
    });

    return NextResponse.json({ message: `เพิ่ม ${email} เป็น ${role} สำเร็จ` });
  } catch (err) {
    console.error("[POST /api/team/invite]", err);
    return NextResponse.json({ message: "เกิดข้อผิดพลาด" }, { status: 500 });
  }
}
