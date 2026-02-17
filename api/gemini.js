export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "Server is missing GEMINI_API_KEY" });
  }

  const model = typeof req.body?.model === "string" && req.body.model.trim() ? req.body.model.trim() : "gemini-2.0-flash";
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
