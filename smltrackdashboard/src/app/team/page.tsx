"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";

interface TeamMember {
  _id: string;
  userId: string;
  email: string;
  name: string;
  image?: string;
  role: "admin" | "responder" | "reviewer" | "viewer";
  addedAt: string;
  isCurrentUser?: boolean;
}

const ROLES: Record<string, { label: string; color: string; desc: string }> = {
  admin:     { label: "Admin",     color: "text-red-400 bg-red-900/30 border-red-800/50",     desc: "จัดการทุกอย่างได้" },
  responder: { label: "Responder", color: "text-blue-400 bg-blue-900/30 border-blue-800/50", desc: "ตอบแชทได้" },
  reviewer:  { label: "Reviewer",  color: "text-amber-400 bg-amber-900/30 border-amber-800/50", desc: "ดูและ review เท่านั้น" },
  viewer:    { label: "Viewer",    color: "text-gray-400 bg-gray-800 border-gray-700",        desc: "ดูข้อมูลได้อย่างเดียว" },
};

function RoleBadge({ role }: { role: string }) {
  const r = ROLES[role] || ROLES.viewer;
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${r.color}`}>
      {r.label}
    </span>
  );
}

export default function TeamPage() {
  const { data: session } = useSession();
  const currentEmail = session?.user?.email || "";

  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"responder" | "reviewer" | "viewer">("viewer");
  const [inviting, setInviting] = useState(false);
  const [inviteResult, setInviteResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [roleChanging, setRoleChanging] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);

  const fetchMembers = useCallback(async () => {
    try {
      const res = await fetch("/dashboard/api/team");
      if (res.ok) {
        const data = await res.json();
        setMembers(
          (data.members || []).map((m: TeamMember) => ({
            ...m,
            isCurrentUser: m.email === currentEmail,
          }))
        );
      }
    } catch {}
    setLoading(false);
  }, [currentEmail]);

  useEffect(() => { fetchMembers(); }, [fetchMembers]);

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    setInviting(true);
    setInviteResult(null);
    try {
      const res = await fetch("/dashboard/api/team/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      });
      const data = await res.json();
      setInviteResult({ ok: res.ok, message: data.message || (res.ok ? "ส่งคำเชิญแล้ว" : "เกิดข้อผิดพลาด") });
      if (res.ok) {
        setInviteEmail("");
        fetchMembers();
      }
    } catch {
      setInviteResult({ ok: false, message: "เชื่อมต่อไม่ได้" });
    }
    setInviting(false);
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    setRoleChanging(userId);
    try {
      await fetch("/dashboard/api/team/member", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, role: newRole }),
      });
      await fetchMembers();
    } catch {}
    setRoleChanging(null);
  };

  const handleRemove = async (userId: string) => {
    setRemoving(userId);
    try {
      await fetch("/dashboard/api/team/member", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      await fetchMembers();
    } catch {}
    setRemoving(null);
    setConfirmRemove(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="border-b border-gray-800 px-6 py-4 sticky top-0 bg-gray-950/95 backdrop-blur z-10">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="text-gray-400 hover:text-white transition text-sm">&larr; Dashboard</Link>
          <div className="w-px h-5 bg-gray-700" />
          <div className="w-7 h-7 bg-gradient-to-br from-indigo-500 to-cyan-500 rounded-lg flex items-center justify-center text-sm">👥</div>
          <h1 className="text-lg font-bold">ทีม</h1>
          <span className="ml-2 text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded-full border border-gray-700">
            {members.length} คน
          </span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto p-6 space-y-6">

        {/* Invite */}
        <section className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-5 pb-4 border-b border-gray-800">
            <div className="w-10 h-10 bg-indigo-900/40 rounded-xl flex items-center justify-center text-xl">✉️</div>
            <div>
              <h2 className="font-semibold">เชิญสมาชิก</h2>
              <p className="text-xs text-gray-500">เชิญทีมงานด้วย Email</p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex gap-2">
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => { setInviteEmail(e.target.value); setInviteResult(null); }}
                placeholder="email@example.com"
                onKeyDown={(e) => e.key === "Enter" && handleInvite()}
                className="flex-1 px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white text-sm placeholder-gray-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition"
              />
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as "responder" | "reviewer" | "viewer")}
                className="px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition"
              >
                <option value="viewer">Viewer</option>
                <option value="reviewer">Reviewer</option>
                <option value="responder">Responder</option>
              </select>
              <button
                onClick={handleInvite}
                disabled={inviting || !inviteEmail.trim()}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 disabled:text-gray-500 rounded-xl text-sm font-medium transition"
              >
                {inviting ? "กำลังส่ง..." : "เชิญ"}
              </button>
            </div>

            {/* Role descriptions */}
            <div className="flex flex-wrap gap-2">
              {Object.entries(ROLES).filter(([k]) => k !== "admin").map(([key, r]) => (
                <div key={key} className="flex items-center gap-1.5">
                  <RoleBadge role={key} />
                  <span className="text-xs text-gray-600">= {r.desc}</span>
                </div>
              ))}
            </div>

            {inviteResult && (
              <div className={`p-3 rounded-xl border text-sm ${inviteResult.ok ? "bg-green-950/50 border-green-800 text-green-400" : "bg-red-950/50 border-red-800 text-red-400"}`}>
                {inviteResult.ok ? "✅" : "❌"} {inviteResult.message}
              </div>
            )}
          </div>
        </section>

        {/* Members list */}
        <section className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-800 flex items-center gap-3">
            <div className="w-10 h-10 bg-gray-800 rounded-xl flex items-center justify-center text-xl">👥</div>
            <div>
              <h2 className="font-semibold">สมาชิกทีม</h2>
              <p className="text-xs text-gray-500">{members.length} คน</p>
            </div>
          </div>

          {members.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-gray-500 text-sm">ยังไม่มีสมาชิก</p>
              <p className="text-gray-600 text-xs mt-1">เชิญสมาชิกด้วยฟอร์มด้านบน</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-800">
              {members.map((member) => (
                <div key={member._id} className="px-6 py-4 flex items-center gap-4">
                  {/* Avatar */}
                  {member.image ? (
                    <img src={member.image} alt={member.name} className="w-10 h-10 rounded-full border border-gray-700 shrink-0" />
                  ) : (
                    <div className="w-10 h-10 bg-gray-800 rounded-full flex items-center justify-center text-lg border border-gray-700 shrink-0">
                      👤
                    </div>
                  )}

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-white truncate">{member.name || member.email}</p>
                      {member.isCurrentUser && (
                        <span className="text-xs text-indigo-400 bg-indigo-900/30 border border-indigo-800/50 px-1.5 py-0.5 rounded-full">คุณ</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 truncate">{member.email}</p>
                    <p className="text-xs text-gray-700 mt-0.5">
                      เข้าร่วม {new Date(member.addedAt).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                  </div>

                  {/* Role selector */}
                  {!member.isCurrentUser ? (
                    <div className="flex items-center gap-2 shrink-0">
                      {confirmRemove === member.userId ? (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-400">ยืนยันลบ?</span>
                          <button
                            onClick={() => handleRemove(member.userId)}
                            disabled={removing === member.userId}
                            className="px-3 py-1.5 bg-red-900 hover:bg-red-800 border border-red-700 rounded-lg text-xs text-red-300 hover:text-white transition"
                          >
                            {removing === member.userId ? "..." : "ลบ"}
                          </button>
                          <button
                            onClick={() => setConfirmRemove(null)}
                            className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-xs text-gray-400 transition"
                          >
                            ยกเลิก
                          </button>
                        </div>
                      ) : (
                        <>
                          <select
                            value={member.role}
                            onChange={(e) => handleRoleChange(member.userId, e.target.value)}
                            disabled={roleChanging === member.userId}
                            className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-xs text-white focus:outline-none focus:border-indigo-500 transition disabled:opacity-50"
                          >
                            {Object.entries(ROLES).map(([key, r]) => (
                              <option key={key} value={key}>{r.label}</option>
                            ))}
                          </select>
                          <button
                            onClick={() => setConfirmRemove(member.userId)}
                            className="w-8 h-8 flex items-center justify-center bg-gray-800 hover:bg-red-950 border border-gray-700 hover:border-red-800 rounded-lg text-gray-500 hover:text-red-400 transition text-sm"
                          >
                            ✕
                          </button>
                        </>
                      )}
                    </div>
                  ) : (
                    <RoleBadge role={member.role} />
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

      </main>
    </div>
  );
}
