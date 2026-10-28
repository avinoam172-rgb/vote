// שרת לאתר "מנדטים בזמן אמת" - קובץ אחד, בלי ספריות חיצוניות
const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;
const PAGE = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");

// הכתובות שמותר לקרוא נלקחות מתוך index.html, כך שמשנים אותן רק במקום אחד
const m = PAGE.match(/const SOURCES = (\[[^\]]*\]);/);
const ALLOWED = m ? JSON.parse(m[1]) : [];

const CACHE_MS = 10000;
const cache = {}; // url -> { time, body, promise }

async function fetchSource(url) {
  const c = cache[url];
  if (c && c.body && Date.now() - c.time < CACHE_MS) return c.body;
  if (c && c.promise) return c.promise;
  const promise = (async () => {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "he-IL,he;q=0.9"
      },
      signal: AbortSignal.timeout(15000)
    });
    if (!res.ok) throw new Error("האתר החזיר שגיאה " + res.status);
    return await res.text();
  })();
  cache[url] = { ...(c || {}), promise };
  try {
    const body = await promise;
    cache[url] = { time: Date.now(), body };
    return body;
  } catch (e) {
    cache[url] = { ...(c || {}), promise: null };
    throw e;
  }
}

http.createServer(async (req, res) => {
  const u = new URL(req.url, "http://x");
  if (u.pathname === "/" || u.pathname === "/index.html") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-cache" });
    return res.end(PAGE);
  }
  if (u.pathname === "/raw") {
    const target = u.searchParams.get("u");
    if (!ALLOWED.includes(target)) {
      res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
      return res.end("כתובת לא מורשית");
    }
    try {
      const body = await fetchSource(target);
      res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" });
      return res.end(body);
    } catch (e) {
      res.writeHead(502, { "Content-Type": "text/plain; charset=utf-8" });
      return res.end(String(e.message || e));
    }
  }
  if (u.pathname === "/health") { res.writeHead(200); return res.end("ok"); }
  res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
  res.end("לא נמצא");
}).listen(PORT, () => console.log("Server on port " + PORT + ", sources: " + ALLOWED.join(", ")));
