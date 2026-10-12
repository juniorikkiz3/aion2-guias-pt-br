// Feedback relay for the site's "Report a problem" form (Cloudflare Worker).
// The site (static, GitHub Pages) POSTs JSON here; the Worker sends it to the owner's Telegram chat through a bot.
// The bot token never reaches the browser: it lives in the Worker's secrets.
//
// Secrets (Worker → Settings → Variables and Secrets, type "Secret"):
//   BOT_TOKEN  — the token from @BotFather
//   CHAT_ID    — the numeric id of the chat that receives the messages (your own account)
//
// Request:  POST {text, contact?, page, lang, mode?, hp}   (hp = honeypot field, must be empty)
// Response: {ok: true} or {ok: false, error: "..."}

const ALLOWED_ORIGINS = ["https://couga54.github.io", "http://localhost:8010", "http://127.0.0.1:8010"];
const MAX_TEXT = 2000;
const PER_IP = 5;                 // messages per IP ...
const WINDOW_MS = 10 * 60 * 1000; // ... per 10 minutes (best effort: kept in memory of one Worker instance)
const hits = new Map();

function cors(origin) {
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin",
  };
}

function reply(body, status, origin) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...cors(origin) } });
}

function limited(ip) {
  const now = Date.now();
  const list = (hits.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  if (list.length >= PER_IP) { hits.set(ip, list); return true; }
  list.push(now);
  hits.set(ip, list);
  if (hits.size > 5000) hits.clear();
  return false;
}

const clean = (v, max) => String(v == null ? "" : v).replace(/\s+/g, " ").trim().slice(0, max);

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(origin) });
    if (request.method === "GET") return new Response("ok", { headers: { "Content-Type": "text/plain" } });
    if (request.method !== "POST") return reply({ ok: false, error: "method" }, 405, origin);
    if (!ALLOWED_ORIGINS.includes(origin)) return reply({ ok: false, error: "origin" }, 403, origin);
    if (!env.BOT_TOKEN || !env.CHAT_ID) return reply({ ok: false, error: "not configured" }, 500, origin);

    let data;
    try { data = await request.json(); } catch (e) { return reply({ ok: false, error: "json" }, 400, origin); }
    if (data.hp) return reply({ ok: true }, 200, origin);   // a bot filled the hidden field: pretend it worked

    const text = String(data.text || "").trim().slice(0, MAX_TEXT);
    if (text.length < 5) return reply({ ok: false, error: "empty" }, 400, origin);

    const ip = request.headers.get("CF-Connecting-IP") || "?";
    if (limited(ip)) return reply({ ok: false, error: "rate" }, 429, origin);

    const page = clean(data.page, 200), lang = clean(data.lang, 5), mode = clean(data.mode, 10), contact = clean(data.contact, 100);
    const country = (request.cf && request.cf.country) || "";
    const lines = [
      "📝 AION 2 Guides — feedback",
      "Page: " + (page || "?") + (mode ? " · " + mode : "") + (lang ? " · " + lang : "") + (country ? " · " + country : ""),
      contact ? "Contact: " + contact : null,
      "",
      text,
    ].filter((l) => l !== null);

    const tg = await fetch("https://api.telegram.org/bot" + env.BOT_TOKEN + "/sendMessage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // plain text on purpose (no parse_mode): nothing a visitor types is interpreted as markup
      body: JSON.stringify({ chat_id: env.CHAT_ID, text: lines.join("\n"), disable_web_page_preview: true }),
    });
    if (!tg.ok) return reply({ ok: false, error: "telegram " + tg.status }, 502, origin);
    return reply({ ok: true }, 200, origin);
  },
};
