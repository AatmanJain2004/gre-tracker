// /api/kv.js — tiny key-value endpoint backing cross-device sync.
// Backed by Upstash Redis (REST). Provision it from the Vercel Marketplace:
// Vercel dashboard -> Storage -> Upstash Redis -> connect to this project.
// That injects the env vars below automatically. No npm packages needed —
// this uses the global fetch available in Vercel's Node runtime.

const REDIS_URL   = process.env.KV_REST_API_URL   || process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

async function redis(command) {
  const r = await fetch(REDIS_URL, {
    method: "POST",
    headers: { Authorization: "Bearer " + REDIS_TOKEN, "Content-Type": "application/json" },
    body: JSON.stringify(command),
  });
  if (!r.ok) throw new Error("redis " + r.status);
  return r.json(); // { result: ... }
}

// keep sync codes to a safe character set, used as a namespace
function sanitize(s) { return String(s || "").trim().toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 64); }

module.exports = async (req, res) => {
  if (req.method !== "POST") { res.status(405).json({ error: "POST only" }); return; }
  if (!REDIS_URL || !REDIS_TOKEN) { res.status(500).json({ error: "Storage not configured — connect Upstash Redis to this project, then redeploy." }); return; }

  try {
    const body = (req.body && typeof req.body === "object") ? req.body : JSON.parse(req.body || "{}");
    const code = sanitize(body.code);
    if (!code) { res.status(400).json({ error: "Missing sync code" }); return; }

    const key = "u:" + code + ":" + String(body.key || "");

    if (body.action === "get") {
      const out = await redis(["GET", key]);
      res.status(200).json({ value: out.result }); // null when absent
    } else if (body.action === "set") {
      await redis(["SET", key, String(body.value)]);
      res.status(200).json({ ok: true });
    } else if (body.action === "delete") {
      await redis(["DEL", key]);
      res.status(200).json({ ok: true });
    } else {
      res.status(400).json({ error: "Unknown action" });
    }
  } catch (e) {
    res.status(500).json({ error: String((e && e.message) || e) });
  }
};
