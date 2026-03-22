import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { getDB } from "@/lib/mongodb";

function maskSecret(value: string | undefined | null): string {
  if (!value) return "";
  if (value.length <= 8) return "••••••••";
  return value.slice(0, 4) + "••••••••" + value.slice(-4);
}

function maskUri(uri: string): string {
  try {
    const url = new URL(uri);
    if (url.password) url.password = "••••••••";
    return url.toString();
  } catch {
    return uri.replace(/:([^@]+)@/, ":••••••••@");
  }
}

export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = await getDB();
    const account = await db.collection("accounts").findOne({ email: user.email });

    if (!account) {
      // ยังไม่มี account doc → return ข้อมูลพื้นฐานจาก session
      return NextResponse.json({
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.image,
        setupComplete: false,
        mongodbUri: "",
        aiKeys: { openrouterKey: "", groqKey: "", sambaNovaKey: "", cerebrasKey: "", googleKey: "" },
        lineConfig: { channelAccessToken: "", channelSecret: "" },
        fbConfig: { pageAccessToken: "", appSecret: "", verifyToken: "" },
        telegramChatId: null,
      });
    }

    // ส่งข้อมูลโดย mask secrets
    return NextResponse.json({
      id: account._id,
      email: account.email,
      name: account.name,
      image: account.image,
      setupComplete: account.setupComplete ?? false,
      mongodbUri: account.mongodbUri ? maskUri(account.mongodbUri) : "",
      mongodbUriConfigured: !!account.mongodbUri,
      aiKeys: {
        openrouterKey: maskSecret(account.aiKeys?.openrouterKey),
        groqKey: maskSecret(account.aiKeys?.groqKey),
        sambaNovaKey: maskSecret(account.aiKeys?.sambaNovaKey),
        cerebrasKey: maskSecret(account.aiKeys?.cerebrasKey),
        googleKey: maskSecret(account.aiKeys?.googleKey),
        openrouterKeyConfigured: !!account.aiKeys?.openrouterKey,
        groqKeyConfigured: !!account.aiKeys?.groqKey,
        sambaNovaKeyConfigured: !!account.aiKeys?.sambaNovaKey,
        cerebrasKeyConfigured: !!account.aiKeys?.cerebrasKey,
        googleKeyConfigured: !!account.aiKeys?.googleKey,
      },
      lineConfig: {
        channelAccessToken: maskSecret(account.lineConfig?.channelAccessToken),
        channelSecret: maskSecret(account.lineConfig?.channelSecret),
        configured: !!(account.lineConfig?.channelAccessToken && account.lineConfig?.channelSecret),
      },
      fbConfig: {
        pageAccessToken: maskSecret(account.fbConfig?.pageAccessToken),
        appSecret: maskSecret(account.fbConfig?.appSecret),
        verifyToken: maskSecret(account.fbConfig?.verifyToken),
        configured: !!(account.fbConfig?.pageAccessToken),
      },
      telegramChatId: account.telegramChatId || null,
      createdAt: account.createdAt,
    });
  } catch (err) {
    console.error("[GET /api/account]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const db = await getDB();

    // สร้าง update object — เฉพาะ field ที่ส่งมาและไม่ใช่ masked value
    const setFields: Record<string, unknown> = {};

    if (body.mongodbUri && !body.mongodbUri.includes("••••")) {
      setFields["mongodbUri"] = body.mongodbUri;
    }

    if (body.setupComplete !== undefined) {
      setFields["setupComplete"] = body.setupComplete;
    }

    if (body.aiKeys) {
      for (const [key, val] of Object.entries(body.aiKeys)) {
        if (val && typeof val === "string" && !val.includes("••••")) {
          setFields[`aiKeys.${key}`] = val;
        }
      }
    }

    if (body.lineConfig) {
      for (const [key, val] of Object.entries(body.lineConfig)) {
        if (val && typeof val === "string" && !val.includes("••••")) {
          setFields[`lineConfig.${key}`] = val;
        }
      }
    }

    if (body.fbConfig) {
      for (const [key, val] of Object.entries(body.fbConfig)) {
        if (val && typeof val === "string" && !val.includes("••••")) {
          setFields[`fbConfig.${key}`] = val;
        }
      }
    }

    setFields["updatedAt"] = new Date();

    await db.collection("accounts").updateOne(
      { email: user.email },
      {
        $set: setFields,
        $setOnInsert: {
          email: user.email,
          name: user.name,
          image: user.image,
          createdAt: new Date(),
        },
      },
      { upsert: true }
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[PUT /api/account]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
