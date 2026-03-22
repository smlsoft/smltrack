import { NextResponse } from "next/server";
import { getDB } from "@/lib/mongodb";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const db = await getDB();

    const [allMeta, allAnalytics, allLogCounts] = await Promise.all([
      db.collection("groups_meta").find().toArray(),
      db.collection("chat_analytics").find().toArray(),
      db.collection("analysis_logs").aggregate([
        { $group: { _id: "$sourceId", count: { $sum: 1 } } },
      ]).toArray(),
    ]);

    // ดึง sourceIds ทั้งหมดจาก messages collection
    const sourceIds = await db
      .collection("messages")
      .distinct("sourceId");

    const groups = await Promise.all(
      sourceIds.map(async (sourceId: string) => {
        if (!sourceId) return null;
        const meta = allMeta.find(
          (m) => m.sourceId === sourceId || m.sourceId?.startsWith(sourceId?.substring(0, 20))
        );
        const analytics = allAnalytics.find(
          (a) => a.sourceId === sourceId || a.sourceId?.startsWith(sourceId?.substring(0, 20))
        );
        const logCount = allLogCounts.find((l) => l._id === sourceId)?.count || 0;

        const [count, messages] = await Promise.all([
          db.collection("messages").countDocuments({ sourceId }),
          db
            .collection("messages")
            .find({ sourceId }, { projection: { embedding: 0, imageUrl: 0 } })
            .sort({ createdAt: -1 })
            .limit(50)
            .toArray(),
        ]);

        const lastMsg = messages[0];

        return {
          id: sourceId,
          name: meta?.groupName || sourceId,
          sourceType: meta?.sourceType || "unknown",
          platform: meta?.platform || "line",
          messageCount: count,
          lastMessage: lastMsg?.content?.substring(0, 50) || "",
          lastActivity: lastMsg?.createdAt || null,
          sentiment: analytics?.overallSentiment || analytics?.sentiment || null,
          customerSentiment: analytics?.customerSentiment || null,
          staffSentiment: analytics?.staffSentiment || null,
          overallSentiment: analytics?.overallSentiment || analytics?.sentiment || null,
          purchaseIntent: analytics?.purchaseIntent || null,
          analysisLogsCount: logCount,
          messages: messages.reverse().map((m) => ({
            ...m,
            _id: m._id.toString(),
            hasImage: m.messageType === "image",
          })),
        };
      })
    );

    return NextResponse.json(groups.filter(Boolean));
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
