const { MongoClient } = require("mongodb");

async function rebuild() {
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const db = client.db("smltrack");

  const sourceIds = await db.collection("messages").distinct("sourceId");
  console.log("Groups:", sourceIds.length);

  const groqKey = process.env.GROQ_API_KEY;
  const sambaKey = process.env.SAMBANOVA_API_KEY;

  for (const sourceId of sourceIds) {
    const recent = await db.collection("messages")
      .find({ sourceId })
      .sort({ createdAt: -1 })
      .limit(10)
      .toArray();

    if (recent.length < 1) continue;

    const chatText = recent.reverse()
      .map((m) => `[${m.role === "assistant" ? "Bot" : m.userName || "User"}] ${m.content}`)
      .join("\n");

    // ใช้ SambaNova หรือ Groq
    const apiUrl = sambaKey ? "https://api.sambanova.ai/v1/chat/completions" : "https://api.groq.com/openai/v1/chat/completions";
    const apiKey = sambaKey || groqKey;
    const model = sambaKey ? "Qwen3-235B" : "llama-3.3-70b-versatile";

    try {
      const res = await fetch(apiUrl, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: "system",
              content: `วิเคราะห์บทสนทนาแล้ว return JSON เท่านั้น:
{"sentiment":{"score":0-100,"stars":1-5,"level":"green|yellow|red","reason":"เหตุผลสั้นๆ"},"purchaseIntent":{"score":0-100,"stars":1-5,"level":"green|yellow|red","reason":"เหตุผลสั้นๆ"}}
sentiment: green(60-100)ปกติ, yellow(30-59)เฝ้าดู, red(0-29)อันตราย
purchaseIntent: green(60-100)สนใจซื้อ, yellow(30-59)เฝ้าดู, red(0-29)ไม่สนใจ`,
            },
            { role: "user", content: chatText },
          ],
          max_tokens: 300,
          response_format: { type: "json_object" },
        }),
      });

      const data = await res.json();
      const content = data.choices?.[0]?.message?.content;
      if (!content) { console.log(sourceId, "no response"); continue; }

      const analysis = JSON.parse(content);
      await db.collection("chat_analytics").updateOne(
        { sourceId },
        {
          $set: {
            sourceId,
            sentiment: analysis.sentiment,
            purchaseIntent: analysis.purchaseIntent,
            messageCount: recent.length,
            updatedAt: new Date(),
          },
          $setOnInsert: { createdAt: new Date() },
        },
        { upsert: true }
      );
      console.log(sourceId.substring(0, 15), "→ sentiment:", analysis.sentiment?.score, analysis.sentiment?.level, "| purchase:", analysis.purchaseIntent?.score, analysis.purchaseIntent?.level);
    } catch (e) {
      console.log(sourceId.substring(0, 15), "error:", e.message);
    }

    // Rate limit delay
    await new Promise((r) => setTimeout(r, 1000));
  }

  await client.close();
  console.log("Done!");
}

rebuild().catch(console.error);
