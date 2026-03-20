"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ThemeToggle } from "@/components/ThemeProvider";

interface Customer {
  _id: string;
  name: string;
  firstName?: string;
  lastName?: string;
  company?: string;
  position?: string;
  phone?: string;
  email?: string;
  lineId?: string;
  address?: string;
  notes?: string;
  avatarUrl?: string;
  tags: string[];
  customTags?: string[];
  rooms: string[];
  totalMessages: number;
  pipelineStage: string;
  lastSentiment: { score: number; level: string; reason?: string } | null;
  lastPurchaseIntent: { score: number; level: string; reason?: string } | null;
  createdAt: string;
  updatedAt: string;
}

const STAGES: Record<string, { label: string; color: string; icon: string }> = {
  new: { label: "ใหม่", color: "bg-gray-500", icon: "🆕" },
  interested: { label: "สนใจ", color: "bg-blue-500", icon: "👀" },
  quoting: { label: "เสนอราคา", color: "bg-purple-500", icon: "💰" },
  negotiating: { label: "ต่อรอง", color: "bg-amber-500", icon: "🤝" },
  closed_won: { label: "ปิดการขาย", color: "bg-emerald-500", icon: "✅" },
  closed_lost: { label: "ไม่ซื้อ", color: "bg-red-500", icon: "❌" },
  following_up: { label: "ติดตาม", color: "bg-cyan-500", icon: "📞" },
};

const SL: Record<string, string> = { green: "ปกติ", yellow: "ติดตาม", red: "ไม่พอใจ" };
const PL: Record<string, string> = { green: "ไม่สนใจ", yellow: "เริ่มสนใจ", red: "สนใจซื้อ!" };

function Badge({ level, label }: { level: string; label: string }) {
  const colors: Record<string, string> = {
    green: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    yellow: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    red: "bg-red-500/20 text-red-400 border-red-500/30",
  };
  return <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium border ${colors[level] || colors.green}`}>{label}</span>;
}

export default function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Form fields
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [company, setCompany] = useState("");
  const [position, setPosition] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [lineId, setLineId] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [customTags, setCustomTags] = useState("");

  useEffect(() => {
    fetch(`/dashboard/api/customers/${id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d._id) {
          setCustomer(d);
          setFirstName(d.firstName || "");
          setLastName(d.lastName || "");
          setCompany(d.company || "");
          setPosition(d.position || "");
          setPhone(d.phone || "");
          setEmail(d.email || "");
          setLineId(d.lineId || "");
          setAddress(d.address || "");
          setNotes(d.notes || "");
          setAvatarUrl(d.avatarUrl || "");
          setCustomTags((d.customTags || []).join(", "));
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [id]);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    await fetch(`/dashboard/api/customers/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName, lastName, company, position,
        phone, email, lineId, address, notes, avatarUrl,
        customTags: customTags.split(",").map((t) => t.trim()).filter(Boolean),
      }),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      router.push("/crm");
    }, 1000);
  };

  if (loading) return <div className="min-h-screen theme-bg flex items-center justify-center"><div className="theme-text-muted animate-pulse">Loading...</div></div>;
  if (!customer) return <div className="min-h-screen theme-bg flex items-center justify-center"><div className="text-red-400">ไม่พบลูกค้า</div></div>;

  const stage = STAGES[customer.pipelineStage] || STAGES.new;

  return (
    <div className="min-h-screen theme-bg theme-text">
      <header className="border-b theme-border px-6 py-4 sticky top-0 z-10" style={{ background: "var(--bg-primary)" }}>
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/crm" className="theme-text-muted hover:theme-text text-xl">&larr;</Link>
            <div className="flex items-center gap-3">
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="w-10 h-10 rounded-full object-cover border-2 theme-border" />
              ) : (
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white ${stage.color}`}>
                  {(firstName || customer.name).substring(0, 2)}
                </div>
              )}
              <div>
                <h1 className="text-lg font-bold">{firstName || lastName ? `${firstName} ${lastName}`.trim() : customer.name}</h1>
                <div className="flex items-center gap-2">
                  {company && <span className="text-xs theme-text-muted">{company}</span>}
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium text-white ${stage.color}`}>
                    {stage.icon} {stage.label}
                  </span>
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${saving ? "opacity-50" : saved ? "bg-emerald-600 text-white" : "bg-blue-600 hover:bg-blue-500 text-white"}`}
            >
              {saving ? "กำลังบันทึก..." : saved ? "✓ บันทึกแล้ว" : "💾 บันทึก"}
            </button>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-6 space-y-6">
        {/* AI Scores — Auto จาก สนทนา */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="rounded-xl border theme-border p-3" style={{ background: "var(--bg-card)" }}>
            <p className="text-[10px] theme-text-muted mb-1">😊 ความรู้สึก</p>
            {customer.lastSentiment ? <Badge level={customer.lastSentiment.level} label={SL[customer.lastSentiment.level]} /> : <span className="theme-text-muted text-xs">-</span>}
          </div>
          <div className="rounded-xl border theme-border p-3" style={{ background: "var(--bg-card)" }}>
            <p className="text-[10px] theme-text-muted mb-1">🛒 โอกาสซื้อ</p>
            {customer.lastPurchaseIntent ? <Badge level={customer.lastPurchaseIntent.level} label={PL[customer.lastPurchaseIntent.level]} /> : <span className="theme-text-muted text-xs">-</span>}
          </div>
          <div className="rounded-xl border theme-border p-3" style={{ background: "var(--bg-card)" }}>
            <p className="text-[10px] theme-text-muted mb-1">📨 ข้อความ</p>
            <span className="text-lg font-bold">{customer.totalMessages}</span>
          </div>
          <div className="rounded-xl border theme-border p-3" style={{ background: "var(--bg-card)" }}>
            <p className="text-[10px] theme-text-muted mb-1">💬 ห้อง</p>
            <span className="text-lg font-bold">{(customer.rooms || []).length}</span>
          </div>
        </div>

        {/* Auto Tags — จาก AI */}
        {(customer.tags || []).length > 0 && (
          <div className="rounded-xl border theme-border p-4" style={{ background: "var(--bg-card)" }}>
            <p className="text-xs theme-text-muted mb-2">🏷️ Tags อัตโนมัติ (AI)</p>
            <div className="flex flex-wrap gap-1.5">
              {customer.tags.map((t) => (
                <span key={t} className="text-xs px-2 py-1 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">{t}</span>
              ))}
            </div>
          </div>
        )}

        {/* Form — ข้อมูลที่ user เพิ่มเติมเอง */}
        <div className="rounded-xl border theme-border p-6" style={{ background: "var(--bg-card)" }}>
          <h2 className="text-sm font-bold mb-4">📝 ข้อมูลลูกค้า <span className="text-xs theme-text-muted font-normal">(แก้ไขได้)</span></h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] theme-text-muted mb-1">ชื่อ</label>
              <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)}
                placeholder={customer.name}
                className="w-full px-3 py-2 rounded-lg border theme-border text-sm theme-bg theme-text" style={{ background: "var(--bg-primary)" }} />
            </div>
            <div>
              <label className="block text-[11px] theme-text-muted mb-1">นามสกุล</label>
              <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border theme-border text-sm theme-bg theme-text" style={{ background: "var(--bg-primary)" }} />
            </div>
            <div>
              <label className="block text-[11px] theme-text-muted mb-1">บริษัท</label>
              <input type="text" value={company} onChange={(e) => setCompany(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border theme-border text-sm theme-bg theme-text" style={{ background: "var(--bg-primary)" }} />
            </div>
            <div>
              <label className="block text-[11px] theme-text-muted mb-1">ตำแหน่ง</label>
              <input type="text" value={position} onChange={(e) => setPosition(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border theme-border text-sm theme-bg theme-text" style={{ background: "var(--bg-primary)" }} />
            </div>
            <div>
              <label className="block text-[11px] theme-text-muted mb-1">เบอร์โทร</label>
              <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border theme-border text-sm theme-bg theme-text" style={{ background: "var(--bg-primary)" }} />
            </div>
            <div>
              <label className="block text-[11px] theme-text-muted mb-1">อีเมล</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border theme-border text-sm theme-bg theme-text" style={{ background: "var(--bg-primary)" }} />
            </div>
            <div>
              <label className="block text-[11px] theme-text-muted mb-1">LINE ID</label>
              <input type="text" value={lineId} onChange={(e) => setLineId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border theme-border text-sm theme-bg theme-text" style={{ background: "var(--bg-primary)" }} />
            </div>
            <div>
              <label className="block text-[11px] theme-text-muted mb-1">รูปภาพ (URL)</label>
              <input type="url" value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)}
                placeholder="https://..."
                className="w-full px-3 py-2 rounded-lg border theme-border text-sm theme-bg theme-text" style={{ background: "var(--bg-primary)" }} />
            </div>
          </div>

          <div className="mt-4">
            <label className="block text-[11px] theme-text-muted mb-1">ที่อยู่</label>
            <input type="text" value={address} onChange={(e) => setAddress(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border theme-border text-sm theme-bg theme-text" style={{ background: "var(--bg-primary)" }} />
          </div>

          <div className="mt-4">
            <label className="block text-[11px] theme-text-muted mb-1">Tags เพิ่มเติม <span className="theme-text-muted">(คั่นด้วย ,)</span></label>
            <input type="text" value={customTags} onChange={(e) => setCustomTags(e.target.value)}
              placeholder="VIP, ลูกค้าเก่า, กรุงเทพ"
              className="w-full px-3 py-2 rounded-lg border theme-border text-sm theme-bg theme-text" style={{ background: "var(--bg-primary)" }} />
          </div>

          <div className="mt-4">
            <label className="block text-[11px] theme-text-muted mb-1">หมายเหตุ</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
              placeholder="บันทึกเพิ่มเติม..."
              className="w-full px-3 py-2 rounded-lg border theme-border text-sm theme-bg theme-text resize-none" style={{ background: "var(--bg-primary)" }} />
          </div>

          <div className="mt-4 flex items-center justify-between">
            <p className="text-[10px] theme-text-muted">
              สร้างเมื่อ {new Date(customer.createdAt).toLocaleString("th-TH")} &middot;
              อัปเดต {new Date(customer.updatedAt).toLocaleString("th-TH")}
            </p>
            <button
              onClick={handleSave}
              disabled={saving}
              className={`px-6 py-2 rounded-lg text-sm font-medium transition ${saving ? "opacity-50" : saved ? "bg-emerald-600 text-white" : "bg-blue-600 hover:bg-blue-500 text-white"}`}
            >
              {saving ? "กำลังบันทึก..." : saved ? "✓ บันทึกแล้ว" : "💾 บันทึก"}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
