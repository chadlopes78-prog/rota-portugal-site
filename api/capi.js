const ALLOWED = new Set(["PageView", "Lead", "ViewContent"]);

function readCookie(header, name) {
  if (!header) return "";
  const parts = header.split(";");
  for (const part of parts) {
    const [k, ...rest] = part.trim().split("=");
    if (k === name) return rest.join("=");
  }
  return "";
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  if (req.method !== "POST") {
    res.status(405).json({ ok: false });
    return;
  }

  const token = process.env.FB_ACCESS_TOKEN;
  const pixel = process.env.FB_PIXEL_ID || "1562720351844425";
  if (!token) {
    res.status(500).json({ ok: false });
    return;
  }

  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
  const eventName = ALLOWED.has(body.event_name) ? body.event_name : "PageView";
  const eventId = String(body.event_id || Date.now());
  const sourceUrl = String(body.event_source_url || req.headers.referer || "").slice(0, 2048);
  const forwarded = String(req.headers["x-forwarded-for"] || "");
  const ip = forwarded.split(",")[0].trim() || req.headers["x-real-ip"] || "";
  const ua = String(req.headers["user-agent"] || "");
  const cookies = String(req.headers.cookie || "");
  const fbp = readCookie(cookies, "_fbp");
  const fbc = body.fbc || readCookie(cookies, "_fbc");

  const userData = {};
  if (ip) userData.client_ip_address = ip;
  if (ua) userData.client_user_agent = ua;
  if (fbp) userData.fbp = fbp;
  if (fbc) userData.fbc = fbc;

  const payload = {
    data: [
      {
        event_name: eventName,
        event_time: Math.floor(Date.now() / 1000),
        action_source: "website",
        event_id: eventId,
        event_source_url: sourceUrl,
        user_data: userData,
      },
    ],
  };

  const fb = await fetch(
    `https://graph.facebook.com/v21.0/${pixel}/events?access_token=${encodeURIComponent(token)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }
  );

  res.status(fb.ok ? 200 : 502).json({ ok: fb.ok });
}
