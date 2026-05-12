// 트윗 청소기 v2.0.0
// Copyright (c) 2026 myo @nneovvin

let _logsCache = null;
let _logsFlushTimer = null;

async function getLogsCache() {
  if (_logsCache) return _logsCache;
  const { logs = [] } = await chrome.storage.local.get('logs');
  _logsCache = logs;
  return _logsCache;
}

function scheduleLogsFlush() {
  if (_logsFlushTimer) return;
  _logsFlushTimer = setTimeout(async () => {
    _logsFlushTimer = null;
    if (_logsCache) await chrome.storage.local.set({ logs: _logsCache });
  }, 750);
}

async function saveLog(msg, level = 'info', channel = 'collect') {
  const logs = await getLogsCache();
  logs.push({ msg, level, channel, ts: Date.now() });
  if (logs.length > 300) logs.splice(0, logs.length - 300);
  scheduleLogsFlush();
}

async function getXTab() {
  return new Promise(r => chrome.tabs.query({ url: ['https://x.com/*', 'https://twitter.com/*'] }, tabs => r(tabs[0] || null)));
}

const _pending = new Set();

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // content script → background
  if (sender.tab) {
    if (msg.type === 'LOG') {
      saveLog(msg.msg, msg.level, msg.channel);
    }
    if (msg.type === 'COLLECT_DONE' || msg.type === 'DONE') {
      chrome.storage.local.set({ state: { running: false } });
    }
    return;
  }

  // 팝업 → content script
  if (['COLLECT', 'DELETE', 'STOP', 'CLEAR_TWEETS'].includes(msg.type)) {
    if (msg.type === 'COLLECT' || msg.type === 'DELETE') {
      _logsCache = [];
      if (_logsFlushTimer) {
        clearTimeout(_logsFlushTimer);
        _logsFlushTimer = null;
      }
    }
    if (msg.type !== 'STOP' && msg.type !== 'CLEAR_TWEETS') {
      if (_pending.has(msg.type)) { sendResponse({ error: '처리 중' }); return true; }
      _pending.add(msg.type);
    }

    (async () => {
      try {
        if (msg.type === 'CLEAR_TWEETS') {
          await chrome.storage.local.set({ tcTweets: [], tcQueue: [], state: { running: false } });
          const tab = await getXTab();
          if (tab) {
            chrome.tabs.sendMessage(tab.id, msg, { frameId: 0 }, () => {});
          }
          sendResponse({ ok: true });
          return;
        }

        const tab = await getXTab();
        if (!tab) { _pending.delete(msg.type); sendResponse({ error: 'x.com 탭 없음' }); return; }

        // STOP은 inject 없이 바로 전달
        if (msg.type === 'STOP') {
          chrome.tabs.sendMessage(tab.id, msg, { frameId: 0 }, res => {
            if (chrome.runtime.lastError) sendResponse({ error: chrome.runtime.lastError.message });
            else sendResponse(res);
          });
          return;
        }

        await chrome.scripting.executeScript(
          { target: { tabId: tab.id, allFrames: false }, files: ['content.js'] }
        );
        await new Promise(r => setTimeout(r, 100));

        chrome.tabs.sendMessage(tab.id, msg, { frameId: 0 }, res => {
          _pending.delete(msg.type);
          if (chrome.runtime.lastError) sendResponse({ error: chrome.runtime.lastError.message });
          else sendResponse(res);
        });
      } catch (e) {
        _pending.delete(msg.type);
        sendResponse({ error: e?.message || '처리 실패' });
      }
    })();

    return true;
  }
});
