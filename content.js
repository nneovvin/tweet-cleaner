// 트윗 청소기 v1.0
// Copyright (c) 2026 myo @nneovvin

if (window.__tcLoaded) { /* skip */ } else {
window.__tcLoaded = true;

// ── Transaction ID 생성 ───────────────────────────────────
const TC = (() => {
  const KEYWORD = 'obfiowerehiring';
  const EXTRA   = 3;
  const EPOCH   = 1682924400 * 1000;

  const isOdd   = n => n % 2 !== 0 ? -1.0 : 0.0;
  const solve   = (v, lo, hi, fl) => { const r = (v * (hi - lo)) / 255 + lo; return fl ? Math.floor(r) : Math.round(r * 100) / 100; };
  const lerp    = (a, b, f) => a * (1 - f) + b * f;
  const lerpArr = (a, b, f) => a.map((v, i) => lerp(v, b[i], f));
  const rotMat  = deg => { const r = deg * Math.PI / 180, c = Math.cos(r), s = Math.sin(r); return [c, s, -s, c, 0, 0]; };

  function f2hex(x) {
    const res = []; let q = Math.floor(x), fr = x - q;
    while (q > 0) { const nq = Math.floor(x / 16), rem = Math.floor(x - nq * 16); res.unshift(rem > 9 ? String.fromCharCode(rem + 55) : String(rem)); x = nq; q = nq; }
    if (!fr) return res.join('');
    res.push('.');
    for (let i = 0; i < 10 && fr > 0; i++) { fr *= 16; const int = Math.floor(fr); fr -= int; res.push(int > 9 ? String.fromCharCode(int + 55) : String(int)); }
    return res.join('');
  }

  class Cubic {
    constructor(cv) { this.cv = cv; }
    calc(a, b, m) { return 3 * a * (1 - m) * (1 - m) * m + 3 * b * (1 - m) * m * m + m * m * m; }
    getValue(t) {
      if (t <= 0) { const g = this.cv[0] > 0 ? this.cv[1] / this.cv[0] : (this.cv[1] === 0 && this.cv[2] > 0 ? this.cv[3] / this.cv[2] : 0); return g * t; }
      if (t >= 1) { const g = this.cv[2] < 1 ? (this.cv[3] - 1) / (this.cv[2] - 1) : (this.cv[2] === 1 && this.cv[0] < 1 ? (this.cv[1] - 1) / (this.cv[0] - 1) : 0); return 1 + g * (t - 1); }
      let lo = 0, hi = 1, mid = 0;
      while (lo < hi) { mid = (lo + hi) / 2; const xe = this.calc(this.cv[0], this.cv[2], mid); if (Math.abs(t - xe) < 1e-5) return this.calc(this.cv[1], this.cv[3], mid); xe < t ? (lo = mid) : (hi = mid); }
      return this.calc(this.cv[1], this.cv[3], mid);
    }
  }

  let _cache = null;

  async function init() {
    const res  = await fetch('https://x.com/', { credentials: 'include', headers: { accept: 'text/html' } });
    const html = await res.text();
    const doc  = new DOMParser().parseFromString(html, 'text/html');
    const key  = doc.querySelector('meta[name="twitter-site-verification"]')?.getAttribute('content');
    if (!key) throw new Error('meta key 없음');
    const frames = Array.from(doc.querySelectorAll('[id^="loading-x-anim"]'));
    if (!frames.length) throw new Error('SVG 프레임 없음');
    //해시
    const mainScript = [...doc.querySelectorAll('script[src]')].map(s => s.src).find(s => /\/main\.[0-9a-f]+\.js/.test(s));
    if (!mainScript) throw new Error('main.js 없음');
    const js   = await (await fetch(mainScript)).text();
    const hits = [...js.matchAll(/\(\w\[(\d{1,2})\],\s*16\)/g)].map(x => Number(x[1]));
    if (!hits.length) throw new Error('인덱스 없음');
    _cache = { keyBytes: Array.from(atob(key)).map(c => c.charCodeAt(0)), frames, rowIndex: hits[0], keyByteIndices: hits.slice(1) };
  }

  function calcAnimKey() {
    const { keyBytes, frames, rowIndex, keyByteIndices } = _cache;
    const frame = frames[keyBytes[5] % 4];
    const d = frame?.children[0]?.children[1]?.getAttribute('d');
    if (!d) throw new Error('SVG path 없음');
    const arr2d = d.slice(9).split('C').map(s => s.replace(/[^\d]+/g, ' ').trim().split(' ').filter(Boolean).map(Number));
    const ri  = keyBytes[rowIndex] % 16;
    const ft  = keyByteIndices.reduce((a, i) => a * (keyBytes[i] % 16), 1);
    const row = arr2d[ri];
    if (!row?.length) throw new Error(`row[${ri}] 없음`);
    const val   = new Cubic(row.slice(7).map((v, i) => solve(v, isOdd(i), 1.0, false))).getValue(ft / 4096);
    const color = lerpArr([...row.slice(0, 3), 1], [...row.slice(3, 6), 1], val).map(v => v > 0 ? v : 0);
    const parts = color.slice(0, 3).map(v => Math.round(v).toString(16));
    for (const v of rotMat(lerp(0, solve(row[6], 60, 360, true), val))) {
      const h = f2hex(Math.round(Math.abs(v) * 100) / 100);
      parts.push(h.startsWith('.') ? '0' + h : h || '0');
    }
    return parts.join('').replace(/[.-]/g, '');
  }

  async function generateTransactionId(method, path) {
    if (!_cache) await init();
    const { keyBytes } = _cache;
    const now  = Math.floor((Date.now() - EPOCH) / 1000);
    const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${method}!${path}!${now}${KEYWORD}${calcAnimKey()}`))));
    const rand  = Math.floor(Math.random() * 256);
    const bytes = [...keyBytes, ...[now & 0xff, (now >> 8) & 0xff, (now >> 16) & 0xff, (now >> 24) & 0xff], ...hash.slice(0, 16), EXTRA];
    const out   = new Uint8Array(bytes.length + 1); out[0] = rand;
    bytes.forEach((b, i) => { out[i + 1] = b ^ rand; });
    return btoa(String.fromCharCode(...out)).replace(/=+$/, '');
  }

  return { generateTransactionId };
})();

// ── 딜레이 ───────────────────────────────────────────────
function gaussianMs(mean, std, min = 800) {
  let u, v;
  do { u = Math.random(); } while (u === 0);
  do { v = Math.random(); } while (v === 0);
  return Math.max(min, mean + Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v) * std);
}

async function humanWait() {
  await new Promise(r => setTimeout(r, gaussianMs(2000, 600)));
  if (Math.random() < 0.08) {
    const p = gaussianMs(6000, 1500, 3000);
    sendLog(`${(p / 1000).toFixed(1)}s 대기...`);
    await new Promise(r => setTimeout(r, p));
  }
}

// ── 쿠키 ─────────────────────────────────────────────────
function getCookie(name) {
  for (const c of document.cookie.split(';')) {
    const i = c.indexOf('=');
    if (i > -1 && c.substring(0, i).trim() === name) return c.substring(i + 1).trim();
  }
  return '';
}

// ── API ──────────────────────────────────────────────────
const BEARER = 'Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA';

async function makeHeaders(method, path) {
  return {
    'authorization':           BEARER,
    'x-csrf-token':            getCookie('ct0'),
    'content-type':            'application/json',
    'x-twitter-active-user':   'yes',
    'x-twitter-auth-type':     'OAuth2Session',
    'x-client-transaction-id': await TC.generateTransactionId(method, path),
  };
}

async function apiPost(path, queryId, variables, attempt = 0) {
  const res = await fetch(`https://x.com${path}`, {
    method: 'POST',
    headers: await makeHeaders('POST', path),
    credentials: 'include',
    body: JSON.stringify({ variables: { ...variables, dark_request: false }, queryId }),
  });
  if (res.status === 429 && attempt < 4) {
    const wait = gaussianMs(30000 * Math.pow(2, attempt), 3000, 10000);
    sendLog(`api 제한 — ${(wait / 1000).toFixed(1)}s 대기 (${attempt + 1}/4)`);
    await new Promise(r => setTimeout(r, wait));
    return apiPost(path, queryId, variables, attempt + 1);
  }
  const body = await res.json().catch(() => null);
  if (!res.ok || body?.errors) {
    sendLog(`API ${res.status}: ${JSON.stringify(body?.errors?.[0]?.message || body)}`, 'err');
    return false;
  }
  return true;
}

const doDelete = id => apiPost('/i/api/graphql/VaenaVgh5q5ih7kvyVjgtg/DeleteTweet', 'VaenaVgh5q5ih7kvyVjgtg', { tweet_id: id });

// ── DOM 파싱 ─────────────────────────────────────────────
function parseDomTweets() {
  const out = [];
  for (const article of document.querySelectorAll('article[data-testid="tweet"]')) {
    try {
      const statusLink = article.querySelector('a[href*="/status/"]');
      if (!statusLink) continue;
      const id = statusLink.href.match(/\/status\/(\d+)/)?.[1];
      if (!id) continue;
      const timeEl    = article.querySelector('time[datetime]');
      const ts        = timeEl ? new Date(timeEl.getAttribute('datetime')).getTime() : 0;
      const text      = (article.querySelector('[data-testid="tweetText"]')?.innerText || '').slice(0, 40);
      const isReply   = article.innerText.includes('Replying to');
      const isRetweet = !!article.querySelector('[data-testid="socialContext"]');
      const likes     = parseInt(article.querySelector('[data-testid="like"] [data-testid="app-text-transition-container"]')?.innerText?.replace(/[^0-9]/g, '') || '0') || 0;
      out.push({ id, ts, likes, isReply, isRetweet, text });
    } catch (_) {}
  }
  return out;
}

// ── 로드 ─────────────────────────────────────────────────
let _scrollJob = null;

async function runCollect(job) {
  sendLog('트윗 로드 시작 — 자동 스크롤 중...');

  const existingIds = new Set(
    ((await chrome.storage.local.get('tcQueue')).tcQueue || []).map(t => t.id)
  );

  async function harvest() {
    const newOnes = parseDomTweets().filter(t => t.id && !existingIds.has(t.id));
    if (!newOnes.length) return;
    for (const t of newOnes) existingIds.add(t.id);
    const { tcQueue = [] } = await chrome.storage.local.get('tcQueue');
    const merged = [...tcQueue, ...newOnes];
    await chrome.storage.local.set({ tcQueue: merged });
    for (const t of newOnes)
      sendLog(`[${new Date(t.ts).toISOString().slice(0, 10)}] ${t.text}`, 'ok');
    chrome.runtime.sendMessage({ type: 'QUEUE_UPDATE', total: merged.length }).catch(() => {});
  }

  await harvest();

  let lastH = 0, sameCount = 0;
  while (!job.stop) {
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    await new Promise(r => setTimeout(r, gaussianMs(2200, 400, 1500)));
    await harvest();
    const newH = document.body.scrollHeight;
    if (newH === lastH) {
      if (++sameCount >= 3) { sendLog('스크롤을 완료했습니다.'); break; }
    } else {
      sameCount = 0;
      lastH = newH;
    }
  }

  _scrollJob = null;
  const { tcQueue = [] } = await chrome.storage.local.get('tcQueue');
  sendLog(`트윗 로드를 완료했습니다. ${tcQueue.length}개`, 'done');
  chrome.runtime.sendMessage({ type: 'COLLECT_DONE', total: tcQueue.length }).catch(() => {});
}

// ── 삭제 ─────────────────────────────────────────────────
let _deleteJob = null;

async function runDelete(opts) {
  const queue = (await chrome.storage.local.get('tcQueue')).tcQueue || [];
  if (!queue.length) { sendLog('로드하기 버튼을 눌러 주세요.', 'err'); _deleteJob = null; return; }

  let fromTs = null, toTs = null;
  if (opts.from) { const [y, m, d] = opts.from.split('-').map(Number); fromTs = Date.UTC(y, m - 1, d); }
  if (opts.to)   { const [y, m, d] = opts.to.split('-').map(Number);   toTs   = Date.UTC(y, m - 1, d, 23, 59, 59, 999); }
  const maxLike = opts.maxLike !== '' ? parseInt(opts.maxLike) : Infinity;

  const filtered = queue.filter(t => {
    if (t.isRetweet)                    return false;
    if (fromTs && t.ts < fromTs)        return false;
    if (toTs   && t.ts > toTs)          return false;
    if (t.likes > maxLike)              return false;
    if (opts.kind === 'tweet' && t.isReply)  return false;
    if (opts.kind === 'reply' && !t.isReply) return false;
    return true;
  });

  if (!filtered.length) { sendLog('조건에 맞는 트윗을 찾지 못하였습니다.'); _deleteJob = null; return; }

  filtered.sort((a, b) => a.ts - b.ts);
  sendLog(`트윗 청소를 시작합니다. ${filtered.length}개 (과거순)`);

  const deletedIds = new Set();
  let count = 0;

  for (const t of filtered) {
    if (_deleteJob?.stop) break;
    await humanWait();
    let ok = false;
    try { ok = await doDelete(t.id); } catch (_) {}
    if (ok) {
      count++;
      deletedIds.add(t.id);
      chrome.runtime.sendMessage({ type: 'COUNT', count, total: filtered.length }).catch(() => {});
      sendLog(`${count}/${filtered.length} | ${t.text}`, 'ok');
    } else {
      sendLog(`실패: ${t.id}`, 'err');
    }
  }

  await chrome.storage.local.set({ tcQueue: queue.filter(t => !deletedIds.has(t.id)) });
  _deleteJob = null;
  chrome.runtime.sendMessage({ type: 'DONE', count }).catch(() => {});
  sendLog(`트윗 청소를 완료했습니다. ${count}개 삭제`, 'done');
}

// ── 로그 ─────────────────────────────────────────────────
function sendLog(msg, level = 'info') {
  try { chrome.runtime.sendMessage({ type: 'LOG', msg, level }); } catch (_) {}
}

// ── 메시지 리스너 ─────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (sender.frameId !== undefined && sender.frameId !== 0) return;
  if (msg.type === 'PING') { sendResponse({ ok: true }); return; }
  if (msg.type === 'COLLECT') {
    if (_scrollJob) { sendResponse({ error: '이미 수집 중' }); return; }
    _scrollJob = { stop: false };
    sendResponse({ ok: true });
    runCollect(_scrollJob);
    return;
  }
  if (msg.type === 'DELETE') {
    if (_deleteJob) { sendResponse({ error: '이미 삭제 중' }); return; }
    _deleteJob = { stop: false };
    sendResponse({ ok: true });
    runDelete(msg.options).catch(e => { sendLog(`오류: ${e.message}`, 'err'); _deleteJob = null; });
    return;
  }
  if (msg.type === 'STOP') {
    if (_scrollJob) { _scrollJob.stop = true; _scrollJob = null; }
    if (_deleteJob) { _deleteJob.stop = true; _deleteJob = null; }
    sendResponse({ ok: true });
  }
  if (msg.type === 'CLEAR_QUEUE') {
    chrome.storage.local.set({ tcQueue: [] });
    sendResponse({ ok: true });
  }
});

} // end __tcLoaded guard