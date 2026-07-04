const thread = document.getElementById("thread");
const composer = document.getElementById("composer");
const input = document.getElementById("input");
const sendBtn = document.getElementById("sendBtn");
const searchToggle = document.getElementById("searchToggle");

const settingsBtn = document.getElementById("settingsBtn");
const settingsModal = document.getElementById("settingsModal");
const closeSettings = document.getElementById("closeSettings");
const saveSettingsBtn = document.getElementById("saveSettings");
const providerSelect = document.getElementById("providerSelect");
const anthropicKeyInput = document.getElementById("anthropicKey");
const openaiKeyInput = document.getElementById("openaiKey");

let history = [];

// ---------- Settings modal ----------
async function openSettings() {
  const settings = await window.nyrex.getSettings();
  providerSelect.value = settings.provider || "anthropic";
  anthropicKeyInput.value = settings.anthropicKey || "";
  openaiKeyInput.value = settings.openaiKey || "";
  settingsModal.hidden = false;
}

settingsBtn.addEventListener("click", openSettings);
closeSettings.addEventListener("click", () => (settingsModal.hidden = true));
settingsModal.addEventListener("click", (e) => {
  if (e.target === settingsModal) settingsModal.hidden = true;
});

saveSettingsBtn.addEventListener("click", async () => {
  await window.nyrex.saveSettings({
    provider: providerSelect.value,
    anthropicKey: anthropicKeyInput.value.trim(),
    openaiKey: openaiKeyInput.value.trim(),
  });
  settingsModal.hidden = true;
});

// Prompt for a key on first run if none is set yet.
(async function checkFirstRun() {
  const settings = await window.nyrex.getSettings();
  if (!settings.anthropicKey && !settings.openaiKey) {
    openSettings();
  }
})();

// ---------- Composer ----------
input.addEventListener("input", () => {
  input.style.height = "auto";
  input.style.height = Math.min(input.scrollHeight, 140) + "px";
});

input.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    composer.requestSubmit();
  }
});

composer.addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text) return;

  addEntry("user", text);
  history.push({ role: "user", content: text });
  input.value = "";
  input.style.height = "auto";

  const pending = addEntry(
    "assistant",
    searchToggle.checked ? "searching the web…" : "thinking…",
    { pending: true }
  );
  setBusy(true);

  try {
    const { reply, sources, error } = await window.nyrex.sendMessage(history, searchToggle.checked);
    if (error) throw new Error(error);

    pending.remove();
    addEntry("assistant", reply, { sources });
    history.push({ role: "assistant", content: reply });
  } catch (err) {
    pending.remove();
    addEntry("assistant", `⚠ ${err.message}`);
  } finally {
    setBusy(false);
  }
});

function setBusy(isBusy) {
  sendBtn.disabled = isBusy;
}

function addEntry(role, text, { pending = false, sources = [] } = {}) {
  const entry = document.createElement("div");
  entry.className = `entry entry--${role}${pending ? " entry--pending" : ""}`;

  const avatar = document.createElement("div");
  avatar.className = `entry__avatar entry__avatar--${role}`;

  const content = document.createElement("div");
  content.className = "entry__content";

  const body = document.createElement("div");
  body.className = "entry__body";
  body.textContent = text;
  content.appendChild(body);

  if (sources && sources.length > 0) {
    const sourcesEl = document.createElement("div");
    sourcesEl.className = "entry__sources";
    sources.forEach((s, i) => {
      const line = document.createElement("div");
      line.className = "entry__source";
      line.innerHTML = `<span>[${i + 1}]</span> <a href="${s.url}" target="_blank" rel="noopener">${escapeHtml(s.title)}</a>`;
      sourcesEl.appendChild(line);
    });
    body.appendChild(sourcesEl);
  }

  entry.appendChild(avatar);
  entry.appendChild(content);
  thread.appendChild(entry);
  thread.scrollTop = thread.scrollHeight;
  return entry;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
