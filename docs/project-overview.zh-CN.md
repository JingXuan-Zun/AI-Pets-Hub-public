# AI Pets Hub

> 一个面向 Windows 桌面的开源 AI 宠物与 AI Runtime World 平台。
>
> 将 AI 角色、长期记忆、神经人格、多 Agent 群体交互、Agent Runtime、Computer Use、MCP、Skill、插件扩展、语音以及 2D / Live2D / 3D 角色运行时组合到同一个可扩展的桌面环境中。

[English README](../README.md)

> **项目状态：Early Open Source / Active Development**
>
> 这是一个正在持续开发和重构中的开源项目。当前源码已经包含大量可运行模块，但不同子系统的稳定程度不同；部分功能仍处于集成、验证或实验阶段。开源的目的之一，就是让开发者能够实际使用、发现问题、参与修复，并共同推进平台建设。

---

## 目录

- [项目是什么](#项目是什么)
- [为什么做这个项目](#为什么做这个项目)
- [核心能力](#核心能力)
- [Agent Runtime](#agent-runtime)
- [Computer Use / Runtime World](#computer-use--runtime-world)
- [Memory / RAG / Neural Persona](#memory--rag--neural-persona)
- [Multi-Agent / Group Chat](#multi-agent--group-chat)
- [Character / Pet Runtime](#character--pet-runtime)
- [Life Companion](#life-companion)
- [MCP](#mcp)
- [Skill 与扩展系统](#skill-与扩展系统)
- [DeepSeek Harness](#deepseek-harness)
- [Voice](#voice)
- [技术架构](#技术架构)
- [技术栈](#技术栈)
- [当前状态](#当前状态)
- [快速开始](#快速开始)
- [开发与测试](#开发与测试)
- [公开仓库边界](#公开仓库边界)
- [路线图](#路线图)
- [贡献](#贡献)
- [问题反馈](#问题反馈)
- [安全](#安全)
- [License](#license)

---

# 项目是什么

AI Pets Hub 最初来自一个很直接的想法：**让 AI 角色真正生活在桌面上。**

但项目并不希望最终成为一个只能聊天、只能运行一个固定角色的桌宠程序。

因此现在的目标逐渐扩展为一个 **AI Pet Platform / AI Runtime World**：

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

一个角色可以拥有自己的：

- 人格
- 模型配置
- 对话历史
- 长期记忆
- 知识库
- 关系状态
- 工具能力
- 权限
- 语音
- 表情和动作
- 2D / Live2D / 3D 表现

多个角色又可以进入同一个群体环境，进行对话、关系变化、记忆共享、任务协作和行为表现。

Agent 则可以进一步使用工具、操作本地环境，并通过 Runtime World 观察和验证执行结果。

最终希望形成的不是：

```text
AI + 桌宠
```

而是：

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

# 为什么做这个项目

传统 AI 陪伴应用通常把能力集中在一个聊天界面里：用户输入 → 模型回复。

AI Pets Hub 希望把这个关系扩展成：

```text
用户
 ↓
角色
 ↓
人格 / 记忆 / 关系 / 知识
 ↓
认知与 Agent
 ↓
工具与 Runtime
 ↓
真实环境
 ↓
新的经历
 ↓
记忆与状态更新
```

这样 AI 角色不只是“回答问题的模型”，而是逐渐成为一个拥有持续状态、行为能力和视觉表现的桌面实体。

与此同时，平台层允许不同角色、Agent、工具和插件共享宿主能力，而不是每一个功能都重新实现一套模型、权限和配置系统。

---

# 核心能力

当前源码中已经可以看到以下主要系统：

| 模块 | 当前源码状态 |
|---|---|
| AI Chat | 已有核心聊天模块，持续完善 |
| 多模型 / Provider | 已有模型协议与 Provider 相关架构 |
| 2D / Live2D | 已有运行时、模型支持、表达式与动作相关模块 |
| 3D / VRM | 已有 Three.js / VRM 运行时 |
| Unity Runtime | 已有 Unity Bridge / Runtime 服务 |
| Agent Runtime | 大量核心执行、策略、验证、恢复模块已存在，持续重构与验证 |
| Computer Use | 已有桌面观察、窗口、输入、坐标、应用启动等工具 |
| Tool Registry | 已有工具注册与输入 schema |
| Permission | 已有 Agent Permission / MCP Policy 相关系统 |
| Observation / Evidence | 已有视觉观察、证据、结果评估与验证模块 |
| Recovery | 已有 Agent Recovery / Replan / Follow-up 相关模块 |
| Memory | 已有聊天、角色、群体记忆相关系统 |
| RAG / Knowledge | 已有相关 Agent / Memory / Knowledge 接口与运行逻辑 |
| Neural Persona | 已有神经人格、图谱、节点、关系、学习和反馈相关系统 |
| Character Relationship | 已有有向关系与行为策略系统 |
| Group Chat | 已有群体角色、群体话题、群体记忆相关模块 |
| Social Timeline / Trend | 已有社交事件时间线和关系趋势相关模块 |
| Life Companion | 已有主动互动、好感、饥饿、情绪、桌面活动感知等系统 |
| MCP | 已有 Server、Stdio、Policy、History、Diagnostics 等模块 |
| Skill | 已有 Skill Registry、Package、Import、Install、Runtime、Sandbox 等模块 |
| Plugin / Extension Hub | 已有扩展中心和外部 Skill / Marketplace 相关实现，仍在持续完善 |
| DeepSeek Harness | 已有 Runtime Service、Runner、Capability Bridge 等集成代码 |
| Voice | 已有本地语音运行时、TTS、Voice Tools 等模块 |
| Expression System | 已有表情库、回复表达式和资源管理系统 |
| ComfyUI | 已有 ComfyUI Workflow 设置入口 |
| Runtime World | 已有 Runtime World Core、Controller、Director、Systems、Agent Bridge |
| Windows Desktop | Electron 宿主、IPC、窗口、桌面输入和应用启动相关模块 |

**注意：** “源码中存在”不等于“所有场景已经达到生产稳定性”。项目目前仍处于持续集成和修复阶段。

---

# Agent Runtime

AI Pets Hub 使用的是项目自己的 TypeScript Agent Runtime，而不是直接建立在 LangChain、LangGraph、CrewAI 或 OpenAI Agents SDK 之上的应用层封装。

当前源码中可以看到多个核心层：

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

相关代码包括但不限于：

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

### Agent 的设计重点

#### 1. Tool Calling

Agent 可以通过统一 Tool Registry 选择并执行不同类型的工具。

#### 2. Permission / Policy

高风险操作并不是简单地把模型生成的动作直接交给操作系统，而是经过权限和策略层。

#### 3. Observation / Evidence

对于桌面操作，系统不仅关心“命令是否执行”，还尝试判断“目标状态是否真的发生”。

#### 4. Verification

执行后可以继续进行观察和结果验证。

#### 5. Recovery / Replan

当执行结果不符合预期时，Runtime 可以进入恢复、跟进或重新规划相关路径。

#### 6. Execution Limits

Agent Runtime 包含多种执行控制和生命周期机制，用于限制连续动作、取消、审批和异常路径。

---

# Computer Use / Runtime World

AI Pets Hub 的 Runtime World 是项目的重要组成部分。

目标是让 Agent 不仅能够调用抽象工具，还能够观察和操作 Windows 桌面环境。

当前源码包含：

- 屏幕捕获
- 区域选择
- 窗口识别
- Window Target Resolution
- UI Automation 相关路径
- 鼠标 / 键盘输入
- 坐标空间处理
- 坐标审计
- 桌面图标识别与整理
- 应用启动
- 本地文件操作
- 浏览器搜索相关能力
- 游戏屏幕分析相关工具
- 视觉目标验证
- Action Evidence
- Recovery / Replan

典型执行逻辑：

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

项目尤其关注一个问题：

> **“动作执行成功”不等于“任务目标已经完成”。**

例如打开一个应用时，启动命令执行成功，并不意味着目标窗口已经出现并进入正确状态。

因此 Runtime 中存在窗口身份、观察证据、结果评估、恢复和最终验证等多个层次。

---

# Memory / RAG / Neural Persona

AI Pets Hub 不把记忆简单理解成“把聊天记录存下来”。

当前源码已经包含多个记忆与人格相关子系统。

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

`src/character-graph/neural-persona/` 已经包含大量神经人格相关实现，包括：

- Persona Node
- Node Generation
- Node Hierarchy
- Graph Layout
- Graph Physics
- Graph Explorer
- Relationship
- Semantic Retrieval
- Tagging
- Feedback Ledger
- Learning Proposal
- Learning Application
- Learning Reversal
- Persistence
- Provider Data Policy
- Response Quality A/B

神经人格系统的目标，是让角色的长期信息能够以更加结构化的方式组织，而不是完全依赖一个巨大的 Persona Prompt。

### 当前方向

```text
Persona
 ├── Memory
 ├── Knowledge
 ├── Relationship
 ├── Experience
 ├── Behavioral Information
 └── Learning / Feedback
```

该系统目前仍处于持续开发和验证阶段。

---

# Multi-Agent / Group Chat

项目支持多个角色共同存在，并围绕群体环境进行交互。

当前源码包含：

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

角色之间可以形成独立的关系与群体状态。

目标交互模型：

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

这部分的长期目标不是让多个模型简单轮流说话，而是形成真正具有角色差异、关系变化和持续群体状态的 Multi-Agent Environment。

---

# Character / Pet Runtime

角色运行时位于 `src/pet-runtime/`，目前包含多个表现层。

## Live2D

源码包含：

- Live2D Runtime Profile
- Cubism Core Loader
- Model Support
- Expression Discovery
- Expression Binding
- Presentation Priority
- Runtime Mapping
- Pointer Look
- Interaction Controller

## 3D / VRM

源码使用 Three.js / React Three Fiber，并包含：

- VRM Asset Loading
- 3D Scene
- Runtime Mount
- Expression Controller
- Look-at Controller
- Interaction Controller
- Drag Motion State
- External Motion Clips
- Reaction Runtime

## Unity

Electron 侧和前端均包含 Unity Runtime / Bridge 相关代码，可作为另一种角色运行时后端。

## 表情与动作

项目还包含独立的 Expression Library 和回复表达式 Runtime，用于把文本 / AI 行为与角色表现连接起来。

---

# Life Companion

除了主动聊天之外，项目还包含一个独立的 Life Companion 系统。

当前源码可以看到：

- 好感度 / Affection
- 饥饿 / Hunger
- Mood
- Startup Greeting
- Proactive Interaction
- Random Interaction
- Desktop Activity Awareness
- Quiet Hours
- LLM Text Prompt
- Interaction Scheduler
- Growth Controller

角色因此可以拥有一定程度的持续桌面状态，而不是只在用户主动打开聊天窗口时存在。

部分主动行为默认关闭或受冷却时间、时间段等条件控制。

---

# MCP

项目包含完整的 MCP 相关基础设施。

Electron 侧包含：

- MCP Config Service
- MCP Stdio Client
- Session Pool
- Tool Call Runner
- Server Compatibility
- Server Health
- Diagnostics
- Environment Preflight
- History
- Policy
- Argument Schema Validation
- Cancellation
- Soak / Readiness 检查

Agent 侧包含 External MCP Bridge、MCP Registry、Policy、Risk Summary 和 Execution Receipt 等相关模块。

MCP 工具仍然受到项目自身的权限与运行时边界控制。

---

# Skill 与扩展系统

项目当前不仅支持“内置工具”，还已经建立了较完整的 Skill / Extension 基础设施。

源码包含：

- Skill Manifest
- Skill Registry
- Skill Package Metadata
- Skill Archive Import
- Package Installation
- Package Lifecycle
- Installed Package Registry
- Execution Scope
- Runtime Policy
- Trust Evidence
- Signature Verification
- Trusted Signature Keys
- Package Update
- Rollback
- External Loader Boundary
- External Permission Grant
- Sandbox Supervisor
- Sandbox Isolation Evidence
- Marketplace Readiness
- Publisher Catalog

这部分是 AI Pets Hub 向“平台”发展的重要基础。

长期目标是允许第三方开发者在不修改宿主核心代码的情况下扩展：

- Agent 能力
- Tools
- Character 能力
- Runtime 能力
- Voice
- Visual
- Memory
- External Services

当前插件 / Skill Marketplace 仍在持续开发和验证。

---

# DeepSeek Harness

项目当前源码中已经包含 DeepSeek Harness 相关集成：

- Harness Runtime Service
- Process Runner
- Capability Bridge
- Capability Plugin
- Profile
- Agent Library
- Runtime Adapter / Transport

设计方向是让外部或独立的 Agent / Harness 能力可以作为 AI Pets Hub 的可组合运行能力，同时继续使用宿主的模型、工具、权限和 Runtime 边界。

这部分仍属于持续开发中的平台能力。

---

# Voice

项目包含本地语音相关基础设施：

- Local Voice Runtime
- Voice Library
- TTS
- Browser TTS
- Voice Tools
- Audio Utilities
- Audio Cache
- Voice Runtime Worker
- Generated Audio Result Handling

语音层被设计为独立能力，可以与角色、Agent、聊天和表现层进行组合。

---

# Expression / Visual Behavior

项目存在独立的 Expression Library 系统，用于管理角色表现资源和 AI 回复对应的表达行为。

相关系统包括：

- Expression Library
- Expression Categories
- Expression Review Queue
- Expression Settings
- Reply Expression Runtime
- Expression Semantics
- Asset Import / Mutation
- System Expression Catalog

未来可以进一步让 Agent / Social / Emotion / Dialogue 共同驱动角色表现。

---

# ComfyUI

设置层已经包含 ComfyUI Workflow 相关入口。

项目计划将外部生成能力与角色 / 聊天场景结合，例如根据当前对话生成场景内容，同时保留角色参考和宿主上下文约束。

相关功能仍属于持续集成方向，不应将设置入口理解为所有生成工作流都已经达到稳定生产状态。

---

# 技术架构

项目当前采用 Electron + React + TypeScript 的桌面应用结构。

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

# 技术栈

当前源码主要使用：

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
- MCP 相关自定义 Runtime
- 自研 TypeScript Agent Runtime

具体依赖版本以 `package.json` 为准。

---

# 当前状态

AI Pets Hub 当前属于 **Early Open Source / Active Development**。

源码规模已经较大，包含大量 Runtime、验证和测试辅助代码，但项目还没有把所有系统收束成一个完全稳定的生产版本。

### 当前重点

#### 相对成熟 / 已形成较完整实现

- Electron Desktop Host
- AI Chat 基础链路
- 2D / Live2D Runtime
- 3D / VRM Runtime
- Agent Tool Registry
- Agent Permission / Policy
- Desktop Observation / Input
- MCP 基础设施
- Neural Persona 数据与图谱系统
- Group Memory 基础设施
- Character Relationship 基础设施
- Life Companion 基础设施
- Skill Package 基础设施

#### 正在持续接合 / 验证

- Agent Production Runtime
- Agent V3 / Runtime 过渡路径
- Computer Use 端到端稳定性
- Observation → Evidence → Verification → Recovery
- Neural Persona → Cognition → Chat
- Group Memory → Social Behavior
- Relationship → Character Behavior
- Skill → Sandbox → Runtime
- Plugin / Marketplace → Host Runtime
- DeepSeek Harness → Agent Runtime
- Multi-character Director / Expression
- Voice → Character Behavior
- Runtime World → Agent / Character

#### 仍需持续完善

- 全面的跨模块自动化集成测试
- 第三方插件生态
- 稳定的 Marketplace 发布流程
- 更完整的安装 / 升级 / 回滚体验
- 更大规模 Multi-Agent 场景下的性能与稳定性
- 更完整的公开开发者文档

> 以上状态是根据当前公开源码结构整理的开发状态，不代表所有功能都已经通过生产级验收。

---

# 快速开始

## 环境要求

推荐：

- Windows
- Node.js
- npm
- Git

## 安装

```powershell
npm install
```

## 开发模式

当前仓库的前端开发脚本：

```powershell
npm run dev
```

如果需要启动 Electron 桌面环境，可以使用：

```powershell
npm run desktop
```

`desktop` 脚本会先构建 renderer，再启动 Electron。

## 类型检查

```powershell
npm run lint
```

## 构建

```powershell
npm run build
```

## Windows 打包

项目包含 Windows portable 构建脚本：

```powershell
npm run dist:win
```

完整生产构建和 Marketplace 相关检查请以 `package.json` 中的脚本为准。

---

# 配置

仓库提供 `.env.example`。

当前示例配置主要用于本地开发和部分功能开关。

**不要把 API Key、Provider Credential、MCP 私有配置或其他敏感信息提交到 Git。**

本项目中的 `.env.local` 等本地配置属于开发环境内容，不应该进入公开仓库。

---

# 开发与测试

项目已经包含大量 Agent、Neural Persona、MCP、Skill、Runtime 和桌面操作相关的 smoke test。

例如：

```powershell
npm run check:agent-runtime-architecture
npm run check:agent-runtime-retirement
npm run smoke:agent:p0
npm run smoke:neural-persona:contract
npm run smoke:neural-persona:graph
npm run smoke:neural-persona:persistence
```

Agent 用户流程还有专门的组合 smoke 流程：

```powershell
npm run smoke:agent:user-flows
```

具体测试脚本会随着 Runtime 重构持续调整。

对于跨模块 Bug，建议同时记录：

1. 复现步骤
2. 环境
3. 日志
4. Agent Trace / Evidence（如果适用）
5. 预期状态
6. 实际状态
7. 修复后的回归结果

---

# 公开仓库边界

当前仓库包含一个 `PUBLIC_EXPORT.md`，用于说明公开源码边界。

公开版本不应包含：

- 源工作区 Git 历史、远端配置或本地凭据
- API Key / Provider Credential
- 私有 MCP 配置
- 用户资料
- 聊天记录
- 私人记忆数据
- 私有角色设定
- 私有模型 / 音频 / 动画资源
- 本地模型运行时
- Python 环境
- 生成构建产物
- 内部临时诊断文件

发布前请检查：

```powershell
git status
git diff --cached
```

并运行适当的 secret scanner。

**尤其不要使用 `git add -f` 强制加入本应被忽略的本地文件。**

---

# 路线图

## 1. Runtime Stabilization

- 继续收紧 Agent Session / Orchestrator / Policy / Runtime 边界
- 提升 Tool Result 与 Evidence 一致性
- 改进 Verification / Recovery
- 完善取消、超时和失败状态
- 减少跨模块状态污染

## 2. Cognitive Integration

- 进一步连接 Neural Persona 与 Cognition
- 让长期记忆真正影响决策
- 改进 RAG 与角色上下文融合
- 完善反馈、学习和关系状态

## 3. Multi-Agent World

- 更强的群体调度
- 群体任务
- 关系驱动行为
- 社交时间线
- 多角色导演与表现层

## 4. Extension Ecosystem

- 完善 Skill SDK
- Plugin / Extension Hub
- Marketplace
- 第三方开发者 API
- Sandbox / Trust / Signature
- Agent / Harness 组合能力

## 5. AI Runtime World

最终希望形成一个可以持续扩展的桌面 AI 世界：

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

# 贡献

AI Pets Hub 正在逐步向社区开放。

欢迎贡献：

- Agent Runtime
- Computer Use
- Memory / RAG
- Neural Persona
- Multi-Agent / Group Chat
- Character Relationship
- Live2D / 3D
- Runtime World
- MCP
- Skill / Plugin
- Voice
- UI / UX
- Performance
- Testing
- Documentation

对于较大的架构改动，建议先通过 Issue / Discussion 讨论设计，再提交 Pull Request。

在提交代码前，请尽量确认：

- 改动边界明确
- 没有破坏公共接口
- 已检查调用方
- 已处理错误 / 取消 / 超时
- 已运行相关测试
- 没有提交敏感配置

---

# 问题反馈

提交 Issue 时建议至少包含：

- Windows 版本
- 项目 commit / release 版本
- Node.js 版本
- 模型 Provider（如果与问题有关）
- 复现步骤
- 预期结果
- 实际结果
- 日志
- 截图 / 视频
- 是否稳定复现

对于 Agent 问题，如果可以，请同时提供对应的任务描述、工具调用过程和验证结果。

---

# 安全

由于 AI Pets Hub 包含本地文件、桌面输入、应用启动、屏幕观察、MCP、Skill 和 Runtime 等能力，安全边界是项目的重要组成部分。

不要向不可信 Skill、Plugin 或 Tool 提供不必要的权限。

不要提交：

- API Key
- Access Token
- Cookie
- 私人 MCP 配置
- 私人角色数据
- 用户数据
- 本地凭据

发现安全漏洞时，如果仓库已启用 GitHub 私密漏洞报告，请通过该功能联系维护者；如果该功能不可用，请通过 GitHub 主页联系维护者。在维护者有机会响应前，请不要在公开 Issue 中发布可利用细节。

---

# License

请查看 [`LICENSE`](../LICENSE)。

项目源码采用 Apache-2.0 许可证。应用图标中的项目角色插画不在该许可证范围内，详见 [`ASSET_LICENSES.md`](../ASSET_LICENSES.md)。第三方依赖、模型、角色资源、音频、动画和其他内容可能具有独立许可证，请在重新分发前确认对应授权。

---

# 项目愿景

AI Pets Hub 从“AI 桌宠”开始，但最终目标并不是再做一个聊天桌宠。

我们希望建立一个可以让 AI 角色真正存在于桌面环境中的平台：

> **它们可以记忆、学习、交流、建立关系、使用工具、操作电脑，并通过插件持续获得新的能力。**

如果你对以下方向感兴趣，欢迎加入：

- AI Companion
- AI Agent
- Computer Use
- Multi-Agent Systems
- Character AI
- Long-term Memory
- Neural Personality
- MCP
- Plugin Systems
- Desktop AI
- AI Runtime

项目目前仍在快速开发中。

欢迎使用、测试、提出问题，并一起把它继续做下去。
