# Claude Code 环境变量切换工具开发文档

## 项目概述

这是一个npm包，用于快速切换Claude Code的环境变量配置，支持多个AI服务供应商之间的无缝切换。

### 核心功能
- 快速切换不同供应商的环境变量
- 管理多个供应商配置
- 简单直观的命令行界面

## 技术栈

- **Node.js** - 运行环境
- **Commander.js** - 命令行参数解析
- **Inquirer.js** - 交互式命令行界面（完全支持Windows CMD）
- **fs-extra** - 文件系统操作
- **chalk** - 终端颜色输出（Windows CMD兼容）
- **cross-spawn** - 跨平台进程执行
- **supports-color** - Windows终端颜色检测

## 平台支持

### ✅ Windows CMD 完全支持
- 支持 Windows 7/8/10/11 的 cmd.exe
- 支持 Windows Terminal 和传统命令提示符
- 自动检测终端颜色支持能力
- 兼容中文字符显示
- 支持 PowerShell 和 Git Bash

### 🎨 Windows 终端体验优化
- 自动降级显示（无颜色支持时使用纯文本）
- Unicode 字符兼容性检测
- 中文路径和文件名支持
- Windows 风格的错误提示

## 项目结构

```
claude-code-switcher/
├── package.json
├── README.md
├── bin/
│   └── cc.js                 # 主要可执行文件
├── src/
│   ├── index.js             # 主入口
│   ├── config.js            # 配置管理
│   ├── commands/
│   │   ├── add.js           # 添加供应商
│   │   ├── remove.js        # 删除供应商
│   │   ├── list.js          # 列出供应商
│   │   ├── switch.js        # 切换供应商
│   │   └── current.js       # 显示当前配置
│   └── utils/
│       ├── storage.js       # 数据存储
│       ├── validator.js     # 输入验证
│       └── logger.js        # 日志工具
└── tests/
    └── *.test.js            # 测试文件
```

## 命令设计

### 基础命令

```bash
# 显示供应商选择列表（默认行为）
cc

# 直接切换到指定供应商（快捷方式）
cc <供应商名称>

# 添加新供应商配置
cc add

# 删除供应商配置
cc remove [供应商名称]

# 列出所有供应商
cc list

# 显示当前配置
cc current

# 显示帮助信息
cc --help

# 显示版本信息
cc --version
```

### 高级命令

```bash
# 重命名供应商
cc rename <旧名称> <新名称>

# 编辑供应商配置
cc edit <供应商名称>

# 导出配置
cc export [文件路径]

# 导入配置
cc import <文件路径>

# 重置所有配置
cc reset

# 验证当前配置
cc validate
```

## 核心模块设计

### 1. 配置管理 (config.js)

```javascript
class ConfigManager {
  constructor() {
    this.configPath = path.join(os.homedir(), '.cc-config.json');
  }
  
  // 加载配置
  load() { }
  
  // 保存配置
  save(config) { }
  
  // 添加供应商
  addProvider(name, config) { }
  
  // 删除供应商
  removeProvider(name) { }
  
  // 获取供应商配置
  getProvider(name) { }
  
  // 列出所有供应商
  listProviders() { }
}
```

### 2. 环境变量切换 (switch.js)

```javascript
class EnvSwitcher {
  // 显示供应商选择列表
  async showProviderSelection() {
    const providers = this.configManager.listProviders();
    
    if (providers.length === 0) {
      console.log(chalk.yellow('🚫 暂无配置的供应商'));
      console.log(chalk.blue('💡 请先运行 "cc add" 添加供应商配置'));
      return;
    }

    const choices = providers.map(provider => ({
      name: `${provider.current ? '✅' : '🔹'} ${provider.name} (${provider.displayName})`,
      value: provider.name,
      short: provider.name
    }));

    // 添加特殊选项
    choices.push(
      new inquirer.Separator(),
      { name: '➕ 添加新供应商', value: '__ADD__' },
      { name: '⚙️  管理配置', value: '__MANAGE__' },
      { name: '❌ 退出', value: '__EXIT__' }
    );

    const answer = await inquirer.prompt([
      {
        type: 'list',
        name: 'provider',
        message: '请选择要切换的供应商:',
        choices,
        pageSize: 10
      }
    ]);

    return this.handleSelection(answer.provider);
  }

  // 处理用户选择
  async handleSelection(selection) {
    switch (selection) {
      case '__ADD__':
        return this.addProvider();
      case '__MANAGE__':
        return this.showManageMenu();
      case '__EXIT__':
        console.log(chalk.gray('👋 再见！'));
        process.exit(0);
      default:
        return this.switchTo(selection);
    }
  }

  // 切换到指定供应商
  async switchTo(providerName) {
    const config = this.getProviderConfig(providerName);
    await this.setEnvironmentVariables(config);
    await this.launchClaude();
  }
  
  // 设置环境变量
  setEnvironmentVariables(config) { }
  
  // 启动Claude Code
  launchClaude() { }

  // 显示管理菜单
  async showManageMenu() {
    const choices = [
      { name: '📋 查看所有供应商', value: 'list' },
      { name: '📍 显示当前配置', value: 'current' },
      { name: '🗑️  删除供应商', value: 'remove' },
      { name: '✏️  编辑供应商', value: 'edit' },
      { name: '↩️  返回主菜单', value: 'back' }
    ];

    const answer = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: '选择管理操作:',
        choices
      }
    ]);

    switch (answer.action) {
      case 'back':
        return this.showProviderSelection();
      // ... 其他操作处理
    }
  }
}
```

### 3. 交互式添加 (add.js)

```javascript
class ProviderAdder {
  async interactive() {
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'name',
        message: '请输入供应商名称 (用于命令行):',
        validate: this.validateName,
        transformer: (input) => input.toLowerCase()
      },
      {
        type: 'input',
        name: 'displayName', 
        message: '请输入供应商显示名称:',
        validate: (input) => input.trim().length > 0
      },
      {
        type: 'input',
        name: 'baseUrl',
        message: '请输入API基础URL:',
        validate: this.validateUrl
      },
      {
        type: 'password',
        name: 'authToken',
        message: '请输入认证Token:',
        validate: this.validateToken
      },
      {
        type: 'confirm',
        name: 'setAsDefault',
        message: '是否设置为默认供应商?',
        default: false
      }
    ]);
    
    return this.saveProvider(answers);
  }
}
```

## 配置文件格式

```json
{
  "version": "1.0.0",
  "currentProvider": "default",
  "providers": {
    "default": {
      "name": "default",
      "displayName": "Anthropic官方",
      "baseUrl": "https://api.anthropic.com",
      "authToken": "sk-ant-xxxxx",
      "createdAt": "2025-01-01T00:00:00Z",
      "lastUsed": "2025-01-01T00:00:00Z",
      "current": true
    },
    "zhipu": {
      "name": "zhipu",
      "displayName": "智谱AI",
      "baseUrl": "https://open.bigmodel.cn/api/anthropic",
      "authToken": "3c768e00b3194fbab0ed7aedc8a7de88.NXFO58Spgx3E8cFM",
      "createdAt": "2025-01-01T00:00:00Z",
      "lastUsed": "2025-01-01T00:00:00Z",
      "current": false
    },
    "deepseek": {
      "name": "deepseek", 
      "displayName": "DeepSeek",
      "baseUrl": "https://api.deepseek.com",
      "authToken": "sk-xxxxxxxxxxxxx",
      "createdAt": "2025-01-01T00:00:00Z",
      "lastUsed": "2025-01-01T00:00:00Z",
      "current": false
    }
  }
}
```

## 安装和使用流程

### 开发环境搭建

```bash
# 创建项目
mkdir claude-code-switcher
cd claude-code-switcher
npm init -y

# 安装依赖
npm install commander inquirer fs-extra chalk cross-spawn
npm install --save-dev jest nodemon

# 设置可执行权限
chmod +x bin/cc.js
```

### package.json 配置

```json
{
  "name": "claude-code-switcher",
  "version": "1.0.0",
  "description": "Claude Code环境变量快速切换工具",
  "main": "src/index.js",
  "bin": {
    "cc": "./bin/cc.js"
  },
  "scripts": {
    "start": "node bin/cc.js",
    "dev": "nodemon bin/cc.js",
    "test": "jest",
    "build": "echo 'No build needed'",
    "prepare": "echo 'Preparing package'"
  },
  "keywords": ["claude", "ai", "cli", "environment", "switcher", "windows"],
  "author": "Your Name",
  "license": "MIT",
  "dependencies": {
    "commander": "^9.4.1",
    "inquirer": "^8.2.6",
    "fs-extra": "^11.1.1",
    "chalk": "^4.1.2",
    "cross-spawn": "^7.0.3",
    "supports-color": "^9.4.0"
  },
  "engines": {
    "node": ">=14.0.0"
  },
  "os": ["win32", "darwin", "linux"]
}
```

### Windows 安装说明

```bash
# 在 Windows CMD 中安装 Node.js (前提条件)
# 1. 下载并安装 Node.js from https://nodejs.org

# 2. 验证安装
node --version
npm --version

# 3. 全局安装工具
npm install -g claude-code-switcher

# 4. 验证安装
cc --version

# 5. 开始使用
cc
```

## 实现细节

### Windows CMD 环境变量设置

```javascript
const setEnvVars = (config) => {
  const platform = process.platform;
  const commands = [];
  
  if (platform === 'win32') {
    // Windows CMD 使用 set 命令
    commands.push(`set ANTHROPIC_BASE_URL=${config.baseUrl}`);
    commands.push(`set ANTHROPIC_AUTH_TOKEN=${config.authToken}`);
    // 启动 Claude Code
    commands.push('claude');
  } else {
    // Unix-like 系统使用 export
    commands.push(`export ANTHROPIC_BASE_URL=${config.baseUrl}`);
    commands.push(`export ANTHROPIC_AUTH_TOKEN=${config.authToken}`);
    commands.push('claude');
  }
  
  return commands;
};

// Windows CMD 专用执行方法
const executeInCMD = async (commands) => {
  const spawn = require('cross-spawn');
  
  // 将所有命令合并为一个批处理脚本
  const batchScript = commands.join(' && ');
  
  // 在 Windows CMD 中执行
  const child = spawn('cmd', ['/c', batchScript], {
    stdio: 'inherit',
    shell: true
  });
  
  return new Promise((resolve, reject) => {
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`命令执行失败，退出码: ${code}`));
      }
    });
  });
};
```

### Windows 特定功能

```javascript
class WindowsSupport {
  // 检测 Windows 终端能力
  static detectTerminalCapabilities() {
    const supportsColor = require('supports-color');
    return {
      colors: supportsColor.stdout,
      unicode: process.env.WT_SESSION || process.env.TERM_PROGRAM === 'vscode',
      encoding: process.stdout.getColorDepth ? process.stdout.getColorDepth() > 1 : false
    };
  }
  
  // Windows 路径处理
  static getConfigPath() {
    const os = require('os');
    const path = require('path');
    
    // 使用 %USERPROFILE% 目录
    return path.join(os.homedir(), '.cc-config.json');
  }
  
  // Windows CMD 友好的消息显示
  static formatMessage(message, type = 'info') {
    const capabilities = this.detectTerminalCapabilities();
    
    if (!capabilities.colors) {
      // 无颜色支持时的纯文本版本
      const symbols = {
        success: '[OK]',
        error: '[错误]',
        warning: '[警告]',
        info: '[信息]'
      };
      return `${symbols[type]} ${message}`;
    }
    
    // 有颜色支持时的彩色版本
    const chalk = require('chalk');
    const colorMap = {
      success: chalk.green,
      error: chalk.red,
      warning: chalk.yellow,
      info: chalk.blue
    };
    
    const symbols = capabilities.unicode ? 
      { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' } :
      { success: '[OK]', error: '[ERROR]', warning: '[WARN]', info: '[INFO]' };
      
    return colorMap[type](`${symbols[type]} ${message}`);
  }
}
```

### 数据安全

- 敏感信息加密存储
- 配置文件权限控制
- Token脱敏显示

### 错误处理

```javascript
class ErrorHandler {
  static handle(error) {
    switch(error.type) {
      case 'CONFIG_NOT_FOUND':
        console.log(chalk.yellow('配置文件不存在，请先添加供应商'));
        break;
      case 'PROVIDER_NOT_FOUND':
        console.log(chalk.red('指定的供应商不存在'));
        break;
      case 'INVALID_TOKEN':
        console.log(chalk.red('Token格式无效'));
        break;
    }
  }
}
```

## 测试策略

### 单元测试

```javascript
describe('ConfigManager', () => {
  test('should add provider successfully', () => {
    const config = new ConfigManager();
    const result = config.addProvider('test', {
      baseUrl: 'https://test.com',
      authToken: 'test-token'
    });
    expect(result).toBe(true);
  });
});
```

### 集成测试

测试完整的命令执行流程，确保各模块协同工作正常。

## 发布流程

### 准备发布

```bash
# 构建和测试
npm test
npm run build

# 检查包内容
npm pack --dry-run

# 登录npm
npm login

# 发布
npm publish
```

### 版本管理

使用语义化版本控制：
- 主版本号：不兼容的API修改
- 次版本号：向下兼容的功能新增
- 修订号：向下兼容的问题修正

## 扩展功能规划

### v1.1.0
- 配置备份和恢复
- 批量操作支持
- 配置模板功能

### v1.2.0
- Web界面管理
- 配置同步功能
- 团队配置共享

### v2.0.0
- 插件系统
- 自定义命令支持
- 高级配置选项

## 使用示例

```bash
# 运行 cc 命令，显示交互式选择界面
$ cc
? 请选择要切换的供应商:
  ✅ default (Anthropic官方)
  🔹 智谱AI (智谱AI)
  🔹 deepseek (DeepSeek)
  ─────────────────────────
  ➕ 添加新供应商
  ⚙️  管理配置
  ❌ 退出

# 选择供应商后的效果
$ cc
? 请选择要切换的供应商: 智谱AI
🔄 正在切换到 智谱AI...
✅ 环境变量已设置
🚀 启动 Claude Code...

# 直接指定供应商（快捷方式）
$ cc 智谱AI
🔄 正在切换到 智谱AI...
✅ 环境变量已设置
🚀 启动 Claude Code...

# 首次使用时的界面
$ cc
🚫 暂无配置的供应商
💡 请先运行 "cc add" 添加供应商配置

# 添加供应商
$ cc add
? 请输入供应商名称: 智谱AI
? 请输入供应商显示名称: 智谱AI
? 请输入API基础URL: https://open.bigmodel.cn/api/anthropic
? 请输入认证Token: [hidden]
✅ 供应商 '智谱AI' 添加成功！

# 管理配置菜单
$ cc
? 请选择要切换的供应商: ⚙️  管理配置
? 选择管理操作:
  📋 查看所有供应商
  📍 显示当前配置
  🗑️  删除供应商
  ✏️  编辑供应商
  ↩️  返回主菜单
```

这个开发文档为您提供了完整的项目规划和实现指导。您可以根据具体需求调整功能范围和实现细节。