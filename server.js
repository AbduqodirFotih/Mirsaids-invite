// Mahalliy ishlab chiqish serveri: node server.js  (yoki: npm run dev)
const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const PUBLIC = path.join(ROOT, "public");

try {
  for (const line of fs.readFileSync(path.join(ROOT, ".env"), "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch {}

const PORT = process.env.PORT || 8080;
const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css",
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp",
  ".svg": "image/svg+xml", ".ico": "image/x-icon",
  ".mp3": "audio/mpeg", ".m4a": "audio/mp4", ".ogg": "audio/ogg",
  ".ttf": "font/ttf", ".woff": "font/woff", ".woff2": "font/woff2"
};

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0, data = "";
    req.on("data", c => {
      size += c.length;
      if (size > 8192) { reject(new Error("too large")); req.destroy(); return; }
      data += c;
    });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

async function runApi(name, req, res) {
  let handler;
  try { handler = require(path.join(ROOT, "api", name + ".js")); } catch { res.writeHead(404); return res.end(); }
  res.status = code => { res.statusCode = code; return res; };
  res.json = obj => { res.setHeader("Content-Type", "application/json; charset=utf-8"); res.end(JSON.stringify(obj)); return res; };
  try { req.body = JSON.parse((await readBody(req)) || "{}"); } catch { req.body = {}; }
  try { await handler(req, res); } catch (e) { console.error(e); if (!res.writableEnded) res.status(500).json({ ok: false }); }
}

function serveStatic(req, res) {
  let rel;
  try { rel = decodeURIComponent(new URL(req.url, "http://x").pathname); } catch { res.writeHead(400); return res.end(); }
  if (rel === "/") rel = "/index.html";
  const file = path.join(PUBLIC, ...rel.split("/").filter(Boolean));
  if (!file.startsWith(PUBLIC + path.sep)) { res.writeHead(404); return res.end("Not found"); }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404); return res.end("Not found"); }
    const ext = path.extname(file).toLowerCase();
    res.writeHead(200, {
      "Content-Type": MIME[ext] || "application/octet-stream",
      "Content-Length": buf.length,
      "Cache-Control": ext === ".html" ? "no-cache" : "public, max-age=604800"
    });
    res.end(buf);
  });
}

http.createServer((req, res) => {
  const p = req.url.split("?")[0];
  const m = p.match(/^\/api\/([a-z]+)$/);
  if (m) return runApi(m[1], req, res);
  if (req.method !== "GET" && req.method !== "HEAD") { res.writeHead(405); return res.end(); }
  serveStatic(req, res);
}).listen(PORT, () => console.log(`Taklifnoma: http://localhost:${PORT}`));
