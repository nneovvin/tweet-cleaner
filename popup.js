// 트윗 청소기 v1.0
// Copyright (c) 2026 myo @nneovvin

// popup.js
let running = false;

const dot        = document.getElementById('dot');
const statusText = document.getElementById('status-text');
const logEl      = document.getElementById('log');
const counterEl  = document.getElementById('counter');
const countNum   = document.getElementById('count-num');
const queueCount = document.getElementById('queue-count');
const btnCollect = document.getElementById('btn-collect');
const btnDelete  = document.getElementById('btn-delete');
const btnStop    = document.getElementById('btn-stop');
const btnClear   = document.getElementById('btn-clear');

function addLog(msg, level = 'info') {
  const div = document.createElement('div');
  div.className = 'entry ' + level;
  div.textContent = msg;
  logEl.prepend(div);
}

function setRunning(yes) {
  running = yes;
  btnCollect.disabled = yes;
  btnDelete.disabled  = yes;
  btnStop.disabled    = !yes;
}

async function refreshQueueCount() {
  const { tcQueue = [] } = await chrome.storage.local.get('tcQueue');
  queueCount.textContent = `${tcQueue.length}건`;
}

async function restoreState() {
  const { logs = [], state = {} } = await chrome.storage.local.get(['logs', 'state']);
  logEl.innerHTML = '';
  [...logs].reverse().forEach(l => {
    const d = document.createElement('div');
    d.className = 'entry ' + (l.level || 'info');
    d.textContent = l.msg;
    logEl.appendChild(d);
  });
  if (state.running) { setRunning(true); addLog('백그라운드 실행 중입니다....'); }
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'LOG')          addLog(msg.msg, msg.level);
  if (msg.type === 'COUNT')        { counterEl.classList.add('visible'); countNum.textContent = msg.count; refreshQueueCount(); }
  if (msg.type === 'COLLECT_DONE') { refreshQueueCount(); setRunning(false); chrome.storage.local.set({ state: { running: false } }); }
  if (msg.type === 'DONE')         { setRunning(false); chrome.storage.local.set({ state: { running: false } }); }
});

async function refreshStatus() {
  const [tab] = await chrome.tabs.query({ url: 'https://x.com/*' });
  if (tab) {
    dot.className = 'dot online';
    statusText.textContent = tab.url.split('x.com')[1] || '/';
    if (!running) { btnCollect.disabled = false; btnDelete.disabled = false; }
  } else {
    dot.className = 'dot offline';
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
  };
}

async function sendToContent(type, options = {}) {
  setRunning(true);
  logEl.innerHTML = '';
  await chrome.storage.local.set({ logs: [], state: { running: true } });
  chrome.runtime.sendMessage({ type, options }, res => {
    if (chrome.runtime.lastError || res?.error) {
      addLog(chrome.runtime.lastError?.message || res?.error, 'err');
      setRunning(false);
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
  await chrome.runtime.sendMessage({ type: 'CLEAR_QUEUE' });
  refreshQueueCount();
  addLog('큐 초기화 완료되었습니다.');
});

restoreState();
refreshQueueCount();
refreshStatus();
setInterval(refreshStatus, 3000);
setInterval(refreshQueueCount, 5000);