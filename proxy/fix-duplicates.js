const { MongoClient } = require("mongodb");
async function fix() {
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const db = client.db("smltrack");
  const coll = db.collection("messages");

  const ids = await coll.distinct("sourceId");
  console.log("All sourceIds:", ids.length);

  const shortIds = ids.filter((id) => id && id.length === 20);
  for (const shortId of shortIds) {
    const fullId = ids.find((id) => id !== shortId && id.startsWith(shortId));
    if (fullId) {
      const result = await coll.updateMany({ sourceId: shortId }, { $set: { sourceId: fullId } });
      console.log("Merged", shortId, "→", fullId, ":", result.modifiedCount, "docs");
    }
  }

  await coll.deleteMany({ sourceId: "test123" });
  console.log("Deleted test123");

  const remaining = await coll.distinct("sourceId");
  console.log("Remaining sourceIds:", remaining.length, remaining);
  await client.close();
}
fix().catch(console.error);
