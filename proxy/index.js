/**
 * SMLTrack AI Agent — All-in-One
 * LINE webhook → เก็บ MongoDB → RAG → AI (SambaNova/Groq/Gemini) → ตอบ LINE
 * All-in-One: LINE + RAG + AI Agent + MCP + Analytics
 */
const express = require("express");
const http = require("http");
const { MongoClient } = require("mongodb");
const app = express();

// === Reverse Proxy: /dashboard* → dashboard container ===
const DASHBOARD_HOST = process.env.DASHBOARD_HOST || "dashboard";
const DASHBOARD_PORT = parseInt(process.env.DASHBOARD_PORT || "3001", 10);

app.use("/dashboard", (req, res) => {
  // app.use strips "/dashboard" prefix → restore มัน
  const targetPath = "/dashboard" + (req.url === "/" ? "" : req.url);
  const options = {
    hostname: DASHBOARD_HOST,
    port: DASHBOARD_PORT,
    path: targetPath,
    method: req.method,
    headers: { ...req.headers, host: `${DASHBOARD_HOST}:${DASHBOARD_PORT}` },
  };
  const proxy = http.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res);
  });
  proxy.on("error", () => {
    if (!res.headersSent) res.status(502).send("Dashboard unavailable");
  });
  req.pipe(proxy);
});

// === MongoDB ===
let db = null;
async function getDB() {
  if (db) return db;
  const uri = process.env.MONGODB_URI;
  if (!uri) return null;
  try {
    const client = new MongoClient(uri, { serverSelectionTimeoutMS: 3000 });
    await client.connect();
    db = client.db(process.env.MONGODB_DB || "smltrack");
    console.log("[DB] MongoDB connected");
    return db;
  } catch (e) {
    console.error("[DB] Failed:", e.message);
    return null;
  }
}


// === Collection เดียว: messages (แยกด้วย sourceId field) ===
const MESSAGES_COLL = "messages";

// === Bot Config ต่อ group/คน — personality แยกเด็ดขาด ===
const botConfigCache = {}; // cache ไม่ต้อง query ทุกครั้ง

const DEFAULT_PROMPT = `คุณชื่อ "น้องปู" 🦀 เป็นเลขาส่วนตัว

บทบาท:
- เป็นเลขาที่คอยช่วยเหลือ แนะนำ ดูแลทุกเรื่อง
- ช่วยตอบคำถาม จัดการนัดหมาย หาข้อมูล สรุปงาน
- จดจำสิ่งที่เคยคุย เพื่อทำงานต่อเนื่อง

บุคลิก:
- ตอบเป็นภาษาไทย สุภาพ เป็นกันเอง อบอุ่น แต่มีมุขตลกแทรกบ้าง
- ใช้ emoji พอประมาณ 😊✨
- ตอบ 2-4 ประโยค กระชับ ได้ใจความ เหมือนเลขาตัวจริง
- ถ้าไม่รู้คำตอบ ให้บอกตรงๆ เช่น "ตรงนี้ปูขอเช็คข้อมูลก่อนนะคะ 📋"
- ห้ามบอกว่าเป็น AI หรือ chatbot ให้บอกว่าเป็น "เลขาน้องปู" เท่านั้น`;

async function getBotConfig(sourceId, sourceMeta) {
  // ลอง cache ก่อน (expire 60 วินาที)
  const cached = botConfigCache[sourceId];
  if (cached && Date.now() - cached._ts < 60000) return cached;

  const database = await getDB();
  if (!database) return { systemPrompt: DEFAULT_PROMPT, botName: "น้องปู" };
  try {
    let config = await database.collection("bot_config").findOne({ sourceId });

    // ถ้ายังไม่มี config → สร้างอัตโนมัติ
    if (!config) {
      config = {
        sourceId,
        sourceType: sourceMeta?.type || "unknown",
        groupName: sourceMeta?.groupName || null,
        botName: "น้องปู",
        systemPrompt: DEFAULT_PROMPT,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      await database.collection("bot_config").insertOne(config);
      console.log(`[Config] Auto-created config for ${sourceId} (${sourceMeta?.groupName || "unknown"})`);
    }

    config._ts = Date.now();
    botConfigCache[sourceId] = config;
    return config;
  } catch (e) {
    return { systemPrompt: DEFAULT_PROMPT, botName: "น้องปู" };
  }
}

async function setBotConfig(sourceId, updates) {
  const database = await getDB();
  if (!database) return;
  await database.collection("bot_config").updateOne(
    { sourceId },
    { $set: { ...updates, sourceId, updatedAt: new Date() } },
    { upsert: true }
  );
  delete botConfigCache[sourceId]; // clear cache
}

// === Download image จาก LINE ===
async function downloadLineImage(messageId) {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) return null;
  try {
    const res = await fetch(
      `https://api-data.line.me/v2/bot/message/${messageId}/content`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch (e) {
    return null;
  }
}


// === Get user profile ===
async function getUserName(source) {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) return "User";
  try {
    let url;
    if (source.type === "group" && source.userId) {
      url = `https://api.line.me/v2/bot/group/${source.groupId}/member/${source.userId}`;
    } else if (source.userId) {
      url = `https://api.line.me/v2/bot/profile/${source.userId}`;
    }
    if (!url) return "User";
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return "User";
    const data = await res.json();
    return data.displayName || "User";
  } catch (e) {
    return "User";
  }
}

// === Lightweight AI Call — วน providers ทั้งหมด ตัวไหน fail ข้ามทันที ===
const lightAICooldown = {}; // provider → cooldown until timestamp

async function callLightAI(messages, { json = false, maxTokens = 500, timeout = 15000 } = {}) {
  // OpenAI-compatible providers (เรียง: ฟรีก่อน → เสียเงินทีหลัง)
  const providers = [
    { name: "OR-Nemotron", url: "https://openrouter.ai/api/v1/chat/completions", key: process.env.OPENROUTER_API_KEY, model: "nvidia/nemotron-3-super-120b-a12b:free" },
    { name: "OR-Llama", url: "https://openrouter.ai/api/v1/chat/completions", key: process.env.OPENROUTER_API_KEY, model: "meta-llama/llama-3.3-70b-instruct:free" },
    { name: "OR-Trinity", url: "https://openrouter.ai/api/v1/chat/completions", key: process.env.OPENROUTER_API_KEY, model: "arcee-ai/trinity-large-preview:free" },
    { name: "SambaNova", url: "https://api.sambanova.ai/v1/chat/completions", key: process.env.SAMBANOVA_API_KEY, model: "Qwen3-235B" },
    { name: "Groq", url: "https://api.groq.com/openai/v1/chat/completions", key: process.env.GROQ_API_KEY, model: "llama-3.3-70b-versatile" },
    { name: "Cerebras", url: "https://api.cerebras.ai/v1/chat/completions", key: process.env.CEREBRAS_API_KEY, model: "qwen-3-235b-a22b-instruct-2507" },
  ].filter((p) => p.key);

  for (const p of providers) {
    // ข้ามถ้ายังอยู่ใน cooldown
    if (lightAICooldown[p.name] && Date.now() < lightAICooldown[p.name]) continue;

    try {
      const body = { model: p.model, messages, max_tokens: maxTokens };
      if (json) body.response_format = { type: "json_object" };
      const res = await fetch(p.url, {
        method: "POST",
        signal: AbortSignal.timeout(timeout),
        headers: { Authorization: `Bearer ${p.key}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.choices?.[0]?.message?.content) return data.choices[0].message.content;
      // Rate limit → cooldown 5 นาที
      if (data.error) {
        const errMsg = data.error.message || "";
        if (errMsg.includes("rate") || errMsg.includes("limit") || errMsg.includes("429") || data.error.code === 429) {
          lightAICooldown[p.name] = Date.now() + 1800000;
          console.log(`[LightAI] ${p.name} rate limited → cooldown 30m`);
        } else {
          console.log(`[LightAI] ${p.name}: ${errMsg.substring(0, 60)}`);
        }
      }
    } catch (e) {
      // Timeout → cooldown 2 นาที
      lightAICooldown[p.name] = Date.now() + 600000;
      console.log(`[LightAI] ${p.name} timeout → cooldown 10m`);
    }
  }

  // Last resort: Gemini (API ต่างจาก OpenAI format)
  const googleKey = process.env.GOOGLE_API_KEY;
  if (googleKey && (!lightAICooldown["Gemini"] || Date.now() >= lightAICooldown["Gemini"])) {
    try {
      const systemMsg = messages.find((m) => m.role === "system");
      const userMsg = messages.find((m) => m.role === "user");
      const text = (systemMsg ? systemMsg.content + "\n\n" : "") + (userMsg?.content || "");
      const genConfig = json ? { responseMimeType: "application/json" } : {};
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${googleKey}`,
        {
          method: "POST",
          signal: AbortSignal.timeout(timeout),
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contents: [{ parts: [{ text }] }], generationConfig: genConfig }),
        }
      );
      const data = await res.json();
      if (data.candidates?.[0]?.content?.parts?.[0]?.text) return data.candidates[0].content.parts[0].text;
      if (data.error) {
        lightAICooldown["Gemini"] = Date.now() + 1800000;
        console.log("[LightAI] Gemini rate limited → cooldown 30m");
      }
    } catch (e) {
      lightAICooldown["Gemini"] = Date.now() + 600000;
    }
  }

  console.log("[LightAI] ❌ ทุก provider ไม่ว่าง");
  return null;
}

// === Gemini Embedding API ===
async function getEmbedding(text) {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey || !text) return null;
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: { parts: [{ text: text.substring(0, 2000) }] },
        }),
      }
    );
    const data = await res.json();
    return data.embedding?.values || null;
  } catch (e) {
    console.error("[Embed] Error:", e.message);
    return null;
  }
}

// === Save message to MongoDB (collection เดียว + embedding non-blocking) ===
async function saveMsg(sourceId, msg) {
  const database = await getDB();
  if (!database) return;
  try {
    const doc = { ...msg, sourceId, createdAt: new Date() };
    const result = await database.collection(MESSAGES_COLL).insertOne(doc);

    // Embed แบบ non-blocking
    const text = msg.content || "";
    if (text.length > 2) {
      getEmbedding(text).then(async (embedding) => {
        if (embedding) {
          await database.collection(MESSAGES_COLL).updateOne(
            { _id: result.insertedId },
            { $set: { embedding } }
          );
        }
      }).catch(() => {});
    }
  } catch (e) {
    console.error("[DB] Save error:", e.message);
  }
}

// === สร้าง compound index (เรียกครั้งเดียวตอน startup) ===
async function ensureIndexes() {
  const database = await getDB();
  if (!database) return;
  try {
    const coll = database.collection(MESSAGES_COLL);
    await coll.createIndex({ sourceId: 1, createdAt: -1 });
    await coll.createIndex({ sourceId: 1, content: "text" });
    // index สำหรับ user_skills + analysis_logs + alerts
    await database.collection("user_skills").createIndex({ sourceId: 1, userId: 1 }, { unique: true });
    await database.collection("analysis_logs").createIndex({ sourceId: 1, analyzedAt: -1 });
    await database.collection("alerts").createIndex({ createdAt: -1 });
    await database.collection("alerts").createIndex({ read: 1, createdAt: -1 });
    console.log("[Index] ✅ messages + analysis_logs indexes ready");
  } catch (e) {
    if (!e.message?.includes("already exists")) {
      console.error("[Index] Error:", e.message);
    }
  }
}

// === RAG: Vector Search → Keyword Search → Recent (3-tier fallback) ===
async function searchMessages(sourceId, queryText, limit = 10) {
  const database = await getDB();
  if (!database) return [];
  const coll = database.collection(MESSAGES_COLL);

  // 1. ลอง Vector Search (ถ้ามี embedding)
  const queryEmbedding = await getEmbedding(queryText).catch(() => null);
  if (queryEmbedding) {
    try {
      const results = await coll.aggregate([
        {
          $vectorSearch: {
            index: "vector_index",
            path: "embedding",
            queryVector: queryEmbedding,
            filter: { sourceId },
            numCandidates: 50,
            limit,
          },
        },
        { $project: { role: 1, userName: 1, content: 1, createdAt: 1, sourceId: 1, score: { $meta: "vectorSearchScore" } } },
      ]).toArray();
      if (results.length > 0) return results;
    } catch (e) { /* fallback */ }
  }

  // 2. Keyword Search (text index)
  try {
    const keywords = queryText.replace(/[^\u0E00-\u0E7Fa-zA-Z0-9\s]/g, "").trim();
    if (keywords.length > 1) {
      const docs = await coll
        .find({ sourceId, content: { $regex: keywords.substring(0, 30), $options: "i" } })
        .sort({ createdAt: -1 })
        .limit(limit)
        .project({ role: 1, userName: 1, content: 1, createdAt: 1, sourceId: 1 })
        .toArray();
      if (docs.length > 0) return docs.reverse();
    }
  } catch (e) { /* fallback */ }

  // 3. Recent messages (เร็วสุด)
  return getRecentMessages(sourceId, limit);
}

// === ดึงข้อความล่าสุด ===
async function getRecentMessages(sourceId, limit = 10) {
  const database = await getDB();
  if (!database) return [];
  try {
    const docs = await database.collection(MESSAGES_COLL)
      .find({ sourceId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .project({ role: 1, userName: 1, content: 1, createdAt: 1, sourceId: 1 })
      .toArray();
    return docs.reverse();
  } catch (e) {
    return [];
  }
}


// === Get group name from LINE API ===
async function getGroupName(groupId) {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token || !groupId) return null;
  try {
    const res = await fetch(`https://api.line.me/v2/bot/group/${groupId}/summary`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.groupName || null;
  } catch (e) {
    return null;
  }
}

// === Save/update group metadata ===
async function saveGroupMeta(sourceId, groupName, source) {
  const database = await getDB();
  if (!database) return;
  try {
    await database.collection("groups_meta").updateOne(
      { sourceId },
      {
        $set: {
          sourceId,
          groupName: groupName || sourceId,
          sourceType: source.type,
          updatedAt: new Date(),
        },
        $setOnInsert: { createdAt: new Date() },
      },
      { upsert: true }
    );
  } catch (e) {}
}

// === Process LINE event → save to MongoDB ===
async function processEvent(event) {
  if (event.type !== "message") return;

  const source = event.source;
  const sourceId = source.groupId || source.roomId || source.userId;
  const msg = event.message;

  // Get user name + group name พร้อมกัน
  const [userName, groupName] = await Promise.all([
    getUserName(source),
    source.groupId ? getGroupName(source.groupId) : Promise.resolve(null),
  ]);

  // Save group metadata — ใช้ชื่อ group สำหรับ group, ชื่อ user สำหรับ DM
  const displayName = groupName || (source.type === "user" ? userName : null);
  saveGroupMeta(sourceId, displayName, source).catch(() => {});

  // Handle image → เก็บเป็น base64 ใน MongoDB + Vision AI วิเคราะห์รูป
  let imageData = null;
  let imageDescription = null;
  if (msg.type === "image") {
    const imgBuffer = await downloadLineImage(msg.id);
    if (imgBuffer) {
      imageData = `data:image/jpeg;base64,${imgBuffer.toString("base64")}`;
      console.log(`[IMG] ${(imgBuffer.length / 1024).toFixed(0)}KB from ${userName}`);

      // Vision AI — วิเคราะห์รูปเป็นข้อความเก็บไว้สำหรับ RAG/analytics
      imageDescription = await analyzeImage(imgBuffer);
      if (imageDescription) {
        console.log(`[Vision] ${imageDescription.substring(0, 60)}`);
      }
    }
  }

  // content = text จาก user หรือ description จาก Vision AI (ถ้าเป็นรูป)
  const msgContent = msg.text || imageDescription || `[${msg.type}]`;

  // Save user message
  await saveMsg(sourceId, {
    role: "user",
    userName,
    userId: source.userId,
    content: msgContent,
    messageType: msg.type,
    imageUrl: imageData,
    imageDescription: imageDescription || null,
    groupId: source.groupId || source.roomId,
    messageId: msg.id,
    timestamp: event.timestamp,
  });

  console.log(
    `[MSG] ${userName}: ${msgContent.substring(0, 60)}${imageData ? " +img" : ""}`
  );
}

// === MCP Client — เชื่อม MCP servers ภายนอก ===
const mcpTools = []; // tools จาก MCP servers
const mcpToolHandlers = {}; // toolName → { serverUrl, apiKey }

async function connectMCPServer(name, sseUrl, apiKey) {
  try {
    console.log(`[MCP] Connecting to ${name}: ${sseUrl}`);
    const headers = { Accept: "text/event-stream" };
    if (apiKey) headers["X-API-Key"] = apiKey;

    const res = await fetch(sseUrl, { headers, signal: AbortSignal.timeout(10000) });
    if (!res.ok) { console.error(`[MCP] ${name} HTTP ${res.status}`); return; }

    // อ่าน SSE stream เพื่อหา endpoint URL
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let messageEndpoint = null;

    // อ่าน SSE events จนกว่าจะได้ endpoint
    const timeout = setTimeout(() => reader.cancel(), 8000);
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // Parse SSE events
        const lines = buffer.split("\n");
        buffer = lines.pop();
        for (const line of lines) {
          if (line.startsWith("data:")) {
            const data = line.substring(5).trim();
            try {
              const parsed = JSON.parse(data);
              if (parsed.endpoint) messageEndpoint = new URL(parsed.endpoint, sseUrl).href;
            } catch (e) {
              // อาจเป็น endpoint URL ตรงๆ
              if (data.startsWith("/") || data.startsWith("http")) {
                messageEndpoint = data.startsWith("http") ? data : new URL(data, sseUrl).href;
              }
            }
          }
          if (line.startsWith("event: endpoint")) {
            // next data line จะเป็น endpoint
          }
        }
        if (messageEndpoint) break;
      }
    } finally {
      clearTimeout(timeout);
      reader.cancel().catch(() => {});
    }

    if (!messageEndpoint) {
      // Fallback: ใช้ SSE URL เปลี่ยน /sse เป็น /message
      messageEndpoint = sseUrl.replace("/sse", "/message");
      console.log(`[MCP] ${name} no endpoint from SSE, fallback: ${messageEndpoint}`);
    } else {
      console.log(`[MCP] ${name} endpoint: ${messageEndpoint}`);
    }

    // เปิด SSE ค้างไว้ เพื่อรับ response + ส่ง tools/list
    const sseHeaders2 = { Accept: "text/event-stream" };
    if (apiKey) sseHeaders2["X-API-Key"] = apiKey;
    const sseRes2 = await fetch(sseUrl, { headers: sseHeaders2 });
    const reader2 = sseRes2.body.getReader();
    const decoder2 = new TextDecoder();
    let sseBuf = "";
    let sseEndpoint = null;

    // อ่าน endpoint
    const ep = await new Promise((resolve) => {
      const t = setTimeout(() => resolve(null), 5000);
      (async () => {
        while (true) {
          const { done, value } = await reader2.read();
          if (done) break;
          sseBuf += decoder2.decode(value, { stream: true });
          const ls = sseBuf.split("\n"); sseBuf = ls.pop();
          for (const l of ls) {
            if (l.startsWith("data:")) {
              const d = l.substring(5).trim();
              if (d.startsWith("/")) { clearTimeout(t); resolve(d); return; }
            }
          }
        }
      })();
    });

    if (!ep) { reader2.cancel().catch(() => {}); return; }
    sseEndpoint = new URL(ep, sseUrl).href;

    // ส่ง tools/list (response จะมาทาง SSE)
    fetch(sseEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(apiKey ? { "X-API-Key": apiKey } : {}) },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} }),
    }).catch(() => {});

    // อ่าน tools/list response จาก SSE
    const toolsResult = await new Promise((resolve) => {
      const t = setTimeout(() => resolve(null), 10000);
      (async () => {
        while (true) {
          const { done, value } = await reader2.read();
          if (done) break;
          sseBuf += decoder2.decode(value, { stream: true });
          const ls = sseBuf.split("\n"); sseBuf = ls.pop();
          for (const l of ls) {
            if (l.startsWith("data:")) {
              try {
                const parsed = JSON.parse(l.substring(5).trim());
                if (parsed.result?.tools) { clearTimeout(t); resolve(parsed.result.tools); return; }
              } catch (e) {}
            }
          }
        }
      })();
    });
    reader2.cancel().catch(() => {});

    const tools = toolsResult || [];
    console.log(`[MCP] ${name}: ${tools.length} tools loaded`);

    // เก็บ SSE URL + endpoint สำหรับ tool calls
    for (const tool of tools) {
      mcpTools.push({
        type: "function",
        function: {
          name: `mcp_${name}_${tool.name}`,
          description: tool.description || tool.name,
          parameters: tool.inputSchema || { type: "object", properties: {} },
        },
      });
      mcpToolHandlers[`mcp_${name}_${tool.name}`] = { sseUrl, apiKey, originalName: tool.name };
      console.log(`[MCP]   → ${tool.name}: ${(tool.description || "").substring(0, 60)}`);
    }
  } catch (e) {
    console.error(`[MCP] ${name} error:`, e.message);
  }
}

// === Call MCP Tool (เปิด SSE → send → อ่าน response จาก SSE) ===
async function callMCPTool(toolName, args) {
  const handler = mcpToolHandlers[toolName];
  if (!handler) return "Unknown MCP tool";
  try {
    const headers = { Accept: "text/event-stream" };
    if (handler.apiKey) headers["X-API-Key"] = handler.apiKey;

    // เปิด SSE
    const sseRes = await fetch(handler.sseUrl, { headers });
    const reader = sseRes.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    let endpoint = null;

    // อ่าน endpoint
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const ls = buf.split("\n"); buf = ls.pop();
      for (const l of ls) {
        if (l.startsWith("data:") && l.substring(5).trim().startsWith("/")) {
          endpoint = new URL(l.substring(5).trim(), handler.sseUrl).href;
        }
      }
      if (endpoint) break;
    }

    if (!endpoint) { reader.cancel().catch(() => {}); return "MCP: no endpoint"; }

    // ส่ง tool call
    fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(handler.apiKey ? { "X-API-Key": handler.apiKey } : {}) },
      body: JSON.stringify({
        jsonrpc: "2.0", id: Date.now(),
        method: "tools/call",
        params: { name: handler.originalName, arguments: args },
      }),
    }).catch(() => {});

    // อ่าน response จาก SSE
    const result = await new Promise((resolve) => {
      const t = setTimeout(() => resolve("MCP: timeout"), 15000);
      (async () => {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const ls = buf.split("\n"); buf = ls.pop();
          for (const l of ls) {
            if (l.startsWith("data:")) {
              try {
                const parsed = JSON.parse(l.substring(5).trim());
                if (parsed.result?.content) {
                  clearTimeout(t);
                  resolve(parsed.result.content.map((c) => c.text || JSON.stringify(c)).join("\n"));
                  return;
                }
                if (parsed.error) {
                  clearTimeout(t);
                  resolve(`MCP Error: ${parsed.error.message}`);
                  return;
                }
              } catch (e) {}
            }
          }
        }
      })();
    });
    reader.cancel().catch(() => {});
    return result || "No result";
  } catch (e) {
    return `MCP Error: ${e.message}`;
  }
}

// === Connect MCP servers on startup ===
async function initMCPServers() {
  const servers = [
    {
      name: "erp",
      url: process.env.MCP_ERP_URL || "https://dev.bcaicloud.com/goapi/mcp/sse",
      apiKey: process.env.MCP_ERP_API_KEY || "",
    },
  ].filter((s) => s.url);

  for (const server of servers) {
    await connectMCPServer(server.name, server.url, server.apiKey);
  }
  console.log(`[MCP] Total tools: ${mcpTools.length}`);
}

// === Agent Tools — AI เรียกได้ (built-in + MCP) ===
const AGENT_TOOLS = [
  {
    type: "function",
    function: {
      name: "search_history",
      description: "ค้นหาประวัติสนทนาที่เกี่ยวข้องจากฐานข้อมูล ใช้เมื่อต้องการหาว่าเคยคุยเรื่องอะไร",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "คำค้นหา เช่น 'ราคา' 'นัดหมาย' 'สินค้า'" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_analytics",
      description: "ดูคะแนนวิเคราะห์ความรู้สึกและแนวโน้มซื้อของลูกค้า",
      parameters: { type: "object", properties: {} },
    },
  },
];

// === Execute Tool ===
async function executeTool(toolName, args, sourceId) {
  if (toolName === "search_history") {
    const docs = await searchMessages(sourceId, args.query || "", 5);
    if (docs.length === 0) {
      const recent = await getRecentMessages(sourceId, 5);
      return recent.map((d) => `[${d.role === "assistant" ? "Bot" : d.userName || "User"}] ${d.content}`).join("\n") || "ไม่มีประวัติ";
    }
    return docs.map((d) => `[${d.role === "assistant" ? "Bot" : d.userName || "User"}] ${d.content}`).join("\n");
  }
  if (toolName === "get_analytics") {
    const database = await getDB();
    if (!database) return "ไม่มีข้อมูล";
    const data = await database.collection("chat_analytics").findOne({ sourceId });
    if (!data) return "ยังไม่มีการวิเคราะห์";
    return `Sentiment: ${data.sentiment?.score}/100 (${data.sentiment?.level}) — ${data.sentiment?.reason}\nPurchase: ${data.purchaseIntent?.score}/100 (${data.purchaseIntent?.level}) — ${data.purchaseIntent?.reason}`;
  }
  // MCP tools
  if (mcpToolHandlers[toolName]) {
    return await callMCPTool(toolName, args);
  }
  return "Unknown tool";
}

// === AI Provider — fallback chain + rate limit cooldown ===
const providerCooldown = {}; // provider → timestamp ที่จะหมด cooldown

async function callProvider(messages, tools) {
  const providers = [
    // OpenRouter free → ฟรี providers → เสียเงิน (ถ้ามี)
    { name: "OR-Nemotron", url: "https://openrouter.ai/api/v1/chat/completions", key: process.env.OPENROUTER_API_KEY, model: "nvidia/nemotron-3-super-120b-a12b:free" },
    { name: "OR-Llama", url: "https://openrouter.ai/api/v1/chat/completions", key: process.env.OPENROUTER_API_KEY, model: "meta-llama/llama-3.3-70b-instruct:free" },
    { name: "SambaNova", url: "https://api.sambanova.ai/v1/chat/completions", key: process.env.SAMBANOVA_API_KEY, model: "Qwen3-235B" },
    { name: "Groq", url: "https://api.groq.com/openai/v1/chat/completions", key: process.env.GROQ_API_KEY, model: "llama-3.3-70b-versatile" },
    { name: "Cerebras", url: "https://api.cerebras.ai/v1/chat/completions", key: process.env.CEREBRAS_API_KEY, model: "qwen-3-235b-a22b-instruct-2507" },
  ].filter((p) => p.key);

  for (const provider of providers) {
    // Skip ถ้ายังอยู่ใน cooldown (rate limit)
    const cooldownUntil = providerCooldown[provider.name] || 0;
    if (Date.now() < cooldownUntil) {
      console.log(`[AI] ⏭️ Skip ${provider.name} (cooldown ${Math.ceil((cooldownUntil - Date.now()) / 1000)}s)`);
      continue;
    }

    try {
      const body = { model: provider.model, messages, max_tokens: 800 };
      if (tools && tools.length > 0) body.tools = tools;

      const res = await fetch(provider.url, {
        method: "POST",
        headers: { Authorization: `Bearer ${provider.key}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.error) {
        const errMsg = JSON.stringify(data.error).substring(0, 100);
        console.error(`[AI] ${provider.name} error:`, errMsg);
        // Rate limit → cooldown 60 วินาที
        if (errMsg.includes("rate") || errMsg.includes("limit") || errMsg.includes("429")) {
          providerCooldown[provider.name] = Date.now() + 1800000; // cooldown 30 นาที
          console.log(`[AI] 🕐 ${provider.name} cooldown 60s`);
        }
        continue;
      }
      const choice = data.choices?.[0];
      if (choice) {
        const usage = data.usage || {};
        console.log(`[AI] ✅ ${provider.name} (${provider.model}) tokens: ${usage.total_tokens || 0}`);
        return {
          provider: provider.name,
          model: provider.model,
          message: choice.message,
          finishReason: choice.finish_reason,
          usage: {
            prompt: usage.prompt_tokens || 0,
            completion: usage.completion_tokens || 0,
            total: usage.total_tokens || 0,
          },
        };
      }
    } catch (e) {
      console.error(`[AI] ${provider.name} error:`, e.message);
    }
  }
  return null;
}

// === Agentic AI — loop จนได้คำตอบ ===
const MAX_STEPS = 8;

async function askAI(userText, sourceId) {
  // ดึง recent messages + RAG context
  const recent = await getRecentMessages(sourceId, 10);
  let relevant = [];
  try {
    relevant = await Promise.race([
      searchMessages(sourceId, userText, 5),
      new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 3000)),
    ]);
  } catch (e) {}

  // Deduplicate context
  const seenIds = new Set();
  const contextDocs = [];
  for (const doc of [...relevant, ...recent]) {
    const id = doc._id?.toString();
    if (id && !seenIds.has(id)) { seenIds.add(id); contextDocs.push(doc); }
  }

  const contextStr = contextDocs.length > 0
    ? contextDocs.map((d) => `[${d.role === "assistant" ? "น้องปู" : d.userName || "User"}] ${d.content}`).join("\n")
    : "";

  const botConfig = await getBotConfig(sourceId);
  const systemPrompt = botConfig.systemPrompt || DEFAULT_PROMPT;

  // สร้าง MCP tools list สำหรับ prompt
  const mcpToolNames = mcpTools.map((t) => `- ${t.function.name}: ${t.function.description.substring(0, 80)}`).join("\n");

  const messages = [
    {
      role: "system",
      content: `${systemPrompt}

${contextStr ? `ประวัติสนทนาที่เกี่ยวข้อง:\n${contextStr}` : ""}

## วิธีทำงาน — Deep Agentic Loop (สำคัญมาก)
คุณทำงานแบบ step-by-step สูงสุด 8 steps โดย **เจาะลึกข้อมูลให้มากที่สุด**:

**Step 1: วิเคราะห์คำถาม + วางแผน**
- คำถามนี้ต้องการข้อมูลอะไรบ้าง? วาง plan ว่าต้องเรียก tool อะไรบ้าง
- ถ้ามี MCP tool ที่เกี่ยวข้อง → เรียกใช้ทันที อย่าเดาคำตอบ
- ถ้าคำถามกว้าง → วางแผนเรียก tools หลายตัว

**Step 2-6: เจาะลึก — ถามตัวเองทุก step**
หลังได้ผลจาก tool ให้ถามตัวเอง 3 คำถามนี้:
1. "ทำไม?" — ตัวเลขนี้สูง/ต่ำเพราะอะไร? → เรียก tool เพิ่มเพื่อหาสาเหตุ
2. "เทียบกับอะไร?" — เปรียบเทียบกับเดือนก่อน/ปีก่อน → เรียก get_mom_comparison หรือ get_yoy_comparison
3. "มีอะไรเกี่ยวข้องอีก?" — ยอดขายสูง + สต็อกต่ำ = ต้องสั่งของ → เรียก get_low_stock_alerts

**Step 7-8: สรุป + แนะนำ + ถาม user**
- สรุปข้อมูลทั้งหมดที่ได้
- วิเคราะห์ insight: แนวโน้ม, จุดเด่น, จุดอ่อน, ข้อเสนอแนะ
- **ท้ายข้อความ ถาม user เสมอ** ว่าอยากดูอะไรเพิ่ม เช่น:
  "📌 อยากดูเพิ่มมั้ยคะ? เช่น แยกตามพนักงาน / เทียบกับปีก่อน / ดูสินค้าค้างสต็อก"

**ตัวอย่าง Deep Loop:**

คำถาม: "ยอดขายเดือนนี้"
- Step 1: get_monthly_summary → ยอด 500K
- Step 2: "ทำไม?" → get_mom_comparison → ลด 15% จากเดือนก่อน
- Step 3: "อะไรลด?" → get_top_selling_products → สินค้า A ลด 40%
- Step 4: "สต็อกพอมั้ย?" → get_low_stock_alerts → สินค้า A สต็อกเหลือ 5
- Step 5: สรุป + insight + แนะนำ + ถาม user

คำถาม: "สุขภาพธุรกิจ"
- Step 1: get_business_health → score 72/100
- Step 2: get_dashboard_kpis → ยอดขาย กำไร ออเดอร์
- Step 3: get_profit_analysis → margin ลด
- Step 4: get_accounts_receivable → ลูกหนี้ค้าง 200K
- Step 5: get_low_stock_alerts → สินค้าใกล้หมด 8 ตัว
- Step 6: get_customer_growth → ลูกค้าใหม่ลด
- Step 7: สรุปภาพรวม + จุดเด่น/จุดอ่อน + action items + ถาม user

คำถาม: "สวัสดี" (แค่ทักทาย)
- Step 1: ไม่ต้อง loop → ทักทายกลับเลย (ไม่เจาะลึก)

## กฎเลือก Tool
| คำถามเกี่ยวกับ | ใช้ tool |
|---|---|
| สินค้า/ราคา/สต็อก | mcp_erp_search_products, mcp_erp_list_barcodes |
| ยอดขายวันนี้ | mcp_erp_get_daily_sales |
| ยอดขายช่วงเวลา | mcp_erp_get_sales_by_date_range |
| สินค้าขายดี | mcp_erp_get_top_selling_products |
| KPI/ภาพรวม | mcp_erp_get_dashboard_kpis |
| สุขภาพธุรกิจ | mcp_erp_get_business_health |
| กำไร/ต้นทุน | mcp_erp_get_profit_analysis |
| ลูกค้า | mcp_erp_get_top_customers, mcp_erp_get_customer_segments |
| สต็อก/คลัง | mcp_erp_get_inventory_value, mcp_erp_get_low_stock_alerts |
| สินค้าค้างสต็อก | mcp_erp_get_dead_stock |
| ลูกหนี้ | mcp_erp_list_debtors, mcp_erp_get_accounts_receivable |
| เจ้าหนี้ | mcp_erp_list_creditors, mcp_erp_get_accounts_payable |
| เปรียบเทียบ YoY | mcp_erp_get_yoy_comparison |
| เปรียบเทียบ MoM | mcp_erp_get_mom_comparison |
| ยอดขายตามพนักงาน | mcp_erp_get_sales_by_seller |
| กระแสเงินสด | mcp_erp_get_cash_flow |
| ประวัติสนทนา | search_history |
| อารมณ์ลูกค้า | get_analytics |

## กฎสำคัญ
- **ห้ามตอบว่า "ไม่มีข้อมูล" โดยไม่ค้นก่อน** — ต้องเรียก tool ค้นก่อนเสมอ
- **ข้อมูลจาก MCP ให้แสดงรายละเอียดให้มากที่สุด** แสดงเป็น list ให้อ่านง่าย:
  • สินค้า: ชื่อ, รหัส, บาร์โค้ด, ราคา, หน่วยนับ, หมวด, กลุ่ม
  • สต็อก: จำนวนคงเหลือ, คลัง, ตำแหน่ง
  • **แม้สินค้าหมดสต็อก (0) ก็ต้องแสดงราคาและรายละเอียดด้วย** — ผู้ใช้ต้องรู้ว่าสินค้ามีในระบบ ราคาเท่าไหร่ แค่หมดชั่วคราว
  • ยอดขาย: จำนวน, มูลค่า, เปรียบเทียบ, แนวโน้ม
  • ลูกค้า/ลูกหนี้: ชื่อ, รหัส, ยอดค้าง, วันครบกำหนด
- ถ้ามีหลายรายการ ให้แสดงทุกรายการ อย่าตัดหรือย่อ (ยกเว้นเกิน 20 รายการ ให้แสดง top 20 + บอกว่ามีอีก)
- จัดรูปแบบให้สวย: ใช้ bullet points, ตัวหนา, emoji
- **ห้ามซ่อนข้อมูลที่ได้มา** — แสดงทุกอย่างที่ tool return มา ผู้ใช้ต้องเห็นข้อมูลครบ
- ห้ามแสดง error, JSON raw, technical details → สรุปเป็นภาษาคนอ่านง่าย
- ตอบเป็นภาษาไทยเสมอ ใช้ emoji พอเหมาะ
- ถ้า tool return error → ลอง tool อื่น หรือบอกผู้ใช้สุภาพ`
    },
  ];

  // เพิ่ม conversation flow
  for (const doc of recent.slice(-5)) {
    if (doc.role === "user" && doc.content) messages.push({ role: "user", content: doc.content });
    else if (doc.role === "assistant" && doc.content) messages.push({ role: "assistant", content: doc.content });
  }
  messages.push({ role: "user", content: userText });

  // === Agentic Loop ===
  let totalTokens = { prompt: 0, completion: 0, total: 0 };
  let lastModel = "";
  let lastProvider = "";
  let stepCount = 0;
  const toolsUsed = []; // เก็บ tools ที่เรียก
  let mcpUsed = false;
  const startTime = Date.now();

  for (let step = 0; step < MAX_STEPS; step++) {
    console.log(`[Agent] Step ${step + 1}/${MAX_STEPS}`);
    stepCount = step + 1;

    const allTools = [...AGENT_TOOLS, ...mcpTools];
    const result = await callProvider(messages, allTools);
    if (!result) break;

    lastModel = result.model;
    lastProvider = result.provider;
    totalTokens.prompt += result.usage?.prompt || 0;
    totalTokens.completion += result.usage?.completion || 0;
    totalTokens.total += result.usage?.total || 0;

    const msg = result.message;

    // ถ้า AI เรียก tool
    if (msg.tool_calls && msg.tool_calls.length > 0) {
      messages.push(msg);

      for (const tc of msg.tool_calls) {
        const toolName = tc.function.name;
        let toolArgs = {};
        try { toolArgs = JSON.parse(tc.function.arguments || "{}"); } catch (e) {}

        // Track tool usage
        const shortName = toolName.replace("mcp_erp_", "");
        toolsUsed.push(shortName);
        if (toolName.startsWith("mcp_")) mcpUsed = true;

        console.log(`[Agent] 🔧 Tool: ${toolName}(${JSON.stringify(toolArgs).substring(0, 50)})`);
        const toolResult = await executeTool(toolName, toolArgs, sourceId);
        console.log(`[Agent] 📋 Result: ${toolResult.substring(0, 80)}`);

        messages.push({ role: "tool", tool_call_id: tc.id, content: toolResult });
      }
      continue;
    }

    // ถ้า AI ตอบเลย
    if (msg.content) {
      const footer = buildFooter(lastProvider, lastModel, totalTokens, stepCount, toolsUsed, mcpUsed, startTime);
      const quickReplies = generateQuickReplies(toolsUsed, mcpUsed);
      console.log(`[Agent] 💬 Final (step ${stepCount}): ${msg.content.substring(0, 60)}`);
      return { text: msg.content + footer, quickReplies };
    }
  }

  // Fallback
  console.log("[Agent] Loop exhausted, final call without tools...");
  const finalResult = await callProvider(messages, null);
  if (finalResult?.message?.content) {
    totalTokens.total += finalResult.usage?.total || 0;
    const footer = buildFooter(finalResult.provider, finalResult.model, totalTokens, stepCount, toolsUsed, mcpUsed, startTime);
    return { text: finalResult.message.content + footer, quickReplies: generateQuickReplies(toolsUsed, mcpUsed) };
  }
  return { text: "ปูขอโทษค่ะ ตอนนี้ตอบไม่ได้ ลองถามใหม่นะคะ 🙏", quickReplies: [] };
}

// === สร้าง Quick Reply ตามบริบท ===
function generateQuickReplies(toolsUsed, mcpUsed) {
  const suggestions = [];

  // ถ้าเพิ่งดูยอดขาย → แนะนำเจาะลึก
  if (toolsUsed.some((t) => t.includes("sales") || t.includes("monthly") || t.includes("daily"))) {
    suggestions.push("📈 เทียบเดือนก่อน", "👨‍💼 แยกตามพนักงาน", "🏆 สินค้าขายดี", "💰 วิเคราะห์กำไร");
  }
  // ถ้าเพิ่งดูสินค้า → แนะนำดูเพิ่ม
  else if (toolsUsed.some((t) => t.includes("product") || t.includes("barcode") || t.includes("search"))) {
    suggestions.push("📦 เช็คสต็อก", "📉 สินค้าค้างสต็อก", "🏆 สินค้าขายดี", "💰 ดูราคา");
  }
  // ถ้าเพิ่งดู KPI / สุขภาพธุรกิจ
  else if (toolsUsed.some((t) => t.includes("kpi") || t.includes("health") || t.includes("profit"))) {
    suggestions.push("📊 ยอดขายเดือนนี้", "👥 ลูกค้า Top 10", "⚠️ สต็อกต่ำ", "💳 ลูกหนี้ค้าง");
  }
  // ถ้าเพิ่งดูลูกค้า
  else if (toolsUsed.some((t) => t.includes("customer") || t.includes("debtor"))) {
    suggestions.push("📊 ยอดขายวันนี้", "🏆 สินค้าขายดี", "💳 ลูกหนี้ค้าง", "📈 การเติบโต");
  }
  // ถ้าเพิ่งดูสต็อก
  else if (toolsUsed.some((t) => t.includes("inventory") || t.includes("stock") || t.includes("dead"))) {
    suggestions.push("📊 ยอดขายเดือนนี้", "🏆 สินค้าขายดี", "💰 มูลค่าสต็อก", "📉 สินค้าค้างนาน");
  }
  // default — ทักทาย/คำถามทั่วไป
  else {
    suggestions.push("📊 ยอดขายวันนี้", "🏥 สุขภาพธุรกิจ", "🏆 สินค้าขายดี", "📦 เช็คสต็อก");
  }

  return suggestions.slice(0, 4); // LINE Quick Reply max 13 แต่ 4 พอดี
}

// === สร้าง footer แสดงสถิติ ===
function buildFooter(provider, model, tokens, steps, tools, mcpUsed, startTime) {
  const cost = estimateCost(provider, tokens);
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  const toolList = tools.length > 0 ? tools.join(", ") : "-";

  return `\n\n---\n📊 Model: ${provider}/${model}\n🔢 Tokens: ${tokens.total.toLocaleString()} (in:${tokens.prompt.toLocaleString()} out:${tokens.completion.toLocaleString()})\n💰 Cost: ${cost}\n🔄 Loop: ${steps} step${steps > 1 ? "s" : ""}\n🔧 Tools: ${toolList}\n🔌 MCP: ${mcpUsed ? "✅ ใช้" : "❌ ไม่ใช้"}\n⏱️ Time: ${elapsed}s`;
}

// === คำนวณค่าใช้จ่ายโดยประมาณ (เงินบาท) ===
function estimateCost(provider, tokens) {
  // ราคาต่อ 1M tokens (USD) — ฟรีทั้งหมดแต่แสดงราคาจริงถ้าเสียเงิน
  const rates = {
    SambaNova: { input: 0, output: 0 },
    Groq: { input: 0.05, output: 0.08 },
    Cerebras: { input: 0, output: 0 },
    OpenRouter: { input: 0, output: 0 },
  };
  const rate = rates[provider] || { input: 0, output: 0 };
  const usd = (tokens.prompt * rate.input + tokens.completion * rate.output) / 1_000_000;
  const thb = usd * 35; // อัตราแลกเปลี่ยนประมาณ
  if (thb < 0.01) return "฿0.00 (ฟรี)";
  return `฿${thb.toFixed(2)}`;
}

// === ส่ง reply กลับ LINE (พร้อม Quick Reply) ===
async function replyToLine(replyToken, text, quickReplies) {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token || !replyToken) return false;
  try {
    const message = { type: "text", text };

    // เพิ่ม Quick Reply ปุ่มกด (ฟรี ใช้ reply token)
    if (quickReplies && quickReplies.length > 0) {
      message.quickReply = {
        items: quickReplies.map((label) => ({
          type: "action",
          action: { type: "message", label: label.substring(0, 20), text: label },
        })),
      };
    }

    const res = await fetch("https://api.line.me/v2/bot/message/reply", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ replyToken, messages: [message] }),
    });
    return res.ok;
  } catch (e) {
    console.error("[LINE] Reply error:", e.message);
    return false;
  }
}

// === Push message (fallback — รองรับ Quick Reply ด้วย) ===
async function pushToLine(to, text, quickReplies) {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token || !to) return;
  try {
    const message = { type: "text", text };
    // Push message รองรับ Quick Reply เหมือน reply
    if (quickReplies && quickReplies.length > 0) {
      message.quickReply = {
        items: quickReplies.map((label) => ({
          type: "action",
          action: { type: "message", label: label.substring(0, 20), text: label },
        })),
      };
    }
    await fetch("https://api.line.me/v2/bot/message/push", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        to,
        messages: [message],
      }),
    });
  } catch (e) {
    console.error("[LINE] Push error:", e.message);
  }
}

// === Slow Response Detection — เตือนตอบช้าเกิน 1 นาที ===
const SLOW_THRESHOLD_MS = 60000; // 1 นาที

async function checkSlowResponse(sourceId, staffName) {
  const nameUpper = (staffName || "").toUpperCase();
  if (!nameUpper.startsWith("SML")) return; // เฉพาะพนักงาน

  const database = await getDB();
  if (!database) return;

  // หาข้อความก่อนหน้าของลูกค้า (ล่าสุด)
  const lastMsgs = await database.collection(MESSAGES_COLL)
    .find({ sourceId })
    .sort({ createdAt: -1 })
    .limit(5)
    .project({ userName: 1, createdAt: 1 })
    .toArray();

  if (lastMsgs.length < 2) return;

  // ข้อความแรก = ตัวที่เพิ่งส่ง (พนักงาน), หาข้อความลูกค้าก่อนหน้า
  const staffMsg = lastMsgs[0]; // ข้อความล่าสุด (พนักงาน)
  const customerMsg = lastMsgs.find((m, i) => {
    if (i === 0) return false;
    const n = (m.userName || "").toUpperCase();
    return !n.startsWith("SML") && !n.includes("น้องปู");
  });

  if (!customerMsg || !customerMsg.createdAt || !staffMsg.createdAt) return;

  const diffMs = new Date(staffMsg.createdAt).getTime() - new Date(customerMsg.createdAt).getTime();
  if (diffMs <= 0 || diffMs > 86400000) return; // ข้ามถ้าลำดับผิดหรือเกิน 24 ชม.

  const diffMinutes = Math.round(diffMs / 60000);

  if (diffMs > SLOW_THRESHOLD_MS) {
    // เตือน! ตอบช้าเกิน 1 นาที
    await database.collection("alerts").insertOne({
      type: "slow_response",
      sourceId,
      staffName,
      customerName: customerMsg.userName,
      responseMinutes: diffMinutes,
      level: diffMinutes > 30 ? "red" : diffMinutes > 5 ? "yellow" : "green",
      message: `${staffName} ตอบช้า ${diffMinutes} นาที (ลูกค้า: ${customerMsg.userName})`,
      read: false,
      createdAt: new Date(),
    });
    console.log(`[ALERT] ⚠️ ${staffName} ตอบช้า ${diffMinutes} นาที ในห้อง ${sourceId.substring(0, 8)}`);
  }
}

// === Skill-Based Analytics — แยกคน แยกห้อง ประหยัด token ===
// แต่ละข้อความ → ดึง skill เดิมของคนนั้น + ข้อความใหม่ → AI อัปเดต skill → รวมเป็นห้อง

async function analyzeChat(sourceId, userName, messageText, lineUserId, source) {
  if (!messageText || messageText === "undefined") return;
  if (messageText.trim().length < 2) return;

  const database = await getDB();
  if (!database) return;

  const nameUpper = (userName || "").toUpperCase();
  const isStaff = nameUpper.startsWith("SML") || nameUpper.startsWith("SML-");
  const isBot = nameUpper.includes("น้องปู") || nameUpper === "น้องปู";
  if (isBot) return; // ข้ามข้อความจาก bot เก่า
  const userId = userName || "Unknown";
  const skillKey = { sourceId, userId }; // แยกคน-แยกห้อง

  try {
    // 1. ดึง skill เดิมของคนนี้ในห้องนี้
    const existingSkill = await database.collection("user_skills").findOne(skillKey);
    const prevSkill = existingSkill ? {
      sentiment: existingSkill.sentiment,
      purchaseIntent: existingSkill.purchaseIntent,
    } : null;

    const prevTags = existingSkill?.tags || [];
    const prevStage = existingSkill?.pipelineStage || "new";
    const prevContext = prevSkill
      ? `Skill เดิม: ความรู้สึก=${prevSkill.sentiment?.level}(${prevSkill.sentiment?.score}) โอกาสซื้อ=${prevSkill.purchaseIntent?.level}(${prevSkill.purchaseIntent?.score}) tags=[${prevTags.join(",")}] stage=${prevStage}`
      : "ยังไม่มี skill เดิม (คนใหม่)";

    // 2. ส่ง AI แค่ skill เดิม + ข้อความใหม่ 1 ข้อ (ประหยัด token มาก!)
    const content = await callLightAI([
      {
        role: "system",
        content: `อัปเดต skill ของ${isStaff ? "พนักงาน" : "ลูกค้า"} จาก skill เดิม + ข้อความใหม่
return JSON เท่านั้น:
{
  "sentiment": { "score": <0-100>, "level": "<green|yellow|red>", "reason": "<สั้นๆ ไทย>" },
  "purchaseIntent": { "score": <0-100>, "level": "<green|yellow|red>", "reason": "<สั้นๆ ไทย>" },
  "tags": ["<tag อัตโนมัติ จากเนื้อหาสนทนา เช่น: ถามราคา, สนใจสินค้า, ร้องเรียน, ขอบคุณ, ถามวิธีใช้, ต้องการซื้อ, เปรียบเทียบ, นัดหมาย ฯลฯ>"],
  "pipelineStage": "<new|interested|quoting|negotiating|closed_won|closed_lost|following_up>"
}
sentiment: green(60-100)=ปกติ, yellow(30-59)=ติดตาม, red(0-29)=ไม่พอใจ
purchaseIntent: green(0-29)=ไม่สนใจ, yellow(30-59)=เริ่มสนใจ, red(60-100)=สนใจซื้อ!
tags: เก็บ tag จาก skill เดิม + เพิ่มใหม่ถ้ามี (ไม่ลบเก่า, ไม่ซ้ำ, สูงสุด 10 tags)
pipelineStage: new=ใหม่, interested=สนใจ, quoting=เสนอราคา, negotiating=ต่อรอง, closed_won=ปิดการขาย, closed_lost=ไม่ซื้อ, following_up=ติดตาม
ค่อยๆ ปรับ score จาก skill เดิม ไม่กระโดดมาก`
      },
      { role: "user", content: `${prevContext}\nข้อความใหม่: "${messageText.substring(0, 200)}"` },
    ], { json: true, maxTokens: 300 });
    if (!content) return;

    const skill = JSON.parse(content);

    // 3. อัปเดต user_skills (ต่อคน-ต่อห้อง) + tags + pipeline
    const tags = [...new Set([...(skill.tags || []), ...prevTags])].slice(0, 10);
    const pipelineStage = skill.pipelineStage || prevStage || "new";

    await database.collection("user_skills").updateOne(
      skillKey,
      {
        $set: {
          sourceId,
          userId,
          userName,
          isStaff,
          sentiment: skill.sentiment,
          purchaseIntent: skill.purchaseIntent,
          tags,
          pipelineStage,
          lastMessage: messageText.substring(0, 100),
          updatedAt: new Date(),
        },
        $inc: { messageCount: 1 },
        $setOnInsert: { createdAt: new Date() },
      },
      { upsert: true }
    );

    // 4. Auto-create/update ลูกค้าใน CRM + ดึง LINE profile อัตโนมัติ
    if (!isStaff) {
      // ดึง LINE profile (รูป, ชื่อ, status)
      let lineProfile = {};
      if (lineUserId) {
        try {
          const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
          let profileUrl;
          if (source?.type === "group" && source?.groupId) {
            profileUrl = `https://api.line.me/v2/bot/group/${source.groupId}/member/${lineUserId}`;
          } else {
            profileUrl = `https://api.line.me/v2/bot/profile/${lineUserId}`;
          }
          const pRes = await fetch(profileUrl, { headers: { Authorization: `Bearer ${token}` } });
          if (pRes.ok) {
            const p = await pRes.json();
            lineProfile = {
              avatarUrl: p.pictureUrl || "",
              lineId: lineUserId,
              statusMessage: p.statusMessage || "",
            };
          }
        } catch {}
      }

      await database.collection("customers").updateOne(
        { name: userName },
        {
          $set: {
            name: userName,
            lastSentiment: skill.sentiment,
            lastPurchaseIntent: skill.purchaseIntent,
            pipelineStage,
            ...lineProfile,
            updatedAt: new Date(),
          },
          $addToSet: { tags: { $each: tags }, rooms: sourceId },
          $inc: { totalMessages: 1 },
          $setOnInsert: { createdAt: new Date(), firstName: "", lastName: "", company: "", position: "", phone: "", email: "", address: "", notes: "", customTags: [] },
        },
        { upsert: true }
      );
    }

    console.log(`[Skill] ${userName}@${sourceId.substring(0, 8)}: sentiment=${skill.sentiment?.level}(${skill.sentiment?.score}) purchase=${skill.purchaseIntent?.level}(${skill.purchaseIntent?.score}) tags=[${tags.join(",")}] stage=${pipelineStage}`);

    // 4. รวม skill ทุกคนในห้อง → อัปเดต chat_analytics (ไม่ต้องเรียก AI!)
    await updateRoomAnalytics(sourceId);

    // 5. เก็บ log
    await database.collection("analysis_logs").insertOne({
      sourceId,
      userId,
      userName,
      isStaff,
      sentiment: skill.sentiment,
      purchaseIntent: skill.purchaseIntent,
      messageText: messageText.substring(0, 200),
      analyzedAt: new Date(),
    });

  } catch (e) {
    console.error("[Skill] Error:", e.message);
  }
}

// รวม skill ทุกคนในห้อง → คำนวณ average → เก็บ chat_analytics
async function updateRoomAnalytics(sourceId) {
  const database = await getDB();
  if (!database) return;

  const skills = await database.collection("user_skills").find({ sourceId }).toArray();
  if (skills.length === 0) return;

  const customerSkills = skills.filter((s) => !s.isStaff);
  const staffSkills = skills.filter((s) => s.isStaff);

  const avgScore = (arr, field) => {
    if (arr.length === 0) return { score: 50, level: "green", reason: "ไม่มีข้อมูล" };
    const avg = Math.round(arr.reduce((sum, s) => sum + (s[field]?.score || 50), 0) / arr.length);
    const level = field === "purchaseIntent"
      ? (avg >= 60 ? "red" : avg >= 30 ? "yellow" : "green")
      : (avg >= 60 ? "green" : avg >= 30 ? "yellow" : "red");
    // เหตุผลจากคนที่มี score แย่สุด
    const worst = [...arr].sort((a, b) => {
      const aScore = a[field]?.score || 50;
      const bScore = b[field]?.score || 50;
      return field === "purchaseIntent" ? bScore - aScore : aScore - bScore;
    })[0];
    return { score: avg, level, reason: worst?.[field]?.reason || "-" };
  };

  const customerSentiment = avgScore(customerSkills, "sentiment");
  const staffSentiment = avgScore(staffSkills, "sentiment");
  const overallSentiment = avgScore(skills, "sentiment");
  const purchaseIntent = avgScore(customerSkills.length > 0 ? customerSkills : skills, "purchaseIntent");

  await database.collection("chat_analytics").updateOne(
    { sourceId },
    {
      $set: {
        sourceId,
        sentiment: overallSentiment,
        customerSentiment,
        staffSentiment,
        overallSentiment,
        purchaseIntent,
        userCount: skills.length,
        customerCount: customerSkills.length,
        staffCount: staffSkills.length,
        updatedAt: new Date(),
      },
      $setOnInsert: { createdAt: new Date() },
    },
    { upsert: true }
  );

  console.log(`[Room] ${sourceId.substring(0, 8)}: ${customerSkills.length} customers, ${staffSkills.length} staff → overall=${overallSentiment.level} purchase=${purchaseIntent.level}`);
}

// === Vision AI — อ่านรูปแปลความหมาย (Groq → Gemini fallback) ===
async function analyzeImage(imageBuffer) {
  if (!imageBuffer) return null;
  const base64 = imageBuffer.toString("base64");
  const dataUrl = `data:image/jpeg;base64,${base64}`;
  const prompt = "อธิบายรูปนี้เป็นภาษาไทย กระชับ 1-2 ประโยค บอกว่าเห็นอะไรในรูป";

  // 1. OpenRouter free vision (meta-llama/llama-4-scout:free)
  const orKey = process.env.OPENROUTER_API_KEY;
  if (orKey) {
    try {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        signal: AbortSignal.timeout(30000),
        headers: { Authorization: `Bearer ${orKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "meta-llama/llama-4-scout-17b-16e-instruct:free",
          messages: [{ role: "user", content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: dataUrl } },
          ] }],
          max_tokens: 300,
        }),
      });
      const data = await res.json();
      if (data.choices?.[0]?.message?.content) {
        console.log("[Vision] OpenRouter OK");
        return data.choices[0].message.content;
      }
      if (data.error) console.log("[Vision] OpenRouter:", (data.error.message || "").substring(0, 80));
    } catch (e) { console.log("[Vision] OpenRouter:", e.message); }
  }

  // 2. Groq vision fallback
  const groqKey = process.env.GROQ_API_KEY;
  if (groqKey) {
    try {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        signal: AbortSignal.timeout(20000),
        headers: { Authorization: `Bearer ${groqKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "meta-llama/llama-4-scout-17b-16e-instruct",
          messages: [{ role: "user", content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: dataUrl } },
          ] }],
          max_tokens: 300,
        }),
      });
      const data = await res.json();
      if (data.choices?.[0]?.message?.content) {
        console.log("[Vision] Groq OK");
        return data.choices[0].message.content;
      }
    } catch (e) { console.log("[Vision] Groq:", e.message); }
  }

  // 3. Gemini fallback
  const googleKey = process.env.GOOGLE_API_KEY;
  if (googleKey) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${googleKey}`,
        {
          method: "POST",
          signal: AbortSignal.timeout(20000),
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [
              { text: prompt },
              { inlineData: { mimeType: "image/jpeg", data: base64 } },
            ] }],
          }),
        }
      );
      const data = await res.json();
      if (data.candidates?.[0]?.content?.parts?.[0]?.text) return data.candidates[0].content.parts[0].text;
    } catch (e) { console.log("[Vision] Gemini:", e.message); }
  }

  return null;
}

// === Webhook endpoint ===
app.post("/webhook", express.raw({ type: "*/*" }), async (req, res) => {
  const rawBody = req.body;
  const bodyString = rawBody.toString("utf-8");

  if (!bodyString) return res.status(200).json({ status: "ok" });

  let parsed;
  try {
    parsed = JSON.parse(bodyString);
  } catch {
    return res.status(200).json({ status: "ok" });
  }

  const events = parsed.events || [];

  // ตอบ LINE ทันที (ไม่ให้ timeout)
  res.status(200).json({ status: "ok" });

  for (const event of events) {
    if (event.type !== "message") continue;

    const source = event.source;
    const sourceId = source.groupId || source.roomId || source.userId;
    const msg = event.message;

    // Auto-create bot config
    let contactName = null;
    if (source.groupId) {
      contactName = await getGroupName(source.groupId).catch(() => null);
    } else if (source.userId) {
      contactName = await getUserName(source).catch(() => null);
    }
    getBotConfig(sourceId, { type: source.type, groupName: contactName }).catch(() => {});

    // === หูทิพย์: เก็บข้อความอย่างเดียว ไม่ตอบ ===
    try {
      await processEvent(event);
      const userName = await getUserName(source).catch(() => "User");
      const messageText = msg.text || `[${msg.type}]`;
      const lineUserId = source.userId || null;
      console.log(`[Listen] ${userName}@${sourceId.substring(0, 8)}: ${messageText.substring(0, 40)}`);

      // ตรวจจับตอบช้า: พนักงาน SML ตอบ → เช็คเวลาตั้งแต่ข้อความลูกค้าล่าสุด
      checkSlowResponse(sourceId, userName).catch(() => {});

      // Skill-Based Analytics: อัปเดต skill ของคนนี้ (non-blocking)
      analyzeChat(sourceId, userName, messageText, lineUserId, source).catch((e) => console.error("[Skill] Catch:", e.message));
    } catch (e) {
      console.error("[Listen] Error:", e.message);
    }
  }
});


// === API: ดู/ตั้งค่า bot config ต่อ group ===
app.get("/config/:sourceId", async (req, res) => {
  const config = await getBotConfig(req.params.sourceId);
  res.json(config);
});

app.post("/config/:sourceId", express.json(), async (req, res) => {
  const { systemPrompt, botName, model } = req.body;
  await setBotConfig(req.params.sourceId, {
    ...(systemPrompt !== undefined ? { systemPrompt } : {}),
    ...(botName !== undefined ? { botName } : {}),
    ...(model !== undefined ? { model } : {}),
  });
  res.json({ status: "ok" });
});

// === API: ดู config ทั้งหมด ===
app.get("/configs", async (req, res) => {
  const database = await getDB();
  if (!database) return res.json([]);
  const configs = await database.collection("bot_config").find().toArray();
  res.json(configs);
});

// === Migrate: ย้าย chat_xxx → messages + ลบ collection เก่า ===
async function migrateOldCollections() {
  const database = await getDB();
  if (!database) return;

  const collections = await database.listCollections().toArray();
  const oldColls = collections.filter((c) => c.name.startsWith("chat_") && c.name !== "chat_analytics");
  if (oldColls.length === 0) return;

  console.log(`[Migrate] Found ${oldColls.length} old chat collections`);
  const msgColl = database.collection(MESSAGES_COLL);
  let totalMigrated = 0;

  for (const coll of oldColls) {
    const name = coll.name;
    // ดึง sourceId จากชื่อ collection: chat_Ca8e408... → Ca8e408...
    const sourceId = name.replace("chat_", "");

    try {
      const docs = await database.collection(name).find({}).toArray();
      if (docs.length === 0) {
        await database.collection(name).drop();
        continue;
      }

      // เพิ่ม sourceId ให้ทุก doc แล้ว insert เข้า messages
      const docsWithSourceId = docs.map((d) => {
        const { _id, ...rest } = d;
        return { ...rest, sourceId: rest.sourceId || sourceId };
      });

      await msgColl.insertMany(docsWithSourceId, { ordered: false }).catch(() => {});
      totalMigrated += docs.length;

      // ลบ collection เก่า
      await database.collection(name).drop();
      console.log(`[Migrate] ${name}: ${docs.length} docs → messages ✅ (dropped)`);
    } catch (e) {
      console.error(`[Migrate] ${name} error:`, e.message);
    }
  }

  console.log(`[Migrate] Done! Total: ${totalMigrated} docs migrated`);
}

// === Daily Summary — น้องปูสรุปงานสิ้นวัน ===
async function generateDailySummary() {
  const database = await getDB();
  if (!database) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const dateFilter = { createdAt: { $gte: today, $lt: tomorrow } };

  // 1. ข้อความวันนี้ แยกตามห้อง
  const msgsByRoom = await database.collection(MESSAGES_COLL).aggregate([
    { $match: dateFilter },
    { $group: { _id: "$sourceId", count: { $sum: 1 }, lastMsg: { $last: "$content" } } },
    { $sort: { count: -1 } },
  ]).toArray();

  const totalMsgs = msgsByRoom.reduce((s, r) => s + r.count, 0);
  const activeRooms = msgsByRoom.length;

  // 2. Alerts วันนี้ (ตอบช้า)
  const alerts = await database.collection("alerts")
    .find({ ...dateFilter, type: "slow_response" })
    .sort({ responseMinutes: -1 })
    .limit(10)
    .toArray();

  // 3. ห้องที่ต้องติดตาม (sentiment red/yellow หรือ purchaseIntent สูง)
  const analytics = await database.collection("chat_analytics").find({}).toArray();
  const redRooms = analytics.filter((a) => a.customerSentiment?.level === "red" || a.sentiment?.level === "red");
  const yellowRooms = analytics.filter((a) => a.customerSentiment?.level === "yellow" || a.sentiment?.level === "yellow");
  const hotLeads = analytics.filter((a) => a.purchaseIntent?.level === "red");

  // 4. ดึงชื่อห้อง
  const groupsMeta = await database.collection("groups_meta").find({}).toArray();
  const nameMap = {};
  for (const g of groupsMeta) nameMap[g.sourceId] = g.name || g.sourceId?.substring(0, 12);

  const getName = (sourceId) => nameMap[sourceId] || sourceId?.substring(0, 12) || "?";

  // 5. สร้างสรุป
  const dateStr = today.toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" });
  let summary = `📋 สรุปงานวันนี้ (${dateStr})\n`;
  summary += `━━━━━━━━━━━━━━\n`;
  summary += `💬 ข้อความทั้งหมด: ${totalMsgs} ข้อความ\n`;
  summary += `👥 ห้องที่มีความเคลื่อนไหว: ${activeRooms} ห้อง\n`;

  // ตอบช้า
  if (alerts.length > 0) {
    summary += `\n⚠️ ตอบช้า (${alerts.length} ครั้ง):\n`;
    for (const a of alerts.slice(0, 5)) {
      summary += `  • ${a.staffName} ตอบช้า ${a.responseMinutes} นาที (${a.customerName})\n`;
    }
  }

  // ลูกค้าไม่พอใจ
  if (redRooms.length > 0) {
    summary += `\n🔴 ลูกค้าไม่พอใจ (${redRooms.length} ห้อง):\n`;
    for (const r of redRooms.slice(0, 5)) {
      summary += `  • ${getName(r.sourceId)}: ${r.customerSentiment?.reason || r.sentiment?.reason || "-"}\n`;
    }
  }

  // ต้องติดตาม
  if (yellowRooms.length > 0) {
    summary += `\n🟡 ต้องติดตาม (${yellowRooms.length} ห้อง):\n`;
    for (const r of yellowRooms.slice(0, 5)) {
      summary += `  • ${getName(r.sourceId)}: ${r.customerSentiment?.reason || r.sentiment?.reason || "-"}\n`;
    }
  }

  // โอกาสขาย
  if (hotLeads.length > 0) {
    summary += `\n🔥 โอกาสขายสูง (${hotLeads.length} ห้อง):\n`;
    for (const r of hotLeads.slice(0, 5)) {
      summary += `  • ${getName(r.sourceId)}: ${r.purchaseIntent?.reason || "-"}\n`;
    }
  }

  // ห้องที่คุยเยอะสุด
  if (msgsByRoom.length > 0) {
    summary += `\n📊 ห้องที่คุยเยอะสุด:\n`;
    for (const r of msgsByRoom.slice(0, 5)) {
      summary += `  • ${getName(r._id)}: ${r.count} ข้อความ\n`;
    }
  }

  if (!alerts.length && !redRooms.length && !yellowRooms.length && !hotLeads.length) {
    summary += `\n✅ ไม่มีประเด็นต้องติดตามวันนี้ เยี่ยมเลยค่ะ!`;
  }

  summary += `\n━━━━━━━━━━━━━━\n🦀 น้องปู สรุปให้ค่ะ`;

  return summary;
}

// ส่งสรุปวันไปหาเป้าหมาย
async function sendDailySummary() {
  const target = process.env.DAILY_SUMMARY_TO;
  if (!target) {
    console.log("[Summary] ❌ ไม่ได้ตั้ง DAILY_SUMMARY_TO — ข้าม");
    return;
  }
  try {
    const summary = await generateDailySummary();
    if (!summary) return;
    await pushToLine(target, summary);
    console.log(`[Summary] ✅ ส่งสรุปวันไป ${target.substring(0, 10)}...`);
  } catch (e) {
    console.error("[Summary] Error:", e.message);
  }
}

// Cron — เช็คทุกนาที ถ้าตรงเวลาที่ตั้ง → ส่งสรุป (default 20:00)
let lastSummaryDate = "";
function startDailyCron() {
  const cronHour = parseInt(process.env.DAILY_SUMMARY_HOUR || "20", 10);
  const cronMinute = parseInt(process.env.DAILY_SUMMARY_MINUTE || "0", 10);

  setInterval(() => {
    const now = new Date();
    const todayKey = now.toISOString().split("T")[0];
    if (now.getHours() === cronHour && now.getMinutes() === cronMinute && lastSummaryDate !== todayKey) {
      lastSummaryDate = todayKey;
      console.log(`[Cron] 🕐 ถึงเวลาสรุปวัน (${cronHour}:${String(cronMinute).padStart(2, "0")})`);
      sendDailySummary();
    }
  }, 60000); // เช็คทุก 1 นาที

  console.log(`[Cron] Daily summary scheduled at ${cronHour}:${String(cronMinute).padStart(2, "0")} → ${process.env.DAILY_SUMMARY_TO || "(not set)"}`);
}

// API: ทดสอบสรุปวัน (กด manual ได้)
app.get("/daily-summary", async (req, res) => {
  const summary = await generateDailySummary();
  res.json({ summary });
});

app.post("/daily-summary/send", async (req, res) => {
  await sendDailySummary();
  res.json({ status: "sent" });
});

// === น้องกุ้ง — AI Advisor ทุก 1 ชม. ===
async function generateAdvice() {
  const database = await getDB();
  if (!database) return null;

  // ดึงข้อมูลล่าสุด
  const analytics = await database.collection("chat_analytics").find({}).toArray();
  const alerts = await database.collection("alerts")
    .find({ createdAt: { $gte: new Date(Date.now() - 3600000) } })
    .toArray();
  const skills = await database.collection("user_skills")
    .find({ updatedAt: { $gte: new Date(Date.now() - 86400000) } })
    .sort({ updatedAt: -1 })
    .limit(50)
    .toArray();

  // ดึงชื่อห้อง
  const groupsMeta = await database.collection("groups_meta").find({}).toArray();
  const nameMap = {};
  for (const g of groupsMeta) nameMap[g.sourceId] = g.name || g.sourceId?.substring(0, 12);
  const getName = (id) => nameMap[id] || id?.substring(0, 12) || "?";

  // สร้าง context สำหรับ AI
  const redRooms = analytics.filter((a) => a.customerSentiment?.level === "red" || a.sentiment?.level === "red");
  const yellowRooms = analytics.filter((a) => a.customerSentiment?.level === "yellow" || a.sentiment?.level === "yellow");
  const hotLeads = analytics.filter((a) => a.purchaseIntent?.level === "red");
  const slowAlerts = alerts.filter((a) => a.type === "slow_response");

  const context = {
    totalRooms: analytics.length,
    redRooms: redRooms.map((r) => ({ name: getName(r.sourceId), reason: r.customerSentiment?.reason || r.sentiment?.reason })),
    yellowRooms: yellowRooms.map((r) => ({ name: getName(r.sourceId), reason: r.customerSentiment?.reason || r.sentiment?.reason })),
    hotLeads: hotLeads.map((r) => ({ name: getName(r.sourceId), reason: r.purchaseIntent?.reason, score: r.purchaseIntent?.score })),
    slowAlerts: slowAlerts.map((a) => ({ staff: a.staffName, minutes: a.responseMinutes, customer: a.customerName })),
    activeUsers: skills.slice(0, 20).map((s) => ({
      name: s.userName,
      room: getName(s.sourceId),
      sentiment: s.sentiment?.level,
      purchase: s.purchaseIntent?.level,
      tags: (s.tags || []).slice(0, 5),
      stage: s.pipelineStage,
    })),
  };

  // สร้าง prompt สำหรับ AI → ใช้ callLightAI (OpenRouter free → Groq → Gemini)
  const adviceSystemPrompt = `คุณชื่อ "น้องกุ้ง" 🦐 เป็น AI Advisor ที่วิเคราะห์ข้อมูลแชทลูกค้าแล้วให้คำแนะนำ
return JSON เท่านั้น: { "advice": [ { "priority": "<critical|warning|info|opportunity>", "icon": "<emoji>", "title": "<หัวข้อสั้นๆ>", "detail": "<คำแนะนำ 1-2 ประโยค ภาษาไทย เป็นกันเอง>", "action": "<สิ่งที่ควรทำ>", "relatedRoom": "<ชื่อห้อง หรือ null>" } ] }
ให้ 3-7 คำแนะนำ เรียงตาม priority (critical ก่อน)
critical = จัดการด่วน (ลูกค้าไม่พอใจ, ตอบช้ามาก)
warning = ควรติดตาม (sentiment เริ่มแย่)
opportunity = โอกาสขาย (purchase intent สูง)
info = ข้อมูลทั่วไป (สถิติ, trend)
ถ้าไม่มีข้อมูลผิดปกติ ให้แนะนำเรื่องทั่วไป เช่น ติดตามลูกค้า, ทักทายลูกค้าเก่า`;

  const content = await callLightAI([
    { role: "system", content: adviceSystemPrompt },
    { role: "user", content: JSON.stringify(context) },
  ], { json: true, maxTokens: 1000, timeout: 30000 });

  if (!content) return null;

  try {
    console.log("[น้องกุ้ง] Raw:", content.substring(0, 200));
    let advice = JSON.parse(content);
    if (!Array.isArray(advice)) {
      const arrKey = Object.keys(advice).find((k) => Array.isArray(advice[k]));
      advice = arrKey ? advice[arrKey] : [];
    }
    return advice;
  } catch (e) {
    console.error("[น้องกุ้ง] JSON parse error:", e.message);
    return null;
  }
}

async function runAdvisor() {
  try {
    const advice = await generateAdvice();
    if (!advice || advice.length === 0) {
      console.log("[น้องกุ้ง] ไม่มีคำแนะนำใหม่");
      return;
    }

    const database = await getDB();
    if (!database) return;

    await database.collection("ai_advice").insertOne({
      advice,
      createdAt: new Date(),
    });

    console.log(`[น้องกุ้ง] ✅ สร้างคำแนะนำ ${advice.length} ข้อ`);
  } catch (e) {
    console.error("[น้องกุ้ง] Error:", e.message);
  }
}

// Cron — ทุก 1 ชม.
function startAdvisorCron() {
  // รันครั้งแรกหลัง startup 30 วินาที
  setTimeout(() => runAdvisor(), 30000);
  // แล้วทุก 1 ชม.
  setInterval(() => runAdvisor(), 3600000);
  console.log("[น้องกุ้ง] 🦐 AI Advisor — monitor ทุก 1 ชม.");
}

// API: ดึงคำแนะนำล่าสุด
app.get("/advice", async (req, res) => {
  const database = await getDB();
  if (!database) return res.json([]);
  const latest = await database.collection("ai_advice")
    .find({})
    .sort({ createdAt: -1 })
    .limit(5)
    .toArray();
  res.json(latest);
});

// API: รัน manual
app.post("/advice/generate", async (req, res) => {
  await runAdvisor();
  const database = await getDB();
  const latest = await database.collection("ai_advice").findOne({}, { sort: { createdAt: -1 } });
  res.json(latest);
});

// Health check
app.get("/", (req, res) => {
  res.json({ status: "ok", service: "SMLTrack AI Agent" });
});

// === Start ===
const PORT = process.env.PORT || 3000;
getDB().then(async () => {
  // สร้าง indexes
  await ensureIndexes().catch((e) => console.error("[Index] Error:", e.message));

  // Migrate: ย้ายข้อมูลจาก chat_xxx collections เก่า → messages collection ใหม่
  await migrateOldCollections().catch((e) => console.error("[Migrate] Error:", e.message));

  // Init MCP servers
  await initMCPServers().catch((e) => console.error("[MCP] Init error:", e.message));

  // Start daily summary cron
  startDailyCron();
  startAdvisorCron();

  app.listen(PORT, () => {
    console.log(`[Agent] Running on port ${PORT}`);
    console.log(`[Agent] AI: OpenRouter(free) → SambaNova → Groq → Cerebras`);
    console.log(`[Agent] Tools: ${AGENT_TOOLS.length} built-in + ${mcpTools.length} MCP`);
    console.log(`[Agent] RAG: Vector Search → Keyword → Recent (3-tier)`);
  });
});
