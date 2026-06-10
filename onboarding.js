(function() {
  'use strict';

  var cards = document.getElementById('cards');
  var successMsg = document.getElementById('success-msg');
  var btnSave = document.getElementById('btn-save-key');
  var btnBuiltin = document.getElementById('btn-continue-builtin');
  var keyInput = document.getElementById('openrouter-key-input');

  function showSuccess() {
    cards.style.display = 'none';
    successMsg.style.display = 'block';
  }

  btnSave.addEventListener('click', function() {
    var key = keyInput.value.trim();
    if (!key) {
      keyInput.style.borderColor = '#ff4444';
      keyInput.focus();
      return;
    }
    chrome.storage.local.set({ apiProvider: 'user', userApiKey: key }, showSuccess);
  });

  keyInput.addEventListener('input', function() { keyInput.style.borderColor = '#333333'; });

  keyInput.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') btnSave.click();
  });

  btnBuiltin.addEventListener('click', function() {
    chrome.storage.local.set({ apiProvider: 'builtin' }, showSuccess);
  });
})();
