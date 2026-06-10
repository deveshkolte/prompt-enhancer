(function() {
  'use strict';

  var cards = document.getElementById('cards');
  var btnSave = document.getElementById('btn-save-key');
  var btnBuiltin = document.getElementById('btn-continue-builtin');
  var keyInput = document.getElementById('openrouter-key-input');
  var saveConfirmation = document.getElementById('save-confirmation');

  function flashConfirmation() {
    saveConfirmation.style.display = 'block';
    setTimeout(function() { saveConfirmation.style.display = 'none'; }, 2000);
  }

  chrome.storage.local.get(['apiProvider', 'userApiKey'], function(r) {
    if (r.userApiKey) keyInput.value = r.userApiKey;
    if (r.apiProvider === 'user')
      document.getElementById('card-openrouter').style.borderColor = '#ffffff';
  });

  btnSave.addEventListener('click', function() {
    var key = keyInput.value.trim();
    if (!key) {
      keyInput.style.borderColor = '#ff4444';
      keyInput.focus();
      return;
    }
    chrome.storage.local.set({ apiProvider: 'user', userApiKey: key }, flashConfirmation);
  });

  keyInput.addEventListener('input', function() { keyInput.style.borderColor = '#333333'; });

  keyInput.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') btnSave.click();
  });

  btnBuiltin.addEventListener('click', function() {
    chrome.storage.local.set({ apiProvider: 'builtin' }, flashConfirmation);
  });
})();
