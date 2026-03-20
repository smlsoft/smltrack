#!/usr/bin/env python3
"""
น้องกุ้ง 🦐 — SMLTrack AI Advisor (ClawTeam Multi-Agent Edition)
Multi-agent: แยก 3 งาน (sentiment / pipeline / summary) → ประหยัด token
ดึงแชทใหม่จาก Agent API → วิเคราะห์ด้วย AI → เก็บ advice ใน MongoDB
+ Cost tracking ทุก AI call
"""

import json
import os
import subprocess
import sys
import urllib.request
from datetime import datetime, timedelta, timezone
from concurrent.futures import ThreadPoolExecutor, as_completed

AGENT_URL = os.environ.get("AGENT_API_URL", "http://agent:3000")
OPENROUTER_KEY = os.environ.get("OPENROUTER_API_KEY", "")
AI_MODEL = os.environ.get("AI_MODEL", "qwen/qwen3-235b-a22b")
TEAM_NAME = "smltrack-advisors"

# ราคาโดยประมาณ (USD per 1M tokens)
AI_PRICING = {
    "qwen/qwen3-235b-a22b": {"input": 0.18, "output": 0.18},
    "qwen/qwen3-30b-a3b": {"input": 0.04, "output": 0.04},
    "meta-llama/llama-3.3-70b-instruct:free": {"input": 0, "output": 0},
}


def api_get(path):
    url = f"{AGENT_URL}{path}"
    try:
        with urllib.request.urlopen(urllib.request.Request(url), timeout=30) as resp:
            return json.loads(resp.read())
    except Exception as e:
        print(f"[ERROR] GET {url}: {e}")
        return None


def api_post(path, data):
    url = f"{AGENT_URL}{path}"
    try:
        body = json.dumps(data).encode("utf-8")
        req = urllib.request.Request(url, data=body, method="POST")
        req.add_header("Content-Type", "application/json")
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read())
    except Exception as e:
        print(f"[ERROR] POST {url}: {e}")
        return None


def call_ai(prompt, context, max_tokens=800):
    """เรียก AI ผ่าน OpenRouter + track cost"""
    if not OPENROUTER_KEY:
        return None, 0, 0

    messages = [
        {"role": "system", "content": prompt},
        {"role": "user", "content": json.dumps(context, ensure_ascii=False, default=str)[:3000]},  # จำกัด 3000 chars ประหยัด token
    ]

    body = json.dumps({
        "model": AI_MODEL,
        "messages": messages,
        "max_tokens": max_tokens,
        "temperature": 0.7,
    }).encode("utf-8")

    req = urllib.request.Request("https://openrouter.ai/api/v1/chat/completions", data=body, method="POST")
    req.add_header("Content-Type", "application/json")
    req.add_header("Authorization", f"Bearer {OPENROUTER_KEY}")

    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            result = json.loads(resp.read())
            content = result["choices"][0]["message"]["content"]
            usage = result.get("usage", {})
            input_tokens = usage.get("prompt_tokens", 0)
            output_tokens = usage.get("completion_tokens", 0)

            # ตัด think tag
            if "</think>" in content:
                content = content.split("</think>")[-1].strip()

            return content, input_tokens, output_tokens
    except Exception as e:
        print(f"[ERROR] AI call: {e}")
        return None, 0, 0


def track_cost(feature, input_tokens, output_tokens, source_id=None):
    """บันทึกค่าใช้จ่ายลง Agent API → MongoDB"""
    pricing = AI_PRICING.get(AI_MODEL, {"input": 0.18, "output": 0.18})
    cost_usd = (input_tokens * pricing["input"] + output_tokens * pricing["output"]) / 1000000

    api_post("/api/advisor/cost", {
        "provider": "openrouter",
        "model": AI_MODEL,
        "feature": feature,
        "inputTokens": input_tokens,
        "outputTokens": output_tokens,
        "totalTokens": input_tokens + output_tokens,
        "costUsd": round(cost_usd, 6),
        "sourceId": source_id,
        "service": "clawteam",
    })


def clawteam_log(msg):
    try:
        subprocess.run(["clawteam", "inbox", "broadcast", TEAM_NAME, msg], capture_output=True, timeout=5)
    except Exception:
        pass


# === Multi-Agent: แยก 3 งาน ===

def agent_sentiment(sources_data):
    """Agent A: วิเคราะห์ sentiment + alerts"""
    context = []
    for d in sources_data:
        context.append({
            "room": d.get("groupName", "?"),
            "sentiment": d.get("analytics", {}).get("customerSentiment", {}),
            "alerts": [{"type": a.get("type"), "staff": a.get("staffName"), "min": a.get("responseMinutes")} for a in d.get("alerts", [])[:3]],
            "recentMsgs": len(d.get("messages", [])),
        })

    prompt = """วิเคราะห์ sentiment ลูกค้า ตอบ JSON เท่านั้น:
{"items":[{"priority":"critical|warning","icon":"emoji","title":"หัวข้อ","detail":"คำแนะนำไทย","action":"ทำอะไร","relatedRoom":"ชื่อห้อง"}]}
ให้ 1-3 ข้อ เฉพาะ critical/warning เท่านั้น ถ้าไม่มีปัญหาให้ items=[]"""

    content, inp, out = call_ai(prompt, context, max_tokens=500)
    track_cost("advisor-sentiment", inp, out)
    return content


def agent_pipeline(sources_data):
    """Agent B: วิเคราะห์โอกาสขาย"""
    context = []
    for d in sources_data:
        skills = d.get("skills", [])
        context.append({
            "room": d.get("groupName", "?"),
            "purchase": d.get("analytics", {}).get("purchaseIntent", {}),
            "customers": [{"name": s.get("userName"), "stage": s.get("pipelineStage"), "purchase": s.get("purchaseIntent", {}).get("level")} for s in skills if not s.get("isStaff")][:5],
        })

    prompt = """วิเคราะห์โอกาสขาย ตอบ JSON เท่านั้น:
{"items":[{"priority":"opportunity","icon":"emoji","title":"หัวข้อ","detail":"คำแนะนำไทย","action":"ทำอะไร","relatedRoom":"ชื่อห้อง"}]}
ให้ 1-3 ข้อ เฉพาะ opportunity เท่านั้น ถ้าไม่มีโอกาสให้ items=[]"""

    content, inp, out = call_ai(prompt, context, max_tokens=500)
    track_cost("advisor-pipeline", inp, out)
    return content


def agent_summary(sources_data, total_sources):
    """Agent C: สรุปภาพรวม"""
    context = {
        "totalSources": total_sources,
        "analyzed": len(sources_data),
        "rooms": [{"name": d.get("groupName", "?"), "msgs": len(d.get("messages", [])), "type": d.get("sourceType")} for d in sources_data],
    }

    prompt = """สรุปภาพรวมสั้นๆ ตอบ JSON เท่านั้น:
{"items":[{"priority":"info","icon":"emoji","title":"หัวข้อ","detail":"สรุปไทยสั้นๆ","action":"","relatedRoom":null}]}
ให้ 1-2 ข้อ เฉพาะ info สรุปสถิติ"""

    content, inp, out = call_ai(prompt, context, max_tokens=300)
    track_cost("advisor-summary", inp, out)
    return content


def parse_ai_items(content):
    """Parse JSON จาก AI response"""
    if not content:
        return []
    try:
        parsed = json.loads(content)
        return parsed.get("items", [])
    except json.JSONDecodeError:
        import re
        match = re.search(r'\{[\s\S]*\}', content)
        if match:
            try:
                return json.loads(match.group()).get("items", [])
            except Exception:
                pass
    return []


def run_advisor():
    """Main: multi-agent ดึงแชทใหม่ → วิเคราะห์ → เก็บ advice"""
    now = datetime.now(timezone.utc)
    since = (now - timedelta(hours=1)).strftime("%Y-%m-%dT%H:%M:%SZ")
    now_iso = now.strftime("%Y-%m-%dT%H:%M:%SZ")

    print(f"\n[น้องกุ้ง] 🦐 เริ่มวิเคราะห์ — since={since}")

    # Step 1: ดึง sources
    result = api_get(f"/api/advisor/sources-changed?since={since}")
    if not result or not result.get("sources"):
        print("[น้องกุ้ง] ไม่มี source เปลี่ยนแปลง — จบ")
        return

    sources = result["sources"]
    print(f"[น้องกุ้ง] พบ {len(sources)} sources เปลี่ยน")

    # Step 2: ดึงรายละเอียด top 5
    details = []
    for src in sources[:5]:
        detail = api_get(f"/api/advisor/source-detail/{src['sourceId']}?since={since}")
        if detail:
            details.append(detail)

    if not details:
        print("[น้องกุ้ง] ไม่มีรายละเอียด — จบ")
        return

    # Step 3: Multi-Agent — รัน 3 agents พร้อมกัน (ประหยัด token เพราะแยก prompt เล็กๆ)
    print(f"[น้องกุ้ง] 🤖 รัน 3 agents พร้อมกัน...")
    all_items = []

    with ThreadPoolExecutor(max_workers=3) as executor:
        futures = {
            executor.submit(agent_sentiment, details): "sentiment",
            executor.submit(agent_pipeline, details): "pipeline",
            executor.submit(agent_summary, details, len(sources)): "summary",
        }
        for future in as_completed(futures):
            name = futures[future]
            try:
                content = future.result()
                items = parse_ai_items(content)
                all_items.extend(items)
                print(f"[น้องกุ้ง] Agent {name}: {len(items)} items")
            except Exception as e:
                print(f"[น้องกุ้ง] Agent {name} error: {e}")

    if not all_items:
        print("[น้องกุ้ง] ไม่มีคำแนะนำ — จบ")
        return

    # เรียง priority
    priority_order = {"critical": 0, "warning": 1, "opportunity": 2, "info": 3}
    all_items.sort(key=lambda x: priority_order.get(x.get("priority", "info"), 3))

    print(f"[น้องกุ้ง] ✅ รวม {len(all_items)} คำแนะนำ")

    # Step 4: POST advice
    source_ids = [d["sourceId"] for d in details]
    post_result = api_post("/api/advisor/advice", {
        "advice": all_items,
        "analyzedSources": source_ids,
        "pulledAt": now_iso,
    })

    if post_result and post_result.get("ok"):
        print(f"[น้องกุ้ง] ✅ บันทึก {len(all_items)} คำแนะนำ")
        clawteam_log(f"🦐 สร้าง {len(all_items)} คำแนะนำจาก {len(source_ids)} sources")
    else:
        print(f"[น้องกุ้ง] ❌ บันทึกล้มเหลว")

    # Step 5: อัพเดต lastPulledAt
    api_post("/api/advisor/update-pulled", {"sourceIds": source_ids, "pulledAt": now_iso})
    print(f"[น้องกุ้ง] 📝 อัพเดต lastPulledAt {len(source_ids)} sources")

    # Step 6: Critical alert → ClawTeam inbox
    criticals = [i for i in all_items if i.get("priority") == "critical"]
    if criticals:
        for c in criticals:
            clawteam_log(f"🚨 CRITICAL: {c.get('title', '?')} — {c.get('detail', '')}")


if __name__ == "__main__":
    run_advisor()
