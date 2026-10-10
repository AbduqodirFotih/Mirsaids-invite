// Saqlash: Vercel'da Upstash Redis (hamma mehmonlar bir xil tilaklarni ko'radi),
// lokal kompyuterda Redis sozlanmagan bo'lsa — data/*.json fayllar.
const fs = require("fs");
const path = require("path");

const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const enabled = !!(URL_ && TOKEN);
const PREFIX = "mirsaid:";
const MAX = 5000;

async function cmd(args) {
  const r = await fetch(URL_, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(args)
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error(j.error || `redis ${r.status}`);
  return j.result;
}

const DATA_DIR = path.join(__dirname, "..", "data");
function fileOf(name) { return path.join(DATA_DIR, name + ".json"); }
function readFile(name) {
  try { const a = JSON.parse(fs.readFileSync(fileOf(name), "utf8")); return Array.isArray(a) ? a : []; }
  catch { return []; }
}

async function append(name, item) {
  if (enabled) {
    await cmd(["LPUSH", PREFIX + name, JSON.stringify(item)]);
    await cmd(["LTRIM", PREFIX + name, 0, MAX - 1]);
    return item;
  }
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  const arr = readFile(name);
  arr.unshift(item);
  if (arr.length > MAX) arr.length = MAX;
  fs.writeFileSync(fileOf(name), JSON.stringify(arr, null, 2), "utf8");
  return item;
}

async function list(name, n = 1000) {
  if (enabled) {
    const rows = await cmd(["LRANGE", PREFIX + name, 0, n - 1]);
    return rows.map(x => { try { return JSON.parse(x); } catch { return null; } }).filter(Boolean);
  }
  return readFile(name).slice(0, n);
}

const hits = new Map();
async function tooMany(key, limit, ttlSec) {
  if (enabled) {
    const c = await cmd(["INCR", PREFIX + "rl:" + key]);
    if (c === 1) await cmd(["EXPIRE", PREFIX + "rl:" + key, ttlSec]);
    return c > limit;
  }
  const now = Date.now();
  const arr = (hits.get(key) || []).filter(t => now - t < ttlSec * 1000);
  arr.push(now);
  hits.set(key, arr);
  return arr.length > limit;
}

module.exports = { enabled, append, list, tooMany };
