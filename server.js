'use strict';
/*
  Pic League Live server
  TikTok LIVE se viewers ka naam aur photo leta hai, aur game ko bhejta hai.
  Ye game ki files (index.html wagairah) bhi khud serve karta hai.

  Chalane ka tareeka:
    node server.js TIKTOK_USERNAME        asli TikTok live
    node server.js --demo                 nakli viewers (test ke liye)
*/
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const args = process.argv.slice(2);
const demo = args.includes('--demo');
const username = (args.find((a) => !a.startsWith('--')) || process.env.TIKTOK_USERNAME || '').replace(/^@/, '');
const PORT = +(process.env.PORT || 8080);

if (!demo && !username) {
  console.log('Username do:  node server.js tumhara_tiktok_username');
  console.log('Test ke liye: node server.js --demo');
  process.exit(1);
}

const FILES = {
  'index.html': 'text/html; charset=utf-8',
  'manifest.json': 'application/manifest+json',
  'sw.js': 'text/javascript; charset=utf-8',
  'icon-192.png': 'image/png',
  'icon-512.png': 'image/png'
};
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Private-Network': 'true',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS'
};

const clients = new Set();
let lastStatus = { type: 'status', text: 'Server chal raha hai', ok: false };

function send(obj) {
  const line = 'data: ' + JSON.stringify(obj) + '\n\n';
  clients.forEach((res) => { try { res.write(line); } catch (e) { /* client gaya */ } });
}
function status(text, ok) {
  lastStatus = { type: 'status', text, ok: !!ok };
  console.log('[status]', text);
  send(lastStatus);
}

// Ek hi user ko 4 second mein ek baar se zyada nahi bhejte (likes bahut aate hain)
const lastSent = new Map();
function emitJoin(id, name, pic) {
  id = String(id || '');
  if (!id) return;
  const now = Date.now();
  if (now - (lastSent.get(id) || 0) < 4000) return;
  lastSent.set(id, now);
  if (lastSent.size > 5000) lastSent.clear();
  send({ type: 'join', id, name: name || id, pic: pic || '' });
}

const server = http.createServer((req, res) => {
  if (req.method === 'OPTIONS') { res.writeHead(204, CORS); return res.end(); }
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/events') {
    res.writeHead(200, Object.assign({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no'
    }, CORS));
    res.write('retry: 3000\n\n');
    res.write('data: ' + JSON.stringify(lastStatus) + '\n\n');
    clients.add(res);
    req.on('close', () => clients.delete(res));
    return;
  }
  let name = decodeURIComponent(url.pathname).replace(/^\/+/, '');
  if (name === '') name = 'index.html';
  if (!Object.prototype.hasOwnProperty.call(FILES, name)) { res.writeHead(404, CORS); return res.end('Not found'); }
  fs.readFile(path.join(__dirname, name), (err, data) => {
    if (err) { res.writeHead(404, CORS); return res.end('Not found'); }
    res.writeHead(200, Object.assign({ 'Content-Type': FILES[name], 'Cache-Control': 'no-cache' }, CORS));
    res.end(data);
  });
});
setInterval(() => clients.forEach((res) => { try { res.write(': ping\n\n'); } catch (e) { /* ignore */ } }), 15000);

// ---------- profile photo dhundhna ----------
// Library ke versions mein field ka naam badalta rehta hai, isliye user object mein se
// image jaisa URL dhundhte hain.
function pickPic(u) {
  const urls = [];
  (function walk(o, d) {
    if (!o || d > 4) return;
    if (typeof o === 'string') { if (/^https?:\/\//.test(o)) urls.push(o); return; }
    if (Array.isArray(o)) { o.forEach((x) => walk(x, d + 1)); return; }
    if (typeof o === 'object') {
      Object.keys(o).forEach((k) => { if (d > 0 || /avatar|profilepic|picture|photo|image/i.test(k)) walk(o[k], d + 1); });
    }
  })(u, 0);
  const ok = urls.filter((x) => !/heic/i.test(x) && (/\.(jpe?g|png|webp)/i.test(x) || /tiktokcdn|avatar/i.test(x)));
  return ok[0] || '';
}

// ---------- TikTok ----------
async function startTikTok() {
  let lib;
  try { lib = await import('tiktok-live-connector'); } catch (e) {
    status('tiktok-live-connector install nahi hai. "npm install" chalao.', false);
    console.error(e.message);
    return;
  }
  const { TikTokLiveConnection, WebcastEvent } = lib;
  const E = WebcastEvent || {};
  let firstUser = true;
  let warnedPic = false;
  let retry = null;
  function scheduleRetry(ms) {
    if (retry) return;
    retry = setTimeout(() => { retry = null; attempt(); }, ms);
  }
  async function attempt() {
    const opts = {};
    if (process.env.SIGN_API_KEY) opts.signApiKey = process.env.SIGN_API_KEY;
    const conn = new TikTokLiveConnection(username, opts);
    const handle = (data) => {
      const u = data && (data.user || data);
      if (!u) return;
      if (firstUser) { firstUser = false; console.log('[info] pehle user ke fields:', Object.keys(u).join(', ')); }
      const pic = pickPic(u);
      if (!pic && !warnedPic) { warnedPic = true; console.log('[warn] profile photo ka URL nahi mila, initials dikhenge.'); }
      emitJoin(u.userId || u.uniqueId || u.id, u.nickname || u.uniqueId, pic);
    };
    ['chat', 'member', 'like', 'gift', 'follow', 'share'].forEach((n) => conn.on(E[n.toUpperCase()] || n, handle));
    conn.on(E.DISCONNECTED || 'disconnected', () => {
      status('TikTok se connection toot gaya. Dobara try kar raha hoon...', false);
      scheduleRetry(8000);
    });
    conn.on(E.ERROR || 'error', (e) => console.error('[error]', (e && e.message) || e));
    status('@' + username + ' se connect ho raha hoon...', false);
    try {
      await conn.connect();
      status('TikTok Live se connect ho gaya: @' + username, true);
    } catch (e) {
      status('@' + username + ' abhi live nahi hai ya connect nahi hua. 15 second baad dobara try...', false);
      console.error('[error]', (e && e.message) || e);
      scheduleRetry(15000);
    }
  }
  attempt();
}

// ---------- demo ----------
function demoPic(i) {
  const c = ['#ff4d6d', '#4cc9f0', '#ffd166', '#06d6a0'][i % 4];
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><rect width="120" height="120" fill="' + c +
    '"/><circle cx="60" cy="46" r="22" fill="#fff"/><rect x="24" y="76" width="72" height="50" rx="30" fill="#fff"/></svg>';
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}
function startDemo() {
  const names = ['Aarav', 'Sita', 'Ramesh', 'Priya', 'Bikash', 'Anita', 'Sujan', 'Mina', 'Rohan', 'Kabita', 'Dipesh', 'Sunita',
    'Nabin', 'Puja', 'Kiran', 'Laxmi', 'Suresh', 'Rina', 'Manish', 'Gita', 'Bishal', 'Asha', 'Prakash', 'Nisha'];
  let i = 0;
  status('DEMO mode: nakli viewers aa rahe hain', true);
  setInterval(() => {
    const base = names[i % names.length];
    const n = i >= names.length ? base + ' ' + Math.floor(i / names.length) : base;
    i++;
    emitJoin('demo' + i, n, i % 3 === 0 ? demoPic(i) : '');
  }, 700);
}

server.listen(PORT, () => {
  console.log('Game kholo:  http://localhost:' + PORT);
  Object.values(os.networkInterfaces()).flat().filter((n) => n && n.family === 'IPv4' && !n.internal)
    .forEach((n) => console.log('Same WiFi pe: http://' + n.address + ':' + PORT));
  if (demo) startDemo(); else startTikTok();
});
process.on('uncaughtException', (e) => console.error('[uncaught]', e && e.message));
process.on('unhandledRejection', (e) => console.error('[unhandled]', e && e.message ? e.message : e));
