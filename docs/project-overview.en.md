# AI Pets Hub: How It Works

<p>
  <a href="./project-overview.zh-CN.md">简体中文</a> | <strong>English</strong>
</p>

This document is for people who want to read the code or contribute: how each part works, where the code lives, and why it is built this way. For the feature list and how to use the app, see the [README](../README.md).

> Written for v0.4.1 (November 2026). The code moves fast; when this page and the source disagree, the source wins, and an issue is welcome.

## Contents

- [Principles](#principles)
- [The big picture](#the-big-picture)
- [The conversation loop: chatting and doing are one thing](#the-conversation-loop-chatting-and-doing-are-one-thing)
- [Desktop actions: look, act, look again](#desktop-actions-look-act-look-again)
- [Confirmation and permissions](#confirmation-and-permissions)
- [Capabilities and settings manifests](#capabilities-and-settings-manifests)
- [Plugins](#plugins)
- [Her own browser](#her-own-browser)
- [Memory and persona](#memory-and-persona)
- [Character runtimes](#character-runtimes)
- [Voice](#voice)
- [Phone: QQ and WeChat](#phone-qq-and-wechat)
- [Background tasks and events](#background-tasks-and-events)
- [In-app updates](#in-app-updates)
- [Privacy and security](#privacy-and-security)
- [Testing](#testing)
- [What's next](#whats-next)

---

## Principles

1. **She should sound like herself.** How a character talks, what she calls you and who she is live in the persona and knowledge base; the code only brings them to the model and adds no canned lines to her replies.
2. **You decide.** Memories are written only after you approve them; she looks at the screen only after you agree; anything that changes things is asked out loud first, and what cannot be undone (sending, deleting, paying, closing programs, overwriting files) is asked every time.
3. **Your data stays on your computer.** Chats, memories, characters and settings are stored locally; keys are encrypted by the system.
4. **One loop, one decision maker.** Chatting and doing things run in the same conversation loop, where the model picks the next step within a budget, so several planners never fight each other.
5. **Done means verified.** After a desktop action she looks again to confirm the result really happened.

## The big picture

```text
┌──────────── Electron main process (electron/) ────────────┐
│ config store · MCP client · her browser · file service      │
│ windows / icons / input · QQ (SnowLuma) / WeChat · updates  │
│ diagnostics export · command and path guards                │
└───────────────▲──────────────────────────▲─────────────────┘
                │ IPC only from the app's own pages │
   ┌────────────┴───┐  ┌──────────────┐  ┌─┴──────────────┐
   │ Pet window      │  │ Chat window   │  │ Settings center │
   │ runtimes, loop, │  │ messages, task│  │ settings, plugin│
   │ voice           │  │ cards, calls  │  │ market, versions│
   └────────────────┘  └──────────────┘  └────────────────┘
          React 19 + TypeScript + Vite (src/)
```

- The three windows are independent and share state through one config saved by the main process, plus IPC. The conversation loop, voice and tools run in the pet window; the chat window shows messages and takes input.
- The main process (`electron/`) does what the UI cannot or should not: read and write files, start programs, work with windows and desktop icons, talk to MCP servers, drive her browser and so on. Roughly one service per file, named `xxxService.cjs` / `xxxIpc*.cjs`.
- The entry point is `electron/bootstrap.cjs`: it decides whether to run the code shipped in the installer or a downloaded update, then loads `electron/main.cjs` (see [In-app updates](#in-app-updates)).

## The conversation loop: chatting and doing are one thing

Code: `src/agent/conversation/`

When the user says something, the model's reply may call tools directly; the results go back to the model until it answers without calling a tool. The core is `streamConversationWithTools` in `conversationToolStream.ts`:

1. Request one round from the model and stream its text to the UI and to voice as it arrives.
2. If the round called tools, run them (`runConversationToolCalls` in `conversationTools.ts`): tools that need no confirmation run in parallel, the others ask one at a time, in order.
3. Add the results to the next round and continue. Rounds, steps and time are capped.

**Where the tools come from.** `conversationToolProviders.ts` is the single registry: desktop actions, files, moving windows, desktop icons, capabilities, plugins, MCP, skills, web search and more, assembled for the current character and settings (about 80 tools).

**Task cards.** As soon as a tool is used, a card appears in the chat (`src/components/chat/runController/conversationTaskCard.ts`): one line per step, what she is doing and whether it worked; confirmations are answered on the card. The card's text is also a "task record" kept in the chat history, so later she knows what was done and what is unfinished.

**How a task ends.**

| What happened | The card says |
| --- | --- |
| Finished | Done |
| The user pressed stop | Stopped |
| The user sent a new message and cut the round off | Interrupted by a new message, not finished |
| An app wants a sign-in / activation, or 3 steps failed in a row (`desktopDeadEnds.ts`) | Stuck, stopped to ask you |
| Out of steps | Too many steps, stopped for now |

**How a request is laid out (to save money).** Model services bill the part of a request that matches the start of the previous one at a cache price. So the system message holds only what does not change (persona and rules); what changes every turn (selected memories, to-dos, background tasks, the current time, search results) goes after the chat history; and when the history outgrows its window, old messages leave 20 at a time so its start stays the same. See `buildCharacterReplyStableInstruction` / `buildCharacterReplyTurnContext` and `limitHistoryForPrompt` in `src/services/geminiPromptService.ts`. Cache hits are logged per request as `prompt cache usage`.

## Desktop actions: look, act, look again

Code: `src/agent/loop/`, `src/agent/conversation/conversationDesktopTools.ts`

- **Layered observation** (`observationTiers.ts`): cheap views first (window list, UI Automation tree), then OCR of a region, and a vision model only when needed. Elements are numbered with screen coordinates, and the model clicks by number.
- **Actions**: click, type, press keys, scroll, drag, start programs, focus / move / close windows. After each action the window is read again, and what changed plus the new element list go back to the model.
- **Finding windows**: by title and process name; Chinese app names ("记事本") also match the English process name / title word (`electron/appLauncher/windowsAppChineseAliases.cjs`).
- **Administrator windows**: apps running as administrator are clicked and typed into through a local, one-time-approved helper process (`electron/elevatedInputBroker.cjs`); the pet itself never runs as administrator.
- **Desktop icons**: tidy a single screen, or move one icon to a named corner of a chosen screen; a preview comes first, icons move only after approval.

## Confirmation and permissions

- Read-only actions run directly; anything that changes things asks first. Within a task, clicks and typing run on once the task is approved (`src/agent/loop/loopApproval.ts`).
- What cannot be undone asks every time: sending, deleting, paying, closing programs, overwriting files. Enter after typing asks in chat apps and browsers (it may mean "send"), but not in editors such as Notepad.
- The character asks in her own voice; the user can say "yes / no", click the card, or answer in QQ / WeChat. "Allow for today" covers everyday actions for the rest of the day; irreversible ones still ask every time (`src/agent/approval/dailyApproval.ts`).
- One "no" ends today's approval at once.

## Capabilities and settings manifests

- **Capabilities** (`src/platform-capabilities/`): reminders, to-dos, weather, character and display settings, data backup, knowledge bases and more. Each declares its arguments, a description and a risk level (`read` / `personal`, only the user's own lists / `change`, a setting that needs confirmation). The conversation loop uses them as tools.
- **Settings manifest** (`src/settings-manifest/`): each setting is declared once (name, values, whether it changes her behavior) and shared by the settings pages and the character. She can `settings.find / set / open_page` to look up or change a setting, or open its page for you.

## Plugins

Code: `src/plugins/`, `electron/pluginPackageService.cjs`, `services/plugin-market/`; format: [`docs/plugin-format.md`](./plugin-format.md)

| Kind | What it is |
| --- | --- |
| Native plugins | Shipped with the app: ComfyUI drawing, QQ, WeChat, dev assistant |
| Skills (SKILL.md) | Written instructions she reads when needed and follows |
| MCP tools | Standard MCP servers (stdio), started and called by the main process |
| Plugin packages | A zip with a `plugin.json`, which can bundle skills, MCP setup and settings |

- **Plugin market**: a Cloudflare Worker with R2 and D1 (`services/plugin-market/worker.mjs`). Submissions are reviewed by hand before they go public; the permissions a plugin needs are listed before it is installed.
- **Per character**: each plugin can be turned on for some characters only.
- **Install from a link** (`pluginLinkInstall.ts`, `electron/pluginLinkInspect.cjs`): reads only `plugin.json`, `SKILL.md`, `README.md` and `package.json` from GitHub to work out what it is and what it needs, tells the user it has not been reviewed, and installs only after they agree, every time.
- **Read-only MCP tools**: tools whose server declares `readOnlyHint` run without a card; arguments are matched to the tool's input schema types before the call.
- **Plugin settings**: `plugin.json` can declare settings; the page is generated, and she can change them through the settings manifest.

## Her own browser

Code: `src/plugins/herBrowser.ts`, `electron/browserSearch*.cjs`, `electron/herBrowserFocusGuard.cjs`

The app starts a Chrome with its own profile (fully separate from the user's browser and accounts) and a debugging port; the chrome-devtools MCP plugin connects to it, so she can open pages, click, fill in forms and take screenshots.

- On the plugin page the user clicks "Open her browser" and signs in her own accounts.
- Switching tabs brings her browser to the front; the main process gives the focus back to the user's window (only when her browser took it). The browser starts with flags that keep it drawing while covered, so screenshots still work behind the user's window.

## Memory and persona

Code: `src/neural-memory/`, `src/character-memory/`, `src/character-graph/`

- **Memory proposals**: when something worth remembering comes up, the character asks "shall I remember this?"; the user approves, edits or declines, and nothing reaches long-term memory without approval.
- **Shared "about you" memory**: tell one character "remember this" and every character knows; "forget it" is confirmed before anything is deleted.
- **Conversation summaries**: old messages that leave the chat window are summarized in batches (`conversationSummary.ts`), so long chats are not forgotten.
- **Neural persona**: a character's long-term information as a graph you can browse and maintain; new "neurons" come only from memories the character proposed and the user approved.
- **Knowledge bases**: each character has its own (rules, background), plus a global one shared by all characters.

## Character runtimes

Code: `src/pet-runtime/`

| Form | Built with |
| --- | --- |
| 2D images / video | Frame sequences, video folders in rotation, clips picked by emotion |
| Live2D | PixiJS + `pixi-live2d-display` + Cubism Core |
| VRM / GLTF / FBX | Three.js + React Three Fiber + `@pixiv/three-vrm` |
| MMD | PMX / PMD models, VMD motions, ammo.js rigid-body physics |
| Unity | An external Unity runtime driven through the Unity Bridge protocol |

Idle, dragging, click reactions and emotional expressions are scheduled by the runtime. The interactive dialogue (video call) draws the character in the chat window with the same renderers; during the call that character steps off the desktop.

## Voice

Code: `src/voice/`; voice pack format: [`docs/voice-pack-format.md`](./voice-pack-format.md)

- **Speaking**: GPT-SoVITS (local, light or trained packs), the browser voice, or OpenAI / Gemini speech; long replies are grouped by whole sentences and played while the rest is synthesized.
- **Listening and wake words**: local speech recognition; each character has her own wake word, matched by sound.
- **Voice runtime**: installed next to the exe on first use; its location is remembered in the user data, so moving the exe does not break it.

## Phone: QQ and WeChat

Code: `src/qq-bridge/`, `src/weixin-bridge/`; QQ setup: [`docs/qq-bridge-setup.md`](./qq-bridge-setup.md)

- **QQ**: through SnowLuma (OneBot v11) on a secondary account; text, images, stickers and voice both ways. Voice is synthesized in the current character's voice; long replies are synthesized in parts and joined.
- **WeChat**: the official ClawBot channel, logged in by scanning a QR code; it can only send text, images, video and files, so her voice goes out as a short video.
- Both can answer confirmations ("yes / no"); messages are relayed on the "her reply is finished" event instead of guessing the order.

## Background tasks and events

- **Background tasks** (`src/agent/background/backgroundTasks.ts`): slow jobs such as drawing run in the background while she keeps chatting; she tells you when it is done (also on QQ / WeChat). One at a time, and cancellable.
- **Event stream** (`src/events/appEvents.ts`): task started / progress / finished, "her reply is finished" and similar events; the phone relays and the task pill subscribe to it.

## In-app updates

Code: `electron/bootstrap.cjs`, `electron/appUpdate*.cjs`, `scripts/build-app-update.mjs`

- Each release produces an **ed25519-signed** version list (`latest.json`) and a package with only the changed files; the app holds just the public key. Sources: Cloudflare R2 first, GitHub Releases as a backup.
- Downloads are checked file by file against the list and unpacked into the user data under `app-updates/<version>/`.
- `bootstrap.cjs` picks the version at start-up; a version that fails to start falls back to the last one that worked, and the user is told.
- A version that changes the foundation (Electron or dependencies) needs the full installer.

## Privacy and security

- **Credentials**: API keys are encrypted with Electron `safeStorage`; if encryption is unavailable, saving is refused rather than falling back to plain text.
- **IPC**: the main process accepts IPC only from the app's own pages (`electron/ipcSenderGuard.cjs`).
- **Tool output is data**: web pages, files and tool results are treated as data, never as instructions.
- **Out of reach**: the file tool and commands cannot touch the app's own config, keys, chat history or browser sign-ins (`electron/sensitivePathPolicy.cjs`, `electron/commandPathGuard.cjs`).
- **Diagnostics export**: what people said, character names, window titles and tool arguments become "<略>", and user names in paths become `<user>` (`electron/diagnosticsExport.cjs`).
- Please report security issues through GitHub private vulnerability reporting.

## Testing

- `scripts/*-smoke.*`: hundreds of smoke checks named by module, run directly with `npx tsx` or `node`.
- `npm run lint`: TypeScript type check.
- **Task benchmark** (`scripts/benchmark/`): with a development build started with a debugging port, `bench-run.cjs` sends a message, answers confirmations and times the run; `desktop-icons.cjs` snapshots and restores desktop icon positions so desktop-tidying tests never disturb the main screen.

## What's next

- Interactive dialogue: lip sync and expressions that follow what she says, and her suggesting a video call herself.
- A plugin process host: plugins in any language running in their own process, with clearer permissions.
- Importing characters from other desktop pet platforms (starting with VPet character animations, only from copies the user installed).
- Characters learning online and slowly growing into themselves; what they learn is kept only with the user's approval.
- Neural persona, long-term memory and character relationships taking a bigger part in everyday chat; characters sharing news with each other.
