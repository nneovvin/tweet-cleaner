// 트윗 청소기 v2.0.0
// Copyright (c) 2026 myo @nneovvin

// popup.js
let running = false;

const statusText = document.getElementById('status-text');
const logEl = document.getElementById('delete-log');
const tweetCount = document.getElementById('tweet-count');
const btnCollect = document.getElementById('btn-collect');
const btnDelete  = document.getElementById('btn-delete');
const btnStop    = document.getElementById('btn-stop');
const btnClear   = document.getElementById('btn-clear');

function addLog(msg, level = 'info', channel = 'collect') {
  logEl.style.display = 'block';
  const div = document.createElement('div');
  div.className = `entry ${level} channel-${channel}`;
  div.textContent = msg;
  logEl.prepend(div);
}

function setRunning(yes) {
  running = yes;
  btnCollect.disabled = yes;
  btnDelete.disabled  = yes;
  btnStop.disabled    = !yes;
}

async function refreshTweetCount() {
  const { tcTweets, tcQueue } = await chrome.storage.local.get(['tcTweets', 'tcQueue']);
  setTweetCount((tcTweets || tcQueue || []).length);
}

function setTweetCount(count) {
  tweetCount.textContent = `${Math.max(0, count)}개`;
}

async function restoreState() {
  const { logs = [], state = {} } = await chrome.storage.local.get(['logs', 'state']);
  logEl.innerHTML = '';
  logEl.style.display = 'none';
  logs.forEach(l => {
    addLog(l.msg, l.level || 'info', l.channel || 'collect');
  });
  if (state.running) { setRunning(true); addLog('백그라운드 실행 중입니다....'); }
}

chrome.runtime.onMessage.addListener((msg) => {
  switch (msg.type) {
    case 'LOG':
      addLog(msg.msg, msg.level, msg.channel);
      break;
    case 'FILTERED_COUNT':
      setTweetCount(msg.total || 0);
      break;
    case 'COUNT':
      if (Number.isFinite(msg.total) && Number.isFinite(msg.count)) setTweetCount(msg.total - msg.count);
      else refreshTweetCount();
      break;
    case 'TWEETS_UPDATE':
      refreshTweetCount();
      break;
    case 'COLLECT_DONE':
    case 'DONE':
      refreshTweetCount();
      setRunning(false);
      chrome.storage.local.set({ state: { running: false } });
      break;
  }
});

async function refreshStatus() {
  const [tab] = await chrome.tabs.query({ url: ['https://x.com/*', 'https://twitter.com/*'] });
  if (tab) {
    statusText.textContent = new URL(tab.url).pathname || '/';
    if (!running) { btnCollect.disabled = false; btnDelete.disabled = false; }
  } else {
    statusText.textContent = 'x.com 탭 필요';
    btnCollect.disabled = true;
    btnDelete.disabled  = true;
  }
}

function getOpts() {
  return {
    from:    document.getElementById('from').value,
    to:      document.getElementById('to').value,
    maxLike: document.getElementById('max-like').value,
    kind:    document.getElementById('kind').value,
    excludeKeywords: document.getElementById('exclude-keywords').value,
    keepThread: document.getElementById('keep-thread').checked,
    keepLiked:  document.getElementById('keep-liked').checked,
  };
}

async function sendToContent(type, options = {}) {
  setRunning(true);
  logEl.innerHTML = '';
  logEl.style.display = 'none';
  await chrome.storage.local.set({ logs: [], state: { running: true } });
  chrome.runtime.sendMessage({ type, options }, res => {
    if (chrome.runtime.lastError || res?.error) {
      addLog(chrome.runtime.lastError?.message || res?.error, 'err');
      setRunning(false);
      chrome.storage.local.set({ state: { running: false } });
    }
  });
}

btnCollect.addEventListener('click', () => sendToContent('COLLECT', getOpts()));
btnDelete.addEventListener('click',  () => sendToContent('DELETE',  getOpts()));
btnStop.addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'STOP' });
  setRunning(false);
  chrome.storage.local.set({ state: { running: false } });
  addLog('중단하였습니다.');
});
btnClear.addEventListener('click', async () => {
  await chrome.runtime.sendMessage({ type: 'CLEAR_TWEETS' });
  setRunning(false);
  await chrome.storage.local.set({ state: { running: false } });
  refreshTweetCount();
  addLog('로드한 트윗 목록을 초기화했습니다.');
});

restoreState();
refreshTweetCount();
refreshStatus();
setInterval(refreshStatus, 5000);