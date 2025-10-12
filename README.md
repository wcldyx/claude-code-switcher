# Claude Code 环境切换器

一键切换 Claude Code 的 API 供应商,让你轻松管理多个账号配置。

## 📸 界面预览

### 主界面 - 供应商选择
![供应商选择界面](./docs/images/main-interface.png)

### 添加供应商界面
![添加供应商界面](./docs/images/add-provider.png)

## 💡 这个工具是干什么的？

如果你在使用 Claude Code 时遇到这些问题：

- ✅ 需要在多个 API 供应商之间切换
- ✅ 使用不同的账号或 Token
- ✅ 需要配置第三方代理服务
- ✅ 想要快速保存和切换多套配置

那这个工具就是为你准备的！只需要一条命令 `cc`，就能快速切换环境。

## 🚀 快速开始

### 第一步：安装工具

打开终端(命令行),运行：

```bash
npm install -g @wcldyx/claude-code-switcher
```

### 第二步：添加你的第一个供应商

```bash
cc add
```

根据提示输入：
1. **名称**：给这个配置起个名字,比如 "官方账号"、"代理服务" 等
2. **认证方式**：选择你使用的 Token 类型
3. **Token**：粘贴你的 API Token
4. **基础 URL**（可选）：如果使用第三方服务需要填写

### 第三步：开始使用

```bash
cc
```

用方向键选择要使用的供应商,按回车确认,工具会自动启动 Claude Code！

## 📖 常用命令

```bash
cc              # 打开选择界面,切换供应商
cc add          # 添加新的供应商配置
cc list         # 查看所有已保存的供应商
cc current      # 查看当前正在使用哪个供应商
cc edit         # 修改某个供应商的配置
cc remove       # 删除不需要的供应商
```

## 🎯 使用场景示例

### 场景1：工作和个人账号切换

```bash
# 上班时使用公司账号
cc 公司账号

# 下班后切换到个人账号
cc 个人账号
```

### 场景2：使用第三方服务

有些第三方服务提供 Claude API 代理,你可以这样配置：

```bash
cc add
# 输入名称: 第三方服务
# 选择认证方式: API 密钥模式
# 输入 API 密钥: 粘贴你的密钥
# 输入基础 URL: https://api.third-party.com
```

### 场景3：临时测试新服务

```bash
# 添加测试配置
cc add

# 试用一下
cc 测试服务

# 不好用就删掉
cc remove 测试服务
```

## ⚙️ 认证方式说明

添加供应商时,会让你选择认证方式,这里简单说明：

**1. OAuth 令牌模式** (最常用)
- 适用于官方 Claude Code
- Token 格式: `sk-ant-oat01-...`
- 只需要填 Token,不需要填 URL

**2. API 密钥模式**
- 适用于第三方服务商
- 需要填写 API 密钥和服务商提供的 URL

**3. 认证令牌模式**
- 适用于某些第三方服务商
- 需要填写认证令牌和服务商提供的 URL

> 💡 不确定选哪个？看你的 Token 是什么格式,或者咨询你的服务商。

## ❓ 常见问题

**Q: 我的 Token 存在哪里,安全吗？**
A: 配置保存在你的电脑上 `~/.cc-config.json`,只有你能访问。Token 会被加密存储。

**Q: 如何重新来过？**
A: 删除配置文件 `~/.cc-config.json` 就会清空所有配置。

**Q: 可以导出配置到其他电脑吗？**
A: 可以！复制 `~/.cc-config.json` 文件到新电脑的相同位置即可。

**Q: 按 ESC 键没反应？**
A: 使用 `Ctrl+C` 也可以退出程序。

**Q: 需要什么系统？**
A: Windows、macOS、Linux 都支持。需要安装 Node.js 14 或更高版本。

## 🆘 遇到问题？

1. 查看 [常见问题](https://github.com/wcldyx/claude-code-switcher/issues)
2. 提交 [新问题](https://github.com/wcldyx/claude-code-switcher/issues/new)

---

**Claude Code Switcher** - 让环境切换变得简单 🚀
