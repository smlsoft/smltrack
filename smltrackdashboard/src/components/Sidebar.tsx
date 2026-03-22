"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signIn, signOut } from "next-auth/react";
import { ThemeToggle } from "@/components/ThemeProvider";

interface NavItem {
  href: string;
  icon: string;
  label: string;
}

interface NavGroup {
  groupLabel?: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    items: [
      { href: "/dashboard", icon: "📊", label: "Dashboard" },
      { href: "/crm", icon: "👥", label: "CRM" },
      { href: "/kpi", icon: "📈", label: "KPI" },
      { href: "/advice", icon: "🦐", label: "น้องกุ้ง" },
      { href: "/costs", icon: "💰", label: "AI Cost" },
    ],
  },
  {
    groupLabel: "เชื่อมต่อ",
    items: [
      { href: "/config", icon: "🔗", label: "ช่องทาง" },
    ],
  },
  {
    groupLabel: "ตั้งค่า",
    items: [
      { href: "/settings", icon: "⚙️", label: "ตั้งค่า" },
      { href: "/team", icon: "👔", label: "ทีมงาน" },
    ],
  },
  {
    groupLabel: "ช่วยเหลือ",
    items: [
      { href: "/guide", icon: "📖", label: "คู่มือ" },
    ],
  },
];

function NavLink({ href, icon, label, onClick }: NavItem & { onClick?: () => void }) {
  const pathname = usePathname();
  // Match exact for /dashboard, prefix for others
  const isActive =
    href === "/dashboard"
      ? pathname === "/dashboard" || pathname === "/"
      : pathname.startsWith(href);

  return (
    <Link
      href={href}
      onClick={onClick}
      className={`flex items-center gap-3 py-2 px-3 rounded-lg text-sm transition-all ${
        isActive
          ? "bg-indigo-900/50 text-indigo-400 font-medium"
          : "text-gray-400 hover:bg-gray-800 hover:text-gray-200"
      }`}
    >
      <span className="text-base leading-none">{icon}</span>
      <span>{label}</span>
    </Link>
  );
}

function UserSection() {
  const { data: session, status } = useSession();
  const [open, setOpen] = useState(false);

  if (status === "loading") {
    return <div className="w-full h-9 rounded-lg bg-gray-800 animate-pulse" />;
  }

  if (!session) {
    return (
      <button
        onClick={() => signIn("google")}
        className="w-full px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm rounded-lg transition font-medium text-center"
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
        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-gray-800 transition"
      >
        {user?.image ? (
          <img
            src={user.image}
            alt={user.name || ""}
            className="w-7 h-7 rounded-full object-cover border border-gray-700 shrink-0"
          />
        ) : (
          <div className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center text-xs font-bold text-white shrink-0">
            {initials}
          </div>
        )}
        <div className="flex-1 text-left min-w-0">
          <p className="text-xs text-gray-200 truncate font-medium">{user?.name || user?.email}</p>
          <p className="text-[10px] text-gray-500 truncate">{user?.email}</p>
        </div>
        <span className="text-gray-600 text-xs shrink-0">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute bottom-full left-0 right-0 mb-1 bg-gray-900 border border-gray-700 rounded-xl shadow-xl z-50 overflow-hidden">
            <div className="px-3 py-2.5 border-b border-gray-800">
              <p className="text-xs font-medium text-white truncate">{user?.name || "ผู้ใช้"}</p>
              <p className="text-[11px] text-gray-400 truncate">{user?.email}</p>
              <span className="inline-block mt-1 text-[10px] px-2 py-0.5 bg-indigo-900/60 text-indigo-300 border border-indigo-700/50 rounded-full">
                {(user as any)?.plan === "pro" ? "Pro" : "Free"}
              </span>
            </div>
            <button
              onClick={() => {
                setOpen(false);
                signOut({ callbackUrl: "/dashboard/login" });
              }}
              className="w-full text-left px-3 py-2.5 text-sm text-red-400 hover:bg-red-950/40 hover:text-red-300 transition"
            >
              ออกจากระบบ
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default function Sidebar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-4 py-4 border-b border-gray-800">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-cyan-500 rounded-xl flex items-center justify-center text-sm shadow-lg shadow-indigo-500/20 shrink-0">
            💬
          </div>
          <div className="min-w-0">
            <h1 className="text-sm font-bold text-white leading-tight">SML Mini CRM</h1>
            <p className="text-[10px] text-gray-500 leading-tight">AI Chat Intelligence</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
        {NAV_GROUPS.map((group, gi) => (
          <div key={gi} className={gi > 0 ? "mt-4" : ""}>
            {group.groupLabel && (
              <p className="text-[11px] text-gray-500 uppercase tracking-wider px-3 mb-1.5 mt-1">
                {group.groupLabel}
              </p>
            )}
            {group.items.map((item) => (
              <NavLink
                key={item.href}
                {...item}
                onClick={() => setMobileOpen(false)}
              />
            ))}
          </div>
        ))}
      </nav>

      {/* Bottom: Theme + User */}
      <div className="px-3 pb-3 pt-2 border-t border-gray-800 space-y-2">
        <div className="flex items-center justify-between px-1">
          <span className="text-[11px] text-gray-500">Theme</span>
          <ThemeToggle />
        </div>
        <UserSection />
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-60 shrink-0 bg-gray-950 border-r border-gray-800 h-screen sticky top-0 overflow-hidden">
        {sidebarContent}
      </aside>

      {/* Mobile: hamburger button */}
      <button
        className="md:hidden fixed top-3 left-3 z-50 w-9 h-9 bg-gray-900 border border-gray-700 rounded-lg flex items-center justify-center text-gray-300 hover:bg-gray-800 transition shadow-lg"
        onClick={() => setMobileOpen(true)}
        aria-label="เปิดเมนู"
      >
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <line x1="2" y1="4.5" x2="16" y2="4.5" />
          <line x1="2" y1="9" x2="16" y2="9" />
          <line x1="2" y1="13.5" x2="16" y2="13.5" />
        </svg>
      </button>

      {/* Mobile: backdrop */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile: slide-in sidebar */}
      <aside
        className={`md:hidden fixed top-0 left-0 z-50 h-full w-60 bg-gray-950 border-r border-gray-800 transform transition-transform duration-200 ease-in-out ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Close button */}
        <button
          className="absolute top-3 right-3 w-7 h-7 flex items-center justify-center text-gray-400 hover:text-white"
          onClick={() => setMobileOpen(false)}
          aria-label="ปิดเมนู"
        >
          ✕
        </button>
        {sidebarContent}
      </aside>
    </>
  );
}
