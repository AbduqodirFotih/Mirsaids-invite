const tg = require("../lib/tg");
const db = require("../lib/storage");

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ ok: false });

  const d = req.body && typeof req.body === "object" ? req.body : {};
  if (d.website) return res.status(200).json({ ok: true }); // honeypot

  try {
    if (await db.tooMany(`rsvp:${tg.ip(req)}`, 8, 600)) return res.status(429).json({ ok: false, error: "rate" });
  } catch (e) { console.error(e.message); }

  const name = String(d.name || "").trim().slice(0, 60);
  const answer = d.answer === "yes" ? "yes" : d.answer === "no" ? "no" : null;
  const guests = Math.min(10, Math.max(1, parseInt(d.guests, 10) || 1));
  const note = String(d.note || "").trim().slice(0, 200);
  if (!name || !answer) return res.status(400).json({ ok: false, error: "bad_request" });

  try { await db.append("rsvp", { n: name, a: answer, g: guests, note, t: Date.now() }); }
  catch (e) { console.error(e.message); }

  const text =
    `🎉 <b>Yangi RSVP</b>\n` +
    `👤 <b>${tg.esc(name)}</b>\n` +
    (answer === "yes" ? `✅ Keladi\n👥 Kishi soni: ${guests}\n` : `❌ Kela olmaydi\n`) +
    (note ? `💬 ${tg.esc(note)}\n` : "") +
    `🕒 ${tg.now()}`;

  try {
    await tg.send(text);
    res.status(200).json({ ok: true });
  } catch (e) {
    console.error(e.message);
    res.status(502).json({ ok: false, error: "telegram" });
  }
};
