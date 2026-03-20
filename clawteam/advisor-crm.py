#!/usr/bin/env python3
"""
SMLTrack CRM Advisor — วิเคราะห์ลูกค้าที่ต้อง follow-up + ลูกค้าหลุด
รัน cron ทุก 6 ชม. (4 รอบ/วัน) — ประหยัด token กว่า advisor.py
เน้นข้อมูลเชิงปฏิบัติสำหรับเซลล์ไทย
"""

import json
import os
import urllib.request
from datetime import datetime, timedelta, timezone

AGENT_URL = os.environ.get("AGENT_API_URL", "http://agent:3000")
OPENROUTER_KEY = os.environ.get("OPENROUTER_API_KEY", "")
AI_MODEL = os.environ.get("AI_MODEL", "qwen/qwen3-235b-a22b")


def api_get(path):
    try:
        with urllib.request.urlopen(f"{AGENT_URL}{path}", timeout=30) as r:
            return json.loads(r.read())
    except Exception as e:
        print(f"[CRM] ERROR GET {path}: {e}")
        return None


def api_post(path, data):
    try:
        body = json.dumps(data).encode()
        req = urllib.request.Request(f"{AGENT_URL}{path}", data=body, method="POST")
        req.add_header("Content-Type", "application/json")
        with urllib.request.urlopen(req, timeout=30) as r:
            return json.loads(r.read())
    except Exception as e:
        print(f"[CRM] ERROR POST {path}: {e}")
        return None


def call_ai(prompt, context, max_tokens=600):
    if not OPENROUTER_KEY:
        return None, 0, 0
    body = json.dumps({
        "model": AI_MODEL,
        "messages": [
            {"role": "system", "content": prompt},
            {"role": "user", "content": json.dumps(context, ensure_ascii=False, default=str)[:2500]},
        ],
        "max_tokens": max_tokens,
        "temperature": 0.7,
    }).encode()
    req = urllib.request.Request("https://openrouter.ai/api/v1/chat/completions", data=body, method="POST")
    req.add_header("Content-Type", "application/json")
    req.add_header("Authorization", f"Bearer {OPENROUTER_KEY}")
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            result = json.loads(r.read())
            content = result["choices"][0]["message"]["content"]
            usage = result.get("usage", {})
            if "</think>" in content:
                content = content.split("</think>")[-1].strip()
            return content, usage.get("prompt_tokens", 0), usage.get("completion_tokens", 0)
    except Exception as e:
        print(f"[CRM] AI error: {e}")
        return None, 0, 0


def track_cost(feature, inp, out):
    pricing = {"input": 0.18, "output": 0.18}
    cost = (inp * pricing["input"] + out * pricing["output"]) / 1000000
    api_post("/api/advisor/cost", {
        "provider": "openrouter", "model": AI_MODEL, "feature": feature,
        "inputTokens": inp, "outputTokens": out, "totalTokens": inp + out,
        "costUsd": round(cost, 6), "service": "clawteam-crm",
    })


def run_crm_advisor():
    now = datetime.now(timezone.utc)
    now_iso = now.strftime("%Y-%m-%dT%H:%M:%SZ")

    print(f"\n[CRM] 🎯 เริ่มวิเคราะห์ CRM — {now_iso}")

    # ดึง KPI data (มีทุกอย่างแล้ว: pipeline, inactive, staff)
    kpi = api_get("/api/costs")  # costs for budget check

    # ดึง sources ที่เปลี่ยน (24 ชม. เพราะรัน 4 รอบ/วัน)
    since_24h = (now - timedelta(hours=24)).strftime("%Y-%m-%dT%H:%M:%SZ")
    sources = api_get(f"/api/advisor/sources-changed?since={since_24h}")
    if not sources:
        print("[CRM] ไม่มีข้อมูล — จบ")
        return

    changed = sources.get("sources", [])
    print(f"[CRM] พบ {len(changed)} sources มีความเคลื่อนไหว 24 ชม.")

    # ดึง top 3 details
    details = []
    for s in changed[:3]:
        d = api_get(f"/api/advisor/source-detail/{s['sourceId']}?since={since_24h}")
        if d:
            details.append(d)

    # สร้าง context สำหรับ AI
    context = {
        "totalActive": len(changed),
        "rooms": [{
            "name": d.get("groupName", "?"),
            "type": d.get("sourceType"),
            "msgs": len(d.get("messages", [])),
            "sentiment": d.get("analytics", {}).get("customerSentiment", {}),
            "purchase": d.get("analytics", {}).get("purchaseIntent", {}),
            "customers": [{
                "name": s.get("userName"),
                "stage": s.get("pipelineStage"),
                "sentiment": s.get("sentiment", {}).get("level"),
                "purchase": s.get("purchaseIntent", {}).get("level"),
                "tags": (s.get("tags") or [])[:3],
            } for s in d.get("skills", []) if not s.get("isStaff")][:3],
        } for d in details],
    }

    # AI วิเคราะห์ — 1 call เดียว (ประหยัด token)
    prompt = """คุณคือ CRM Advisor สำหรับธุรกิจ SME ไทย ตอบ JSON เท่านั้น:
{"followups":[{"customer":"ชื่อ","room":"ห้อง","action":"ทำอะไร","message":"ข้อความที่ควรส่ง (ภาษาไทย สุภาพ)","urgency":"high|medium|low"}],"insights":[{"title":"หัวข้อ","detail":"รายละเอียดไทย"}]}

วิเคราะห์:
1. ลูกค้าที่ควร follow-up ด่วน (purchase intent สูง + ยังไม่ปิด)
2. ลูกค้าที่ sentiment เริ่มแย่ → ร่างข้อความทักทาย
3. โอกาสขายที่ซ่อนอยู่ (ถามราคา, สนใจแต่ยังไม่ซื้อ)

เน้น: กระชับ ได้ใจความ ข้อความพร้อมส่งทาง LINE ได้เลย"""

    content, inp, out = call_ai(prompt, context, max_tokens=800)
    track_cost("crm-analysis", inp, out)

    if not content:
        print("[CRM] AI ไม่ตอบ — จบ")
        return

    # Parse — ลอง JSON หลายแบบ
    import re
    parsed = None
    # ลอง direct parse
    try:
        parsed = json.loads(content)
    except Exception:
        pass
    # ลอง extract JSON block
    if not parsed:
        try:
            match = re.search(r'```json?\s*([\s\S]*?)```', content)
            if match:
                parsed = json.loads(match.group(1))
        except Exception:
            pass
    # ลอง extract { ... }
    if not parsed:
        try:
            match = re.search(r'\{[\s\S]*\}', content)
            if match:
                parsed = json.loads(match.group())
        except Exception:
            pass
    if not parsed:
        print(f"[CRM] JSON parse error — content[:200]: {content[:200]}")
        return

    followups = parsed.get("followups", [])
    insights = parsed.get("insights", [])

    print(f"[CRM] ✅ {len(followups)} follow-ups, {len(insights)} insights")

    # สร้าง advice items จาก followups + insights
    advice_items = []
    for f in followups:
        urgency_map = {"high": "critical", "medium": "warning", "low": "opportunity"}
        advice_items.append({
            "priority": urgency_map.get(f.get("urgency", "low"), "info"),
            "icon": "📞" if f.get("urgency") == "high" else "💬",
            "title": f"Follow-up: {f.get('customer', '?')}",
            "detail": f"{f.get('action', '')} — \"{f.get('message', '')}\"",
            "action": f"ส่งข้อความให้ {f.get('customer', '?')} ทาง LINE",
            "relatedRoom": f.get("room"),
        })

    for i in insights:
        advice_items.append({
            "priority": "info",
            "icon": "💡",
            "title": i.get("title", "Insight"),
            "detail": i.get("detail", ""),
            "action": "",
            "relatedRoom": None,
        })

    if advice_items:
        source_ids = [d["sourceId"] for d in details]
        api_post("/api/advisor/advice", {
            "advice": advice_items,
            "analyzedSources": source_ids,
            "pulledAt": now_iso,
        })
        print(f"[CRM] ✅ บันทึก {len(advice_items)} CRM advice items")


if __name__ == "__main__":
    run_crm_advisor()
