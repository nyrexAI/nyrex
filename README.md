# Nyrex — desktop AI assistant

A branded, standalone desktop app (Electron) version of the chat assistant,
with your logo, a dark UI matching its gradient, and an in-app **Settings**
panel where each person who runs it enters their own API key.

## Getting an actual `.exe` — read this first

I can't compile a Windows `.exe` myself — I tried, and the sandbox I run code
in has no route to the servers that serve Electron's binaries (it's locked
down to a small allowlist of domains for security). So instead of a working
`.exe`, I've set things up so **GitHub builds it for you, for free, in about
2 minutes, with zero commands typed on your end.** Here's the whole process:

### One-time setup (5 minutes)

1. Go to [github.com](https://github.com) and sign in (or create a free account).
2. Click the **+** in the top right → **New repository**. Name it `nyrex`,
   set it to Public or Private, click **Create repository**.
3. On the new repo's page, click **Add file → Upload files**, then drag in
   every file and folder from this project (keep the folder structure —
   `.github`, `assets`, `public`, plus `main.js`, `preload.js`,
   `package.json`, `README.md`). Click **Commit changes**.
4. Click the **Actions** tab at the top of the repo. You'll see a workflow
   called "Build Windows EXE" already running (uploading to `main` triggers
   it automatically). Wait about 2 minutes for the green checkmark.
5. Click into that finished run, scroll down to **Artifacts**, and download
   **nyrex-windows-installer** — that's your `.exe`, zipped.

That's it — from here on, every time you upload changed files, a fresh `.exe`
gets built automatically.

### Making it a clean one-click download for other people

Artifacts from step 5 require a GitHub account to download. To get a link
you can send to anyone (no account needed):

1. On the repo page, click **Releases** (right sidebar) → **Create a new release**.
2. Under "Choose a tag," type `v1.0.0` and click **Create new tag**.
3. Click **Publish release**.
4. This triggers the workflow again, and a minute or two later your release
   page will have `Nyrex-Setup-1.0.0.exe` attached — a direct download link
   you can share with anyone.

### Why not just hand you a finished .exe right now?

Because I have no way to run Windows build tools or reach Electron's
download servers from where I execute code — this GitHub Actions setup is
the most "download and go" path that's actually available to me. If you'd
rather build it on your own Windows PC instead of using GitHub, see "Build it
yourself locally" below.

## Why users need their own key

Since this is meant to be downloaded and run by other people, I built it so
**each person enters their own API key** in Settings (stored only on their own
machine, in their OS's app-data folder — never bundled into the app or sent
anywhere but the AI provider). This matters for two reasons:

1. **Security** — any key baked into a distributed `.exe` can be extracted by
   a moderately determined person. Compiled apps are not a safe place to hide
   secrets.
2. **Cost** — API usage is billed to whoever owns the key. If you embed your
   own key and share the app with others, you pay for everyone's usage,
   with no real way to cap it.

If you want, instead, a version where *only you* run it and it's fine for
your own key to be built in, I can make that variant too — just say so.

## Run it locally first (no build needed)

```bash
cd nyrex-app
npm install
npm start
```

This opens the app in a window immediately — good for testing before you
package it.

## Build it yourself locally (alternative to GitHub Actions)

This has to be run on a machine with full internet access (to download the
Electron binaries) — I can't run this step inside this sandboxed
environment, so please run these on your own computer:

```bash
cd nyrex-app
npm install
npm run build:win
```

electron-builder will produce an installer at:

```
dist/Nyrex Setup 1.0.0.exe
```

That's the file you share — people download it, run it, click through the
installer, and Nyrex appears in their Start Menu with your icon.

**Note:** you can build the Windows `.exe` from macOS or Linux too (electron-builder
cross-compiles), but building *from Windows* is the most reliable if you hit
any issues.

### Building for Mac / Linux too

```bash
npm run build:mac     # produces a .dmg (run this on a Mac)
npm run build:linux   # produces an .AppImage
```

## How it's built

```
nyrex-app/
├── main.js            Electron main process — window, IPC, API calls, web search
├── preload.js          Safely exposes a small API to the UI (contextBridge)
├── package.json        App metadata + electron-builder config (icons, targets)
├── assets/
│   ├── icon.ico         Windows app icon (multi-resolution, generated from your logo)
│   ├── icon.png          Mac/Linux app icon
│   └── logo-header.png   Logo shown in the app's top bar
└── public/
    ├── index.html       UI markup (chat thread, composer, settings modal)
    ├── style.css        Dark theme matching your logo's blue→purple gradient
    └── script.js         UI logic — calls window.nyrex.sendMessage(...) etc.
```

- **No local web server**: unlike a browser-based version, the Electron main
  process handles chat and search calls directly and hands results back to
  the UI over IPC — simpler and one less moving part.
- **Live search toggle**: same idea as before — a live DuckDuckGo search is
  used to ground answers in current information (retrieval-augmented
  generation), not real model training. See the note in the previous
  build's README if you want the fuller explanation.
- **Settings persist per-user**: stored in Electron's per-OS app-data
  directory (e.g. `%APPDATA%/Nyrex/settings.json` on Windows), separate from
  the installed app files.

## Natural next steps

- **Auto-updates**: electron-builder supports publishing updates so users
  get new versions without reinstalling (needs a hosting location like GitHub
  Releases).
- **Streaming replies**: show tokens as they arrive instead of all at once.
- **Persistent chat history**: save conversations to a local file/DB so they
  survive closing the app.
- **Code signing**: unsigned Windows installers trigger a SmartScreen
  warning on first run — a code-signing certificate removes that.

Happy to build any of these next — just let me know which.
