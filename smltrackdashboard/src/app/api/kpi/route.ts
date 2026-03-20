import { NextResponse } from "next/server";
import { getDB } from "@/lib/mongodb";

export const dynamic = "force-dynamic";

// วิเคราะห์ response time จาก messages — ลูกค้าส่ง → พนักงานตอบ ใช้เวลาเท่าไหร่
function isStaffName(name: string | null) {
  return (name || "").toUpperCase().startsWith("SML");
}
function isBotName(name: string | null) {
  return (name || "").includes("น้องปู");
}

interface ResponseTimeResult {
  avgMinutes: number;
  level: "green" | "yellow" | "red"; // green <5min, yellow <30min, red >30min
  totalResponses: number;
  fastCount: number; // <5min
  mediumCount: number; // 5-30min
  slowCount: number; // >30min
}

function calcResponseTime(messages: any[], staffName?: string): ResponseTimeResult {
  const responseTimes: number[] = [];

  for (let i = 1; i < messages.length; i++) {
    const prev = messages[i - 1];
    const curr = messages[i];
    if (!prev.createdAt || !curr.createdAt) continue;

    // ลูกค้าส่ง → พนักงานตอบ
    const prevIsCustomer = !isStaffName(prev.userName) && !isBotName(prev.userName);
    const currIsStaff = isStaffName(curr.userName);
    if (staffName && curr.userName !== staffName) continue;

    if (prevIsCustomer && currIsStaff) {
      const diffMs = new Date(curr.createdAt).getTime() - new Date(prev.createdAt).getTime();
      if (diffMs > 0 && diffMs < 86400000) { // ไม่เกิน 24 ชม.
        responseTimes.push(diffMs / 60000); // เป็นนาที
      }
    }
  }

  const total = responseTimes.length;
  if (total === 0) return { avgMinutes: 0, level: "green", totalResponses: 0, fastCount: 0, mediumCount: 0, slowCount: 0 };

  const avg = Math.round(responseTimes.reduce((a, b) => a + b, 0) / total);
  const fast = responseTimes.filter((t) => t < 5).length;
  const medium = responseTimes.filter((t) => t >= 5 && t < 30).length;
  const slow = responseTimes.filter((t) => t >= 30).length;

  return {
    avgMinutes: avg,
    level: avg < 5 ? "green" : avg < 30 ? "yellow" : "red",
    totalResponses: total,
    fastCount: fast,
    mediumCount: medium,
    slowCount: slow,
  };
}

export async function GET() {
  try {
    const db = await getDB();

    const [allSkills, allAnalytics, allMeta, totalMessages] = await Promise.all([
      db.collection("user_skills").find().toArray(),
      db.collection("chat_analytics").find().toArray(),
      db.collection("groups_meta").find().toArray(),
      db.collection("messages").countDocuments(),
    ]);

    // ดึงข้อความทุกห้อง (เฉพาะ field ที่ต้องใช้ + เรียงตามเวลา)
    const allMessages = await db
      .collection("messages")
      .find({}, { projection: { sourceId: 1, userName: 1, createdAt: 1 } })
      .sort({ createdAt: 1 })
      .toArray();

    // แยกข้อความตามห้อง
    const messagesByRoom: Record<string, any[]> = {};
    for (const m of allMessages) {
      if (!m.sourceId) continue;
      if (!messagesByRoom[m.sourceId]) messagesByRoom[m.sourceId] = [];
      messagesByRoom[m.sourceId].push(m);
    }

    // Staff KPI
    const staffSkills = allSkills.filter((s) => s.isStaff);
    const customerSkills = allSkills.filter((s) => !s.isStaff);
    const staffNames = [...new Set(staffSkills.map((s) => s.userName))];

    const staffKpi = await Promise.all(
      staffNames.map(async (name) => {
        const msgCount = await db.collection("messages").countDocuments({ userName: name });

        const rooms = staffSkills
          .filter((s) => s.userName === name)
          .map((s) => {
            const meta = allMeta.find((m) => m.sourceId === s.sourceId);
            return {
              sourceId: s.sourceId,
              roomName: meta?.groupName || s.sourceId.substring(0, 12),
              sentiment: s.sentiment,
              purchaseIntent: s.purchaseIntent,
            };
          });

        // Response time ของพนักงานคนนี้ (รวมทุกห้อง)
        const staffRoomIds = rooms.map((r) => r.sourceId);
        const staffMessages = staffRoomIds.flatMap((id) => messagesByRoom[id] || []);
        const responseTime = calcResponseTime(staffMessages, name);

        // avg sentiment ลูกค้าในห้องที่ดูแล
        const relatedCustomers = customerSkills.filter((s) => staffRoomIds.includes(s.sourceId));
        const avgCustomerScore = relatedCustomers.length > 0
          ? Math.round(relatedCustomers.reduce((sum, s) => sum + (s.sentiment?.score || 50), 0) / relatedCustomers.length)
          : 50;

        return {
          name,
          messageCount: msgCount,
          roomCount: rooms.length,
          rooms,
          responseTime,
          customerSatisfaction: {
            score: avgCustomerScore,
            level: avgCustomerScore >= 60 ? "green" as const : avgCustomerScore >= 30 ? "yellow" as const : "red" as const,
          },
          sentiment: staffSkills.find((s) => s.userName === name)?.sentiment || null,
        };
      })
    );

    // Customer KPI
    const customerNames = [...new Set(customerSkills.map((s) => s.userId))];
    const customerKpi = await Promise.all(
      customerNames.slice(0, 50).map(async (name) => {
        const msgCount = await db.collection("messages").countDocuments({ userName: name });
        const skills = customerSkills.filter((s) => s.userId === name);
        const roomCount = skills.length;

        // ความพอใจรวมของลูกค้าคนนี้
        const avgSentiment = skills.length > 0
          ? Math.round(skills.reduce((sum, s) => sum + (s.sentiment?.score || 50), 0) / skills.length)
          : 50;

        // โอกาสซื้อรวม
        const avgPurchase = skills.length > 0
          ? Math.round(skills.reduce((sum, s) => sum + (s.purchaseIntent?.score || 10), 0) / skills.length)
          : 10;

        return {
          name,
          messageCount: msgCount,
          roomCount,
          sentiment: {
            score: avgSentiment,
            level: avgSentiment >= 60 ? "green" as const : avgSentiment >= 30 ? "yellow" as const : "red" as const,
          },
          purchaseIntent: {
            score: avgPurchase,
            level: avgPurchase >= 60 ? "red" as const : avgPurchase >= 30 ? "yellow" as const : "green" as const,
          },
        };
      })
    );

    // Room overview + response time ต่อห้อง
    const rooms = allAnalytics.map((a) => {
      const meta = allMeta.find((m) => m.sourceId === a.sourceId);
      const roomSkills = allSkills.filter((s) => s.sourceId === a.sourceId);
      const roomMsgs = messagesByRoom[a.sourceId] || [];
      const responseTime = calcResponseTime(roomMsgs);

      return {
        sourceId: a.sourceId,
        name: meta?.groupName || a.sourceId.substring(0, 12),
        customerSentiment: a.customerSentiment,
        staffSentiment: a.staffSentiment,
        overallSentiment: a.overallSentiment || a.sentiment,
        purchaseIntent: a.purchaseIntent,
        responseTime,
        userCount: roomSkills.length,
        customerCount: roomSkills.filter((s: any) => !s.isStaff).length,
        staffCount: roomSkills.filter((s: any) => s.isStaff).length,
        messageCount: roomMsgs.length,
        updatedAt: a.updatedAt,
      };
    });

    // Summary
    const alertRooms = rooms.filter(
      (r) => r.customerSentiment?.level === "red" || r.purchaseIntent?.level === "red"
    );

    // Overall response time
    const overallResponseTime = calcResponseTime(allMessages);

    return NextResponse.json({
      summary: {
        totalRooms: allAnalytics.length,
        totalMessages,
        totalStaff: staffNames.length,
        totalCustomers: customerNames.length,
        alertCount: alertRooms.length,
        avgResponseMinutes: overallResponseTime.avgMinutes,
        responseTimeLevel: overallResponseTime.level,
      },
      staffKpi: staffKpi.sort((a, b) => b.messageCount - a.messageCount),
      customerKpi: customerKpi
        .sort((a, b) => b.messageCount - a.messageCount)
        .filter((c) => c.messageCount > 0),
      rooms: rooms.sort((a, b) => {
        const aUrgent = (a.customerSentiment?.level === "red" ? 2 : 0) + (a.purchaseIntent?.level === "red" ? 1 : 0);
        const bUrgent = (b.customerSentiment?.level === "red" ? 2 : 0) + (b.purchaseIntent?.level === "red" ? 1 : 0);
        return bUrgent - aUrgent;
      }),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
