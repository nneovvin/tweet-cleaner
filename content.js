// 트윗 청소기 v2.0.0
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
    const frameRows = frames.map(frame => {
      const d = frame?.children[0]?.children[1]?.getAttribute('d');
      if (!d) return null;
      return d.slice(9).split('C').map(s => s.replace(/[^\d]+/g, ' ').trim().split(' ').filter(Boolean).map(Number));
    });
    _cache = { keyBytes: Array.from(atob(key)).map(c => c.charCodeAt(0)), frameRows, rowIndex: hits[0], keyByteIndices: hits.slice(1) };
  }

  function calcAnimKey() {
    const { keyBytes, frameRows, rowIndex, keyByteIndices } = _cache;
    const arr2d = frameRows[keyBytes[5] % 4];
    if (!arr2d?.length) throw new Error('SVG path 없음');
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

async function waitOrStop(ms, job = null, step = 250) {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    if (job?.stop) return false;
    await new Promise(r => setTimeout(r, Math.min(step, until - Date.now())));
  }
  return !job?.stop;
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
let _globalApiGate = Promise.resolve();
let _lastApiAt = 0;

async function waitGlobalApiGap(job, minGap = 800) {
  let release;
  const previous = _globalApiGate;
  _globalApiGate = new Promise(r => { release = r; });
  await previous;
  try {
    const wait = minGap - (Date.now() - _lastApiAt);
    if (wait > 0 && !(await waitOrStop(wait, job))) return false;
    _lastApiAt = Date.now();
    return !job?.stop;
  } finally {
    release();
  }
}

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

async function apiPost(path, queryId, variables, attempt = 0, job = null, channel = 'delete') {
  if (job?.stop) return 'stopped';
  if (!(await waitGlobalApiGap(job))) return 'stopped';
  const controller = new AbortController();
  if (job) job.controller = controller;
  let res;
  try {
    res = await fetch(`https://x.com${path}`, {
      method: 'POST',
      headers: await makeHeaders('POST', path),
      credentials: 'include',
      signal: controller.signal,
      body: JSON.stringify({ variables: { ...variables, dark_request: false }, queryId }),
    });
  } catch (e) {
    if (job?.stop || e?.name === 'AbortError') return 'stopped';
    throw e;
  } finally {
    if (job?.controller === controller) job.controller = null;
  }
  if (res.status === 429) {
    if (attempt < 4) {
      const wait = gaussianMs(30000 * Math.pow(2, attempt), 3000, 10000);
      sendLog(`api 제한 — ${(wait / 1000).toFixed(1)}s 대기 (${attempt + 1}/4)`, 'err', channel);
      if (!(await waitOrStop(wait, job))) return 'stopped';
      return apiPost(path, queryId, variables, attempt + 1, job, channel);
    }
    return 'rate_limited';
  }
  const body = await res.json().catch(() => null);
  if (!res.ok || body?.errors) {
    const errorMessage = body?.errors?.[0]?.message || body;
    sendLog(`API ${res.status}: ${JSON.stringify(errorMessage)}`, 'err', channel);
    return false;
  }
  return true;
}

const doDelete = (id, job) => apiPost('/i/api/graphql/VaenaVgh5q5ih7kvyVjgtg/DeleteTweet', 'VaenaVgh5q5ih7kvyVjgtg', { tweet_id: id }, 0, job, 'delete');

let _graphqlQueryIdCache = {};

async function findGraphqlQueryId(operationName) {
  if (_graphqlQueryIdCache[operationName]) return _graphqlQueryIdCache[operationName];
  const html = await (await fetch('https://x.com/', { credentials: 'include', headers: { accept: 'text/html' } })).text();
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const scripts = [...doc.querySelectorAll('script[src]')]
    .map(s => s.src)
    .filter(src => /\.js(\?|$)/.test(src));
  const patterns = [
    new RegExp(`queryId:["']([^"']+)["'][^}]{0,300}operationName:["']${operationName}["']`),
    new RegExp(`operationName:["']${operationName}["'][^}]{0,300}queryId:["']([^"']+)["']`),
    new RegExp(`queryId:["']([^"']+)["'][^}]{0,300}["']${operationName}["']`),
    new RegExp(`["']${operationName}["'][^}]{0,300}queryId:["']([^"']+)["']`),
  ];
  for (const src of scripts) {
    const js = await fetch(src).then(r => r.ok ? r.text() : '').catch(() => '');
    if (!js) continue;
    for (const pattern of patterns) {
      const hit = js.match(pattern);
      if (hit?.[1]) {
        _graphqlQueryIdCache[operationName] = hit[1];
        return hit[1];
      }
    }
  }
  throw new Error(`${operationName} queryId 없음`);
}

async function doUnretweet(id, job) {
  const queryId = await findGraphqlQueryId('DeleteRetweet');
  return apiPost(`/i/api/graphql/${queryId}/DeleteRetweet`, queryId, { source_tweet_id: id }, 0, job, 'unretweet');
}

// ── DOM 파싱 ─────────────────────────────────────────────
function parseCountText(text = '') {
  const normalized = String(text).trim().replace(/,/g, '');
  if (!normalized) return 0;
  const match = normalized.match(/([\d.]+)\s*([kKmM]|천|만)?/);
  if (!match) return 0;
  const value = Number(match[1]);
  if (!Number.isFinite(value)) return 0;
  const unit = match[2];
  const multiplier = unit === 'K' || unit === 'k' || unit === '천'
    ? 1000
    : unit === 'M' || unit === 'm'
      ? 1000000
      : unit === '만'
        ? 10000
        : 1;
  return Math.round(value * multiplier);
}

function getTweetStatusInfo(article) {
  const href = article.querySelector('time')?.closest('a[href*="/status/"]')?.href;
  const match = href?.match(/\/([^/]+)\/status\/(\d+)/);
  return match ? { author: match[1].toLowerCase(), id: match[2] } : null;
}

function getTweetId(article) {
  return getTweetStatusInfo(article)?.id || null;
}

function getTargetUsername() {
  const match = location.pathname.match(/^\/([^/?]+)(?:\/|$)/);
  const username = match?.[1]?.toLowerCase();
  if (!username || ['home', 'explore', 'notifications', 'messages', 'i', 'search', 'settings'].includes(username)) return null;
  return username;
}

function getTweetAction(article) {
  const targetUsername = getTargetUsername();
  if (!targetUsername) return null;
  const { author } = getTweetStatusInfo(article) || {};
  if (!author) return null;
  if (author === targetUsername) return 'delete';
  if (article.querySelector('[data-testid="socialContext"]')) return 'unretweet';
  return null;
}

function isReplyTweet(article) {
  const text = article.textContent || '';
  return text.includes('Replying to') || text.includes('님에게 보내는 답글') || text.includes('에게 보내는 답글');
}

function getTweetLogText(article) {
  const text = (article.querySelector('[data-testid="tweetText"]')?.textContent || '').trim();
  if (text) return text.slice(0, 40);
  const hasMedia = !!article.querySelector('[data-testid="tweetPhoto"], [data-testid="videoPlayer"], [data-testid="card.wrapper"]');
  return hasMedia ? 'media' : '';
}

function getCurrentStatusId() {
  return location.pathname.match(/\/status\/(\d+)/)?.[1] || null;
}

function getTweetArticles(root = document) {
  const articles = [];
  if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_NODE) return articles;
  if (root.matches?.('article[data-testid="tweet"]')) articles.push(root);
  articles.push(...root.querySelectorAll?.('article[data-testid="tweet"]') || []);
  return articles;
}

function buildVisibleTweetState() {
  const states = new Map();
  const currentStatusId = getCurrentStatusId();
  let reachedCurrentThread = false;
  for (const article of getTweetArticles()) {
    const id = getTweetId(article);
    if (!id) continue;
    if (currentStatusId && id === currentStatusId) reachedCurrentThread = true;
    states.set(id, {
      isLikedByMe: !!article.querySelector('[data-testid="unlike"]'),
      isCurrentThreadOrBelow: !!reachedCurrentThread,
    });
  }
  return states;
}

function parseTweetArticle(article, visibleStates = null) {
  try {
    const statusInfo = getTweetStatusInfo(article);
    const id = statusInfo?.id;
    if (!id) return null;
    const action = getTweetAction(article);
    if (!action) return null;
    const timeEl = article.querySelector('time[datetime]');
    const ts = timeEl ? new Date(timeEl.getAttribute('datetime')).getTime() : 0;
    const text = getTweetLogText(article);
    const state = visibleStates?.get(id);
    return {
      id,
      author: statusInfo.author,
      action,
      ts,
      likes: parseCountText(article.querySelector('[data-testid="like"], [data-testid="unlike"]')?.textContent),
      isReply: isReplyTweet(article),
      isRetweet: !!article.querySelector('[data-testid="socialContext"]'),
      isLikedByMe: state?.isLikedByMe ?? !!article.querySelector('[data-testid="unlike"]'),
      isCurrentThreadOrBelow: state?.isCurrentThreadOrBelow ?? false,
      text,
    };
  } catch (_) {
    return null;
  }
}

function parseDomTweets(root = document, visibleStates = buildVisibleTweetState()) {
  return getTweetArticles(root).map(article => parseTweetArticle(article, visibleStates)).filter(Boolean);
}

// ── 로드 ─────────────────────────────────────────────────
let _scrollJob = null;
let _tweetsVersion = 0;

async function getStoredTweets() {
  const { tcTweets, tcQueue } = await chrome.storage.local.get(['tcTweets', 'tcQueue']);
  return tcTweets || tcQueue || [];
}

async function setStoredTweets(tweets) {
  await chrome.storage.local.set({ tcTweets: tweets, tcQueue: [] });
}

async function runCollect(job) {
  const tweetsVersion = _tweetsVersion;
  sendLog('트윗 로드 시작 — 자동 스크롤 중...');

  let collectedTweets = await getStoredTweets();
  const existingKeys = new Set(collectedTweets.map(t => `${t.action || 'delete'}:${t.id}`));
  const pendingTweets = new Map();
  let flushTimer = null;

  async function flushTweets(force = false) {
    if ((!force && job.stop) || tweetsVersion !== _tweetsVersion) return;
    if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }
    if (!pendingTweets.size && !force) return;
    const newOnes = Array.from(pendingTweets.values());
    pendingTweets.clear();
    if (newOnes.length) {
      collectedTweets = [...collectedTweets, ...newOnes];
      await setStoredTweets(collectedTweets);
      for (const t of newOnes) {
        const label = t.action === 'unretweet' ? 'RT 취소' : '삭제';
        sendLog(`[${new Date(t.ts).toISOString().slice(0, 10)}] ${label} | ${t.text}`, 'ok', t.action === 'unretweet' ? 'unretweet' : 'delete');
      }
    }
    chrome.runtime.sendMessage({ type: 'TWEETS_UPDATE', total: collectedTweets.length }).catch(() => {});
  }

  function scheduleFlush() {
    if (flushTimer || job.stop || tweetsVersion !== _tweetsVersion) return;
    flushTimer = setTimeout(() => { flushTweets().catch(() => {}); }, 800);
  }

  function collectFromRoots(roots) {
    if (job.stop || tweetsVersion !== _tweetsVersion) return;
    const visibleStates = buildVisibleTweetState();
    const newOnes = roots
      .flatMap(root => parseDomTweets(root, visibleStates))
      .filter(t => t.id && !existingKeys.has(`${t.action}:${t.id}`));
    for (const t of newOnes) {
      const key = `${t.action}:${t.id}`;
      existingKeys.add(key);
      pendingTweets.set(key, t);
    }
    if (newOnes.length) scheduleFlush();
  }

  collectFromRoots([document]);
  await flushTweets();

  const observer = new MutationObserver(records => {
    const addedNodes = [];
    for (const record of records) {
      for (const node of record.addedNodes) addedNodes.push(node);
    }
    if (addedNodes.length) collectFromRoots(addedNodes);
  });
  observer.observe(document.body, { childList: true, subtree: true });

  let lastH = 0, lastTweetCount = collectedTweets.length, sameCount = 0;
  while (!job.stop) {
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    if (!(await waitOrStop(gaussianMs(2200, 400, 1500), job))) break;
    await flushTweets();
    const newH = document.body.scrollHeight;
    if (newH === lastH && collectedTweets.length === lastTweetCount) {
      if (++sameCount >= 3) { sendLog('스크롤을 완료했습니다.'); break; }
    } else {
      sameCount = 0;
      lastH = newH;
      lastTweetCount = collectedTweets.length;
    }
  }

  observer.disconnect();
  await flushTweets(true);
  if (_scrollJob === job) _scrollJob = null;
  sendLog(job.stop ? `트윗 로드를 중단했습니다. ${collectedTweets.length}개` : `트윗 로드를 완료했습니다. ${collectedTweets.length}개`, job.stop ? 'info' : 'done');
  chrome.runtime.sendMessage({ type: 'COLLECT_DONE', total: collectedTweets.length }).catch(() => {});
}

// ── 삭제 ─────────────────────────────────────────────────
let _deleteJob = null;

async function runActions(opts) {
  const job = _deleteJob;
  const tweetsVersion = _tweetsVersion;
  const collectedTweets = await getStoredTweets();
  if (!collectedTweets.length) {
    sendLog('로드하기 버튼을 눌러 주세요.', 'err');
    if (_deleteJob === job) _deleteJob = null;
    chrome.runtime.sendMessage({ type: 'DONE', count: 0 }).catch(() => {});
    return;
  }

  let fromTs = null, toTs = null;
  if (opts.from) { const [y, m, d] = opts.from.split('-').map(Number); fromTs = Date.UTC(y, m - 1, d); }
  if (opts.to)   { const [y, m, d] = opts.to.split('-').map(Number);   toTs   = Date.UTC(y, m - 1, d, 23, 59, 59, 999); }
  const hasLikeLimit = opts.maxLike !== '';
  const likeExcludeMin = hasLikeLimit ? Number(opts.maxLike) : Infinity;
  if (hasLikeLimit && (!Number.isFinite(likeExcludeMin) || likeExcludeMin < 0 || !Number.isInteger(likeExcludeMin))) {
    sendLog('마음수에는 0 이상의 정수만 입력해 주세요.', 'err');
    if (_deleteJob === job) _deleteJob = null;
    chrome.runtime.sendMessage({ type: 'DONE', count: 0 }).catch(() => {});
    return;
  }

  function matchesKind(t, action) {
    const kind = opts.kind || 'all';
    if (kind === 'all') return action === 'delete' || action === 'unretweet';
    if (kind === 'tweet') return action === 'delete' && !t.isReply;
    if (kind === 'reply') return action === 'delete' && t.isReply;
    if (kind === 'retweet') return action === 'unretweet';
    if (kind === 'tweet_retweet') return action === 'unretweet' || (action === 'delete' && !t.isReply);
    return action === 'delete' || action === 'unretweet';
  }

  const liveStates = (opts.keepThread || opts.keepLiked) ? buildVisibleTweetState() : null;
  const filtered = collectedTweets.filter(t => {
    const action = t.action || 'delete';
    const liveState = liveStates?.get(t.id);
    const isCurrentThreadOrBelow = liveState?.isCurrentThreadOrBelow ?? t.isCurrentThreadOrBelow;
    const isLikedByMe = liveState?.isLikedByMe ?? t.isLikedByMe;
    if (action === 'delete' && t.isRetweet) return false;
    if (action !== 'delete' && action !== 'unretweet') return false;
    if (!matchesKind(t, action)) return false;
    if (opts.keepThread && isCurrentThreadOrBelow) return false;
    if (opts.keepLiked && isLikedByMe) return false;
    if (fromTs && t.ts < fromTs)        return false;
    if (toTs   && t.ts > toTs)          return false;
    if (t.likes >= likeExcludeMin)      return false;
    return true;
  });

  if (!filtered.length) {
    sendLog('조건에 맞는 트윗을 찾지 못하였습니다.');
    if (_deleteJob === job) _deleteJob = null;
    chrome.runtime.sendMessage({ type: 'DONE', count: 0 }).catch(() => {});
    return;
  }

  const actionNames = [...new Set(filtered.map(t => t.action || 'delete'))].sort((a, b) => {
    const order = { delete: 0, unretweet: 1 };
    return (order[a] ?? 99) - (order[b] ?? 99);
  });

  const completedKeys = new Set();

  async function runActionWorker({ items, channel, action, meanDelay, stdDelay, minDelay }) {
    let count = 0;
    for (const t of items) {
      if (job?.stop) break;
      if (!(await waitOrStop(gaussianMs(meanDelay, stdDelay, minDelay), job))) break;
      let ok = false;
      try {
        let result = await action(t.id, job);
        if (result === 'stopped') break;
        if (result === 'rate_limited') {
          const wait = channel === 'unretweet'
            ? gaussianMs(1200000, 60000, 900000)
            : gaussianMs(900000, 30000, 800000);
          sendLog(`API 제한 초과 — ${(wait / 60000).toFixed(1)}분 후 재시작합니다.`, 'err', channel);
          if (!(await waitOrStop(wait, job))) break;
          sendLog('재시작합니다.', 'info', channel);
          result = await action(t.id, job);
          if (result === 'stopped') break;
        }
        ok = result === true;
      } catch (e) {
        sendLog(`오류: ${e.message}`, 'err', channel);
      }
      if (ok) {
        count++;
        completedKeys.add(`${t.action || 'delete'}:${t.id}`);
        chrome.runtime.sendMessage({ type: 'COUNT', count: completedKeys.size, total: filtered.length }).catch(() => {});
        sendLog(`${count}/${items.length} | ${t.text}`, 'ok', channel);
      } else {
        sendLog(`실패: ${t.id}`, 'err', channel);
      }
    }
    sendLog(job?.stop ? `중단했습니다. ${count}개 완료` : `완료했습니다. ${count}개`, job?.stop ? 'info' : 'done', channel);
    return count;
  }

  let completedCount = 0;
  for (const actionName of actionNames) {
    if (job?.stop) break;
    const channel = actionName;
    const items = filtered
      .filter(t => (t.action || 'delete') === actionName)
      .sort((a, b) => a.ts - b.ts);
    const label = actionName === 'unretweet' ? 'RT 취소' : '트윗 삭제';
    if (!items.length) continue;
    sendLog(`${label}를 시작합니다. ${items.length}개 (과거순)`, 'info', channel);
    completedCount += await runActionWorker({
      items,
      channel,
      action: actionName === 'unretweet' ? doUnretweet : doDelete,
      meanDelay: actionName === 'unretweet' ? 4500 : 2000,
      stdDelay: actionName === 'unretweet' ? 1200 : 600,
      minDelay: actionName === 'unretweet' ? 2500 : 800,
    });
  }

  if (tweetsVersion === _tweetsVersion) {
    await setStoredTweets(collectedTweets.filter(t => !completedKeys.has(`${t.action || 'delete'}:${t.id}`)));
  }
  if (_deleteJob === job) _deleteJob = null;
  chrome.runtime.sendMessage({ type: 'DONE', count: completedCount }).catch(() => {});
}

// ── 로그 ─────────────────────────────────────────────────
function sendLog(msg, level = 'info', channel = 'collect') {
  try { chrome.runtime.sendMessage({ type: 'LOG', msg, level, channel }); } catch (_) {}
}

// ── 메시지 리스너 ─────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (sender.frameId !== undefined && sender.frameId !== 0) return;
  if (msg.type === 'PING') { sendResponse({ ok: true }); return; }
  if (msg.type === 'COLLECT') {
    if (_scrollJob) { sendResponse({ error: '이미 수집 중' }); return; }
    const job = { stop: false };
    _scrollJob = job;
    sendResponse({ ok: true });
    runCollect(job).catch(e => {
      sendLog(`오류: ${e.message}`, 'err');
      if (_scrollJob === job) _scrollJob = null;
      chrome.runtime.sendMessage({ type: 'COLLECT_DONE', total: 0 }).catch(() => {});
    });
    return;
  }
  if (msg.type === 'DELETE') {
    if (_deleteJob) { sendResponse({ error: '이미 삭제 중' }); return; }
    const job = { stop: false };
    _deleteJob = job;
    sendResponse({ ok: true });
    runActions(msg.options).catch(e => {
      sendLog(`오류: ${e.message}`, 'err', 'delete');
      if (_deleteJob === job) _deleteJob = null;
      chrome.runtime.sendMessage({ type: 'DONE', count: 0 }).catch(() => {});
    });
    return;
  }
  if (msg.type === 'STOP') {
    if (_scrollJob) _scrollJob.stop = true;
    if (_deleteJob) {
      _deleteJob.stop = true;
      _deleteJob.controller?.abort();
    }
    sendResponse({ ok: true });
    return;
  }
  if (msg.type === 'CLEAR_TWEETS') {
    _tweetsVersion++;
    if (_scrollJob) _scrollJob.stop = true;
    if (_deleteJob) {
      _deleteJob.stop = true;
      _deleteJob.controller?.abort();
    }
    setStoredTweets([]).then(() => {
      chrome.runtime.sendMessage({ type: 'COUNT', count: 0, total: 0 }).catch(() => {});
      sendResponse({ ok: true });
    });
    return true;
  }
});

} // end __tcLoaded guard
