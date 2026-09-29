<div align="center">
  <img src="build/icon.png" alt="AI Pets Hub project icon" width="148" />
  <h1>AI Pets Hub</h1>
  <p><strong>Bring AI characters to the desktop. Connect agents to the real environment.</strong></p>
  <p>A Windows desktop platform for AI characters and agents</p>
  <p>
    <a href="./README.zh-CN.md">简体中文</a> · <strong>English</strong>
  </p>
  <p>
    <img src="https://img.shields.io/badge/Platform-Windows-0078D4?logo=windows&logoColor=white" alt="Platform: Windows" />
    <img src="https://img.shields.io/badge/Electron-37-47848F?logo=electron&logoColor=white" alt="Electron 37" />
    <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black" alt="React 19" />
    <a href="./LICENSE"><img src="https://img.shields.io/badge/Source%20License-Apache--2.0-blue" alt="Source license: Apache-2.0" /></a>
  </p>
  <p><a href="https://github.com/JingXuan-Zun/AI-Pets-Hub-public/releases/latest">⬇️ Download Windows preview</a></p>
</div>

<p align="center">
  <a href="#feature-overview">✨ Feature overview</a> ·
  <a href="#quick-start">🚀 Quick start</a> ·
  <a href="#project-status">📊 Project status</a>
</p>

## ✨ Feature Overview

- 🐾 **Desktop AI characters** — Run 2D, Live2D, or 3D characters on Windows, with runtime support for expressions, motion, look-at, and interaction. Character models and assets must be supplied and licensed separately.
- 💬 **AI character chat** — Configure a model service to chat with characters in the desktop app and manage character and chat settings.
- 🧠 **Character memory and persona** — Character / group memory, Neural Persona graphs, relationships, and social context provide different foundations for ongoing interactions; integration is still progressing.
- 👥 **Multi-character and group interaction** — Modules for group topics, shared memory, character relationships, and social timelines support exploration of shared character environments.
- 🛠️ **Agent tool execution** — The Agent Runtime plans and calls registered tools, with permission checks, result assessment, and recovery-related paths; end-to-end execution is still being validated.
- 🖥️ **Windows desktop actions** — Interact with the desktop through screen / window observation, mouse and keyboard input, app launching, and local-file tools; behavior depends on system conditions and integration status.
- 🔌 **MCP and Skill extensions** — Connect external MCP tool servers and manage Skill packages; policy, trust, and sandbox infrastructure are being improved.
- 🔊 **Voice and character presentation** — Includes a local voice runtime, TTS / Browser TTS, and expression-related modules; specific voice services require user configuration.
- 🧩 **Runtime integrations** — Includes a Unity Bridge, DeepSeek Harness Bridge, and ComfyUI Workflow settings entry to extend runtime and workflow options.

> **Current stage:** Early open source; some capabilities are still being integrated. See [project status](#project-status) for subsystem details.

> [!IMPORTANT]
> Apache-2.0 applies to project source code; the character illustration in the app icon is excluded. The repository does not provide a library of character models, animations, or voice assets for unrestricted redistribution. Read the [asset licensing notes](./ASSET_LICENSES.md) and [public export boundary](./PUBLIC_EXPORT.md) first.

<details>
<summary>📚 Contents</summary>

- [Project Goal](#project-goal)
- [Feature Overview](#feature-overview)
- [Core Systems](#core-systems)
  - [Agent Runtime](#agent-runtime)
  - [Windows Computer Use](#windows-computer-use)
  - [Characters, Memory, and Group Interaction](#characters-memory-and-group-interaction)
  - [Desktop Pets and Character Presentation](#desktop-pets-and-character-presentation)
  - [MCP, Skills, and Integrations](#mcp-skills-and-integrations)
- [Architecture and Tech Stack](#architecture-and-tech-stack)
- [Quick Start](#quick-start)
- [Project Status](#project-status)
- [License and Assets](#license-and-assets)
- [Contributing and Support](#contributing-and-support)

</details>

## 🧭 Project Goal

Many AI companion apps keep interaction inside a single chat. AI Pets Hub explores a different desktop experience: characters can have ongoing context and visual presentation; agents can call tools within runtime and permission boundaries; and multiple characters can share group activity and relationship state.

```text
Characters and chat ── Memory / persona / relationships
          │                         │
          └──── Agent Runtime ────── Tools / MCP / Computer Use
                          │
               Desktop, voice, and presentation
```

These capabilities are being built as composable systems. The long-term direction is an extensible AI Runtime World, rather than a single chat flow that has to own every capability. This direction is still being implemented; actual availability depends on the current code and project status.

## 🧩 Core Systems

### 🤖 Agent Runtime

The project includes its own TypeScript Agent Runtime. The source has components for session entry, context and planning, tool execution, result assessment, and follow-up handling:

```text
Request / session
       ↓
Context and planning
       ↓
Permission and preflight checks
       ↓
Tool registry and execution
       ↓
Observation, evidence, and result assessment
       ↓
Verification, recovery, or replanning
```

The design distinguishes “the tool call returned successfully” from “the requested state was achieved.” For example, a successful app-launch command alone does not prove that the intended window opened. The code therefore also includes window / visual-target verification, action evidence, result assessment, recovery, and replanning modules.

The runtime also contains tool schemas, permission routing, and execution lifecycle controls. These modules continue to evolve; whether a particular Agent entry point uses the full path depends on the feature. Example source files include `src/agent/agentOrchestrator.ts`, `src/agent/agentPlanner.ts`, `src/agent/agentToolRegistry.ts`, and `src/agent/agentRuntimeExecutor.ts`.

#### What the Agent Execution Path Covers

- **Tool registration and input constraints:** tools expose descriptions and input schemas through a shared registry for runtime selection and dispatch.
- **Permission and policy:** permission routing and policy components participate in preflight checks so model output is not treated as a trusted system command.
- **Desktop observation:** screen and window tools provide environment information before and after an action; target resolution and visual verification help identify the intended target and check the result.
- **Evidence and assessment:** result-assessment modules use tool results and observation data to evaluate whether the intended state was reached, rather than relying only on a process exit code.
- **Failure handling:** cancellation, timeouts, recovery, follow-up, and replanning paths exist in the runtime. The exact behavior depends on the entry point and executor.

Common entry points and implementations live in `src/agent/` and `src/agent/runtime/`. The architecture is still being refactored and integrated, so this diagram describes the design and code components; it does not mean every user request follows the exact same path.

### 🖥️ Windows Computer Use

Desktop actions are organized around observing, locating, acting, and checking. The repository contains code paths for screen capture, region and window handling, desktop input, app launching, local file operations, and visual-target verification.

```text
Observe desktop → resolve target → check permissions → act
       ↑                                               ↓
       └──── verify result ← collect evidence ← observe again
                                  └→ recover / replan
```

These capabilities let an Agent interact with a local desktop environment, and require the runtime to handle permissions, cancellation, failures, and uncertain outcomes. Actual behavior depends on the Windows session, target application, and integration status; it is not a guarantee for arbitrary desktop tasks.

### 🧠 Characters, Memory, and Group Interaction

Memory-related code includes more than chat history. It also includes character and group memory, knowledge / retrieval interfaces, and subsystems for neural-persona graphs, relationship state, and social timelines. The design aims to let longer-term context inform later interactions and to provide structure for shared group state between characters.

Group-related modules include group topics, group memory, relationship policies, social events, and trends. They are still being connected: the presence of an infrastructure component does not mean it is already used throughout every conversation, learning, or character-behavior flow.

#### What Neural Persona Includes

Code under `src/character-graph/neural-persona/` covers persona nodes and hierarchy, node generation, graph layout and exploration, relationship analysis, semantic retrieval, and tagging. It also includes feedback ledgers, learning proposals, application / reversal paths, and persistence. Additional modules cover provider-data policy and response-quality A/B flows.

The goal is to organize long-term character information into structures that can be explored and maintained. Integration with cognition and chat is ongoing; the presence of graph modules does not mean automatic memory is fully enabled.

#### What Group Interaction Includes

Group-related code goes beyond a group-chat entry point. It includes group topics, shared memory, social groups, directed character relationships, relationship behavior policies, social timelines, and trends. Group-memory modules also cover conflict detection, evidence scope, review, and readiness logic. The long-term direction is to use this state in later interactions; connections and consistency between modules are still being validated.

### 🎭 Desktop Pets and Character Presentation

- **2D / Live2D:** runtime modules cover model loading, Cubism Core integration, expression discovery and binding, pointer look, and interaction control.
- **3D / VRM:** built with Three.js / React Three Fiber, with modules for VRM loading, scene mounting, expression and look-at control, motion, and reactions.
- **Unity Bridge:** the repository contains Unity Runtime / Bridge services and protocol code as another runtime connection path.

These are runtime capabilities; the repository does not thereby include models, motion clips, textures, or voice assets that can be freely redistributed. Check the source and license of any assets you use.

The runtimes also have distinct responsibilities. Live2D modules cover Runtime Profiles, the Cubism Core loader, expression discovery / binding, presentation priority, pointer look, and interaction control. The 3D / VRM path covers asset loading, scene mounting, expression and look-at controls, drag state, external motion clips, and reactions. The Unity Bridge provides service- and protocol-level connection code.

### ✨ Expressions and Life Companion

**Expression Library** modules cover expression categories, asset import and mutation, review queues, settings, semantics, and the system asset catalog. The reply-expression runtime connects AI replies to character presentation. Asset sources and permissions still need to be checked individually.

**Life Companion** is infrastructure for persistent character state and proactive interaction. Source modules include Affection, Hunger, Mood, startup greetings, proactive / random interactions, desktop-activity awareness, quiet hours, scheduling, and growth control. Triggers depend on settings, time windows, and cooldowns, and are still being connected to character behavior.

### 🔌 MCP, Skills, and Integrations

**MCP:** the repository contains modules for server configuration, a Stdio client, session pooling, tool calls, health diagnostics, argument validation, policy, and cancellation. The Agent side also has external MCP bridge and policy-related code.

Other implementations cover server compatibility, environment preflight, call history, soak / readiness checks, risk summaries, and execution receipts. Third-party server behavior and compatibility depend on those servers; the runtime still has to handle connection errors and validate tool arguments.

**Skills and extensions:** source modules cover the Skill Registry, package import and installation, lifecycle, runtime policy, trust evidence, signature verification, update / rollback, and sandbox-related infrastructure. The external extension ecosystem and Marketplace release workflow are still under development and validation.

The Skill design uses manifests and package metadata to describe extensions, with host-side execution scopes, trust information, permission grants, and sandbox boundaries governing runtime behavior. Signature, update, rollback, and Marketplace-readiness components show that a package lifecycle is being built; they do not mean a mature third-party marketplace is already available.

**Other integrations:** the repository also contains a local voice runtime, a DeepSeek Harness Bridge, and a ComfyUI Workflow settings entry, among other code. These may require external software or user-supplied credentials. A settings entry does not mean the full workflow is stable and ready to use.

### 🔊 Voice and Other Integrations

Voice code includes a local voice runtime, voice library, TTS / Browser TTS, voice tools, audio cache, and background workers. Available services depend on the local environment and configuration; the repository does not provide cloud credentials or every backend dependency.

DeepSeek Harness-related code includes a runtime service, process runner, capability bridge / plugin, profile, and runtime adapter. ComfyUI currently appears mainly as a Workflow settings entry and integration direction. These capabilities may need additional runtimes or credentials, and their maturity varies.

### 🗂️ Repository Map

```text
electron/                 Electron main-process services and desktop integration
src/agent/                Agent sessions, planning, tools, execution, and verification
src/pet-runtime/          2D / Live2D / 3D character runtimes
src/social-group/         Group-interaction types and projections
src/social-timeline/      Social-event timeline
src/social-trend/          Relationship trends and evidence-related logic
src/character-graph/      Character graphs and Neural Persona
src/voice/                Renderer-side voice and playback logic
docs/                     Chinese and English project and maintenance notes
scripts/                  Smoke checks, build, and maintenance scripts
```

This is a navigation aid; a directory does not imply that every capability in it is integrated as a product feature. See the [project overview](./docs/project-overview.en.md) for a more complete module list.

## 🏗️ Architecture and Tech Stack

The application uses an Electron desktop host with a React / TypeScript renderer. The main process handles windows and IPC, desktop capture, file access, app launching, and some runtime services. Renderer features include chat, character interfaces, memory and persona views, extension controls, and character presentation. Agent, memory, relationship, expression, and Runtime World logic live in their respective modules.

```text
Electron Main Process              React / TypeScript Renderer
Windows and IPC                    Chat, character, and settings UI
Files / desktop input / capture     Live2D / 3D presentation
Voice / MCP / Skill services        Memory, persona, group, and Agent UI
            └────────── IPC / Runtime Bridge ──────────┘
                                 │
                        Core Runtime Modules
              Agent · Memory · Cognition · Social · Pet
```

Main technologies and dependencies:

- Electron 37 and Electron Builder
- React 19, TypeScript 5.8, and Vite 6
- Three.js, React Three Fiber, and `@pixiv/three-vrm`
- PixiJS 6 and `pixi-live2d-display`
- Project-built TypeScript Agent and MCP runtime components

See [`package.json`](./package.json) and [`package-lock.json`](./package-lock.json) for exact dependency ranges. The [English project overview](./docs/project-overview.en.md) has a more complete architecture map.

## 🚀 Quick Start

### Requirements

- A Windows desktop environment
- Node.js, npm, and Git
- A compatible model service and credentials configured by you for model-backed chat

This README does not claim a verified minimum Node.js version. Choose a version compatible with the current dependencies and check installation errors. Desktop capture, input, and some integrations require Windows.

### Clone, install, and launch

```powershell
git clone https://github.com/JingXuan-Zun/AI-Pets-Hub-public.git
cd AI-Pets-Hub
npm ci
npm run desktop
```

`npm run desktop` builds the renderer and then launches Electron. To work on the renderer UI alone, run:

```powershell
npm run dev
```

### Common commands

```powershell
npm run lint            # TypeScript type check
npm run build           # Build the renderer
npm run smoke:agent:p0  # Focused Agent smoke checks
npm run dist:win        # Windows distribution build flow
```

The project also has checks and smoke scripts for Agent, Neural Persona, MCP, Skills, and desktop runtime subsystems. Refer to [`package.json`](./package.json) for their current names and arguments. Configure a model provider in the app after launch. Never put real credentials in the repository or commit them to Git.

## 🚧 Project Status

The table distinguishes “source infrastructure exists” from “end-to-end flow is still being integrated.” A single “done” label would be misleading because modules in the same subsystem can have different levels of maturity.

| Subsystem | Current implementation scope | Status notes |
| --- | --- | --- |
| Electron desktop host | Windows, IPC, desktop capture, input, app launching | Desktop foundation exists; individual tools depend on the Windows environment |
| Chat and character UI | Chat, character settings, model configuration surfaces | Core UI path exists; requires a model service configured by the user |
| Agent Runtime | Sessions, planning, tool registry, permission routing, execution, result assessment | Core modules exist; production paths continue to be refactored and validated |
| Computer Use | Screen and window observation, target handling, input, verification | End-to-end reliability is still under validation |
| Memory / Knowledge | Character and group memory, knowledge and retrieval interfaces | Integration varies across subsystems |
| Neural Persona | Persona nodes, graph, relationships, feedback, persistence | Data and graph foundations exist; cognition / chat integration is ongoing |
| Multi-Agent / Social | Group topics and memory, relationships, timelines, trends | Consistency of multi-character behavior is still being validated |
| 2D / Live2D | Cubism loading, expression binding, pointer look, interaction | Runtime foundations exist; asset licensing is separate from this code description |
| 3D / VRM | Three.js scene, VRM loading, expression, look-at, motion modules | Runtime foundations exist; compatible user-provided assets are required |
| Unity Bridge | Unity Runtime / Bridge services and protocols | Connection code exists; integration requires a matching Unity side |
| Life Companion | Mood / affection, proactive interaction, quiet hours, desktop awareness | Some behavior depends on settings and scheduling; integration is ongoing |
| MCP | Configuration, Stdio, session pool, diagnostics, policy, argument validation | Host infrastructure exists; third-party compatibility varies |
| Skills / Sandbox | Package import, trust, signatures, policy, sandbox components | Ecosystem and distribution flows are still being validated |
| Voice | Local voice, TTS / Browser TTS, playback, cache | Requires external services or local backend configuration |
| DeepSeek Harness | Runtime service, runner, capability bridge | Integration code exists; external runtime is still required |
| ComfyUI | Workflow settings entry | An entry point does not mean the generation flow is complete and stable |

This status is based on the source tree. It is not a certification of release quality or security. Features may change, and some flows are incomplete.

### Current Development Focus

- Stabilize the end-to-end path across Agent sessions, execution, observation, verification, and recovery.
- Connect Neural Persona, longer-term context, character relationships, and actual conversation behavior incrementally.
- Validate group memory, relationship state, and multi-character interaction in the shared runtime.
- Improve trust, sandboxing, distribution, and maintenance workflows for Skills and extensions.
- Improve public developer documentation and cross-module integration checks.

Do not infer that a capability is enabled in every app entry point or stable just because its source module exists.

## 📄 License and Assets

- Project source code is licensed under the [Apache License 2.0](./LICENSE).
- The character illustration in the application icons is creator-owned and **excluded from the Apache-2.0 grant**. See [ASSET_LICENSES.md](./ASSET_LICENSES.md).
- Third-party dependencies and user-provided character models, animation, audio, and other assets remain subject to their own licenses.
- See [PUBLIC_EXPORT.md](./PUBLIC_EXPORT.md) for the scope and checks for public exports.

Before copying, modifying, or redistributing source, builds, or assets, confirm the license that applies to each item.

## 🤝 Contributing and Support

Before contributing or publishing, follow the [privacy checklist](./docs/PUBLIC_PRIVACY_WORKFLOW.md) to protect local data and commit email addresses.

Issues and pull requests are welcome. For larger architectural changes, open an issue first to discuss the design. When reporting a problem, include as much of the following as possible:

- Windows version and project commit / release
- Reproduction steps, expected behavior, and actual behavior
- Relevant logs or screenshots (remove API keys, tokens, cookies, personal paths, and user data first)
- For Agent issues, the task description, tool-call sequence, and shareable verification results

For security issues, use GitHub private vulnerability reporting if it is enabled for this repository. Do not publish exploitable details in a public issue before maintainers have had a chance to respond.

---

For the complete subsystem inventory, development and check scripts, and roadmap direction, see the [English project overview](./docs/project-overview.en.md).
