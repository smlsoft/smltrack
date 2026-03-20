"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeProvider";

interface AdviceItem {
  priority: "critical" | "warning" | "opportunity" | "info";
  icon: string;
  title: string;
  detail: string;
  action: string;
  relatedRoom?: string;
  timestamp?: string;
}

interface AdviceBatch {
  generatedAt: string;
  items: AdviceItem[];
}

const PRIORITY_STYLES: Record<
  string,
  { bg: string; text: string; border: string; dot: string; label: string }
> = {
  critical: {
    bg: "bg-red-500/10",
    text: "text-red-500",
    border: "border-red-500/30",
    dot: "bg-red-500",
    label: "วิกฤต",
  },
  warning: {
    bg: "bg-amber-500/10",
    text: "text-amber-500",
    border: "border-amber-500/30",
    dot: "bg-amber-500",
    label: "เตือน",
  },
  opportunity: {
    bg: "bg-emerald-500/10",
    text: "text-emerald-500",
    border: "border-emerald-500/30",
    dot: "bg-emerald-500",
    label: "โอกาส",
  },
  info: {
    bg: "bg-blue-500/10",
    text: "text-blue-500",
    border: "border-blue-500/30",
    dot: "bg-blue-500",
    label: "ข้อมูล",
  },
};

function PriorityBadge({ priority }: { priority: string }) {
  const s = PRIORITY_STYLES[priority] || PRIORITY_STYLES.info;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium ${s.bg} ${s.text} border ${s.border}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}

function formatTimestamp(ts: string) {
  try {
    const d = new Date(ts);
    return d.toLocaleString("th-TH", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return ts;
  }
}

export default function AdvicePage() {
  const [batches, setBatches] = useState<AdviceBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const fetchAdvice = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/dashboard/api/advice");
      const data = await res.json();
      if (Array.isArray(data)) {
        // MongoDB ส่ง { advice: [...], createdAt } → map เป็น AdviceBatch
        const mapped = data.slice(0, 5).map((doc: any) => ({
          generatedAt: doc.createdAt || new Date().toISOString(),
          items: (doc.advice || []).map((a: any) => ({
            ...a,
            priority: a.priority || "info",
          })),
        }));
        setBatches(mapped);
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  const generateAdvice = useCallback(async () => {
    try {
      setGenerating(true);
      await fetch("/dashboard/api/advice", { method: "POST" });
      await fetchAdvice();
    } catch {
      /* ignore */
    } finally {
      setGenerating(false);
    }
  }, [fetchAdvice]);

  useEffect(() => {
    fetchAdvice();
  }, [fetchAdvice]);

  // Auto-refresh every 5 minutes
  useEffect(() => {
    const interval = setInterval(fetchAdvice, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchAdvice]);

  const totalItems = batches.reduce((sum, b) => sum + b.items.length, 0);

  return (
    <div className="min-h-screen theme-bg">
      {/* Header */}
      <header
        className="sticky top-0 z-30 backdrop-blur-md border-b theme-border"
        style={{ background: "var(--bg-secondary)" }}
      >
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex items-center gap-1.5 text-sm theme-text-secondary hover:opacity-80 transition-opacity"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
              กลับ
            </Link>
            <h1 className="text-lg font-bold theme-text">
              🦐 น้องกุ้ง — AI Advisor
            </h1>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* Action bar */}
        <div className="flex items-center justify-between">
          <p className="text-sm theme-text-secondary">
            {loading
              ? "กำลังโหลด..."
              : `${totalItems} คำแนะนำจาก ${batches.length} รอบ`}
          </p>
          <button
            onClick={generateAdvice}
            disabled={generating}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-all disabled:opacity-50"
            style={{ background: "var(--primary)" }}
          >
            {generating ? (
              <svg
                className="w-4 h-4 animate-spin"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
            ) : (
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            )}
            {generating ? "กำลังสร้าง..." : "รีเฟรชคำแนะนำ"}
          </button>
        </div>

        {/* Loading state */}
        {loading && batches.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <svg
              className="w-8 h-8 animate-spin"
              style={{ color: "var(--primary)" }}
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            <p className="text-sm theme-text-muted">
              กำลังโหลดคำแนะนำ...
            </p>
          </div>
        )}

        {/* Empty state */}
        {!loading && batches.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl"
              style={{ background: "var(--primary-bg)" }}
            >
              🦐
            </div>
            <div className="text-center space-y-1">
              <p className="text-sm font-medium theme-text">
                ยังไม่มีคำแนะนำ
              </p>
              <p className="text-xs theme-text-muted">
                กดปุ่ม &quot;รีเฟรชคำแนะนำ&quot;
                เพื่อให้น้องกุ้งวิเคราะห์และสร้างคำแนะนำใหม่
              </p>
            </div>
          </div>
        )}

        {/* Advice batches */}
        {batches.map((batch, batchIdx) => (
          <section key={batchIdx} className="space-y-3">
            <div className="flex items-center gap-2">
              <div
                className="h-px flex-1"
                style={{ background: "var(--border)" }}
              />
              <span className="text-xs font-medium theme-text-muted px-2">
                {formatTimestamp(batch.generatedAt)}
              </span>
              <div
                className="h-px flex-1"
                style={{ background: "var(--border)" }}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {batch.items.map((item, itemIdx) => {
                const ps =
                  PRIORITY_STYLES[item.priority] || PRIORITY_STYLES.info;
                return (
                  <div
                    key={itemIdx}
                    className={`rounded-xl border p-4 space-y-3 transition-colors theme-bg-card theme-border hover:border-opacity-60`}
                    style={{
                      borderLeftWidth: 3,
                      borderLeftColor:
                        item.priority === "critical"
                          ? "#ef4444"
                          : item.priority === "warning"
                            ? "#f59e0b"
                            : item.priority === "opportunity"
                              ? "#10b981"
                              : "#3b82f6",
                    }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{item.icon}</span>
                        <h3 className="text-sm font-semibold theme-text leading-tight">
                          {item.title}
                        </h3>
                      </div>
                      <PriorityBadge priority={item.priority} />
                    </div>

                    <p className="text-xs theme-text-secondary leading-relaxed">
                      {item.detail}
                    </p>

                    {item.action && (
                      <div
                        className="rounded-lg px-3 py-2 text-xs"
                        style={{
                          background: "var(--primary-bg)",
                          color: "var(--primary)",
                        }}
                      >
                        <span className="font-medium">แนะนำ:</span>{" "}
                        {item.action}
                      </div>
                    )}

                    <div className="flex items-center justify-between">
                      {item.relatedRoom && (
                        <span className="text-[11px] theme-text-muted">
                          ห้อง: {item.relatedRoom}
                        </span>
                      )}
                      {item.timestamp && (
                        <span className="text-[11px] theme-text-muted ml-auto">
                          {formatTimestamp(item.timestamp)}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </main>
    </div>
  );
}
