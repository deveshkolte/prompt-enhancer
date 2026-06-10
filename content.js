(function() {
  var hostname = window.location.hostname;
  var allowed = [
    "chatgpt.com", "chat.openai.com",
    "claude.ai",
    "gemini.google.com",
    "copilot.microsoft.com",
    "chat.mistral.ai",
    "perplexity.ai",
    "poe.com",
    "character.ai",
    "you.com",
    "phind.com",
    "bolt.new",
    "v0.dev",
    "cursor.com",
    "replit.com",
    "colab.research.google.com",
    "huggingface.co",
    "playground.ai",
    "ideogram.ai",
    "midjourney.com",
    "leonardo.ai"
  ];
  var isAllowed = false;
  for (var i = 0; i < allowed.length; i++) {
    if (hostname === allowed[i] || hostname.endsWith("." + allowed[i])) {
      isAllowed = true;
      break;
    }
  }
  if (!isAllowed) return;
})();

if (!window.__promptEnhancerLoaded) {
  window.__promptEnhancerLoaded = true;

  (function() {
    'use strict';

    var isEnhancing = false;
    var toastTimeout = null;
    var currentInput = null;
    var lastFocused = null;
    var tooltipTimeout = null;
    var progressInterval = null;
    var progressStart = 0;
    var apiDone = false;
    var progressResolve = null;
    var nudgeDismissed = false;
    var nudgeTimer = null;
    var NUDGE_MIN = 2;
    var NUDGE_MAX = 3;
    var NUDGE_TIMEOUT = 8000;

    document.addEventListener('focusin', function(e) {
      var el = e.target;
      if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT' || el.isContentEditable) {
        lastFocused = el;
      }
    });

    var EXCLUDED = ['chrome://', 'chrome-extension://', 'edge://', 'about:', 'brave://'];

    function isExcludedPage() {
      return EXCLUDED.some(function(h) { return window.location.href.startsWith(h); });
    }

    function findInput() {
      if (lastFocused && document.contains(lastFocused)) return lastFocused;

      var active = document.activeElement;
      if (active && (active.tagName === 'TEXTAREA' || active.isContentEditable)) return active;

      var els = document.querySelectorAll('textarea, [contenteditable="true"]');
      for (var i = 0; i < els.length; i++) {
        var r = els[i].getBoundingClientRect();
        if (r.height > 40 && r.width > 100 && r.top < window.innerHeight) return els[i];
      }
      return null;
    }

    function getText(el) {
      return el.tagName === 'TEXTAREA' || el.tagName === 'INPUT'
        ? el.value.trim()
        : (el.innerText || el.textContent || '').trim();
    }

    // React-controlled inputs need the native setter to trigger state updates
    function injectText(el, text) {
      el.focus();
      if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
        var proto = el.tagName === 'TEXTAREA'
          ? window.HTMLTextAreaElement.prototype
          : window.HTMLInputElement.prototype;
        var setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
        setter.call(el, text);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      } else {
        el.focus();
        document.execCommand('selectAll', false, null);
        var ok = document.execCommand('insertText', false, text);
        if (!ok) {
          el.innerText = text;
          el.dispatchEvent(new Event('input', { bubbles: true }));
        }
      }
    }

    function showToast(msg, persistent) {
      var old = document.getElementById('pe-toast');
      if (old) old.remove();
      clearTimeout(toastTimeout);

      var t = document.createElement('div');
      t.id = 'pe-toast';
      t.textContent = msg;
      document.body.appendChild(t);
      requestAnimationFrame(function() { t.classList.add('pe-toast-show'); });

      if (!persistent) {
        toastTimeout = setTimeout(function() {
          t.classList.remove('pe-toast-show');
          t.classList.add('pe-toast-fade');
          setTimeout(function() { t.remove(); }, 300);
        }, 3000);
      }
    }

    function clearToast() {
      clearTimeout(toastTimeout);
      var el = document.getElementById('pe-toast');
      if (el) {
        el.classList.remove('pe-toast-show');
        el.classList.add('pe-toast-fade');
        setTimeout(function() { el.remove(); }, 300);
      }
    }

    function showTooltip(msg) {
      hideTooltip();
      var tip = document.createElement('div');
      tip.id = 'pe-tooltip';
      tip.textContent = msg;
      document.body.appendChild(tip);
      requestAnimationFrame(function() { tip.classList.add('pe-tooltip-show'); });
      tooltipTimeout = setTimeout(hideTooltip, 3000);
    }

    function hideTooltip() {
      clearTimeout(tooltipTimeout);
      var el = document.getElementById('pe-tooltip');
      if (el) {
        el.classList.remove('pe-tooltip-show');
        setTimeout(function() { el.remove(); }, 200);
      }
    }

    function progressMsg(pct) {
      if (pct < 15) return 'Reading your prompt...';
      if (pct < 40) return 'Applying enhancement framework...';
      if (pct < 70) return 'Structuring your output...';
      if (pct < 90) return 'Finalizing...';
      if (pct < 100) return 'Almost there...';
      return 'Done!';
    }

    function showProgress() {
      hideProgress();

      var bd = document.createElement('div');
      bd.id = 'pe-progress-backdrop';

      var card = document.createElement('div');
      card.id = 'pe-progress-card';
      card.innerHTML = '<div id="pe-progress-icon">\u2726</div>' +
        '<div id="pe-progress-bar-container"><div id="pe-progress-bar"></div></div>' +
        '<div id="pe-progress-percent">0%</div>' +
        '<div id="pe-progress-status">Reading your prompt...</div>' +
        '<div id="pe-progress-hint" style="display:none;margin-top:20px;font-size:12px;color:#666666;line-height:1.5;">Shared API key is slow. Add your own key in extension settings for instant enhancements.</div>';

      bd.appendChild(card);
      document.body.appendChild(bd);

      apiDone = false;
      progressStart = Date.now();
      var pct = 0;
      var hintShown = false;

      progressInterval = setInterval(function() {
        var elapsed = Date.now() - progressStart;
        var next;

        // show hint after 3s if still waiting
        if (!hintShown && elapsed > 3000 && !apiDone) {
          hintShown = true;
          var hint = document.getElementById('pe-progress-hint');
          if (hint) hint.style.display = 'block';
        }

        if (apiDone) {
          next = 100;
        } else if (pct < 85) {
          // ease out cubic
          var t = Math.min(elapsed / 6000, 1);
          next = Math.min(Math.round((1 - Math.pow(1 - t, 3)) * 85), 85);

          // slow crawl after 6s
          if (elapsed > 6000 && pct >= 85) {
            next = Math.min(85 + Math.round((elapsed - 6000) / 500), 92);
          }
        } else {
          next = Math.min(pct + 1, 92);
        }

        pct = next;
        updateProgress(pct);

        if (apiDone && pct >= 100) {
          clearInterval(progressInterval);
          progressInterval = null;
          setTimeout(function() {
            hideProgress();
            if (progressResolve) {
              progressResolve();
              progressResolve = null;
            }
          }, 300);
        }
      }, 50);
    }

    function updateProgress(pct) {
      var bar = document.getElementById('pe-progress-bar');
      var num = document.getElementById('pe-progress-percent');
      var status = document.getElementById('pe-progress-status');
      if (bar) bar.style.width = pct + '%';
      if (num) num.textContent = pct + '%';
      if (status) status.textContent = progressMsg(pct);
    }

    function finishProgress() {
      apiDone = true;
      if (!progressInterval) {
        hideProgress();
        if (progressResolve) {
          progressResolve();
          progressResolve = null;
        }
      }
    }

    function hideProgress() {
      clearInterval(progressInterval);
      progressInterval = null;
      var el = document.getElementById('pe-progress-backdrop');
      if (el) el.remove();
    }

    function waitForProgress() {
      return new Promise(function(resolve) { progressResolve = resolve; });
    }

    function trackKeyUsage() {
      chrome.storage.local.get(['userApiKey', 'sharedKeyUsageCount', 'nudgeDismissed'], function(r) {
        if (r.userApiKey) return;
        var count = (r.sharedKeyUsageCount || 0) + 1;
        chrome.storage.local.set({ sharedKeyUsageCount: count });
        if (!r.nudgeDismissed && count >= NUDGE_MIN && count <= NUDGE_MAX) showNudge();
      });
    }

    function showNudge() {
      if (nudgeDismissed || document.getElementById('pe-nudge')) return;

      var n = document.createElement('div');
      n.id = 'pe-nudge';
      n.innerHTML = '<div class="pe-nudge-content">' +
        '<div class="pe-nudge-text">Using shared API key. Add your own for faster, private enhancements.</div>' +
        '<div class="pe-nudge-actions">' +
          '<button class="pe-nudge-btn" id="pe-nudge-add-key">Add My Key</button>' +
          '<button class="pe-nudge-btn-secondary" id="pe-nudge-dismiss">\u00D7</button>' +
        '</div>' +
      '</div>' +
      '<div class="pe-nudge-countdown"></div>';

      document.body.appendChild(n);
      requestAnimationFrame(function() { n.classList.add('pe-nudge-show'); });

      var countdown = n.querySelector('.pe-nudge-countdown');
      countdown.style.animationDuration = NUDGE_TIMEOUT + 'ms';

      n.querySelector('#pe-nudge-add-key').addEventListener('click', function() {
        chrome.runtime.sendMessage({ type: 'OPEN_NUDGE_PAGE' });
        hideNudge();
      });

      n.querySelector('#pe-nudge-dismiss').addEventListener('click', function() {
        chrome.storage.local.set({ nudgeDismissed: true });
        nudgeDismissed = true;
        hideNudge();
      });

      nudgeTimer = setTimeout(hideNudge, NUDGE_TIMEOUT);
    }

    function hideNudge() {
      clearTimeout(nudgeTimer);
      var n = document.getElementById('pe-nudge');
      if (!n) return;
      n.classList.remove('pe-nudge-show');
      n.classList.add('pe-nudge-hide');
      setTimeout(function() { if (n.parentNode) n.remove(); }, 400);
    }

    function loadNudgeState() {
      chrome.storage.local.get(['nudgeDismissed'], function(r) {
        if (r.nudgeDismissed) nudgeDismissed = true;
      });
    }

    function injectButton() {
      if (document.getElementById('prompt-enhancer-btn')) return;
      var btn = document.createElement('div');
      btn.id = 'prompt-enhancer-btn';
      btn.innerHTML = '\u2726';
      btn.title = 'Prompt Enhancer';
      btn.addEventListener('click', handleClick);
      document.body.appendChild(btn);
    }

    function setBtnLoading() {
      var btn = document.getElementById('prompt-enhancer-btn');
      if (btn) { btn.innerHTML = '<div class="pe-spinner"></div>'; btn.classList.add('pe-loading'); }
    }

    function setBtnIdle() {
      var btn = document.getElementById('prompt-enhancer-btn');
      if (btn) { btn.innerHTML = '\u2726'; btn.classList.remove('pe-loading'); }
    }

    function removeOverlay() {
      var el = document.getElementById('pe-overlay-backdrop');
      if (el) el.remove();
    }

    function saveToHistory(original, enhanced) {
      chrome.storage.local.get(['promptHistory'], function(r) {
        var h = r.promptHistory || [];
        h.unshift({ timestamp: Date.now(), original: original, enhanced: enhanced });
        if (h.length > 10) h.length = 10;
        chrome.storage.local.set({ promptHistory: h });
      });
    }

    function toggleHistory() {
      var panel = document.getElementById('pe-history-panel');
      if (!panel) return;

      var vis = panel.style.display !== 'none';
      panel.style.display = vis ? 'none' : 'block';
      if (vis) return;

      chrome.storage.local.get(['promptHistory'], function(r) {
        var h = r.promptHistory || [];
        if (h.length === 0) {
          panel.innerHTML = '<h4>History</h4><div id="pe-history-empty">No history yet</div>';
          return;
        }

        var html = '<h4>History</h4>';
        for (var i = 0; i < h.length; i++) {
          var item = h[i];
          var time = new Date(item.timestamp).toLocaleString();
          html += '<div class="pe-history-item" data-index="' + i + '">' +
            '<div class="pe-history-item-original">' + escapeHtml(item.original) + '</div>' +
            '<div class="pe-history-item-enhanced">' + escapeHtml(item.enhanced) + '</div>' +
            '<div class="pe-history-item-time">' + time + '</div>' +
          '</div>';
        }
        html += '<button id="pe-history-clear">Clear History</button>';
        panel.innerHTML = html;

        var items = panel.querySelectorAll('.pe-history-item');
        for (var j = 0; j < items.length; j++) {
          items[j].addEventListener('click', function() {
            var idx = parseInt(this.getAttribute('data-index'));
            var histItem = h[idx];
            if (!histItem) return;
            var ta = document.getElementById('pe-overlay-textarea');
            if (ta) { ta.value = histItem.enhanced; ta.focus(); ta.select(); }
            panel.style.display = 'none';
          });
        }

        var clearBtn = document.getElementById('pe-history-clear');
        if (clearBtn) {
          clearBtn.addEventListener('click', function() {
            chrome.storage.local.set({ promptHistory: [] }, function() {
              panel.innerHTML = '<h4>History</h4><div id="pe-history-empty">No history yet</div>';
            });
          });
        }
      });
    }

    function escapeHtml(text) {
      var d = document.createElement('div');
      d.textContent = text;
      return d.innerHTML;
    }

    function showOverlay(enhancedText, inputEl, original) {
      removeOverlay();

      var bd = document.createElement('div');
      bd.id = 'pe-overlay-backdrop';

      var card = document.createElement('div');
      card.id = 'pe-overlay-card';
      card.innerHTML = '<div id="pe-overlay-header">' +
        '<h3 id="pe-overlay-title">\u2726 Enhanced Prompt</h3>' +
        '<button id="pe-overlay-history-btn">History</button>' +
      '</div>' +
      '<textarea id="pe-overlay-textarea"></textarea>' +
      '<div id="pe-overlay-actions">' +
        '<button id="pe-btn-keep">Keep Original</button>' +
        '<button id="pe-btn-use">Use This Prompt</button>' +
      '</div>' +
      '<div id="pe-history-panel" style="display:none;"></div>';

      bd.appendChild(card);
      document.body.appendChild(bd);

      var ta = card.querySelector('#pe-overlay-textarea');
      ta.value = enhancedText;

      card.querySelector('#pe-btn-use').addEventListener('click', function(e) {
        e.stopPropagation();
        var txt = ta.value.trim();
        if (txt && inputEl) {
          injectText(inputEl, txt);
          if (original) saveToHistory(original, txt);
        }
        removeOverlay();
      });

      card.querySelector('#pe-btn-keep').addEventListener('click', function(e) {
        e.stopPropagation();
        removeOverlay();
      });

      card.querySelector('#pe-overlay-history-btn').addEventListener('click', function(e) {
        e.stopPropagation();
        toggleHistory();
      });

      bd.addEventListener('click', function(e) { if (e.target === bd) removeOverlay(); });

      ta.focus();
      ta.select();
    }

    function showError(msg) {
      removeOverlay();

      var bd = document.createElement('div');
      bd.id = 'pe-overlay-backdrop';

      var card = document.createElement('div');
      card.id = 'pe-overlay-card';
      card.style.textAlign = 'center';
      card.style.padding = '40px 24px';
      card.innerHTML = '<div style="font-size:36px;margin-bottom:16px;">\u26A0\uFE0F</div>' +
        '<h3 id="pe-overlay-title" style="color:var(--pe-text);margin-bottom:8px;">Enhancement Failed</h3>' +
        '<p style="color:var(--pe-text-secondary);font-size:14px;margin-bottom:24px;">' + escapeHtml(msg) + '</p>' +
        '<div id="pe-overlay-actions" style="justify-content:center;">' +
          '<button id="pe-btn-close-error" style="background:var(--pe-primary);color:#000000;padding:10px 24px;border:none;border-radius:8px;font-size:14px;font-weight:500;cursor:pointer;font-family:inherit;">OK</button>' +
        '</div>';

      bd.appendChild(card);
      document.body.appendChild(bd);

      card.querySelector('#pe-btn-close-error').addEventListener('click', function(e) {
        e.stopPropagation(); removeOverlay();
      });
      bd.addEventListener('click', function(e) { if (e.target === bd) removeOverlay(); });
    }

    function sendEnhance(raw, inputEl) {
      var done = false;

      function onErr(msg) {
        if (done) return;
        done = true;
        setBtnIdle();
        isEnhancing = false;
        finishProgress();
        setTimeout(function() { showError(msg); }, 350);
      }

      if (!chrome.runtime || !chrome.runtime.id) {
        onErr('Extension invalidated. Please reload the page and try again.');
        return;
      }

      chrome.runtime.sendMessage(
        { type: 'ENHANCE_PROMPT', rawPrompt: raw },
        function(resp) {
          if (!chrome.runtime || !chrome.runtime.id) {
            onErr('Extension invalidated. Please reload the page and try again.');
            return;
          }
          if (chrome.runtime.lastError) {
            onErr('Extension error. Please reload the page and try again.');
            return;
          }
          if (done) return;
          done = true;
          setBtnIdle();
          isEnhancing = false;
          finishProgress();
          waitForProgress().then(function() {
            if (resp && resp.success) {
              trackKeyUsage();
              showOverlay(resp.enhancedPrompt, inputEl, raw);
            } else {
              showError((resp && resp.error) ? resp.error : 'Enhancement failed. Please try again.');
            }
          });
        }
      );
    }

    function handleClick() {
      if (isEnhancing) return;

      var input = findInput();
      if (!input) { showTooltip('Click inside a text box first'); return; }

      var text = getText(input);
      if (!text) { showToast('Type a basic prompt first'); return; }

      currentInput = input;
      isEnhancing = true;
      setBtnLoading();
      showProgress();
      sendEnhance(text, currentInput);
    }

    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') removeOverlay();
    });

    function observeDOM() {
      var obs = new MutationObserver(function() {
        if (!document.getElementById('prompt-enhancer-btn')) injectButton();
      });
      obs.observe(document.body, { childList: true, subtree: true });
    }

    function init() {
      if (isExcludedPage()) return;
      chrome.storage.local.get(['apiProvider'], function(r) {
        if (!r.apiProvider) return;
        loadNudgeState();
        injectButton();
        observeDOM();
      });
    }

    init();
  })();
}
