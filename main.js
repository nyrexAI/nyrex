// main.js — Electron main process.
//
// This is the "backend" of the desktop app. It runs in Node, so it's the
// only place allowed to hold the API key and make network calls. The
// renderer (the UI) never talks to the internet directly — it asks the
// main process to do it over IPC. That keeps the key out of devtools/JS
// context that a user could poke at.

const { app, BrowserWindow, ipcMain, shell } = require("electron");
const path = require("path");
const fs = require("fs");

const SETTINGS_PATH = () => path.join(app.getPath("userData"), "settings.json");

let mainWindow;

function loadSettings() {
  try {
    return JSON.parse(fs.readFileSync(SETTINGS_PATH(), "utf-8"));
  } catch {
    return { provider: "anthropic", anthropicKey: "", openaiKey: "" };
  }
}

function saveSettings(settings) {
  fs.writeFileSync(SETTINGS_PATH(), JSON.stringify(settings, null, 2));
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 760,
    minWidth: 420,
    minHeight: 520,
    backgroundColor: "#07070a",
    icon: path.join(__dirname, "assets", "icon.png"),
    titleBarStyle: "hiddenInset",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, "public", "index.html"));

  // Open external links (e.g. cited sources) in the system browser, not
  // inside the app window.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
}

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

// ---------------------------------------------------------------------------
// Settings (API key + provider), persisted to a JSON file in the user's
// per-app data folder — not bundled into the app, never shared between users.
// ---------------------------------------------------------------------------
ipcMain.handle("settings:get", () => loadSettings());

ipcMain.handle("settings:save", (_event, settings) => {
  saveSettings(settings);
  return { ok: true };
});

// ---------------------------------------------------------------------------
// Web search (no API key needed) — same DuckDuckGo-scrape approach as the
// web version. Swap in a paid search API here for production reliability.
// ---------------------------------------------------------------------------
async function webSearch(query, maxResults = 5) {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36",
    },
  });
  const html = await res.text();

  const results = [];
  const resultRegex =
    /<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;
  const stripTags = (s) => s.replace(/<[^>]+>/g, "").trim();

  let match;
  while ((match = resultRegex.exec(html)) !== null && results.length < maxResults) {
    results.push({ url: match[1], title: stripTags(match[2]), snippet: stripTags(match[3]) });
  }
  return results;
}

// ---------------------------------------------------------------------------
// LLM calls
// ---------------------------------------------------------------------------
async function callAnthropic(messages, systemPrompt, apiKey) {
  if (!apiKey) throw new Error("No Anthropic API key set. Open Settings to add one.");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-5",
      max_tokens: 1500,
      system: systemPrompt,
      messages,
    }),
  });

  if (!res.ok) throw new Error(`Anthropic API error: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.content.map((b) => (b.type === "text" ? b.text : "")).join("");
}

async function callOpenAI(messages, systemPrompt, apiKey) {
  if (!apiKey) throw new Error("No OpenAI API key set. Open Settings to add one.");

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "system", content: systemPrompt }, ...messages],
      max_tokens: 1500,
    }),
  });

  if (!res.ok) throw new Error(`OpenAI API error: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.choices[0].message.content;
}

ipcMain.handle("chat:send", async (_event, { messages, search }) => {
  const settings = loadSettings();
  const provider = settings.provider || "anthropic";
  const apiKey = provider === "openai" ? settings.openaiKey : settings.anthropicKey;

  let systemPrompt =
    "You are Nyrex, a helpful and friendly AI assistant running inside a desktop app. Answer clearly and concisely.";
  let sources = [];

  if (search) {
    const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
    const query = lastUserMsg ? lastUserMsg.content : "";
    try {
      sources = await webSearch(query);
    } catch (e) {
      console.error("Web search failed:", e.message);
    }
    if (sources.length > 0) {
      const context = sources
        .map((s, i) => `[${i + 1}] ${s.title}\n${s.snippet}\nURL: ${s.url}`)
        .join("\n\n");
      systemPrompt += `\n\nYou were just given live web search results for the user's question. Use them to ground your answer in current information and cite sources like [1], [2]. If the results don't answer the question, say so honestly.\n\nSEARCH RESULTS:\n${context}`;
    }
  }

  const reply =
    provider === "openai"
      ? await callOpenAI(messages, systemPrompt, apiKey)
      : await callAnthropic(messages, systemPrompt, apiKey);

  return { reply, sources };
});
