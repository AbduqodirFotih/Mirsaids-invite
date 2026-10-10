// Ixtiyoriy Telegram bildirishnomasi. TELEGRAM_BOT_TOKEN va TELEGRAM_CHAT_ID
// .env faylida to'ldirilmasa, bu funksiyalar sokin ravishda hech narsa qilmaydi.
function configured() {
  return !!(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID);
}

function esc(s) {
  return String(s).replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
}

function now() {
  return new Date().toLocaleString("en-GB", { timeZone: "Asia/Tashkent", hour12: false });
}

async function send(text) {
  if (!configured()) return;
  const url = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`;
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: process.env.TELEGRAM_CHAT_ID, text, parse_mode: "HTML" })
  });
  if (!r.ok) throw new Error("telegram " + r.status + " " + (await r.text()));
}

function ip(req) {
  return (req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown").split(",")[0].trim();
}

module.exports = { configured, esc, now, send, ip };
