const tg = require("../lib/tg");
const db = require("../lib/storage");

module.exports = async (req, res) => {
  if (req.method === "GET") {
    try {
      const wishes = await db.list("wishes", 1000);
      res.setHeader("Cache-Control", "public, s-maxage=10, stale-while-revalidate=50");
      return res.status(200).json({ ok: true, wishes });
    } catch (e) {
      console.error(e.message);
      return res.status(500).json({ ok: false, error: "storage" });
    }
  }
  if (req.method !== "POST") return res.status(405).json({ ok: false });

  const d = req.body && typeof req.body === "object" ? req.body : {};
  if (d.website) return res.status(200).json({ ok: true }); // honeypot

  try {
    if (await db.tooMany(`wish:${tg.ip(req)}`, 8, 600)) return res.status(429).json({ ok: false, error: "rate" });
  } catch (e) { console.error(e.message); }

  const name = String(d.name || "").trim().slice(0, 60);
  const text = String(d.text || "").trim().slice(0, 500);
  if (!name || !text) return res.status(400).json({ ok: false, error: "bad_request" });

  const wish = { n: name, m: text, t: Date.now() };
  try {
    await db.append("wishes", wish);
  } catch (e) {
    console.error(e.message);
    return res.status(500).json({ ok: false, error: "storage" });
  }

  try {
    await tg.send(`💌 <b>Yangi tilak</b>\n👤 <b>${tg.esc(name)}</b>\n\n${tg.esc(text)}\n\n🕒 ${tg.now()}`);
  } catch (e) { console.error(e.message); }

  res.status(200).json({ ok: true, wish });
};
