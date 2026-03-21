// 트윗 청소기 v1.0
// Copyright (c) 2026 myo @nneovvin

async function saveLog(msg, level = 'info') {
  const { logs = [] } = await chrome.storage.local.get('logs');
  logs.push({ msg, level, ts: Date.now() });
  if (logs.length > 300) logs.splice(0, logs.length - 300);
  await chrome.storage.local.set({ logs });
}

async function getXTab() {
  return new Promise(r => chrome.tabs.query({ url: ['https://x.com/*', 'https://twitter.com/*'] }, tabs => r(tabs[0] || null)));
}

const _pending = new Set();

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // content script → background
  if (sender.tab) {
    if (msg.type === 'LOG') {
      saveLog(msg.msg, msg.level);
      chrome.runtime.sendMessage(msg).catch(() => {});
    }
    return;
  }

  // 팝업 → content script
  if (['COLLECT', 'DELETE', 'STOP', 'CLEAR_QUEUE'].includes(msg.type)) {
    if (msg.type !== 'STOP' && msg.type !== 'CLEAR_QUEUE') {
      if (_pending.has(msg.type)) { sendResponse({ error: '처리 중' }); return true; }
      _pending.add(msg.type);
    }

    (async () => {
      const tab = await getXTab();
      if (!tab) { _pending.delete(msg.type); sendResponse({ error: 'x.com 탭 없음' }); return; }

      // STOP, CLEAR_QUEUE는 inject 없이 바로 전달
      if (msg.type === 'STOP' || msg.type === 'CLEAR_QUEUE') {
        chrome.tabs.sendMessage(tab.id, msg, { frameId: 0 }, res => {
          if (chrome.runtime.lastError) sendResponse({ error: chrome.runtime.lastError.message });
          else sendResponse(res);
        });
        return;
      }

      await new Promise(resolve =>
        chrome.scripting.executeScript(
          { target: { tabId: tab.id, allFrames: false }, files: ['content.js'] },
          resolve
        )
      );
      await new Promise(r => setTimeout(r, 100));

      chrome.tabs.sendMessage(tab.id, msg, { frameId: 0 }, res => {
        _pending.delete(msg.type);
        if (chrome.runtime.lastError) sendResponse({ error: chrome.runtime.lastError.message });
        else sendResponse(res);
      });
    })();

    return true;
  }
});