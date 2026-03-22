import { NextRequest, NextResponse } from "next/server";
import { MongoClient } from "mongodb";
import dns from "node:dns/promises";
import { getAuthUser } from "@/lib/auth";

dns.setServers(["8.8.8.8", "1.1.1.1"]);

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { uri } = await req.json();

  if (!uri) {
    return NextResponse.json({ ok: false, error: "กรุณากรอก MongoDB URI" }, { status: 400 });
  }

  let client: MongoClient | null = null;

  try {
    client = new MongoClient(uri, { serverSelectionTimeoutMS: 8000 });
    await client.connect();

    // ลอง ping ก่อน
    await client.db("admin").command({ ping: 1 });

    // ดึงชื่อ DB จาก URI
    let dbName = "smltrack";
    try {
      const url = new URL(uri);
      const pathDb = url.pathname.replace("/", "").trim();
      if (pathDb) dbName = pathDb;
    } catch {}

    const db = client.db(dbName);
    const collections = await db.listCollections().toArray();
    let documentCount = 0;
    try {
      const stats = await db.stats();
      documentCount = stats.objects || 0;
    } catch {}

    return NextResponse.json({
      ok: true,
      database: dbName,
      collections: collections.map((c) => c.name),
      documentCount,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "เชื่อมต่อไม่ได้";
    return NextResponse.json({ ok: false, error: message }, { status: 200 });
  } finally {
    if (client) await client.close().catch(() => {});
  }
}
