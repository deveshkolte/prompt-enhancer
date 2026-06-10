var SYSTEM_PROMPT = "You are a professional prompt engineer. Your only job is to take a rough prompt written by a user and rewrite it into a high-quality structured prompt. IMPORTANT: Perform the self-critique process entirely in your head. Do NOT output your draft or your critique. Output ONLY the final rewritten prompt. Nothing else. BUILD THE ENHANCED PROMPT USING THESE 6 COMPONENTS: Apply all that are relevant. For simple tasks use only what is needed. Do not over-engineer simple requests. ROLE / CONTEXT: Define who the AI should be for this task and what expertise to draw from. TASK / OBJECTIVE: One single specific task stated directly. Never combine multiple tasks in one prompt. FORMAT: Specify structure, length, tone, and presentation explicitly. Always state this even if the user did not. CONSTRAINTS: State what to avoid, exclude, or limit. Always add at least 2 negative constraints. AUDIENCE: Define who will read or use the output. Infer from context if not stated. DATA / CONTEXT DUMP: Include a placeholder for any relevant background, data, or examples the AI needs. APPLY THESE PRINCIPLES: Specificity: Remove all vague language. Make every instruction concrete and measurable. Context: Add as much relevant context as can be inferred from the user's rough prompt. Context is the biggest lever. Negative Constraints: Always add what the AI should NOT do. Minimum 2 constraints per prompt. Avoid Leading Language: Never use words like find, prove, confirm, or support in the task. Use neutral language. One Task Only: If the user's rough prompt contains multiple tasks, focus on one primary task only. ADD REASONING INSTRUCTION for tasks involving analysis, planning, strategy, research, or multi-step logic. ADD UNCERTAINTY INSTRUCTION for tasks involving facts, data, research, legal, medical, technical, or financial claims: If you are uncertain about any claim, flag it explicitly rather than guessing. ADD VERIFICATION REQUEST for tasks involving analysis, advice, strategy, or planning: Tell the AI to list assumptions, caveats, or next steps the user should verify. OUTPUT RULES: Output ONLY the enhanced prompt. No preamble. No explanation. No meta-commentary. No 'Here is your enhanced prompt'. Just the enhanced prompt itself. Wrap the entire output in <text></text> tags.";

var _k1 = "sk-or-v1-";
var _k2 = "f59fa4bbdbd54287";
var _k3 = "fb4a7f439dcad594";
var _k4 = "fcd2faf8991b381f";
var _k5 = "9b8fb82656cbaf85";
var OPENROUTER_KEY = _k1 + _k2 + _k3 + _k4 + _k5;

var FREE_MODELS = [
  "openai/gpt-oss-120b:free",
  "google/gemma-4-31b-it:free",
  "nvidia/nemotron-3-super-120b-a12b:free",
  "meta-llama/llama-3.3-70b-instruct:free"
];

function cleanResponse(text) {
  var out = text.trim();
  out = out.replace(/^```(?:\w*)\s*\n?/i, "");
  out = out.replace(/\n?```\s*$/i, "");
  out = out.replace(/^<text>\s*/i, "");
  out = out.replace(/\s*<\/text>$/i, "");
  return out.trim();
}

function detectProvider(apiKey) {
  if (!apiKey) return "builtin";
  if (apiKey.indexOf("sk-or-v1-") === 0) return "openrouter";
  if (apiKey.indexOf("AIza") === 0) return "gemini";
  if (apiKey.indexOf("sk-") === 0) return "openai";
  return "openrouter";
}

function callOpenRouter(rawPrompt, apiKey, model) {
  return fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + apiKey,
      "HTTP-Referer": "https://openrouter.ai",
      "X-Title": "Prompt Enhancer"
    },
    body: JSON.stringify({
      model: model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: rawPrompt }
      ]
    })
  }).then(function(res) {
    if (!res.ok) {
      return res.json().catch(function() { return {}; }).then(function(d) {
        var errMsg = (d && d.error && d.error.message) ? d.error.message : "HTTP " + res.status;
        throw new Error("OpenRouter: " + errMsg);
      });
    }
    return res.json();
  }).then(function(d) {
    var text = d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content;
    if (!text) throw new Error("Empty response from model");
    return cleanResponse(text);
  });
}

function callOpenAI(rawPrompt, apiKey) {
  return fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + apiKey
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: rawPrompt }
      ]
    })
  }).then(function(res) {
    if (!res.ok) throw new Error("OpenAI error: " + res.status);
    return res.json();
  }).then(function(d) {
    var text = d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content;
    if (!text) throw new Error("No response from OpenAI");
    return cleanResponse(text);
  });
}

function callGemini(rawPrompt, apiKey) {
  var url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=" + apiKey;
  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ parts: [{ text: rawPrompt }] }]
    })
  }).then(function(res) {
    if (!res.ok) throw new Error("Gemini error: " + res.status);
    return res.json();
  }).then(function(d) {
    var text = d.candidates && d.candidates[0] && d.candidates[0].content &&
      d.candidates[0].content.parts && d.candidates[0].content.parts[0] &&
      d.candidates[0].content.parts[0].text;
    if (!text) throw new Error("No response from Gemini");
    return cleanResponse(text);
  });
}

function fallbackModels(raw, i) {
  if (i >= FREE_MODELS.length) {
    return Promise.reject(new Error("All free models failed. Try adding your own API key in settings."));
  }
  return callOpenRouter(raw, OPENROUTER_KEY, FREE_MODELS[i]).catch(function() {
    return fallbackModels(raw, i + 1);
  });
}

function callBuiltin(raw) {
  return fallbackModels(raw, 0);
}

function callWithUserKey(raw, apiKey) {
  var provider = detectProvider(apiKey);
  if (provider === "openrouter") return callOpenRouter(raw, apiKey, "openrouter/auto");
  if (provider === "openai") return callOpenAI(raw, apiKey);
  if (provider === "gemini") return callGemini(raw, apiKey);
  return callBuiltin(raw);
}

function enhance(rawPrompt) {
  return chrome.storage.local.get(["userApiKey"]).then(function(result) {
    var key = result.userApiKey;
    var valid = key && (
      key.indexOf("sk-or-v1-") === 0 ||
      key.indexOf("AIza") === 0 ||
      key.indexOf("sk-proj-") === 0
    );
    return valid ? callWithUserKey(rawPrompt, key) : callBuiltin(rawPrompt);
  }).then(function(out) {
    return { success: true, enhancedPrompt: out };
  }).catch(function(err) {
    return { success: false, error: (err && err.message) ? err.message : "Enhancement failed." };
  });
}

chrome.runtime.onMessage.addListener(function(msg, sender, sendResponse) {
  if (msg.type === "ENHANCE_PROMPT") {
    enhance(msg.rawPrompt).then(sendResponse).catch(function() {
      sendResponse({ success: false, error: "Enhancement failed." });
    });
    return true;
  }
  if (msg.type === "OPEN_NUDGE_PAGE") {
    chrome.runtime.openOptionsPage();
    sendResponse({ success: true });
    return false;
  }
});

chrome.runtime.onInstalled.addListener(function(details) {
  if (details.reason === "install") {
    chrome.tabs.create({ url: chrome.runtime.getURL("onboarding.html") });
  }
});

chrome.action.onClicked.addListener(function(tab) {
  if (!tab.url || tab.url.startsWith("chrome://")) return;
  chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] }).catch(function() {});
  chrome.scripting.insertCSS({ target: { tabId: tab.id }, files: ["overlay.css"] }).catch(function() {});
});
