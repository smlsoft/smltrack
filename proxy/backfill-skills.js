/**
 * Backfill user_skills จากข้อมูล messages ที่มีอยู่
 * รันครั้งเดียว: docker exec smltrack-agent node backfill-skills.js
 */
const { MongoClient } = require("mongodb");

async function backfill() {
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const db = client.db(process.env.MONGODB_DB || "smlclaw");

  // ดึง distinct sourceId + userName pairs
  const pairs = await db.collection("messages").aggregate([
    { $match: { userName: { $ne: null, $nin: ["น้องกุ้ง", "User", null] } } },
    { $group: {
      _id: { sourceId: "$sourceId", userName: "$userName" },
      count: { $sum: 1 },
      lastContent: { $last: "$content" },
      lastDate: { $max: "$createdAt" },
    }},
    { $sort: { count: -1 } },
  ]).toArray();

  console.log(`Found ${pairs.length} user-room pairs`);

  let created = 0;
  for (const pair of pairs) {
    const { sourceId, userName } = pair._id;
    if (!sourceId || !userName) continue;

    const nameUpper = userName.toUpperCase();
    const isStaff = nameUpper.startsWith("SML");
    const isBot = nameUpper.includes("น้องกุ้ง");
    if (isBot) continue;

    // ตรวจว่ามี skill อยู่แล้วไหม
    const exists = await db.collection("user_skills").findOne({ sourceId, userId: userName });
    if (exists) continue;

    // สร้าง skill เริ่มต้น (ยังไม่ได้ให้ AI วิเคราะห์ — ใช้ค่า default)
    await db.collection("user_skills").updateOne(
      { sourceId, userId: userName },
      {
        $set: {
          sourceId,
          userId: userName,
          userName,
          isStaff,
          sentiment: { score: 50, level: "green", reason: "เริ่มต้น" },
          purchaseIntent: { score: 10, level: "green", reason: "เริ่มต้น" },
          lastMessage: (pair.lastContent || "").substring(0, 100),
          messageCount: pair.count,
          updatedAt: pair.lastDate || new Date(),
        },
        $setOnInsert: { createdAt: new Date() },
      },
      { upsert: true }
    );
    created++;
  }

  console.log(`Created ${created} user_skills`);

  // อัปเดต room analytics จาก skills
  const sourceIds = [...new Set(pairs.map(p => p._id.sourceId))];
  for (const sourceId of sourceIds) {
    if (!sourceId) continue;
    const skills = await db.collection("user_skills").find({ sourceId }).toArray();
    const customerSkills = skills.filter(s => !s.isStaff);
    const staffSkills = skills.filter(s => s.isStaff);

    const avgScore = (arr, field) => {
      if (arr.length === 0) return { score: 50, level: "green", reason: "ไม่มีข้อมูล" };
      const avg = Math.round(arr.reduce((sum, s) => sum + (s[field]?.score || 50), 0) / arr.length);
      const level = field === "purchaseIntent"
        ? (avg >= 60 ? "red" : avg >= 30 ? "yellow" : "green")
        : (avg >= 60 ? "green" : avg >= 30 ? "yellow" : "red");
      return { score: avg, level, reason: "backfill" };
    };

    await db.collection("chat_analytics").updateOne(
      { sourceId },
      {
        $set: {
          sourceId,
          sentiment: avgScore(skills, "sentiment"),
          customerSentiment: avgScore(customerSkills, "sentiment"),
          staffSentiment: avgScore(staffSkills, "sentiment"),
          overallSentiment: avgScore(skills, "sentiment"),
          purchaseIntent: avgScore(customerSkills.length > 0 ? customerSkills : skills, "purchaseIntent"),
          userCount: skills.length,
          customerCount: customerSkills.length,
          staffCount: staffSkills.length,
          updatedAt: new Date(),
        },
        $setOnInsert: { createdAt: new Date() },
      },
      { upsert: true }
    );
  }

  console.log(`Updated ${sourceIds.length} room analytics`);
  client.close();
}

backfill().catch(console.error);
