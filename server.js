// שרת לאתר "מנדטים בזמן אמת" - קובץ אחד, בלי ספריות חיצוניות
// האפליקציה קוראת את התוצאות מאתר הוועדה ושולחת אותן לכאן (/push).
// האתר מציג את התוצאות האחרונות שהתקבלו (/data).
const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;
const PUSH_KEY = "9c398b6b54795a93ed05eaff9ce59c98"; // אותו מפתח כמו באפליקציה
const PAGE = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");

let latest = null; // { receivedAt, data }

function isValidData(d) {
  if (!d || typeof d.valid !== "number" || d.valid <= 0 || !Array.isArray(d.lists)) return false;
  if (d.lists.length === 0 || d.lists.length > 100) return false;
  return d.lists.every(l => l && typeof l.letters === "string" && typeof l.name === "string" &&
    typeof l.votes === "number" && l.votes >= 0 && l.letters.length <= 10 && l.name.length <= 300);
}

function clean(d) {
  const num = v => (typeof v === "number" && isFinite(v) ? v : null);
  return {
    valid: d.valid, total: num(d.total), invalid: num(d.invalid), ballots: num(d.ballots),
    eligible: num(d.eligible), asOf: typeof d.asOf === "string" ? d.asOf.slice(0, 40) : null,
    lists: d.lists.map(l => ({ name: l.name, letters: l.letters, votes: l.votes }))
  };
}

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" };

http.createServer((req, res) => {
  const u = new URL(req.url, "http://x");

  if (req.method === "OPTIONS") { res.writeHead(204, CORS); return res.end(); }

  if (u.pathname === "/" || u.pathname === "/index.html") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-cache" });
    return res.end(PAGE);
  }

  if (u.pathname === "/data") {
    if (!latest) { res.writeHead(204, { "Cache-Control": "no-store" }); return res.end(); }
    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
    return res.end(JSON.stringify(latest));
  }

  if (u.pathname === "/push" && req.method === "POST") {
    let body = "", tooBig = false;
    req.on("data", c => { body += c; if (body.length > 300000) { tooBig = true; req.destroy(); } });
    req.on("end", () => {
      if (tooBig) return;
      try {
        const j = JSON.parse(body);
        if (j.key !== PUSH_KEY) { res.writeHead(403, CORS); return res.end("bad key"); }
        if (!isValidData(j.data)) { res.writeHead(400, CORS); return res.end("bad data"); }
        latest = { receivedAt: Date.now(), data: clean(j.data) };
        res.writeHead(200, CORS);
        res.end("ok");
      } catch (e) {
        res.writeHead(400, CORS);
        res.end("bad json");
      }
    });
    return;
  }

  if (u.pathname === "/health") { res.writeHead(200); return res.end("ok"); }
  res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
  res.end("לא נמצא");
}).listen(PORT, () => console.log("Server on port " + PORT));
