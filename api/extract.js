export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Use POST" });
  }

  try {
    const { articles } = req.body || {};
    if (!Array.isArray(articles)) {
      return res.status(400).json({ error: "Missing articles array" });
    }

    const text = articles.map(a =>
      `TITLE: ${a.title || ""}
DESC: ${a.description || ""}
LINK: ${a.link || ""}
DATE: ${a.pubDate || ""}`
    ).join("\n\n");

    const prompt = `
Extract Chicago events from the articles below.
Return ONLY valid JSON array. No text outside JSON.

Articles:
${text}
    `.trim();

    const hfUrl = "https://api-inference.huggingface.co/models/google/gemma-2-9b-it";

    const hfResp = await fetch(hfUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        inputs: prompt,
        parameters: { max_new_tokens: 300, temperature: 0.2 }
      })
    });

    const raw = await hfResp.text();
    let output = raw;

    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return res.status(200).json(parsed);
      }
      if (parsed[0]?.generated_text) {
        output = parsed[0].generated_text;
      }
    } catch {}

    try {
      const events = JSON.parse(output);
      return res.status(200).json(events);
    } catch {
      return res.status(200).json([]);
    }

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
}
