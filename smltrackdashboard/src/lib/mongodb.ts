import { MongoClient, type Db } from "mongodb";
import dns from "node:dns/promises";

// Fix Node.js v22+ Windows DNS SRV issue
dns.setServers(["8.8.8.8", "1.1.1.1"]);

const uri = process.env.MONGODB_URI || "mongodb://localhost:27017/smltrack";
const dbName = process.env.MONGODB_DB || "smltrack";

let client: MongoClient;
let db: Db;

export async function getDB(): Promise<Db> {
  if (db) return db;
  client = new MongoClient(uri);
  await client.connect();
  db = client.db(dbName);
  return db;
}

export interface ChatMessage {
  _id?: string;
  role: "user" | "assistant";
  userName?: string;
  userId?: string;
  content: string;
  messageType: string;
  imageUrl?: string | null;
  groupId?: string;
  messageId?: string;
  timestamp?: number;
  createdAt?: Date | string;
}
