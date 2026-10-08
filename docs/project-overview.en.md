# AI Pets Hub

> A source-available desktop AI pet and AI Runtime World platform for building intelligent characters, persistent memory, multi-agent interaction, computer-use agents, and extensible AI systems.
>
> AI Pets Hub brings AI characters, memory, neural personality, multi-agent interaction, Agent Runtime, Computer Use, MCP, Skills, extensions, voice, and 2D / Live2D / 3D character runtimes into one extensible desktop environment.

[中文 README](../README.zh-CN.md)

> **Project Status: Early Public Development / Active Development**
>
> AI Pets Hub is actively developed and continuously refactored. The current source tree already contains a large number of working runtime, agent, memory, character, MCP, skill, and desktop subsystems, but different parts of the platform are at different levels of stability. Some features are still being integrated, tested, or experimentally developed.

---

## Contents

- [What is AI Pets Hub?](#what-is-ai-pets-hub)
- [Why AI Pets Hub?](#why-ai-pets-hub)
- [Core Capabilities](#core-capabilities)
- [Agent Runtime](#agent-runtime)
- [Computer Use / Runtime World](#computer-use--runtime-world)
- [Memory / RAG / Neural Persona](#memory--rag--neural-persona)
- [Multi-Agent / Group Chat](#multi-agent--group-chat)
- [Character / Pet Runtime](#character--pet-runtime)
- [Life Companion](#life-companion)
- [MCP](#mcp)
- [Skills and Extension System](#skills-and-extension-system)
- [DeepSeek Harness](#deepseek-harness)
- [Voice](#voice)
- [Expression and Visual Behavior](#expression-and-visual-behavior)
- [ComfyUI](#comfyui)
- [Architecture](#architecture)
- [Technology Stack](#technology-stack)
- [Current Status](#current-status)
- [Quick Start](#quick-start)
- [Development and Testing](#development-and-testing)
- [Public Repository Boundary](#public-repository-boundary)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [Bug Reports](#bug-reports)
- [Security](#security)
- [License](#license)

---

# What is AI Pets Hub?

AI Pets Hub started from a simple idea:

**What if an AI character could actually live on the desktop?**

The project is intentionally not limited to a single character or a chat window.

The current direction is to build an extensible **AI Pet Platform / AI Runtime World** where characters, agents, memory, tools, social systems, visual runtimes, and third-party extensions can operate together.

```text
                    AI Pets Hub
                         │
        ┌────────────────┼────────────────┐
        ↓                ↓                ↓
     AI Pets           Agents        Runtime World
        │                │                │
        ↓                ↓                ↓
   Persona / Voice    Tools / MCP     Computer Use
   Memory / Social    Policy / Skill   Observe / Act
   Live2D / 3D        Recovery         Verify / Recover
        │                │                │
        └────────────────┼────────────────┘
                         ↓
              Memory / Neural / Plugin
                         ↓
                 AI Runtime World
```

A character can have its own:

- Personality
- Model configuration
- Conversation history
- Long-term memory
- Knowledge base
- Relationship state
- Tools
- Permissions
- Voice
- Expressions and actions
- 2D / Live2D / 3D representation

Multiple characters can then exist in the same environment and participate in group conversations, relationships, memories, tasks, and coordinated behavior.

Agents can additionally use tools, interact with the local computer, observe execution results, and recover from failures.

The long-term goal is not simply:

```text
AI + Pet
```

but:

```text
Character
   +
Memory
   +
Agent
   +
Social
   +
Tools
   +
Computer Use
   +
Plugins
   +
Visual Runtime
       ↓
AI Runtime World
```

---

# Why AI Pets Hub?

Many AI companion applications ultimately reduce the interaction model to:

```text
User → Model → Reply
```

AI Pets Hub explores a larger loop:

```text
User
 ↓
Character
 ↓
Persona / Memory / Relationship / Knowledge
 ↓
Cognition / Agent
 ↓
Tools / Runtime
 ↓
Real Environment
 ↓
New Experience
 ↓
Memory / State Update
```

The goal is for an AI character to become a persistent desktop entity with state, behavior, tools, and visual presence rather than simply a model wrapped in a chat interface.

At the platform level, characters, agents, tools, and extensions should be able to reuse host services instead of rebuilding independent model, permission, and configuration systems for every feature.

---

# Core Capabilities

The current source tree contains the following major systems:

| Area | Current source status |
|---|---|
| AI Chat | Core chat modules present; actively refined |
| Multiple Models / Providers | Model protocol and provider architecture present |
| 2D / Live2D | Runtime, model support, expressions, and presentation modules present |
| 3D / VRM | Three.js / VRM runtime present |
| Unity Runtime | Unity bridge and runtime services present |
| Agent Runtime | Extensive execution, policy, verification, and recovery layers present; actively refactored and validated |
| Computer Use | Desktop observation, windows, input, coordinates, and application-launch tools present |
| Tool Registry | Tool registry and input schema present |
| Permissions | Agent permission and MCP policy systems present |
| Observation / Evidence | Visual observation, evidence, result assessment, and verification modules present |
| Recovery | Recovery, replan, and follow-up runtime modules present |
| Memory | Chat, character, and group-memory systems present |
| RAG / Knowledge | Related memory / retrieval / runtime components present |
| Neural Persona | Graph, nodes, relationships, learning, feedback, and persistence systems present |
| Character Relationships | Directed relationship and behavior-policy systems present |
| Group Chat | Group memory, topics, and social interaction infrastructure present |
| Social Timeline / Trends | Social event timeline and relationship-trend infrastructure present |
| Life Companion | Proactive interaction, affection, hunger, mood, and desktop-awareness systems present |
| MCP | Server, Stdio, policy, history, diagnostics, and readiness infrastructure present |
| Skills | Registry, packages, import, installation, runtime, trust, and sandbox infrastructure present |
| Plugin / Extension Hub | Extension and external-skill / marketplace implementation present; still being refined |
| DeepSeek Harness | Runtime service, runner, capability bridge, and adapter code present |
| Voice | Local voice runtime, TTS, and voice tools present |
| Expression System | Expression library, reply expressions, and asset management present |
| ComfyUI | Workflow integration entry exists in settings |
| Runtime World | Core, controller, director, systems, and Agent bridge present |
| Windows Desktop | Electron host, IPC, windows, desktop input, and app-launch infrastructure present |

**Important:** the presence of a subsystem in source code does not mean every workflow is production-stable. AI Pets Hub is still undergoing integration and regression testing.

---

# Agent Runtime

AI Pets Hub uses its own TypeScript Agent Runtime rather than being an application wrapper around LangChain, LangGraph, CrewAI, or the OpenAI Agents SDK.

The current source tree contains several distinct layers:

```text
Chat Entry / Command
        ↓
Agent Context / Planner
        ↓
Agent Session / Production Session
        ↓
Agent Orchestrator
        ↓
Policy / Permission
        ↓
Tool Registry
        ↓
Runtime Executor
        ↓
Observation / Evidence
        ↓
Result Assessment
        ↓
Verification / Recovery / Replan
```

Representative source files include:

- `src/agent/agentCore.ts`
- `src/agent/agentOrchestrator.ts`
- `src/agent/agentPlanner.ts`
- `src/agent/agentProductionSession.ts`
- `src/agent/agentToolRegistry.ts`
- `src/agent/agentPermissionRouter.ts`
- `src/agent/agentRuntimeCore.ts`
- `src/agent/agentRuntimeExecutor.ts`
- `src/agent/agentResultAssessment.ts`
- `src/agent/agentVisualTargetVerification.ts`
- `src/agent/runtime/*`

## Agent design principles

### 1. Tool Calling

Agents can select and execute different capabilities through a unified tool registry.

### 2. Permission / Policy

High-risk operations are not intended to be passed directly from model output to the operating system. They go through policy and permission boundaries.

### 3. Observation / Evidence

For desktop operations, the runtime cares not only about whether an action was issued, but also about whether there is evidence that the target state actually changed.

### 4. Verification

Execution can be followed by observation and result verification.

### 5. Recovery / Replanning

When execution does not produce the expected result, the runtime contains recovery, follow-up, and replanning paths.

### 6. Execution Controls

The Agent Runtime includes lifecycle controls for cancellation, approvals, repeated actions, and abnormal execution paths.

---

# Computer Use / Runtime World

Runtime World is one of the major directions of AI Pets Hub.

The goal is to allow agents to observe and operate the Windows desktop rather than limiting them to abstract API calls.

The current source tree contains:

- Screen capture
- Region selection
- Window identification
- Window target resolution
- UI Automation-related paths
- Mouse / keyboard input
- Coordinate-space handling
- Coordinate auditing
- Desktop icon classification and organization
- Application launching
- Local file operations
- Browser search capabilities
- Game screen analysis tools
- Visual target verification
- Action evidence
- Recovery / replanning

A representative loop is:

```text
Observe
   ↓
Target Resolution
   ↓
Plan
   ↓
Permission / Preflight
   ↓
Action
   ↓
Observation
   ↓
Evidence
   ↓
Verification
   ↓
Success / Recovery / Replan
```

A core principle is:

> **Successful command execution is not the same thing as successful task completion.**

For example, launching an application successfully does not necessarily mean that the target window has appeared or reached the expected state.

The runtime therefore contains window identity, observation evidence, result assessment, recovery, and final verification layers.

---

# Memory / RAG / Neural Persona

AI Pets Hub does not treat memory as simply storing conversation history.

The source tree contains multiple memory and character-cognition subsystems.

```text
Conversation
     ↓
Working Context
     ↓
Memory / Knowledge
     ↓
Retrieval
     ↓
Persona / Cognition
     ↓
Decision
     ↓
Behavior
     ↓
New Memory
```

## Neural Persona

`src/character-graph/neural-persona/` contains a substantial neural-persona system, including:

- Persona nodes
- Node generation
- Node hierarchy
- Graph layout
- Graph physics
- Graph explorer
- Relationships
- Semantic retrieval
- Tagging
- Feedback ledger
- Learning proposals
- Learning application
- Learning reversal
- Persistence
- Provider data policy
- Response-quality A/B workflows

The purpose is to represent long-term character information in a more structured form instead of relying entirely on a single large persona prompt.

The current direction is:

```text
Persona
 ├── Memory
 ├── Knowledge
 ├── Relationship
 ├── Experience
 ├── Behavioral Information
 └── Learning / Feedback
```

This subsystem remains under active development and validation.

---

# Multi-Agent / Group Chat

AI Pets Hub supports multiple characters existing in the same environment and participating in group interactions.

The source tree contains:

- Group Memory
- Group Topic
- Social Group
- Social Timeline
- Social Trend
- Directed Relationship
- Relationship Behavior Policy
- Group Memory Conflict Detection
- Group Memory Evidence Scope
- Group Memory Review / Readiness

Characters can maintain independent relationships and group-level state.

The intended interaction model is:

```text
                  User
                   │
          ┌────────┼────────┐
          ↓        ↓        ↓
        Agent A  Agent B  Agent C
          │        │        │
          └────────┼────────┘
                   ↓
             Shared Context
                   ↓
        Group Memory / Social State
                   ↓
             New Interaction
```

The long-term goal is not simply to have several models take turns speaking. It is to build a persistent multi-agent environment with differentiated characters, relationships, memory, and behavior.

---

# Character / Pet Runtime

The character runtime lives primarily under `src/pet-runtime/` and contains multiple presentation backends.

## Live2D

The source includes:

- Live2D runtime profiles
- Cubism Core loading
- Model support
- Expression discovery
- Expression binding
- Presentation priority
- Runtime mapping
- Pointer look
- Interaction controllers

## 3D / VRM

The project uses Three.js / React Three Fiber and includes:

- VRM asset loading
- 3D scenes
- Runtime mounting
- Expression controllers
- Look-at controllers
- Interaction controllers
- Drag motion state
- External motion clips
- Reaction runtime

## Unity

Both Electron and renderer-side code include Unity runtime / bridge infrastructure for another possible character backend.

## Expressions and Actions

The project also contains an independent Expression Library and reply-expression runtime for connecting text / AI behavior with character presentation.

---

# Life Companion

Beyond reactive chat, the project contains a Life Companion subsystem.

The current source includes:

- Affection
- Hunger
- Mood
- Startup greeting
- Proactive interaction
- Random interaction
- Desktop activity awareness
- Quiet hours
- LLM text prompts
- Interaction scheduling
- Growth controller

This gives a character a persistent desktop state instead of limiting its existence to moments when the user opens a chat window.

Some proactive behaviors are disabled by default or controlled by cooldowns and quiet-hour settings.

---

# MCP

The project contains substantial MCP infrastructure.

Electron-side components include:

- MCP configuration service
- MCP Stdio client
- Session pool
- Tool call runner
- Server compatibility
- Server health
- Diagnostics
- Environment preflight
- History
- Policy
- Argument schema validation
- Cancellation
- Soak / readiness checks

The Agent layer includes an external MCP bridge, registry, policy, risk summary, and execution receipt components.

MCP tools remain subject to the platform's permission and runtime boundaries.

---

# Skills and Extension System

AI Pets Hub is not limited to built-in tools. The current source tree contains a substantial Skill / Extension infrastructure.

It includes:

- Skill manifests
- Skill registry
- Package metadata
- Archive import
- Package installation
- Package lifecycle
- Installed package registry
- Execution scope
- Runtime policy
- Trust evidence
- Signature verification
- Trusted signature keys
- Package updates
- Rollback
- External loader boundaries
- External permission grants
- Sandbox supervisor
- Sandbox isolation evidence
- Marketplace readiness
- Publisher catalog

This is one of the foundations for the platform direction.

The long-term goal is to let third-party developers extend:

- Agent capabilities
- Tools
- Character capabilities
- Runtime capabilities
- Voice
- Visual systems
- Memory
- External services

without modifying the host application's core implementation.

The plugin / Skill marketplace is still under active development and validation.

---

# DeepSeek Harness

The current source tree contains DeepSeek Harness integration code, including:

- Harness runtime service
- Process runner
- Capability bridge
- Capability plugin
- Profile
- Agent library
- Runtime adapter / transport

The direction is to allow an external or specialized Agent / Harness implementation to become a composable runtime capability while continuing to use host-level models, tools, permissions, and runtime boundaries.

This remains an actively developed platform integration.

---

# Voice

The project contains local voice infrastructure including:

- Local voice runtime
- Voice library
- TTS
- Browser TTS
- Voice tools
- Audio utilities
- Audio cache
- Voice runtime worker
- Generated-audio result handling

The voice layer is designed as an independent capability that can be combined with characters, agents, chat, and presentation systems.

---

# Expression and Visual Behavior

AI Pets Hub contains an independent Expression Library system for managing character presentation assets and AI-driven expression behavior.

Related components include:

- Expression Library
- Expression Categories
- Expression Review Queue
- Expression Settings
- Reply Expression Runtime
- Expression Semantics
- Asset Import / Mutation
- System Expression Catalog

The long-term direction is to allow Agent, social, emotional, and dialogue systems to jointly drive character presentation.

---

# ComfyUI

The settings layer currently contains a ComfyUI Workflow integration entry.

The intended direction is to connect external generation workflows with conversations and character context, for example generating scene content while preserving character references and host context.

This remains an active integration area; the presence of a workflow entry does not imply that every generation workflow is production-ready.

---

# Architecture

AI Pets Hub currently uses an Electron + React + TypeScript desktop architecture.

```text
Electron Main Process
│
├── Window / IPC
├── Local File System
├── Desktop Input
├── Screen Capture
├── App Launcher
├── Voice Runtime
├── MCP Runtime
├── Skill / Sandbox Runtime
├── DeepSeek Harness Runtime
├── Unity Bridge
└── Persistence

Renderer
│
├── Chat
├── Character / Pet UI
├── Live2D
├── 3D / VRM
├── Settings
├── Agent UI
├── Memory / Neural UI
├── Group Chat
├── Plugin / Skill UI
├── Voice UI
└── Runtime World UI

Core Runtime
│
├── Agent
├── Memory
├── Cognition
├── Relationship
├── Social Group
├── Expression
├── Pet Runtime
└── Runtime World
```

---

# Technology Stack

The current source primarily uses:

- Electron 37
- React 19
- TypeScript 5.8
- Vite 6
- Tailwind CSS 4
- Three.js
- React Three Fiber
- `@pixiv/three-vrm`
- PixiJS 6
- `pixi-live2d-display`
- Electron Builder
- Node.js
- Custom MCP runtime infrastructure
- Custom TypeScript Agent Runtime

Exact dependency versions are defined in `package.json`.

---

# Current Status

AI Pets Hub is currently **Early Public Development / Active Development**.

The source tree already contains a substantial number of runtime, validation, and testing components, but the project has not yet consolidated every subsystem into a fully production-stable release.

### Relatively mature / substantial implementations

- Electron desktop host
- Core AI chat path
- 2D / Live2D runtime
- 3D / VRM runtime
- Agent tool registry
- Agent permission / policy
- Desktop observation / input
- MCP infrastructure
- Neural Persona data and graph systems
- Group Memory infrastructure
- Character Relationship infrastructure
- Life Companion infrastructure
- Skill package infrastructure

### Actively being integrated / validated

- Agent production runtime
- Agent V3 / runtime transition paths
- End-to-end Computer Use reliability
- Observation → Evidence → Verification → Recovery
- Neural Persona → Cognition → Chat
- Group Memory → Social Behavior
- Relationship → Character Behavior
- Skill → Sandbox → Runtime
- Plugin / Marketplace → Host Runtime
- DeepSeek Harness → Agent Runtime
- Multi-character director / expression systems
- Voice → Character behavior
- Runtime World → Agent / Character

### Still needs continued work

- Comprehensive cross-module automated integration tests
- Third-party extension ecosystem
- Stable Marketplace publishing workflows
- More complete installation / upgrade / rollback experience
- Performance and stability at larger multi-agent scale
- More complete public developer documentation

> These statuses are based on the current source snapshot and should not be interpreted as production certification.

---

# Quick Start

## Requirements

Recommended:

- Windows
- Node.js
- npm
- Git

## Install

```powershell
npm install
```

## Development

The current repository exposes a Vite development script:

```powershell
npm run dev
```

To launch the Electron desktop environment:

```powershell
npm run desktop
```

The `desktop` script builds the renderer and then launches Electron.

## Type checking

```powershell
npm run lint
```

## Build

```powershell
npm run build
```

## Windows packaging

The project includes a Windows portable build script:

```powershell
npm run dist:win
```

For production builds and Marketplace-related checks, see the scripts in `package.json`.

---

# Configuration

The repository provides `.env.example`.

The current example configuration is mainly intended for local development and selected feature flags.

**Do not commit API keys, provider credentials, private MCP configuration, or other secrets.**

Local files such as `.env.local` are development-only configuration and should not be published.

---

# Development and Testing

The project already contains a large number of smoke tests covering Agent, Neural Persona, MCP, Skills, Runtime, and desktop interaction.

Examples:

```powershell
npm run check:agent-runtime-architecture
npm run check:agent-runtime-retirement
npm run smoke:agent:p0
npm run smoke:neural-persona:contract
npm run smoke:neural-persona:graph
npm run smoke:neural-persona:persistence
```

Agent user flows also have a dedicated combined smoke workflow:

```powershell
npm run smoke:agent:user-flows
```

The test suite is expected to evolve along with the Agent Runtime and other subsystem boundaries.

For cross-module bugs, contributors should record:

1. Reproduction steps
2. Environment
3. Logs
4. Agent Trace / Evidence when applicable
5. Expected state
6. Actual state
7. Regression result after the fix

---

# Public Repository Boundary

The repository includes `PUBLIC_EXPORT.md`, which documents the public-source boundary.

The public version should not contain:

- Source-workspace Git history, remote configuration, or local credentials
- API keys / provider credentials
- Private MCP configuration
- User profiles
- Chat history
- Private memory data
- Private character definitions
- Private model / audio / animation assets
- Local model runtimes
- Python environments
- Generated build output
- Internal temporary diagnostics

Before publishing, check:

```powershell
git status
git diff --cached
```

and run an appropriate secret scanner.

**Do not use `git add -f` to force-add local files that should remain ignored.**

---

# Roadmap

## 1. Runtime Stabilization

- Further separate Agent Session / Orchestrator / Policy / Runtime responsibilities
- Improve Tool Result and Evidence consistency
- Improve Verification / Recovery
- Improve cancellation, timeout, and failure semantics
- Reduce cross-module state contamination

## 2. Cognitive Integration

- Connect Neural Persona more deeply with Cognition
- Make long-term memory influence decisions more directly
- Improve RAG and character-context composition
- Expand feedback, learning, and relationship state

## 3. Multi-Agent World

- Stronger group scheduling
- Group tasks
- Relationship-driven behavior
- Social timelines
- Multi-character direction and presentation

## 4. Extension Ecosystem

- Skill SDK
- Plugin / Extension Hub
- Marketplace
- Third-party developer APIs
- Sandbox / Trust / Signature systems
- Agent / Harness composition

## 5. AI Runtime World

The long-term goal is a continuously extensible desktop AI world:

```text
        Characters
            │
      ┌─────┼─────┐
      ↓     ↓     ↓
    Memory Social Agent
      │     │     │
      └─────┼─────┘
            ↓
        Runtime
            ↓
     Computer / Apps
            ↓
       New Experiences
            ↓
        Memory Update
```

---

# Contributing

AI Pets Hub is gradually opening development to the community.

Contributions are welcome in:

- Agent Runtime
- Computer Use
- Memory / RAG
- Neural Persona
- Multi-Agent / Group Chat
- Character Relationships
- Live2D / 3D
- Runtime World
- MCP
- Skills / Plugins
- Voice
- UI / UX
- Performance
- Testing
- Documentation

For larger architectural changes, please discuss the design through an Issue or Discussion before submitting a large pull request.

Before submitting code, please make sure that:

- The change has a clear boundary
- Public interfaces are not accidentally broken
- Callers have been reviewed
- Error / cancellation / timeout paths are considered
- Relevant tests have been run
- No credentials or private configuration are included

---

# Bug Reports

When opening an issue, please include:

- Windows version
- Project commit / release version
- Node.js version
- Model provider when relevant
- Reproduction steps
- Expected behavior
- Actual behavior
- Logs
- Screenshot / video when useful
- Whether the issue is consistently reproducible

For Agent issues, please include the task description, tool execution path, and verification result when possible.

---

# Security

AI Pets Hub includes local file access, desktop input, application launching, screen observation, MCP, Skills, and Runtime capabilities. Security boundaries are therefore an important part of the project.

Do not grant unnecessary permissions to untrusted Skills, Plugins, or Tools.

Never commit:

- API keys
- Access tokens
- Cookies
- Private MCP configuration
- Private character data
- User data
- Local credentials

For security vulnerabilities, use GitHub's private vulnerability reporting if it is enabled for this repository. If it is unavailable, contact the maintainers through the GitHub profile. Please do not post exploitable details in a public issue before maintainers have had a chance to respond.

---

# License

See [`LICENSE`](../LICENSE).

The project source is licensed under PolyForm Noncommercial 1.0.0: free for personal and other noncommercial use; commercial use requires a separate license (contact: QQ group 1082932504). Versions released before v0.2.0 were published under Apache-2.0. The project character artwork used in the application icons is excluded; see [`ASSET_LICENSES.md`](../ASSET_LICENSES.md). Third-party dependencies, models, character resources, audio, animations, and other content may have separate licenses. Check the corresponding license terms before redistribution.

---

# Vision

AI Pets Hub started as an AI desktop pet project, but the long-term goal is not to build another chat pet.

The goal is to create a platform where AI characters can actually exist inside a desktop environment:

> **They can remember, learn, communicate, form relationships, use tools, operate computers, and continuously gain new capabilities through extensions.**

If you are interested in:

- AI Companions
- AI Agents
- Computer Use
- Multi-Agent Systems
- Character AI
- Long-term Memory
- Neural Personality
- MCP
- Plugin Systems
- Desktop AI
- AI Runtime

you are welcome to explore the project.

The project is still evolving quickly.

Use it, test it, report issues, experiment with it, and help build it further.
