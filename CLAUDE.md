# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

Claude Code Switcher 是一个 CLI 工具，用于快速切换 Claude Code 的 API 供应商配置。它允许用户在多个 Claude API 提供商之间切换，管理环境变量，并检测配置冲突。

## 开发命令

```bash
# 安装依赖
npm install

# 本地运行（开发模式，支持热重载）
npm run dev

# 运行测试
npm test

# 发布新版本（会自动运行测试）
npm run release
```

## 核心架构

### 1. 命令系统架构

项目使用 **CommandRegistry** 模式实现命令的懒加载和解耦：

- `src/CommandRegistry.js` - 命令注册中心，负责管理所有命令的懒加载
- `src/commands/BaseCommand.js` - 所有命令的基类，提供通用功能（ESC 键处理、错误处理、提示符管理）
- `src/commands/switch.js` - 主要的切换逻辑，包含 `EnvSwitcher` 类
- `src/commands/add.js`, `remove.js`, `edit.js`, `list.js`, `current.js` - 各个子命令

**重要设计理念**：
- 所有命令都继承自 `BaseCommand`，必须调用 `super()` 初始化
- 命令通过 `registry.executeCommand(name, ...args)` 调用，不直接 require
- 避免循环依赖：子命令需要调用其他命令时，使用 `registry.executeCommand()` 而非直接导入

### 2. 配置管理系统

`src/config.js` 中的 `ConfigManager` 类管理所有供应商配置：

**核心特性**：
- 配置文件位置：`~/.cc-config.json`
- 懒加载机制：配置在首次使用时才加载，并缓存
- 并发保护：使用 `loadPromise` 防止并发加载
- 自动迁移：旧的 `api_token` 模式会自动迁移到 `auth_token`

**配置结构**：
```javascript
{
  version: '1.0.0',
  currentProvider: 'provider-name',
  providers: {
    'provider-name': {
      name: 'provider-name',
      displayName: '显示名称',
      authMode: 'oauth_token' | 'api_key' | 'auth_token',
      authToken: 'token-value',
      baseUrl: 'https://api.example.com',  // oauth_token 模式可选
      models: {
        primary: 'claude-sonnet-4',
        smallFast: 'claude-haiku-4'
      },
      launchArgs: ['--continue'],
      current: true,
      lastUsed: '2024-01-01T00:00:00.000Z',
      createdAt: '2024-01-01T00:00:00.000Z',
      usageCount: 5
    }
  }
}
```

**使用模式**：
```javascript
const configManager = new ConfigManager();
await configManager.load();  // 加载配置
const provider = configManager.getProvider('name');  // 同步获取
await configManager.save();  // 保存配置
```

### 3. ESC 键导航系统

`src/navigation/EscNavigationManager.js` 和 `BaseCommand` 协同工作：

- 支持 Windows 平台的 ESC 键检测（通过 `node-windows-support` 模块）
- 提供统一的返回/取消机制
- 每个界面可以注册 ESC 键监听器，自动清理

**使用模式**：
```javascript
const escListener = this.createESCListener(() => {
  this.showPreviousMenu();
}, '返回上级菜单');

try {
  await this.prompt(questions);
} finally {
  this.removeESCListener(escListener);
}
```

### 4. Claude 设置文件冲突检测

`src/utils/claude-settings.js` 实现了自动检测和处理 Claude Code 设置文件中的环境变量冲突：

**工作原理**：
1. 扫描多个可能的设置文件位置（`.claude/settings.json`, `.claude/settings.local.json`）
2. 检测是否存在与供应商配置冲突的环境变量
3. 提示用户备份并清理冲突变量
4. 备份文件命名格式：`settings.backup-YYYYMMDD_HHmmss.json`

**冲突检测的环境变量**：
- `ANTHROPIC_API_KEY`
- `ANTHROPIC_AUTH_TOKEN`
- `ANTHROPIC_BASE_URL`
- `CLAUDE_CODE_OAUTH_TOKEN`
- `ANTHROPIC_MODEL`
- `ANTHROPIC_SMALL_FAST_MODEL`

### 5. 环境变量设置与启动

`src/utils/env-launcher.js` 负责根据供应商配置设置环境变量并启动 Claude Code：

**认证模式映射**：
- `oauth_token` → 设置 `CLAUDE_CODE_OAUTH_TOKEN`
- `api_key` → 设置 `ANTHROPIC_BASE_URL` + `ANTHROPIC_API_KEY`
- `auth_token` → 设置 `ANTHROPIC_BASE_URL` + `ANTHROPIC_AUTH_TOKEN`

## 重要实现细节

### Inquirer 补丁系统

`src/utils/inquirer-setup.js` 为 Inquirer 添加了两个补丁：

1. **allowEmpty 补丁**：允许用户提交空字符串而不回退到默认值
2. **prefillDefault 补丁**：在输入框中预填充默认值，用户可以编辑

这些补丁在 `src/index.js` 中通过 require 自动应用。

### 屏幕清空逻辑

不同平台使用不同的 ANSI 转义序列：
- Windows: `\x1b[3J\x1b[2J\x1b[0f`
- Unix/Linux/macOS: `\x1b[3J\x1b[2J\x1b[H`

实现在 `BaseCommand.clearScreen()` 和 `env-launcher.js` 的 `clearTerminal()`。

### 错误处理约定

- 使用 `BaseCommand.isEscCancelled(error)` 检查是否为 ESC 取消错误
- ESC 取消错误应该被静默处理，不显示错误信息
- 其他错误通过 `Logger.error()` 或 `Logger.fatal()` 显示

## 测试

测试使用 Jest 框架，配置在 `jest.config.js`。

运行测试：
```bash
npm test
```

## 项目结构说明

```
src/
├── commands/           # 所有 CLI 命令实现
│   ├── BaseCommand.js # 命令基类（ESC 处理、提示符）
│   ├── switch.js      # 主切换逻辑（EnvSwitcher 类）
│   ├── add.js         # 添加供应商
│   ├── edit.js        # 编辑供应商
│   ├── remove.js      # 删除供应商
│   ├── list.js        # 列出供应商
│   └── current.js     # 显示当前供应商
├── utils/             # 工具模块
│   ├── claude-settings.js  # Claude 设置文件冲突检测
│   ├── env-launcher.js     # 环境变量设置和启动
│   ├── inquirer-setup.js   # Inquirer 补丁
│   ├── ui-helper.js        # UI 格式化工具
│   ├── logger.js           # 日志工具
│   ├── validator.js        # 输入验证
│   └── config-opener.js    # 配置文件打开工具
├── navigation/        # 导航系统
│   └── EscNavigationManager.js  # ESC 键管理
├── config.js          # 配置管理（ConfigManager）
├── CommandRegistry.js # 命令注册中心
└── index.js           # 入口点
```

## 开发注意事项

### 添加新命令

1. 在 `src/commands/` 创建新命令文件
2. 继承 `BaseCommand` 类
3. 在 `CommandRegistry.js` 中注册懒加载
4. 在 `bin/cc.js` 中添加 commander 命令定义

### 修改配置结构

如果修改 `ConfigManager` 的配置结构：
1. 在 `getDefaultConfig()` 中更新默认值
2. 添加迁移逻辑到 `_migrateAuthModes()` 或创建新的迁移方法
3. 更新配置文件版本号

### ESC 键处理最佳实践

- 始终在 `try...finally` 中清理 ESC 监听器
- 使用 `isEscCancelled()` 判断是否为 ESC 取消
- ESC 取消不应该抛出异常或显示错误

### UI 一致性

使用 `src/utils/ui-helper.js` 中的工具函数保持 UI 一致：
- `UIHelper.createTitle()` - 创建标题
- `UIHelper.createCard()` - 创建信息卡片
- `UIHelper.createHintLine()` - 创建快捷键提示
- `UIHelper.formatProvider()` - 格式化供应商显示
