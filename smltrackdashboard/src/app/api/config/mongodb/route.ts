import { NextRequest, NextResponse } from "next/server";
import { MongoClient } from "mongodb";
import dns from "node:dns/promises";

dns.setServers(["8.8.8.8", "1.1.1.1"]);

export async function GET() {
  const uri = process.env.MONGODB_URI || "";
  const dbName = process.env.MONGODB_DB || "";
  return NextResponse.json({
    uri: uri ? maskUri(uri) : "",
    dbName,
    configured: !!uri,
  });
}

export async function POST(req: NextRequest) {
  const { uri, dbName } = await req.json();

  if (!uri) {
    return NextResponse.json({ ok: false, error: "กรุณากรอก MongoDB URI" }, { status: 400 });
  }

  const testDb = dbName || "smltrack";
  let client: MongoClient | null = null;

  try {
    client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
    await client.connect();
    const db = client.db(testDb);
    const collections = await db.listCollections().toArray();
    const stats = await db.stats();

    return NextResponse.json({
      ok: true,
      database: testDb,
      collections: collections.map((c) => c.name),
      documentCount: stats.objects,
      storageMB: Math.round((stats.storageSize / 1024 / 1024) * 100) / 100,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "เชื่อมต่อไม่ได้";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  } finally {
    if (client) await client.close();
  }
}

function maskUri(uri: string): string {
  try {
    const url = new URL(uri);
    if (url.password) url.password = "****";
    return url.toString();
  } catch {
    return uri.replace(/:([^@]+)@/, ":****@");
  }
}
