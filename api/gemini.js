const ALLOWED_ORIGINS = [
  "https://meydans.github.io",
  "http://localhost:5500",
  "http://127.0.0.1:5500"
];

function isSameHost(url, host) {
  if (!url || !host) return false;
  try {
    return new URL(url).host.toLowerCase() === host.toLowerCase();
  } catch {
    return false;
  }
}

function isAllowedOrigin(req) {
  const host = req.headers.host || "";
  const origin = req.headers.origin || "";
  if (origin) {
    return ALLOWED_ORIGINS.includes(origin.toLowerCase()) || isSameHost(origin, host);
  }

  // Some browsers/requests omit Origin on same-site navigations; fall back to Referer.
  const referer = req.headers.referer || "";
  if (!referer) return false;
  return ALLOWED_ORIGINS.some(allowed => referer.toLowerCase().startsWith(allowed.toLowerCase())) || isSameHost(referer, host);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!isAllowedOrigin(req)) {
    return res.status(403).json({ error: "Origin not allowed" });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "Server is missing GEMINI_API_KEY" });
  }

  const model = typeof req.body?.model === "string" && req.body.model.trim() ? req.body.model.trim() : "gemini-3.5-flash";
  const prompt = typeof req.body?.prompt === "string" ? req.body.prompt.trim() : "";

  if (!prompt) {
    return res.status(400).json({ error: "Missing prompt" });
  }

  try {
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.2 }
        })
      }
    );

    const data = await geminiRes.json().catch(() => ({}));
    if (!geminiRes.ok) {
      return res.status(geminiRes.status).json({
        error: data?.error?.message || "Gemini API error"
      });
    }

    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: err?.message || "Failed to call Gemini" });
  }
}
