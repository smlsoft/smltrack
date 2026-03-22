import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { MongoClient, type Db } from "mongodb";
import { randomUUID } from "crypto";

// ใช้ standalone MongoClient ใน auth route (ไม่ผ่าน getDB เพื่อหลีกเลี่ยง circular deps)
let authClient: MongoClient | null = null;
let authDb: Db | null = null;

async function getAuthDB(): Promise<Db> {
  if (authDb) return authDb;
  const uri = process.env.MONGODB_URI || "mongodb://localhost:27017/smltrack";
  const dbName = process.env.MONGODB_DB || "smltrack";
  authClient = new MongoClient(uri);
  await authClient.connect();
  authDb = authClient.db(dbName);
  return authDb;
}

// Skip auth ถ้าไม่มี GOOGLE_CLIENT_ID (dev mode)
const DEV_MODE = !process.env.GOOGLE_CLIENT_ID;

const handler = NextAuth({
  providers: DEV_MODE
    ? []
    : [
        GoogleProvider({
          clientId: process.env.GOOGLE_CLIENT_ID!,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        }),
      ],

  secret: process.env.NEXTAUTH_SECRET || "dev-secret-change-me-in-production",

  // basePath /dashboard → NextAuth callbacks ต้องชี้ถูก
  callbacks: {
    async signIn({ user }) {
      if (!user.email) return false;
      try {
        const db = await getAuthDB();

        // หา user จาก email mapping
        const emailDoc = await db
          .collection("user_emails")
          .findOne({ email: user.email });

        if (emailDoc) {
          // user มีอยู่แล้ว — อัพเดต name/image ถ้าเปลี่ยน
          await db.collection("users").updateOne(
            { _id: emailDoc.userId },
            {
              $set: {
                name: user.name || undefined,
                image: user.image || undefined,
                lastSignIn: new Date(),
              },
            }
          );
          return true;
        }

        // user ใหม่ — สร้าง GUID
        const userId = randomUUID();

        await db.collection("users").insertOne({
          _id: userId as any,
          name: user.name || "",
          image: user.image || "",
          createdAt: new Date(),
          lastSignIn: new Date(),
          plan: "free",
        });

        await db.collection("user_emails").insertOne({
          email: user.email,
          userId,
          isPrimary: true,
          addedAt: new Date(),
        });

        // สร้าง default team ให้ user ใหม่
        const teamId = randomUUID();
        await db.collection("teams").insertOne({
          _id: teamId as any,
          name: user.name ? `ทีมของ ${user.name}` : "ทีมของฉัน",
          ownerId: userId,
          createdAt: new Date(),
        });

        await db.collection("team_members").insertOne({
          teamId,
          userId,
          role: "admin",
          addedAt: new Date(),
          addedBy: userId,
        });

        return true;
      } catch (err) {
        console.error("[NextAuth] signIn error:", err);
        return false;
      }
    },

    async session({ session, token }) {
      if (session.user?.email) {
        try {
          const db = await getAuthDB();
          const emailDoc = await db
            .collection("user_emails")
            .findOne({ email: session.user.email });

          if (emailDoc) {
            // เพิ่ม userId ใน session
            (session.user as any).id = emailDoc.userId;
            (session.user as any).userId = emailDoc.userId;

            // ดึง plan
            const userDoc = await db
              .collection("users")
              .findOne({ _id: emailDoc.userId });
            if (userDoc) {
              (session.user as any).plan = userDoc.plan || "free";
            }
          }
        } catch (err) {
          console.error("[NextAuth] session callback error:", err);
        }
      }
      return session;
    },

    async jwt({ token, user }) {
      if (user?.email) {
        token.email = user.email;
      }
      return token;
    },
  },

  pages: {
    signIn: "/dashboard/login",
    error: "/dashboard/login",
  },
});

export { handler as GET, handler as POST };
