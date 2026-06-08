export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Use POST" });
  }

  try {
    const { articles } = req.body || {};
    if (!Array.isArray(articles) || articles.length === 0) {
      return res.status(400).json({ error: "Missing articles array" });
    }

    const text = articles.map(a =>
      `TITLE: ${a.title || ""}
DESC: ${a.description || ""}
LINK: ${a.link || ""}
DATE: ${a.pubDate || ""}`
    ).join("\n\n");

    const prompt = `
You are an event-detection AI.

From the list of news articles below, extract ONLY real events related to Chicago.

Event types include (but are not limited to):
event, fest, festival, game, soccer, convention, con, expo, meetup, gathering,
tournament, show, concert, performance, parade, celebration, party, fair,
summit, showcase, opening, premiere, match, competition.

For each event you find, return JSON ONLY in this exact format:

[
  {
    "id": "short-unique-id-based-on-title",
    "name": "Event Name",
    "type": "festival / concert / game / convention / etc",
    "date": "If a specific date is mentioned, else null",
    "location": "If a specific location/venue is mentioned, else null",
    "summary": "Short 1-2 sentence summary of the event",
    "link": "URL to learn more"
  }
]

Rules:
- Only output valid JSON. No backticks, no explanation, no extra text.
- If no events are found, return [].
- Prefer Chicago-related events.

Articles:
${text}
    `.trim();

    const hfUrl = "https://api-inference.huggingface.co/models/google/gemma-2-9b-it";

    const hfResp = await fetch(hfUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        inputs: prompt,
        parameters: {
          max_new_tokens: 512,
          temperature: 0.2
        }
      })
    });

    const raw = await hfResp.text();
    let textOut = raw;

    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].generated_text) {
        textOut = parsed[0].generated_text;
      } else if (typeof parsed === "string") {
        textOut = parsed;
      } else if (Array.isArray(parsed)) {
        return res.status(200).json(parsed);
      }
    } catch {}

    let events = [];
    try {
      events = JSON.parse(textOut);
      if (!Array.isArray(events)) events = [];
    } catch {
      events = [];
    }

    return res.status(200).json(events);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
}
