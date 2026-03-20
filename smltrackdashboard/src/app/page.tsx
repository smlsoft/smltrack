"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  useSortable,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import IPhoneChat from "@/components/IPhoneChat";
import { ThemeToggle } from "@/components/ThemeProvider";

interface Message {
  _id: string;
  role: "user" | "assistant";
  userName?: string;
  content: string;
  messageType: string;
  imageUrl?: string | null;
  createdAt?: string;
}

interface ScoreData {
  score: number;
  stars: number;
  level: "green" | "yellow" | "red";
  reason: string;
}

interface Group {
  id: string;
  name: string;
  messageCount: number;
  lastMessage: string;
  lastActivity: string | null;
  messages?: Message[];
  sentiment?: ScoreData | null;
  customerSentiment?: ScoreData | null;
  staffSentiment?: ScoreData | null;
  overallSentiment?: ScoreData | null;
  purchaseIntent?: ScoreData | null;
  analysisLogsCount?: number;
}

type FilterKey = "sentiment-green" | "sentiment-yellow" | "sentiment-red" | "purchase-green" | "purchase-yellow" | "purchase-red";

interface AlertData {
  _id: string;
  type: string;
  staffName: string;
  customerName: string;
  responseMinutes: number;
  level: "green" | "yellow" | "red";
  message: string;
  read: boolean;
  createdAt: string;
}

export default function Home() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [order, setOrder] = useState<string[]>([]);
  const [autoSort, setAutoSort] = useState(true);
  const [zoomImage, setZoomImage] = useState<string | null>(null);
  const [filters, setFilters] = useState<Set<FilterKey>>(new Set());
  const [alerts, setAlerts] = useState<AlertData[]>([]);
  const [showAlerts, setShowAlerts] = useState(true);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const fetchAll = useCallback(async () => {
    try {
      const res = await fetch("/dashboard/api/groups");
      const data = await res.json();
      if (!Array.isArray(data)) return;

      // Server ส่ง messages มาพร้อมแล้ว ไม่ต้อง fetch แยก
      const withMessages = data;

      if (autoSort) {
        withMessages.sort((a, b) => {
          const ta = a.lastActivity ? new Date(a.lastActivity).getTime() : 0;
          const tb = b.lastActivity ? new Date(b.lastActivity).getTime() : 0;
          return tb - ta;
        });
        setOrder(withMessages.map((g) => g.id));
      } else if (order.length === 0) {
        setOrder(withMessages.map((g) => g.id));
      } else {
        const newIds = withMessages.map((g) => g.id).filter((id) => !order.includes(id));
        if (newIds.length > 0) setOrder((prev) => [...prev, ...newIds]);
      }

      setGroups(withMessages);
    } catch {}
  }, [autoSort, order.length]);

  const fetchAlerts = useCallback(async () => {
    try {
      const res = await fetch("/dashboard/api/alerts?limit=10");
      const data = await res.json();
      if (data.alerts) setAlerts(data.alerts);
    } catch {}
  }, []);

  useEffect(() => { fetchAll(); fetchAlerts(); }, []);
  useEffect(() => {
    const interval = setInterval(() => { fetchAll(); fetchAlerts(); }, 5000);
    return () => clearInterval(interval);
  }, [fetchAll, fetchAlerts]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setOrder((prev) => {
      const oldIndex = prev.indexOf(active.id as string);
      const newIndex = prev.indexOf(over.id as string);
      return arrayMove(prev, oldIndex, newIndex);
    });
    setAutoSort(false);
  };

  // Filter groups
  // Filter: AND logic — ต้องตรงทุกตัวที่เลือก
  const filteredGroups = groups.filter((g) => {
    if (filters.size === 0) return true;
    for (const f of filters) {
      if (f.startsWith("sentiment-") && g.sentiment?.level !== f.replace("sentiment-", "")) return false;
      if (f.startsWith("purchase-") && g.purchaseIntent?.level !== f.replace("purchase-", "")) return false;
    }
    return true;
  });

  const sortedGroups = order
    .map((id) => filteredGroups.find((g) => g.id === id))
    .filter(Boolean) as Group[];

  return (
    <div className="min-h-screen theme-bg theme-text">
      {/* Zoom Modal */}
      {zoomImage && (
        <div
          className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center cursor-zoom-out"
          onClick={() => setZoomImage(null)}
        >
          <img src={zoomImage} alt="Zoomed" className="max-w-[95vw] max-h-[95vh] object-contain rounded-lg shadow-2xl" />
          <button
            className="absolute top-4 right-4 text-white bg-black/50 rounded-full w-12 h-12 flex items-center justify-center text-3xl hover:bg-black/80 backdrop-blur"
            onClick={() => setZoomImage(null)}
          >&times;</button>
        </div>
      )}

      {/* Alert Banner — ตอบช้า */}
      {showAlerts && alerts.length > 0 && (
        <div className="bg-red-950/80 border-b border-red-800 px-4 py-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 flex-1 overflow-x-auto">
              <span className="text-red-400 text-sm font-bold shrink-0">⚠️ ตอบช้า</span>
              <div className="flex gap-2">
                {alerts.filter(a => a.type === "slow_response").slice(0, 5).map((a) => (
                  <span key={a._id} className={`shrink-0 text-[11px] px-2 py-1 rounded-lg border ${a.level === "red" ? "bg-red-900/50 border-red-700 text-red-300" : "bg-amber-900/50 border-amber-700 text-amber-300"}`}>
                    {a.staffName.replace(/^SML\s*-?\s*/i, "")} ตอบช้า {a.responseMinutes} นาที ({a.customerName})
                  </span>
                ))}
              </div>
            </div>
            <button onClick={() => setShowAlerts(false)} className="text-red-400 hover:text-white ml-2 text-xs shrink-0">✕</button>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="border-b theme-border px-4 py-3 sticky top-0 theme-bg backdrop-blur z-10" style={{ background: "var(--bg-primary)" }}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-gradient-to-br from-indigo-500 to-cyan-500 rounded-xl flex items-center justify-center text-lg shadow-lg shadow-indigo-500/20">💬</div>
          <div>
            <h1 className="text-lg font-bold">SML ChatFlow</h1>
            <p className="text-xs theme-text-muted">CRM from Chat — ไหลลื่นจากแชทสู่ CRM</p>
          </div>
          <div className="ml-auto flex items-center gap-3 flex-wrap">
            {/* Filters — Traffic Light with Labels */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => setFilters(new Set())}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${filters.size === 0 ? "bg-white text-black" : "bg-gray-800 text-gray-400 hover:bg-gray-700"}`}
              >ทั้งหมด</button>

              {/* ความพอใจลูกค้า */}
              <div className="flex items-center gap-1 bg-gray-900/80 rounded-lg px-2 py-1 border border-gray-700">
                <span className="text-[10px] text-gray-500 mr-1">ลูกค้า</span>
                {([
                  { color: "green" as const, label: "ปกติ", emoji: "😊" },
                  { color: "yellow" as const, label: "ติดตาม", emoji: "😐" },
                  { color: "red" as const, label: "ไม่พอใจ", emoji: "😤" },
                ]).map(({ color, label, emoji }) => {
                  const key = `sentiment-${color}` as FilterKey;
                  const isActive = filters.has(key);
                  const activeBg = color === "green" ? "bg-emerald-600 text-white" : color === "yellow" ? "bg-amber-500 text-black" : "bg-red-600 text-white";
                  const inactiveBg = color === "green" ? "bg-emerald-900/30 text-emerald-400 hover:bg-emerald-800/40" : color === "yellow" ? "bg-amber-900/30 text-amber-400 hover:bg-amber-800/40" : "bg-red-900/30 text-red-400 hover:bg-red-800/40";
                  return (
                    <button key={key}
                      onClick={() => setFilters((prev) => {
                        const next = new Set(prev);
                        for (const k of prev) { if (k.startsWith("sentiment-")) next.delete(k); }
                        if (!prev.has(key)) next.add(key);
                        return next;
                      })}
                      className={`px-2 py-0.5 rounded text-[10px] font-medium transition-all ${isActive ? activeBg : inactiveBg}`}
                    >{emoji} {label}</button>
                  );
                })}
              </div>

              {/* โอกาสซื้อ */}
              <div className="flex items-center gap-1 bg-gray-900/80 rounded-lg px-2 py-1 border border-gray-700">
                <span className="text-[10px] text-gray-500 mr-1">ซื้อ</span>
                {([
                  { color: "green" as const, label: "ไม่สนใจ", emoji: "🟢" },
                  { color: "yellow" as const, label: "สนใจ", emoji: "🟡" },
                  { color: "red" as const, label: "ซื้อ!", emoji: "🔴" },
                ]).map(({ color, label, emoji }) => {
                  const key = `purchase-${color}` as FilterKey;
                  const isActive = filters.has(key);
                  const activeBg = color === "green" ? "bg-emerald-600 text-white" : color === "yellow" ? "bg-amber-500 text-black" : "bg-red-600 text-white";
                  const inactiveBg = color === "green" ? "bg-emerald-900/30 text-emerald-400 hover:bg-emerald-800/40" : color === "yellow" ? "bg-amber-900/30 text-amber-400 hover:bg-amber-800/40" : "bg-red-900/30 text-red-400 hover:bg-red-800/40";
                  return (
                    <button key={key}
                      onClick={() => setFilters((prev) => {
                        const next = new Set(prev);
                        for (const k of prev) { if (k.startsWith("purchase-")) next.delete(k); }
                        if (!prev.has(key)) next.add(key);
                        return next;
                      })}
                      className={`px-2 py-0.5 rounded text-[10px] font-medium transition-all ${isActive ? activeBg : inactiveBg}`}
                    >{emoji} {label}</button>
                  );
                })}
              </div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={autoSort}
                onChange={(e) => setAutoSort(e.target.checked)}
                className="w-4 h-4 accent-blue-500 rounded"
              />
              <span className="text-xs text-gray-300">Auto Sort</span>
            </label>
            <Link href="/crm" className="px-3 py-1.5 bg-cyan-900/50 hover:bg-cyan-800/50 border border-cyan-700/50 rounded-lg text-xs text-cyan-300 hover:text-white transition">👥 CRM</Link>
            <Link href="/kpi" className="px-3 py-1.5 bg-purple-900/50 hover:bg-purple-800/50 border border-purple-700/50 rounded-lg text-xs text-purple-300 hover:text-white transition">📊 KPI</Link>
            <Link href="/advice" className="px-3 py-1.5 bg-orange-900/50 hover:bg-orange-800/50 border border-orange-700/50 rounded-lg text-xs text-orange-300 hover:text-white transition">🦐 น้องกุ้ง</Link>
            <Link href="/costs" className="px-3 py-1.5 bg-emerald-900/50 hover:bg-emerald-800/50 border border-emerald-700/50 rounded-lg text-xs text-emerald-300 hover:text-white transition">💰 AI Cost</Link>
            <Link href="/config" className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-xs text-gray-300 hover:text-white transition">⚙️</Link>
            <ThemeToggle />
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              <span className="text-xs text-green-400">{groups.length} groups &middot; Live</span>
            </div>
          </div>
        </div>
      </header>

      {/* iPhone Grid */}
      <main className="p-4">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={order} strategy={rectSortingStrategy}>
            <div className="flex flex-wrap gap-4 justify-center">
              {sortedGroups.map((group) => (
                <SortableIPhone key={group.id} group={group} onZoom={(url) => setZoomImage(url)} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </main>
    </div>
  );
}

function SortableIPhone({ group, onZoom }: { group: Group; onZoom: (url: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: group.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : "auto" as any,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <IPhoneChat group={group} onZoom={onZoom} dragHandleProps={{ ...attributes, ...listeners }} />
    </div>
  );
}
