import { getServerSession, type Session } from "next-auth";
import { getDB } from "@/lib/mongodb";

// Dev mode: ไม่มี GOOGLE_CLIENT_ID → ข้าม auth
const DEV_MODE = !process.env.GOOGLE_CLIENT_ID;

export interface AuthUser {
  id: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
  plan: "free" | "pro";
}

/**
 * getAuthUser — ดึง user ปัจจุบัน (Server Component / API Route)
 * Dev mode: return mock user แทน
 */
export async function getAuthUser(): Promise<AuthUser | null> {
  if (DEV_MODE) {
    return {
      id: "dev-user",
      name: "Dev User",
      email: "dev@localhost",
      image: null,
      plan: "free",
    };
  }

  const session = await getServerSession();
  if (!session?.user?.email) return null;

  const user = session.user as any;
  return {
    id: user.id || user.userId || "",
    name: user.name,
    email: user.email,
    image: user.image,
    plan: user.plan || "free",
  };
}

/**
 * requireAuth — ต้อง login, ถ้าไม่มี session throw error
 * ใช้ใน API routes เพื่อ guard
 */
export async function requireAuth(): Promise<AuthUser> {
  const user = await getAuthUser();
  if (!user) {
    throw new Error("UNAUTHORIZED");
  }
  return user;
}

/**
 * getTeamsForUser — ดึง teams ที่ user เป็นสมาชิก
 */
export async function getTeamsForUser(userId: string) {
  const db = await getDB();
  const memberships = await db
    .collection("team_members")
    .find({ userId })
    .toArray();

  const teamIds = memberships.map((m) => m.teamId);
  if (teamIds.length === 0) return [];

  const teams = await db
    .collection("teams")
    .find({ _id: { $in: teamIds } })
    .toArray();

  return teams.map((t) => ({
    ...t,
    role: memberships.find((m) => m.teamId === t._id)?.role || "viewer",
  }));
}

/**
 * isDevMode — ใช้ check ใน client components
 */
export const isDevMode = DEV_MODE;
