# 角色音色包格式（GPT-SoVITS v2ProPlus）

框架固定，换音色包就换声音。每个音色包是 `local-models/voice/gpt-sovits/<音色ID>/` 下的一个文件夹，只能包含数据（音频、权重、清单），不能包含任何可执行内容。

## 两种规格

| 规格 | 内容 | 体积 | 说明 |
|---|---|---|---|
| 轻量版 `lite` | 只有参考录音 | 几 MB | 跑在共享底模（`s1v3.ckpt` + `v2Pro/s2Gv2ProPlus.pth`）上；不用训练；各轻量包之间切换不需要重新加载权重 |
| 训练版 `full` | 参考录音 + 微调权重 | 约 300MB | 最像原声；切换到/离开训练版需要 2–3.5 秒加载权重 |

规格由清单推断：同时没有 `gpt` 和 `sovits` 是轻量版，两个都有是训练版，只写其中一个视为错误。

## manifest.json

```json
{
  "name": "小玲（轻量）",
  "version": "v2ProPlus",
  "description": "可选，最多 200 字",
  "author": "可选，最多 40 字",
  "gpt": "gpt.ckpt",
  "sovits": "sovits.pth",
  "emotions": {
    "neutral": { "wav": "refs/neutral.wav", "text": "参考录音里说的原话。" },
    "happy": { "wav": "refs/happy.wav", "text": "……" }
  }
}
```

- `version` 必须是 `v2ProPlus`。
- `gpt` / `sovits` 只在训练版出现。
- `emotions.neutral` 必须有；其他情绪键为小写字母开头的 `[a-z0-9_-]`，缺少的情绪自动退回 `neutral`。
- 所有路径都是相对路径，且必须留在音色包目录内（主进程和语音服务都会校验）。
- 参考录音建议 3–10 秒、安静环境、单人说话，`text` 必须与录音内容一致。

## 实测（2026-10-07，RTX 4060 Laptop）

- 轻量版与参考原声的声纹相似度 0.65–0.89（训练版小玲 0.93）；发音错误率 0–3%。
- 合成速度约为实时的 2–3 倍。
- 男声、成熟女声模仿最好；特别尖的少女音最差；音色本来接近的两个轻量包听起来会更像。
