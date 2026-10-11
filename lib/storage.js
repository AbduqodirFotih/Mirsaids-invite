// Saqlash:
//  - Vercel'da: Vercel Blob (private). Har bir yozuv alohida fayl (asosiy manba, yo'qolmaydi)
//    + tez o'qish uchun bitta snapshot fayl.
//  - Lokal kompyuterda (BLOB_READ_WRITE_TOKEN bo'lmasa): data/*.json fayllar.
const fs = require("fs");
const path = require("path");

const BLOB = !!process.env.BLOB_READ_WRITE_TOKEN;
const MAX = 2000;
const blob = BLOB ? require("@vercel/blob") : null;

/* ---------- Blob ---------- */
const snapName = name => `${name}-snapshot.json`;
const itemName = (name, item) =>
  `${name}/${String(item.t).padStart(15, "0")}-${Math.random().toString(36).slice(2, 8)}.json`;

async function readBlob(pathname) {
  try {
    const r = await blob.get(pathname, { access: "private", useCache: false });
    if (!r || r.statusCode !== 200) return null;
    return JSON.parse(await new Response(r.stream).text());
  } catch (e) {
    if (e instanceof blob.BlobNotFoundError) return null;
    throw e;
  }
}

async function writeBlob(pathname, data, overwrite) {
  await blob.put(pathname, JSON.stringify(data), {
    access: "private", addRandomSuffix: false, allowOverwrite: !!overwrite, contentType: "application/json"
  });
}

async function readSnapshot(name) {
  const s = await readBlob(snapName(name));
  return s && Array.isArray(s.items) ? s : { items: [], keys: [] };
}

// Barcha alohida yozuvlarni snapshot bilan solishtirib, tushib qolganlarini qo'shadi.
async function reconcile(name, snap) {
  const known = new Set(snap.keys);
  const missing = [];
  let cursor;
  do {
    const page = await blob.list({ prefix: `${name}/`, limit: 1000, cursor });
    for (const b of page.blobs) if (!known.has(b.pathname)) missing.push(b.pathname);
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  for (let i = 0; i < missing.length; i += 10) {
    const chunk = missing.slice(i, i + 10);
    const got = await Promise.all(chunk.map(p => readBlob(p).catch(() => null)));
    got.forEach((it, k) => { if (it) { snap.items.push(it); snap.keys.push(chunk[k]); } });
  }
  return missing.length > 0;
}

let writes = 0;
async function blobAppend(name, item) {
  const key = itemName(name, item);
  await writeBlob(key, item, false); // asosiy manba — shu yozuv saqlansa, ma'lumot yo'qolmaydi
  const snap = await readSnapshot(name);
  if (++writes % 10 === 1) { try { await reconcile(name, snap); } catch (e) { console.error(e.message); } }
  if (!snap.keys.includes(key)) { snap.items.push(item); snap.keys.push(key); }
  snap.items.sort((a, b) => b.t - a.t);
  if (snap.items.length > MAX) { snap.items.length = MAX; }
  await writeBlob(snapName(name), snap, true);
  return item;
}

async function blobList(name, n) {
  const snap = await readSnapshot(name);
  return snap.items.slice(0, n);
}

/* ---------- lokal fayl ---------- */
const DATA_DIR = path.join(__dirname, "..", "data");
const fileOf = name => path.join(DATA_DIR, name + ".json");
function readFile(name) {
  try { const a = JSON.parse(fs.readFileSync(fileOf(name), "utf8")); return Array.isArray(a) ? a : []; }
  catch { return []; }
}
function fileAppend(name, item) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  const arr = readFile(name);
  arr.unshift(item);
  if (arr.length > MAX) arr.length = MAX;
  fs.writeFileSync(fileOf(name), JSON.stringify(arr, null, 2), "utf8");
  return item;
}

/* ---------- umumiy ---------- */
async function append(name, item) { return BLOB ? blobAppend(name, item) : fileAppend(name, item); }
async function list(name, n = 1000) { return BLOB ? blobList(name, n) : readFile(name).slice(0, n); }

// spamdan himoya (xotirada; serverless'da har bir instansiya uchun alohida — yetarli)
const hits = new Map();
async function tooMany(key, limit, ttlSec) {
  const now = Date.now();
  const arr = (hits.get(key) || []).filter(t => now - t < ttlSec * 1000);
  arr.push(now);
  hits.set(key, arr);
  return arr.length > limit;
}

module.exports = { append, list, tooMany, mode: BLOB ? "blob" : "file" };
