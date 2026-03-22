"use client";

import { useSession, signIn, signOut } from "next-auth/react";
import { useState } from "react";

// Dev mode: ไม่มี GOOGLE_CLIENT_ID
const DEV_MODE = !process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID && typeof window !== "undefined"
  ? !document.cookie.includes("next-auth")
  : false;

export default function UserMenu() {
  const { data: session, status } = useSession();
  const [open, setOpen] = useState(false);

  // ถ้าไม่มี GOOGLE_CLIENT_ID configured → ไม่แสดง menu
  if (status === "loading") {
    return (
      <div className="w-7 h-7 rounded-full bg-gray-700 animate-pulse" />
    );
  }

  if (!session) {
    return (
      <button
        onClick={() => signIn("google")}
        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs rounded-lg transition font-medium"
      >
        เข้าสู่ระบบ
      </button>
    );
  }

  const user = session.user;
  const initials = user?.name
    ? user.name.slice(0, 2).toUpperCase()
    : user?.email?.slice(0, 2).toUpperCase() || "??";

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-gray-800 transition"
      >
        {user?.image ? (
          <img
            src={user.image}
            alt={user.name || ""}
            className="w-7 h-7 rounded-full object-cover border border-gray-700"
          />
        ) : (
          <div className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center text-xs font-bold text-white">
            {initials}
          </div>
        )}
        <span className="text-xs text-gray-300 hidden sm:block max-w-[100px] truncate">
          {user?.name || user?.email}
        </span>
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />
          {/* Dropdown */}
          <div className="absolute right-0 top-full mt-2 w-56 bg-gray-900 border border-gray-700 rounded-xl shadow-xl z-50 overflow-hidden">
            {/* User info */}
            <div className="px-4 py-3 border-b border-gray-800">
              <p className="text-sm font-medium text-white truncate">
                {user?.name || "ผู้ใช้"}
              </p>
              <p className="text-xs text-gray-400 truncate">{user?.email}</p>
              <span className="inline-block mt-1 text-[10px] px-2 py-0.5 bg-indigo-900/60 text-indigo-300 border border-indigo-700/50 rounded-full">
                {(user as any)?.plan === "pro" ? "Pro" : "Free"}
              </span>
            </div>
            {/* Sign out */}
            <button
              onClick={() => {
                setOpen(false);
                signOut({ callbackUrl: "/dashboard/login" });
              }}
              className="w-full text-left px-4 py-2.5 text-sm text-red-400 hover:bg-red-950/40 hover:text-red-300 transition"
            >
              ออกจากระบบ
            </button>
          </div>
        </>
      )}
    </div>
  );
}
