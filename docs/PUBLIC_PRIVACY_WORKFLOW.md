# 公开仓库隐私检查

每位合作者都需要在自己的 GitHub 账号中开启 **Keep my email addresses private** 和 **Block command line pushes that expose my email**。再从 GitHub 邮箱设置页复制本人专用的 `...@users.noreply.github.com` 地址，在准备提交的仓库执行：

```powershell
git config --local user.email "你的 GitHub noreply 邮箱"
git config --local --get user.email
```

克隆公开仓库后，安装本地推送检查：

```powershell
node scripts/install-privacy-hook.mjs
```

提交前运行：

```powershell
node scripts/public-privacy-audit.mjs --include-untracked --strict
git status --short
```

检查器只输出文件路径和风险类别，不输出匹配到的邮箱、手机号、密钥、角色内容或聊天文本。若本机存在应用用户数据，检查器还会在本机内存中将角色名称、角色设定、聊天文本和凭据与候选文件比对。它不会把这些数据上传到任何地方。无法识别的内容仍需人工审阅。

私人配置、角色图像、模型、聊天记录和报告应留在本机被 `.gitignore` 排除的位置。不要使用 `git add -f` 绕过忽略规则。公开更新应从已审核的公开仓库提交继续，不要合并含有私人数据的研发旧历史。发布安装包前，还要检查打包资源和 Release 标签所指向的提交。
