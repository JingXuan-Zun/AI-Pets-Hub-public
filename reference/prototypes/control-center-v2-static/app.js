const roster = [
  { id: "primary", name: "示例角色A", state: "Live2D / WALKING", online: true, scope: "当前角色" },
  { id: "companion-pet-2", name: "示例角色B", state: "未启用 / 2D", online: false, scope: "当前角色" },
  { id: "companion-pet-3", name: "示例角色C", state: "未启用 / 3D", online: false, scope: "当前角色" },
  { id: "companion-pet-4", name: "示例角色D", state: "未启用 / 2D", online: false, scope: "当前角色" },
  { id: "companion-pet-5", name: "示例角色E", state: "未启用 / 2D", online: false, scope: "当前角色" },
  { id: "companion-pet-6", name: "示例角色F", state: "未启用 / 2D", online: false, scope: "当前角色" },
  { id: "companion-pet-7", name: "示例角色G", state: "未启用 / 2D", online: false, scope: "当前角色" },
  { id: "companion-pet-8", name: "示例角色H", state: "未启用 / 2D", online: false, scope: "当前角色" },
];

const modules = [
  {
    id: "dashboard",
    label: "总览",
    cn: "总览",
    icon: "⌁",
    color: "cyan",
    desc: "状态、异常、最近活动",
    status: [
      ["当前桌宠", "示例角色A"],
      ["AI", "在线"],
      ["运行时", "健康"],
      ["警告", "0"],
    ],
    pages: [
      {
        id: "overview",
        label: "控制台总览",
        breadcrumb: ["总览", "概览"],
        sections: [
          {
            title: "运行概览",
            summary: "把 AI、桌宠、平台和系统状态集中在一个入口。",
            fields: [
              field("当前桌宠", "示例角色A", "live2d / WALKING"),
              field("当前模型", "deepseek-v4-pro", "兼容 OpenAI 路由"),
              field("Agent", "运行中", "动作 Agent 已启用"),
              field("最近更新", "2 分钟前", "静态 UI 快照"),
            ],
          },
          {
            title: "快捷入口",
            summary: "进入最常调整的页面，不需要记住具体位置。",
            fields: [
              chips("常用配置", ["模型", "Prompt", "记忆", "角色", "Live2D", "运行时"]),
              field("全局搜索", "可用", "输入关键词后定位模块和字段"),
            ],
          },
        ],
        workspace: {
          title: "系统态势",
          type: "dashboard",
          metrics: [
            ["AI", "在线", "green"],
            ["桌宠", "行走中", "cyan"],
            ["插件", "3 个就绪", "violet"],
            ["运行时", "60 FPS", "green"],
          ],
          timeline: ["载入角色槽位：8", "应用 V3 控制台布局", "等待真实功能接入"],
        },
      },
    ],
  },
  {
    id: "ai",
    label: "AI",
    cn: "智能",
    icon: "✦",
    color: "blue",
    desc: "模型、Prompt、Agent、记忆",
    status: [
      ["模型", "deepseek-v4-pro"],
      ["Agent", "运行中"],
      ["记忆", "开启"],
      ["知识库", "开启"],
    ],
    pages: [
      {
        id: "model",
        label: "模型",
        breadcrumb: ["AI", "模型", "主脑模型"],
        sections: [
          {
            title: "主脑模型",
            summary: "控制当前 AI 的核心推理模型与供应商路由。",
            fields: [
              selectField("模型供应商", "DeepSeek", ["OpenAI", "Gemini", "Claude", "DeepSeek", "Qwen"], "当前走兼容 OpenAI 协议"),
              field("模型名称", "deepseek-v4-pro", "已填写"),
              secretField("API Key", "已填写", "不在静态原型中显示明文"),
              field("接口地址", "已配置", "连接地址只显示配置状态"),
            ],
          },
          {
            title: "推理参数",
            summary: "所有参数都显示推荐范围和当前倾向。",
            fields: [
              sliderField("温度", "0.7", "推荐范围 0.6 ~ 0.9", "平衡"),
              sliderField("Top-p", "1.0", "推荐范围 0.8 ~ 1.0", "Creative"),
              field("Max Tokens", "8192", "长上下文回复"),
            ],
          },
          {
            title: "模型能力",
            summary: "对应旧模型高级配置里的文本、图像、工具和思考能力标记，只做 UI 状态。",
            fields: [
              chips("能力标记", ["文本", "图像", "工具", "思考"]),
              field("连接测试", "可用", "静态按钮占位，不发起请求"),
              field("重置模型配置", "可用", "静态按钮占位，不清空数据"),
            ],
          },
        ],
        workspace: {
          title: "AI 工作区",
          type: "ai",
          metrics: [
            ["当前模型", "deepseek-v4-pro", "cyan"],
            ["上下文", "128K", "blue"],
            ["温度", "0.7", "green"],
            ["状态", "在线", "green"],
          ],
          reply: "主人，当前模型已准备好。你可以在这里测试一句话，观察 Prompt、记忆和知识库的组合效果。",
        },
      },
      {
        id: "prompt",
        label: "Prompt",
        breadcrumb: ["AI", "Prompt", "系统提示词"],
        sections: [
          {
            title: "系统 Prompt",
            summary: "定义 AI 的长期行为边界和默认回应方式。",
            fields: [
              textareaField("人格提示词", "\"name\": \"示例角色A\", \"prompt\": \"SYSTEM 角色、人设、世界观和行为约束内容已填写，原文较长，此处为摘要。\""),
              field("Token 估算", "1820 Tokens", "静态估算"),
              chips("启用上下文", ["记忆", "知识库", "工具策略"]),
            ],
          },
          {
            title: "模拟回复",
            summary: "右侧工作区用来验证 Prompt 手感，不展示代码。",
            fields: [
              textareaField("测试输入", "今天心情怎么样？"),
              field("回复风格", "亲近、轻松、带一点撒娇", "来自当前角色配置"),
            ],
          },
        ],
        workspace: {
          title: "Prompt 验证",
          type: "prompt",
          reply: "主人～今天心情很好呢。刚刚整理完记忆和知识库，我会尽量用更自然的方式回应你。",
          metrics: [
            ["系统 Prompt", "1820 Tokens", "violet"],
            ["记忆", "已启用", "green"],
            ["知识库", "已启用", "green"],
            ["风险", "低", "cyan"],
          ],
        },
      },
      {
        id: "memory",
        label: "记忆",
        breadcrumb: ["AI", "记忆", "记忆"],
        sections: [
          {
            title: "记忆范围",
            summary: "区分工作记忆、长期记忆和角色记忆。",
            fields: [
              toggleField("角色记忆", true, "仅当前角色使用"),
              toggleField("聊天记录记忆", true, "从历史对话提取上下文"),
              sliderField("记忆深度", "60%", "推荐范围 40% ~ 70%", "Balanced"),
              field("记忆摘要", "未填写", "等待真实记忆系统接入"),
            ],
          },
          {
            title: "知识注入",
            summary: "显示记忆进入 Prompt 前的大致状态。",
            fields: [
              field("工作记忆", "4 条", "最近对话片段"),
              field("长期记忆", "23 条", "长期条目"),
              field("预计 Token", "16384", "当前配置快照"),
            ],
          },
        ],
        workspace: {
          title: "记忆工作区",
          type: "memory",
          metrics: [
            ["工作记忆", "4", "cyan"],
            ["长期记忆", "23", "green"],
            ["摘要", "就绪", "violet"],
            ["Token", "16384", "blue"],
          ],
          timeline: ["角色记忆库：已启用", "聊天记录记忆：已启用", "注入策略：摘要优先"],
        },
      },
      {
        id: "knowledge",
        label: "知识库",
        breadcrumb: ["AI", "知识库", "知识库"],
        sections: [
          {
            title: "知识库",
            summary: "角色知识库和全局知识库统一管理，但生效范围由顶部作用域切换。",
            fields: [
              toggleField("角色知识库", true, "仅当前角色使用"),
              toggleField("全局知识库", false, "所有角色共享"),
              chips("内容入口", ["角色背景资料", "常用事实", "长期设定", "全局规则"]),
            ],
          },
        ],
        workspace: {
          title: "知识库命中",
          type: "knowledge",
          metrics: [
            ["角色知识库", "23", "green"],
            ["全局知识库", "8", "cyan"],
            ["当前命中", "5", "blue"],
            ["召回状态", "就绪", "green"],
          ],
          timeline: ["命中：角色背景", "命中：长期设定", "命中：用户偏好"],
        },
      },
      {
        id: "agent",
        label: "Agent",
        breadcrumb: ["AI", "Agent", "行为规划"],
        sections: [
          {
            title: "Agent 配置",
            summary: "控制 AI 何时规划、何时调用工具、何时触发桌宠动作。",
            fields: [
              toggleField("动作 Agent", true, "允许根据语义选择动作 / 表情"),
              toggleField("现实时间感知", true, "把本地日期时间注入上下文"),
              selectField("任务模式", "轻量规划", ["轻量规划", "多步规划", "手动确认"], "当前偏向低打扰"),
            ],
          },
        ],
        workspace: {
          title: "Agent Trace",
          type: "agent",
          metrics: [
            ["规划器", "运行中", "green"],
            ["工具策略", "受保护", "cyan"],
            ["最近动作", "行走", "blue"],
            ["失败次数", "0", "green"],
          ],
          timeline: ["观察输入", "选择动作候选", "等待用户确认策略"],
        },
      },
      {
        id: "vision-model",
        label: "视觉模型",
        breadcrumb: ["AI", "视觉模型", "桌面理解"],
        sections: [
          {
            title: "视觉路由",
            summary: "对应旧视觉页里的视觉模型调用设置，只做静态展示。",
            fields: [
              selectField("视觉模式", "自动选择视觉路由", ["自动选择视觉路由", "继承主脑模型", "独立视觉模型", "关闭视觉模型"], "决定桌面画面理解走哪条模型路线"),
              selectField("视觉供应商", "沿用聊天模型", ["沿用聊天模型", "独立 Gemini 视觉模型", "独立 OpenAI 兼容视觉模型"], "不在原型中测试连接"),
              field("视觉模型名称", "doubao-seed-1-8-251228", "来自当前配置快照"),
              secretField("视觉 API Key", "已填写", "敏感字段只显示状态"),
            ],
          },
          {
            title: "视觉请求参数",
            summary: "与主脑模型分离的视觉模型高级参数。",
            fields: [
              sliderField("视觉温度", "0.4", "推荐范围 0.2 ~ 0.7", "稳定识别"),
              field("最大输出 Token", "4096", "视觉摘要上限"),
              chips("能力标记", ["图像理解", "区域识别", "OCR 辅助", "桌面描述"]),
            ],
          },
        ],
        workspace: {
          title: "视觉模型工作区",
          type: "perception",
          metrics: [
            ["视觉模式", "自动", "green"],
            ["模型", "doubao", "cyan"],
            ["图像理解", "开启", "blue"],
            ["延迟", "模拟", "amber"],
          ],
          timeline: ["等待桌面截图", "生成视觉摘要", "注入 AI 上下文"],
        },
      },
      {
        id: "voice-model",
        label: "语音模型",
        breadcrumb: ["AI", "语音模型", "TTS / STT"],
        sections: [
          {
            title: "语音交互",
            summary: "对应旧语音页的语音开关、自动播报和文本清洗策略。",
            fields: [
              toggleField("语音播报", true, "AI 回复可以被朗读"),
              toggleField("语音输入", true, "显示语音输入入口，不打开麦克风"),
              toggleField("自动朗读回复", false, "用户可手动触发播报"),
              toggleField("跳过括号内容", true, "动作、旁白类括号文本不朗读"),
              toggleField("表达性标点", true, "保留语气停顿和轻微情绪"),
            ],
          },
          {
            title: "播报模型 TTS",
            summary: "对应旧语音页的浏览器语音、API 语音和本地语音播报设置。",
            fields: [
              selectField("播报来源", "Edge-TTS 本地", ["Edge-TTS 本地", "API 语音", "本地语音模型"], "静态显示，不启动服务"),
              selectField("API 协议", "OpenAI", ["OpenAI", "Gemini"], "影响 API TTS 字段展示"),
              field("播报模型", "Qwen3-TTS-12Hz-1.7B-Base", "本地模型快照"),
              field("声音名称", "xiaoyi", "当前语音名称"),
              sliderField("语速", "1.0", "推荐范围 0.8 ~ 1.2", "自然"),
            ],
          },
          {
            title: "识别模型 STT",
            summary: "对应旧语音页的浏览器识别、API 识别和本地识别模型。",
            fields: [
              selectField("识别来源", "浏览器识别", ["浏览器识别", "API 识别", "本地识别模型"], "不打开麦克风"),
              field("识别模型", "Qwen3-ASR-1.7B", "本地模型快照"),
              field("识别语言", "zh-CN", "浏览器识别语言"),
              secretField("语音 API Key", "已填写", "敏感字段只显示状态"),
            ],
          },
          {
            title: "本地语音运行时",
            summary: "本地 Python 运行时、依赖安装、参考音频和音色锁定的静态入口。",
            fields: [
              field("本地运行时路径", "已配置", "不显示真实路径"),
              toggleField("锁定音色", true, "保持参考音色稳定"),
              sliderField("音色稳定度", "70", "推荐范围 50 ~ 90", "稳定"),
              field("参考文本", "已填写", "用于本地音色参考"),
            ],
          },
        ],
        workspace: {
          title: "语音工作区",
          type: "agent",
          metrics: [
            ["TTS", "就绪", "green"],
            ["STT", "就绪", "cyan"],
            ["语速", "1.0", "blue"],
            ["音色", "锁定", "violet"],
          ],
          timeline: ["播报来源：Edge-TTS 本地", "识别来源：浏览器识别", "本地语音运行时：静态占位"],
        },
      },
      {
        id: "tools-web",
        label: "工具与联网",
        breadcrumb: ["AI", "工具与联网", "Tool / Web"],
        sections: [
          {
            title: "Tool 调用策略",
            summary: "控制 AI 何时调用工具、是否确认、失败后如何恢复。",
            fields: [
              toggleField("允许 Tool 调用", true, "只展示开关，不调用工具"),
              selectField("调用确认", "高风险确认", ["全部确认", "高风险确认", "自动执行低风险"], "原型不执行真实动作"),
              selectField("失败恢复", "自动重试一次", ["不重试", "自动重试一次", "转人工确认"], "用于 Agent 诊断展示"),
              chips("工具类型", ["桌面动作", "文件", "浏览器", "记忆", "系统观察"]),
            ],
          },
          {
            title: "联网能力",
            summary: "原系统联网查询、联网学习和第三方搜索 API 汇总到 AI。",
            fields: [
              toggleField("联网查询", true, "允许外部信息查询"),
              toggleField("联网学习", false, "是否把联网结果沉淀为长期信息"),
              selectField("搜索供应商", "Tavily", ["Gemini", "本机浏览器", "Tavily", "Serper", "Brave", "自定义"], "只显示配置状态"),
              secretField("Tavily API Key", "已填写", "敏感字段只显示状态"),
              secretField("Serper API Key", "未填写", "敏感字段只显示状态"),
              secretField("Brave API Key", "未填写", "敏感字段只显示状态"),
            ],
          },
        ],
        workspace: {
          title: "工具与联网工作区",
          type: "mcp",
          metrics: [
            ["Tool", "允许", "green"],
            ["确认", "高风险", "amber"],
            ["搜索", "Tavily", "cyan"],
            ["学习", "关闭", "blue"],
          ],
          timeline: ["工具策略已展示", "联网供应商已归档", "未接入真实调用"],
        },
      },
    ],
  },
  {
    id: "desktop",
    label: "桌宠",
    cn: "桌宠",
    icon: "◉",
    color: "rose",
    desc: "角色、外观、动作、感知",
    status: [
      ["Pet", "示例角色A"],
      ["模型", "Live2D"],
      ["动作", "行走中"],
      ["Vision", "ON"],
    ],
    pages: [
      {
        id: "role",
        label: "角色",
        breadcrumb: ["桌宠", "角色", "身份与人格"],
        sections: [
          {
            title: "基础信息",
            summary: "当前角色的身份、性格和核心人设。模型接口已经迁到 AI。",
            fields: [
              field("角色名称", "示例角色A", "当前槽位 1"),
              textareaField("性格特征", "开朗、体贴、耐心"),
              textareaField("人格提示词", "\"name\": \"示例角色A\", \"prompt\": \"SYSTEM 角色、人设、世界观和行为约束内容已填写，原文较长，此处为摘要。\""),
              field("聊天头像", "已填写", "静态快照"),
            ],
          },
          {
            title: "对话行为",
            summary: "把预设对话、错误回复和口吻约束合并到同一页。",
            fields: [
              field("预设对话", "0 组", "尚未填写"),
              textareaField("开场白", "未填写"),
              textareaField("自定义错误回复", "未填写"),
              selectField("说话风格", "按人格提示词控制", ["按人格提示词控制", "简短直接", "正式克制"], "会影响 AI 模拟回复"),
            ],
          },
        ],
        workspace: {
          title: "角色工作区",
          type: "role",
          metrics: [
            ["当前角色", "示例角色A", "rose"],
            ["状态", "行走中", "green"],
            ["好感度", "85", "cyan"],
            ["记忆", "ON", "green"],
          ],
          reply: "主人～欢迎回来。今天想让我陪你整理设置，还是先看看我的动作状态？",
        },
      },
      {
        id: "appearance",
        label: "外观",
        breadcrumb: ["桌宠", "外观", "模型与主题"],
        sections: [
          {
            title: "模型库",
            summary: "统一管理 Live2D、3D、2D 模型资源。",
            fields: [
              field("当前模型", "示例模型安.model3.json", "Live2D"),
              field("模型总数", "19", "来自静态快照"),
              selectField("模型类型", "Live2D", ["Live2D", "3D", "2D"], "右侧显示对应预览"),
            ],
          },
          {
            title: "聊天外观",
            summary: "聊天头像、背景、气泡样式和 UI 主题集中放在外观。",
            fields: [
              field("聊天头像", "已填写", "不显示图片原文"),
              field("聊天背景", "已填写", "不显示图片原文"),
              selectField("气泡样式", "Cyber Soft", ["Cyber Soft", "Minimal", "Glass"], "静态样式位点"),
              chips("特效", ["状态光效", "动作残影", "在线呼吸灯"]),
            ],
          },
        ],
        workspace: {
          title: "外观工作区",
          type: "appearance",
          metrics: [
            ["模型", "Live2D", "rose"],
            ["资源", "19", "cyan"],
            ["食物", "6", "amber"],
            ["主题", "赛博", "blue"],
          ],
        },
      },
      {
        id: "interaction",
        label: "互动",
        breadcrumb: ["桌宠", "互动", "动作与状态"],
        sections: [
          {
            title: "动作系统",
            summary: "动作、表情、状态值、移动和物理模拟放在一起。",
            fields: [
              field("当前行为", "WALKING", "运行中"),
              toggleField("自动移动", true, "桌宠会在活动范围内移动"),
              toggleField("鼠标跟随", true, "开启视觉跟随"),
              field("活动范围", "6007 x 1453", "桌面范围快照"),
            ],
          },
          {
            title: "动作入口与诊断",
            summary: "旧控制页里的动作控制、右键动作入口和动作 Agent 触发记录。",
            fields: [
              field("当前动作", "WALKING", "静态快照"),
              chips("动作入口", ["右键菜单", "动作 Agent", "聊天触发", "状态触发"]),
              field("最近触发记录", "暂无", "静态日志位点"),
              field("动作诊断", "已显示", "只展示面板位置"),
            ],
          },
          {
            title: "状态值",
            summary: "好感、饥饿、疲劳等影响行为反馈。",
            fields: [
              sliderField("好感度", "85", "推荐范围 60 ~ 100", "Friendly"),
              sliderField("饥饿值", "20", "推荐范围 0 ~ 40", "Stable"),
              sliderField("疲劳值", "5", "推荐范围 0 ~ 30", "Energetic"),
            ],
          },
        ],
        workspace: {
          title: "互动工作区",
          type: "interaction",
          metrics: [
            ["动作", "行走中", "green"],
            ["好感", "85", "rose"],
            ["饥饿", "20", "amber"],
            ["疲劳", "5", "cyan"],
          ],
        },
      },
      {
        id: "mouse-icons",
        label: "鼠标图标",
        breadcrumb: ["桌宠", "鼠标图标", "桌面互动"],
        sections: [
          {
            title: "鼠标互动",
            summary: "对应旧控制页里的真实鼠标互动、鼠标穿透、跟随和指向反馈。",
            fields: [
              toggleField("真实鼠标互动", true, "桌宠可响应鼠标靠近、点击和拖动"),
              toggleField("鼠标穿透", true, "鼠标不在桌宠或面板上时穿透到桌面"),
              toggleField("鼠标跟随", true, "角色视线或朝向跟随鼠标"),
              field("点击反馈", "已显示", "静态交互位点"),
              field("拖拽惯性", "已显示", "只展示参数入口"),
            ],
          },
          {
            title: "桌面图标互动",
            summary: "对应真实桌面图标识别、靠近、点击候选和图标区域反馈。",
            fields: [
              toggleField("桌面图标互动", true, "允许桌宠围绕桌面图标产生行为"),
              field("图标识别", "已检测", "不读取真实桌面数据"),
              chips("互动候选", ["靠近", "注视", "点击提示", "绕行", "避让"]),
              field("图标区域", "待接入", "静态可视化入口"),
            ],
          },
        ],
        workspace: {
          title: "鼠标图标工作区",
          type: "interaction",
          metrics: [
            ["鼠标", "开启", "green"],
            ["穿透", "开启", "cyan"],
            ["图标", "开启", "blue"],
            ["拖拽", "静态", "amber"],
          ],
          timeline: ["鼠标互动入口已展示", "桌面图标互动入口已展示", "原型不监听真实鼠标和图标"],
        },
      },
      {
        id: "perception",
        label: "感知",
        breadcrumb: ["桌宠", "感知", "屏幕与输入"],
        sections: [
          {
            title: "屏幕感知",
            summary: "处理屏幕、窗口、区域、OCR 和显示器管理。",
            fields: [
              toggleField("屏幕感知", true, "允许捕获桌面画面摘要"),
              toggleField("窗口感知", true, "识别当前窗口上下文"),
              toggleField("OCR", false, "文字识别入口"),
              field("显示器管理", "已检测", "多屏定位位点"),
            ],
          },
          {
            title: "输入设备",
            summary: "摄像头、麦克风等输入能力只做静态入口。",
            fields: [
              toggleField("摄像头", false, "未接入"),
              toggleField("麦克风", true, "语音识别已启用"),
              field("视觉日志", "待接入", "后续可显示观察记录"),
            ],
          },
        ],
        workspace: {
          title: "感知工作区",
          type: "perception",
          metrics: [
            ["屏幕", "开启", "green"],
            ["窗口", "开启", "cyan"],
            ["OCR", "关闭", "amber"],
            ["显示器", "就绪", "blue"],
          ],
          timeline: ["捕获屏幕摘要", "识别活动窗口", "等待 OCR 任务"],
        },
      },
      {
        id: "vision-area",
        label: "视觉区域",
        breadcrumb: ["桌宠", "视觉区域", "捕获与定位"],
        sections: [
          {
            title: "捕获来源",
            summary: "对应旧视觉页的屏幕、窗口、区域三类捕获来源。",
            fields: [
              selectField("捕获类型", "屏幕", ["屏幕", "窗口", "区域"], "只切换 UI 文案，不连接桌面"),
              field("当前来源", "已选择", "不显示窗口标题或真实画面"),
              field("视觉连接反馈", "等待连接", "静态状态"),
              chips("来源状态", ["屏幕源", "窗口源", "区域源", "跨屏区域"]),
            ],
          },
          {
            title: "区域选择",
            summary: "对应区域框选、裁剪矩形和跨屏区域信息。",
            fields: [
              field("区域 X / Y", "0 / 0", "静态坐标"),
              field("区域宽高", "1920 x 1080", "静态尺寸"),
              field("所在屏幕", "主显示器", "静态显示器"),
              field("区域预览", "未接入", "不截图、不显示真实画面"),
            ],
          },
          {
            title: "桌面定位",
            summary: "对应活动屏幕、互动聊天屏幕、桌宠定位和文件夹位置面板。",
            fields: [
              selectField("活动屏幕", "跟随活动屏幕", ["跟随活动屏幕", "主显示器", "显示器 1", "显示器 2"], "静态选择"),
              selectField("互动聊天屏幕", "主显示器", ["主显示器", "显示器 1", "显示器 2"], "静态选择"),
              field("桌宠定位", "已显示", "位置面板入口"),
              field("文件夹位置", "已显示", "图标 / 文件夹定位入口"),
            ],
          },
        ],
        workspace: {
          title: "视觉区域工作区",
          type: "perception",
          metrics: [
            ["来源", "屏幕", "cyan"],
            ["区域", "1920x1080", "blue"],
            ["定位", "已显示", "green"],
            ["截图", "未接入", "amber"],
          ],
          timeline: ["捕获来源入口已展示", "区域坐标入口已展示", "不会读取真实屏幕画面"],
        },
      },
      {
        id: "model-library",
        label: "模型库",
        breadcrumb: ["桌宠", "模型库", "Live2D / 3D / 2D"],
        sections: [
          {
            title: "模型资源",
            summary: "对应旧模型页的模型库、上传模型、恢复内置模型和当前槽位模型。",
            fields: [
              field("当前槽位模型", "示例模型安.model3.json", "当前角色使用"),
              field("模型数量", "19", "内置 + 自定义"),
              chips("支持格式", ["2D 图片", "Live2D .model3.json", "VRM", "PMX", "FBX", "GLB / GLTF"]),
              selectField("3D Runtime", "Three.js", ["Three.js", "Unity 3D Runtime"], "只显示选择项"),
              toggleField("隐藏内置模型", false, "对应旧模型库过滤状态"),
            ],
          },
          {
            title: "模型预设卡片",
            summary: "原模型卡片里的应用模型、删除模型、当前使用状态。",
            fields: [
              field("当前使用", "示例模型安 Live2D", "已应用"),
              field("自定义模型", "可上传", "静态按钮占位"),
              field("恢复内置模型", "可用", "静态按钮占位"),
            ],
          },
        ],
        workspace: {
          title: "模型库工作区",
          type: "appearance",
          metrics: [
            ["Live2D", "已选", "rose"],
            ["3D", "支持", "cyan"],
            ["2D", "支持", "blue"],
            ["模型数", "19", "green"],
          ],
          timeline: ["当前模型：示例模型安.model3.json", "Runtime：Three.js", "上传入口：静态占位"],
        },
      },
      {
        id: "motion-expression",
        label: "动作表情",
        breadcrumb: ["桌宠", "动作表情", "动作绑定"],
        sections: [
          {
            title: "动作绑定",
            summary: "对应旧模型页的 Live2D / 3D 动作导入和动作槽位绑定。",
            fields: [
              chips("动作槽位", ["待机", "移动", "走路", "跑步", "吃东西", "开心", "难过", "睡觉"]),
              field("动作文件", "支持 VRMA / FBX / GLB / GLTF / motion3", "静态导入入口"),
              field("播放时长", "auto", "可由动作文件决定"),
              textareaField("语义别名", "挠头, 抓后脑勺, 尴尬"),
              textareaField("语义描述", "角色在尴尬、不好意思或思考时抓后脑勺。"),
            ],
          },
          {
            title: "表情文件",
            summary: "Live2D 表情不会占用动作槽位，可由动作 Agent 调用。",
            fields: [
              field("Live2D 表情", "支持 .exp3.json", "静态导入入口"),
              chips("表情标签", ["害羞", "开心", "生气", "思考", "困倦"]),
              toggleField("允许 Agent 调用表情", true, "只展示，不触发"),
            ],
          },
        ],
        workspace: {
          title: "动作表情工作区",
          type: "interaction",
          metrics: [
            ["动作", "8 槽位", "green"],
            ["表情", "支持", "rose"],
            ["Agent", "可调用", "cyan"],
            ["导入", "静态", "amber"],
          ],
          timeline: ["动作槽位已列出", "Live2D 表情已归档", "未绑定真实动作播放"],
        },
      },
      {
        id: "chat-appearance",
        label: "聊天外观",
        breadcrumb: ["桌宠", "聊天外观", "头像 / 背景 / 文字"],
        sections: [
          {
            title: "聊天头像",
            summary: "对应旧模型页的聊天头像开关、头像大小和用户头像。",
            fields: [
              toggleField("启用聊天头像", true, "消息中显示角色头像"),
              sliderField("头像大小", "48", "推荐范围 36 ~ 72", "清晰"),
              field("用户显示名", "主人", "静态示例"),
              field("用户显示 ID", "user", "静态示例"),
              field("用户头像", "已填写", "不显示图片内容"),
            ],
          },
          {
            title: "聊天背景",
            summary: "聊天背景图、背景大小和可见度。",
            fields: [
              toggleField("启用聊天背景", true, "显示背景图"),
              field("背景图片", "已填写", "不显示图片内容"),
              sliderField("背景大小", "100%", "推荐范围 80% ~ 140%", "适中"),
              sliderField("背景可见度", "42%", "推荐范围 20% ~ 60%", "柔和"),
              field("括号外文字颜色", "#0f766e", "区分动作描写和对白"),
            ],
          },
        ],
        workspace: {
          title: "聊天外观工作区",
          type: "prompt",
          metrics: [
            ["头像", "开启", "green"],
            ["背景", "开启", "cyan"],
            ["文字色", "#0f766e", "blue"],
            ["透明度", "42%", "rose"],
          ],
          reply: "示例角色A：主人～欢迎回来。\n用户：今天忙吗？",
        },
      },
      {
        id: "food-library",
        label: "食物库",
        breadcrumb: ["桌宠", "食物库", "桌面食物"],
        sections: [
          {
            title: "食物外观库",
            summary: "对应旧模型页的食物图片上传、恢复预设食物和随机挑选外观。",
            fields: [
              field("食物图片", "6 / 24", "当前静态快照"),
              field("上传食物图", "可用", "静态按钮占位"),
              field("恢复预设食物", "可用", "静态按钮占位"),
              chips("食物状态", ["随机外观", "桌面投喂", "饥饿值联动"]),
            ],
          },
        ],
        workspace: {
          title: "食物库工作区",
          type: "appearance",
          metrics: [
            ["食物", "6", "amber"],
            ["上限", "24", "cyan"],
            ["预设", "可恢复", "green"],
            ["投喂", "静态", "rose"],
          ],
          timeline: ["食物外观用于创建桌面食物", "饥饿值会影响靠近食物行为", "原型不创建真实食物"],
        },
      },
      {
        id: "activity-physics",
        label: "范围与物理",
        breadcrumb: ["桌宠", "范围与物理", "活动边界"],
        sections: [
          {
            title: "活动范围",
            summary: "对应旧控制页的活动区域、显示器、边界和活动范围可视化。",
            fields: [
              toggleField("限制活动范围", true, "桌宠只在指定区域内移动"),
              selectField("活动显示器", "主显示器", ["主显示器", "显示器 1", "显示器 2"], "静态显示器列表"),
              sliderField("活动范围缩放", "100%", "推荐范围 60% ~ 100%", "完整桌面"),
              field("活动宽度", "6007", "静态快照"),
              field("活动高度", "1453", "静态快照"),
              field("偏移 X / Y", "0 / 0", "静态快照"),
            ],
          },
          {
            title: "物理模拟",
            summary: "重力、碰撞、拖拽惯性和落地反馈。",
            fields: [
              toggleField("启用物理", true, "桌宠受重力和碰撞影响"),
              toggleField("显示活动边界", false, "调试用边框"),
              chips("碰撞配置", ["左边界", "右边界", "顶部", "底部", "缩放修正"]),
            ],
          },
          {
            title: "模型尺寸",
            summary: "对应旧控制页的模型尺寸、手动偏移和缩放修正。",
            fields: [
              field("模型尺寸", "自动", "静态快照"),
              sliderField("缩放倍率", "100%", "推荐范围 40% ~ 180%", "标准"),
              toggleField("手动尺寸", false, "显示手动宽高入口"),
              field("模型偏移 X / Y", "0 / 0", "静态偏移"),
            ],
          },
        ],
        workspace: {
          title: "范围与物理工作区",
          type: "interaction",
          metrics: [
            ["范围", "6007 x 1453", "cyan"],
            ["物理", "开启", "green"],
            ["边界", "隐藏", "blue"],
            ["显示器", "主屏", "violet"],
          ],
          timeline: ["活动区域已展示", "物理开关已展示", "不修改真实窗口边界"],
        },
      },
    ],
  },
  {
    id: "platform",
    label: "平台",
    cn: "平台",
    icon: "✚",
    color: "violet",
    desc: "插件、MCP、工作流、API",
    status: [
      ["插件", "3 个就绪"],
      ["MCP", "已连接"],
      ["工作流", "草稿"],
      ["API", "受保护"],
    ],
    pages: [
      {
        id: "plugins",
        label: "插件",
        breadcrumb: ["平台", "插件", "生态"],
        sections: [
          {
            title: "插件管理",
            summary: "插件市场、已安装插件、权限和事件统一接入。",
            fields: [
              field("已安装插件", "3", "静态示例"),
              selectField("插件状态", "就绪", ["就绪", "已禁用", "错误"], "用于右侧状态预览"),
              chips("权限", ["文件", "网络", "工具调用", "事件订阅"]),
            ],
          },
          {
            title: "开发者模式",
            summary: "给插件开发者查看字段、绑定、Preview 和事件。",
            fields: [
              toggleField("开发者模式", true, "显示检查器"),
              field("插件入口", "模块 -> 页面 -> 字段 -> 工作区", "统一注册结构"),
            ],
          },
        ],
        workspace: {
          title: "插件工作区",
          type: "plugins",
          metrics: [
            ["插件", "3", "violet"],
            ["状态", "就绪", "green"],
            ["权限", "4", "cyan"],
            ["事件", "12", "blue"],
          ],
          timeline: ["插件载入", "权限检查", "事件订阅完成"],
        },
      },
      {
        id: "mcp",
        label: "MCP",
        breadcrumb: ["平台", "MCP", "工具服务"],
        sections: [
          {
            title: "MCP 服务",
            summary: "外部工具服务、连接状态和调用延迟。",
            fields: [
              field("连接状态", "已连接", "3 个服务"),
              field("运行工具", "工具", "静态占位"),
              field("响应时间", "128 ms", "模拟延迟"),
              toggleField("调用确认", true, "高风险工具需要确认"),
            ],
          },
        ],
        workspace: {
          title: "MCP 工作区",
          type: "mcp",
          metrics: [
            ["已连接", "3", "green"],
            ["运行中", "工具", "cyan"],
            ["响应", "128ms", "blue"],
            ["错误", "0", "green"],
          ],
          timeline: ["list_tools", "call_tool preview", "response received"],
        },
      },
      {
        id: "workflow",
        label: "工作流",
        breadcrumb: ["平台", "工作流", "自动化"],
        sections: [
          {
            title: "工作流",
            summary: "未来用于跨 AI、桌宠、插件和系统的自动化流程。",
            fields: [
              field("当前工作流", "草稿", "未启用"),
              chips("触发器", ["时间", "消息", "状态", "插件事件"]),
              chips("动作", ["调用模型", "移动角色", "写日志", "调用插件"]),
            ],
          },
        ],
        workspace: {
          title: "工作流工作区",
          type: "workflow",
          metrics: [
            ["草稿", "2", "violet"],
            ["触发器", "4", "cyan"],
            ["动作", "4", "blue"],
            ["运行", "0", "amber"],
          ],
          timeline: ["触发器等待", "动作链未启用", "等待真实执行器接入"],
        },
      },
      {
        id: "skills-api",
        label: "Skill / API",
        breadcrumb: ["平台", "Skill / API", "开发者入口"],
        sections: [
          {
            title: "Skill 管理",
            summary: "预留开放式能力包入口，未来插件和 Skill 可以统一注册页面。",
            fields: [
              field("Skill 数量", "待接入", "静态入口"),
              selectField("启用范围", "全局", ["全局", "当前角色", "当前插件"], "受顶部作用域影响"),
              chips("Skill 信息", ["名称", "描述", "权限", "触发条件", "工作区"]),
            ],
          },
          {
            title: "API 管理",
            summary: "第三方服务、Webhook、服务授权和回调地址。",
            fields: [
              field("API 注册", "预留", "静态入口"),
              secretField("第三方服务 Key", "未填写", "敏感字段只显示状态"),
              field("Webhook", "未配置", "静态入口"),
              toggleField("开发者模式", true, "显示字段绑定和检查器信息"),
            ],
          },
        ],
        workspace: {
          title: "Skill / API 工作区",
          type: "plugins",
          metrics: [
            ["Skill", "预留", "violet"],
            ["API", "预留", "cyan"],
            ["权限", "待配置", "amber"],
            ["开发者", "开启", "green"],
          ],
          timeline: ["统一结构：模块 -> 页面 -> 字段 -> 工作区", "未接入真实插件系统"],
        },
      },
      {
        id: "migration-map",
        label: "迁移对照",
        breadcrumb: ["平台", "迁移对照", "旧设置 -> V3"],
        sections: [
          {
            title: "旧设置页映射",
            summary: "用于检查已有功能是否已经在 V3 静态 UI 中找到位置。",
            fields: [
              chips("人格页", ["角色", "Prompt", "记忆", "知识库", "AI 模型"]),
              chips("模型页", ["模型库", "动作表情", "食物库", "聊天外观"]),
              chips("控制页", ["互动", "鼠标图标", "范围与物理", "动作 Agent", "状态值", "模型尺寸"]),
              chips("视觉页", ["感知", "视觉模型", "视觉区域", "活动屏幕", "显示器管理"]),
              chips("语音页", ["语音模型", "语音开关", "TTS", "STT", "本地语音运行时"]),
              chips("系统页", ["联网", "Runtime", "日志", "性能", "存储", "备份"]),
            ],
          },
          {
            title: "接入状态",
            summary: "本页只说明位置，不代表真实功能已迁移。",
            fields: [
              field("静态 UI", "已补全第一轮", "可继续按截图调整"),
              field("真实能力", "未接入", "不会读写真实配置"),
              field("下一步", "逐页核对遗漏", "建议从 AI 和桌宠开始"),
            ],
          },
        ],
        workspace: {
          title: "迁移对照工作区",
          type: "workflow",
          metrics: [
            ["旧页", "6", "cyan"],
            ["V3 模块", "5", "green"],
            ["状态", "静态", "amber"],
            ["能力接入", "无", "rose"],
          ],
          timeline: ["人格 -> 桌宠/AI", "模型 -> 桌宠", "控制 -> 桌宠", "视觉/语音 -> AI/桌宠", "系统 -> 系统/AI"],
        },
      },
    ],
  },
  {
    id: "system",
    label: "系统",
    cn: "系统",
    icon: "⚙",
    color: "gray",
    desc: "运行时、日志、性能、数据",
    status: [
      ["运行时", "健康"],
      ["FPS", "60"],
      ["内存", "512 MB"],
      ["日志", "实时"],
    ],
    pages: [
      {
        id: "runtime",
        label: "运行时",
        breadcrumb: ["系统", "运行时", "运行时"],
        sections: [
          {
            title: "运行状态",
            summary: "桌宠运行时、渲染状态、线程和健康检查。",
            fields: [
              field("运行时", "健康", "当前运行正常"),
              field("Renderer", "Live2D", "渲染器已加载"),
              field("FPS", "60", "稳定"),
              field("线程", "Main / Render / Agent", "静态快照"),
            ],
          },
          {
            title: "性能",
            summary: "性能指标用于判断 UI、模型和渲染压力。",
            fields: [
              field("CPU", "12%", "模拟数值"),
              field("内存", "512 MB", "模拟数值"),
              field("GPU", "18%", "模拟数值"),
            ],
          },
        ],
        workspace: {
          title: "运行时工作区",
          type: "runtime",
          metrics: [
            ["FPS", "60", "green"],
            ["CPU", "12%", "cyan"],
            ["内存", "512MB", "blue"],
            ["GPU", "18%", "violet"],
          ],
          timeline: ["Renderer ready", "Agent loop stable", "No runtime warnings"],
        },
      },
      {
        id: "logs",
        label: "日志",
        breadcrumb: ["系统", "日志", "实时输出"],
        sections: [
          {
            type: "logConsole",
            title: "平台日志",
            summary: "运行日志、错误日志和 Agent 诊断日志集中查看。这里是静态 UI 示例，不读取真实日志文件。",
            notice: "Debug 日志需要在「配置文件 → 系统 → 控制台日志级别」中开启",
            autoScroll: true,
            actions: ["安装 Pip 库"],
            levels: ["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"],
            sources: ["Core", "Runtime", "Agent", "插件", "MCP", "视觉", "语音"],
            addLabel: "添加日志显示",
            fields: [
              field("日志等级", "DEBUG / INFO / WARNING / ERROR / CRITICAL", "静态筛选状态"),
              field("自动滚动", "已开启", "只展示 UI 状态"),
              field("日志来源", "Core / Runtime / Agent / 插件 / MCP / 视觉 / 语音", "静态来源分组"),
            ],
            entries: [
              {
                level: "debug",
                time: "2026-06-25 13:43:47.590",
                source: "Core",
                version: "v4.23.6",
                path: "runtime.bootstrap:24",
                message: "控制中心日志面板已挂载，当前处于静态原型模式。",
              },
              {
                level: "info",
                time: "2026-06-25 13:43:47.618",
                source: "Core",
                version: "v4.23.6",
                path: "core.event_bus:61",
                message: "[default] [示例群(bot)] 成员A/10000001: [图片]",
              },
              {
                level: "warning",
                time: "2026-06-25 13:43:47.623",
                source: "Core",
                version: "v4.23.6",
                path: "star.context:338",
                message: "没有找到 ID 为 deepseek_default_source/deepseek-chat 的提供商，这可能是由于您修改了提供商（模型）ID 导致的。",
              },
              {
                level: "error",
                time: "2026-06-25 13:43:47.623",
                source: "Plug",
                version: "v4.23.6",
                path: "astrbot.long_term_memory:139",
                message: "获取图片描述失败：没有找到 ID 为 deepseek_default_source/deepseek-chat 的提供商。",
              },
              {
                level: "info",
                time: "2026-06-25 13:43:47.954",
                source: "Agent",
                version: "v4.23.6",
                path: "pet.motion_agent:88",
                message: "动作候选：WALKING / IDLE / HAPPY，当前选择 WALKING。",
              },
              {
                level: "warning",
                time: "2026-06-25 15:05:53.336",
                source: "Runtime",
                version: "v4.23.6",
                path: "desktop.capture:77",
                message: "视觉区域未连接真实桌面源，当前显示静态 UI 状态。",
              },
              {
                level: "critical",
                time: "2026-06-25 15:05:53.420",
                source: "Runtime",
                version: "v4.23.6",
                path: "watchdog.health:12",
                message: "示例严重日志：用于验证 CRITICAL 颜色和筛选入口，不代表真实错误。",
              },
            ],
          },
        ],
        workspace: {
          title: "日志工作区",
          type: "logs",
          metrics: [
            ["DEBUG", "24", "cyan"],
            ["INFO", "128", "green"],
            ["警告", "2", "amber"],
            ["错误", "1", "rose"],
          ],
          timeline: ["[DEBUG] control center mounted", "[INFO] workspace tab changed", "[WARNING] static prototype mode", "[ERROR] provider id not found"],
        },
      },
      {
        id: "performance",
        label: "性能",
        breadcrumb: ["系统", "性能", "指标与线程"],
        sections: [
          {
            title: "性能指标",
            summary: "把旧系统页和运行时里的 FPS、CPU、内存、GPU 独立成可查看页面。",
            fields: [
              field("FPS", "60", "静态快照"),
              field("CPU", "12%", "模拟数值"),
              field("内存", "512 MB", "模拟数值"),
              field("GPU", "18%", "模拟数值"),
              field("最近更新时间", "2 分钟前", "静态 UI 快照"),
            ],
          },
          {
            title: "渲染与线程",
            summary: "用于后续判断渲染压力、Agent 循环和后台任务状态。",
            fields: [
              field("Renderer", "Live2D", "渲染器状态"),
              field("主线程", "稳定", "静态状态"),
              field("渲染线程", "稳定", "静态状态"),
              field("Agent 线程", "运行中", "静态状态"),
              chips("性能面板", ["帧率", "内存", "GPU", "线程", "Renderer"]),
            ],
          },
        ],
        workspace: {
          title: "性能工作区",
          type: "runtime",
          metrics: [
            ["FPS", "60", "green"],
            ["CPU", "12%", "cyan"],
            ["内存", "512MB", "blue"],
            ["GPU", "18%", "violet"],
          ],
          timeline: ["FPS 稳定", "内存占用静态展示", "未接入真实性能采集"],
        },
      },
      {
        id: "data",
        label: "数据",
        breadcrumb: ["系统", "数据", "导入导出"],
        sections: [
          {
            title: "数据维护",
            summary: "存储、导入导出、备份恢复和迁移包。",
            fields: [
              field("存储状态", "就绪", "配置目录可用"),
              field("备份", "未创建", "静态占位"),
              chips("数据操作", ["导入", "导出", "备份", "恢复"]),
            ],
          },
        ],
        workspace: {
          title: "数据工作区",
          type: "data",
          metrics: [
            ["存储", "就绪", "green"],
            ["备份", "0", "amber"],
            ["导出", "就绪", "cyan"],
            ["导入", "空闲", "blue"],
          ],
          timeline: ["等待用户选择数据操作", "不会在原型中读写真文件"],
        },
      },
      {
        id: "network",
        label: "网络",
        breadcrumb: ["系统", "网络", "连接与代理"],
        sections: [
          {
            title: "系统网络",
            summary: "系统级网络状态、代理和下载连接，不等于 AI 联网搜索能力。",
            fields: [
              field("连接状态", "正常", "静态示例"),
              field("代理", "未配置", "静态入口"),
              field("下载通道", "默认", "用于资源和模型下载"),
              toggleField("网络诊断日志", false, "只显示开关"),
            ],
          },
          {
            title: "浏览器搜索环境",
            summary: "本机浏览器路径、调试端口和默认搜索引擎归档到系统网络。",
            fields: [
              field("浏览器路径", "自动查找 Edge / Chrome", "不显示真实路径"),
              field("调试端口", "9222", "静态默认值"),
              selectField("搜索引擎", "自动", ["自动", "百度", "Google", "Bing", "搜狗", "自定义"], "AI 页面决定是否调用"),
              field("自定义搜索 URL", "未填写", "静态入口"),
            ],
          },
        ],
        workspace: {
          title: "网络工作区",
          type: "runtime",
          metrics: [
            ["网络", "正常", "green"],
            ["代理", "无", "cyan"],
            ["端口", "9222", "blue"],
            ["诊断", "关闭", "amber"],
          ],
          timeline: ["系统网络独立于 AI 联网能力", "不启动浏览器调试实例"],
        },
      },
      {
        id: "storage",
        label: "存储",
        breadcrumb: ["系统", "存储", "缓存与资源"],
        sections: [
          {
            title: "资源存储",
            summary: "模型、图片、语音缓存、日志和配置目录的静态入口。",
            fields: [
              field("配置目录", "已检测", "不显示真实路径"),
              field("模型资源", "可用", "Live2D / 3D / 2D"),
              field("语音缓存", "可清理", "静态按钮占位"),
              field("日志缓存", "可清理", "静态按钮占位"),
            ],
          },
          {
            title: "数据占用",
            summary: "后续可接入容量统计，现在只做 UI 占位。",
            fields: [
              field("模型占用", "待统计", "未接入"),
              field("语音占用", "待统计", "未接入"),
              field("日志占用", "待统计", "未接入"),
            ],
          },
        ],
        workspace: {
          title: "存储工作区",
          type: "data",
          metrics: [
            ["配置", "已检测", "green"],
            ["模型", "待统计", "cyan"],
            ["语音", "待统计", "blue"],
            ["日志", "待统计", "violet"],
          ],
          timeline: ["只显示静态存储入口", "不扫描真实文件大小"],
        },
      },
      {
        id: "backup-debug",
        label: "备份与调试",
        breadcrumb: ["系统", "备份与调试", "恢复 / 诊断"],
        sections: [
          {
            title: "导入导出与备份",
            summary: "配置导入、导出、备份和恢复点集中在这里。",
            fields: [
              field("导入配置", "可用", "静态按钮占位"),
              field("导出配置", "可用", "静态按钮占位"),
              field("创建备份", "未创建", "静态按钮占位"),
              field("恢复备份", "无可用备份", "静态入口"),
            ],
          },
          {
            title: "调试",
            summary: "开发日志、诊断开关、运行时检查和测试入口。",
            fields: [
              toggleField("开发者日志", true, "显示更详细的日志"),
              toggleField("Agent 诊断", true, "显示规划、权限和工具状态"),
              field("前端错误", "0", "静态示例"),
              field("一键诊断", "可用", "静态按钮占位"),
            ],
          },
        ],
        workspace: {
          title: "备份调试工作区",
          type: "logs",
          metrics: [
            ["备份", "0", "amber"],
            ["导出", "就绪", "cyan"],
            ["调试", "开启", "green"],
            ["错误", "0", "green"],
          ],
          timeline: ["不会创建真实备份", "不会导出真实配置", "仅用于确认 UI 位置"],
        },
      },
      {
        id: "about",
        label: "关于",
        breadcrumb: ["系统", "关于", "版本信息"],
        sections: [
          {
            title: "版本",
            summary: "应用版本、构建信息、版权和更新说明。",
            fields: [
              field("控制中心", "V3 静态原型", "当前 UI 验证版"),
              field("桌宠平台", "PET-ENGINE", "产品定位"),
              field("构建时间", "2026-06-26", "静态显示"),
              field("更新说明", "信息架构重组", "不接真实更新服务"),
            ],
          },
        ],
        workspace: {
          title: "关于工作区",
          type: "dashboard",
          metrics: [
            ["版本", "V3", "cyan"],
            ["类型", "静态原型", "amber"],
            ["能力接入", "无", "rose"],
            ["状态", "可预览", "green"],
          ],
          timeline: ["Control Center V3", "开放式 AI 桌宠平台控制台", "当前仅验证 UI 结构"],
        },
      },
    ],
  },
];

const scopes = ["全局", "当前角色", "当前群聊", "当前插件"];
const workspaceTabs = ["工作区", "检查器", "日志"];

let activeModuleId = "dashboard";
let activePageId = "overview";
let activeScope = "全局";
let activePetId = "primary";
let activeWorkspaceTab = "工作区";
let searchTerm = "";

const primaryNav = document.querySelector("#primaryNav");
const entityDock = document.querySelector("#entityDock");
const editorRoot = document.querySelector("#editorRoot");
const workspaceRoot = document.querySelector("#workspaceRoot");

function field(label, value, meta = "") {
  return { type: "text", label, value, meta };
}

function secretField(label, value, meta = "") {
  return { type: "secret", label, value, meta };
}

function textareaField(label, value, meta = "") {
  return { type: "textarea", label, value, meta };
}

function selectField(label, value, options, meta = "") {
  return { type: "select", label, value, options, meta };
}

function toggleField(label, checked, meta = "") {
  return { type: "toggle", label, checked, meta };
}

function sliderField(label, value, range, state) {
  return { type: "slider", label, value, range, state };
}

function chips(label, values) {
  return { type: "chips", label, values };
}

function getActiveModule() {
  return modules.find((item) => item.id === activeModuleId) ?? modules[0];
}

function getActivePage() {
  const module = getActiveModule();
  return module.pages.find((page) => page.id === activePageId) ?? module.pages[0];
}

function getActivePet() {
  return roster.find((item) => item.id === activePetId) ?? roster[0];
}

function setModule(moduleId) {
  activeModuleId = moduleId;
  const module = getActiveModule();
  activePageId = module.pages[0]?.id ?? "";
  activeWorkspaceTab = "工作区";
  render();
}

function setPage(pageId) {
  activePageId = pageId;
  activeWorkspaceTab = "工作区";
  render();
}

function renderNav() {
  primaryNav.innerHTML = modules.map((module) => `
    <button class="nav-item ${module.id === activeModuleId ? "active" : ""}" data-module="${module.id}" data-color="${module.color}" type="button">
      <span class="nav-icon">${module.icon}</span>
      <span class="nav-text">
        <strong>${module.label}</strong>
        <small>${module.cn} · ${module.desc}</small>
      </span>
    </button>
  `).join("");

  primaryNav.querySelectorAll("[data-module]").forEach((button) => {
    button.addEventListener("click", () => setModule(button.dataset.module));
  });
}

function renderEntityDock() {
  const activePet = getActivePet();
  entityDock.innerHTML = `
    <div class="entity-dock-header">
      <span>对象</span>
      <strong>${activePet.name}</strong>
    </div>
    <div class="entity-list">
      ${roster.map((pet, index) => `
        <button class="entity-card ${pet.id === activePetId ? "active" : ""}" data-pet="${pet.id}" type="button">
          <span class="entity-avatar"></span>
          <span>
            <strong>${pet.name}</strong>
            <small>${index + 1}号 · ${pet.state}</small>
          </span>
          <i data-online="${pet.online}"></i>
        </button>
      `).join("")}
    </div>
  `;

  entityDock.querySelectorAll("[data-pet]").forEach((button) => {
    button.addEventListener("click", () => {
      activePetId = button.dataset.pet;
      if (activeScope !== "全局") activeScope = "当前角色";
      render();
    });
  });
}

function renderEditor() {
  const module = getActiveModule();
  const page = getActivePage();
  const searchResults = getSearchResults();

  editorRoot.innerHTML = `
    <header class="editor-topbar">
      <div class="topbar-row">
        <div class="search-box">
          <span>⌕</span>
          <input id="globalSearch" value="${escapeHtml(searchTerm)}" placeholder="搜索设置、模块、字段..." />
        </div>
        <label class="scope-select">
          <span>作用域</span>
          <select id="scopeSelect">
            ${scopes.map((scope) => `<option ${scope === activeScope ? "selected" : ""}>${scope}</option>`).join("")}
          </select>
        </label>
      </div>
      <div id="searchResultsSlot">
        ${searchTerm ? searchResultsMarkup(searchResults) : ""}
      </div>
    </header>

    <section class="module-status-bar" data-color="${module.color}">
      <div>
        <div class="breadcrumb">${page.breadcrumb.map((item) => `<span>${item}</span>`).join("<b>/</b>")}</div>
        <h1>${module.label}</h1>
      </div>
      <div class="status-strip">
        ${module.status.map(([label, value]) => `
          <span><small>${label}</small><strong>${value}</strong></span>
        `).join("")}
      </div>
    </section>

    <nav class="page-tabs">
      ${module.pages.map((item) => `
        <button class="${item.id === page.id ? "active" : ""}" data-page="${item.id}" type="button">${item.label}</button>
      `).join("")}
    </nav>

    <section class="editor-scroll">
      ${page.sections.map((section, index) => sectionMarkup(section, index, module.color)).join("")}
    </section>
  `;

  const searchInput = editorRoot.querySelector("#globalSearch");
  searchInput.addEventListener("input", (event) => {
    searchTerm = event.target.value;
    const slot = editorRoot.querySelector("#searchResultsSlot");
    slot.innerHTML = searchTerm ? searchResultsMarkup(getSearchResults()) : "";
    attachSearchResults();
  });

  editorRoot.querySelector("#scopeSelect").addEventListener("change", (event) => {
    activeScope = event.target.value;
    render();
  });

  editorRoot.querySelectorAll("[data-page]").forEach((button) => {
    button.addEventListener("click", () => setPage(button.dataset.page));
  });
}

function sectionMarkup(section, index, color) {
  if (section.type === "logConsole") {
    return logConsoleMarkup(section, color);
  }

  return `
    <article class="editor-section" data-color="${color}">
      <div class="section-head">
        <span>${String(index + 1).padStart(2, "0")}</span>
        <div>
          <h2>${section.title}</h2>
          <p>${section.summary}</p>
        </div>
      </div>
      <div class="field-stack">
        ${section.fields.map(fieldMarkup).join("")}
      </div>
    </article>
  `;
}

function logConsoleMarkup(section, color) {
  const checked = section.autoScroll ? "checked" : "";
  return `
    <article class="log-console-section" data-color="${color}">
      <div class="log-console-header">
        <div>
          <h2>${section.title}</h2>
          <p>${section.summary}</p>
        </div>
        <div class="log-console-actions">
          <label class="log-switch">
            <input type="checkbox" ${checked} />
            <span>自动滚动已开启</span>
          </label>
          ${(section.actions ?? []).map((action) => `<button type="button">${action}</button>`).join("")}
        </div>
      </div>

      <div class="log-notice">
        <span>i</span>
        <strong>${section.notice}</strong>
      </div>

      <div class="log-display-bar">
        <div class="log-display-group">
          <span>级别</span>
          <div class="log-levels">
            ${(section.levels ?? []).map((level) => `<button type="button"><span>✓</span>${level}</button>`).join("")}
          </div>
        </div>
        <div class="log-display-group">
          <span>来源</span>
          <div class="log-sources">
            ${(section.sources ?? []).map((source) => `<button type="button"><span>✓</span>${source}</button>`).join("")}
          </div>
        </div>
        <button class="log-add-source" type="button">+ ${section.addLabel ?? "添加日志显示"}</button>
      </div>

      <div class="log-console-frame">
        <div class="log-console-blur" aria-hidden="true">
          ${Array.from({ length: 7 }).map(() => `<p>${"▥ ".repeat(44)}</p>`).join("")}
        </div>
        <div class="log-console-lines">
          ${(section.entries ?? []).map(logLineMarkup).join("")}
        </div>
      </div>
    </article>
  `;
}

function logLineMarkup(entry) {
  return `
    <p class="log-line" data-level="${entry.level}">
      <span class="log-time">[${entry.time}]</span>
      <span class="log-source">[${entry.source}]</span>
      <span class="log-level">[${entry.level.toUpperCase()}]</span>
      <span class="log-version">[${entry.version}]</span>
      <span class="log-path">[${entry.path}]</span>
      <span class="log-message">${escapeHtml(entry.message)}</span>
    </p>
  `;
}

function fieldMarkup(item) {
  if (item.type === "secret") {
    return `
      <label class="field-row">
        <span>${item.label}</span>
        <input type="password" value="••••••••••••" />
        ${fieldMeta(item.meta)}
      </label>
    `;
  }

  if (item.type === "textarea") {
    return `
      <label class="field-row field-wide">
        <span>${item.label}</span>
        <textarea>${escapeHtml(item.value)}</textarea>
        ${fieldMeta(item.meta)}
      </label>
    `;
  }

  if (item.type === "select") {
    return `
      <label class="field-row">
        <span>${item.label}</span>
        <span class="select-wrap">
          <select>
            ${item.options.map((option) => `<option ${option === item.value ? "selected" : ""}>${option}</option>`).join("")}
          </select>
          <b>展开</b>
        </span>
        ${fieldMeta(item.meta)}
      </label>
    `;
  }

  if (item.type === "toggle") {
    return `
      <label class="field-row toggle-row">
        <span>${item.label}</span>
        <input type="checkbox" ${item.checked ? "checked" : ""} />
        ${fieldMeta(item.meta)}
      </label>
    `;
  }

  if (item.type === "slider") {
    return `
      <label class="field-row slider-row">
        <span>${item.label}</span>
        <strong>${item.value}</strong>
        <input type="range" value="70" />
        <em>${item.range}</em>
        <small>当前：${item.state}</small>
      </label>
    `;
  }

  if (item.type === "chips") {
    return `
      <div class="field-row chip-row">
        <span>${item.label}</span>
        <div>${item.values.map((value) => `<b>${value}</b>`).join("")}</div>
      </div>
    `;
  }

  return `
    <label class="field-row">
      <span>${item.label}</span>
      <input value="${escapeHtml(item.value)}" />
      ${fieldMeta(item.meta)}
    </label>
  `;
}

function fieldMeta(meta) {
  return meta ? `<small>${escapeHtml(meta)}</small>` : "";
}

function renderWorkspace() {
  const module = getActiveModule();
  const page = getActivePage();
  workspaceRoot.innerHTML = `
    <header class="workspace-header">
      <div>
        <small>工作区</small>
        <h2>${page.workspace.title}</h2>
      </div>
      <div class="workspace-tabs">
        ${workspaceTabs.map((tab) => `
          <button class="${tab === activeWorkspaceTab ? "active" : ""}" data-workspace-tab="${tab}" type="button">${tab}</button>
        `).join("")}
      </div>
    </header>

    <section class="workspace-body">
      ${activeWorkspaceTab === "工作区" ? workspacePanelMarkup(page.workspace, module.color) : ""}
      ${activeWorkspaceTab === "检查器" ? inspectorMarkup(module, page) : ""}
      ${activeWorkspaceTab === "日志" ? logsMarkup(page.workspace) : ""}
    </section>
  `;

  workspaceRoot.querySelectorAll("[data-workspace-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      activeWorkspaceTab = button.dataset.workspaceTab;
      renderWorkspace();
    });
  });
}

function workspacePanelMarkup(workspace, color) {
  return `
    <div class="workspace-panel" data-color="${color}">
      <div class="metric-grid">
        ${workspace.metrics.map(([label, value, tone]) => `
          <div class="metric-card" data-color="${tone}">
            <span>${label}</span>
            <strong>${value}</strong>
          </div>
        `).join("")}
      </div>
      ${visualMarkup(workspace)}
      ${workspace.reply ? `
        <div class="reply-preview">
          <span>AI 模拟回复</span>
          <p>${workspace.reply}</p>
        </div>
      ` : ""}
      ${workspace.timeline ? timelineMarkup(workspace.timeline) : ""}
    </div>
  `;
}

function visualMarkup(workspace) {
  if (["appearance", "role", "interaction", "perception"].includes(workspace.type)) {
    return `
      <div class="pet-preview">
        <div class="pet-stage">
          <span class="pet-aura"></span>
          <span class="pet-orbit"></span>
          <span class="pet-avatar-large"></span>
        </div>
        <div class="preview-controls">
          <button type="button">待机</button>
          <button type="button">行走</button>
          <button type="button">微笑</button>
        </div>
      </div>
    `;
  }

  if (["runtime", "logs", "dashboard"].includes(workspace.type)) {
    return `
      <div class="chart-preview">
        <span style="height:42%"></span>
        <span style="height:68%"></span>
        <span style="height:51%"></span>
        <span style="height:82%"></span>
        <span style="height:56%"></span>
        <span style="height:73%"></span>
      </div>
    `;
  }

  if (["plugins", "mcp", "workflow"].includes(workspace.type)) {
    return `
      <div class="node-preview">
        <span>模块</span>
        <i></i>
        <span>字段</span>
        <i></i>
        <span>工作区</span>
      </div>
    `;
  }

  return `
    <div class="ai-console">
      <div>系统 Prompt</div>
      <div>记忆</div>
      <div>知识库</div>
      <div>工具策略</div>
    </div>
  `;
}

function inspectorMarkup(module, page) {
  const firstField = page.sections[0]?.fields[0];
  return `
    <div class="inspector-panel">
      <h3>检查器</h3>
      <dl>
        <div><dt>模块</dt><dd>${module.label}</dd></div>
        <div><dt>页面</dt><dd>${page.label}</dd></div>
        <div><dt>作用域</dt><dd>${activeScope}</dd></div>
        <div><dt>选中字段</dt><dd>${firstField?.label ?? "无"}</dd></div>
        <div><dt>类型</dt><dd>${fieldTypeLabel(firstField?.type)}</dd></div>
        <div><dt>绑定</dt><dd>${module.id}.${page.id}.${firstField?.label ?? "field"}</dd></div>
        <div><dt>来源</dt><dd>静态原型</dd></div>
        <div><dt>更新时间</dt><dd>14:30</dd></div>
      </dl>
    </div>
  `;
}

function logsMarkup(workspace) {
  const lines = workspace.timeline ?? ["workspace mounted", "waiting for action"];
  return `
    <div class="log-panel">
      ${lines.map((line, index) => `<p><span>${String(index + 1).padStart(2, "0")}</span>${line}</p>`).join("")}
    </div>
  `;
}

function timelineMarkup(lines) {
  return `
    <div class="timeline">
      ${lines.map((line) => `<p>${line}</p>`).join("")}
    </div>
  `;
}

function getSearchResults() {
  const term = searchTerm.trim().toLowerCase();
  if (!term) return [];
  const results = [];
  modules.forEach((module) => {
    module.pages.forEach((page) => {
      page.sections.forEach((section) => {
        section.fields.forEach((item) => {
          const text = `${module.label} ${module.cn} ${page.label} ${section.title} ${item.label}`.toLowerCase();
          if (text.includes(term)) {
            results.push({ module, page, section, item });
          }
        });
      });
    });
  });
  return results.slice(0, 8);
}

function searchResultsMarkup(results) {
  return `
    <div class="search-results">
      ${results.length ? results.map((result) => `
        <button type="button" data-search-module="${result.module.id}" data-search-page="${result.page.id}">
          <strong>${result.module.label}</strong>
          <span>${result.page.label} / ${result.section.title} / ${result.item.label}</span>
        </button>
      `).join("") : `<p>没有找到匹配项</p>`}
    </div>
  `;
}

function attachSearchResults() {
  editorRoot.querySelectorAll("[data-search-module]").forEach((button) => {
    button.addEventListener("click", () => {
      activeModuleId = button.dataset.searchModule;
      activePageId = button.dataset.searchPage;
      searchTerm = "";
      render();
    });
  });
}

function fieldTypeLabel(type) {
  return {
    text: "文本",
    secret: "密钥",
    textarea: "多行文本",
    select: "下拉选择",
    toggle: "开关",
    slider: "滑杆",
    chips: "标签组",
  }[type] ?? "未知";
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function render() {
  renderNav();
  renderEntityDock();
  renderEditor();
  attachSearchResults();
  renderWorkspace();
}

render();
