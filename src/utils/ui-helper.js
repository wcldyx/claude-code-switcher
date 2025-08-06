const chalk = require('chalk');
const { WindowsSupport } = require('./windows-support');

class UIHelper {
  // 颜色主题
  static colors = {
    primary: chalk.cyan,
    secondary: chalk.blue,
    success: chalk.green,
    warning: chalk.yellow,
    error: chalk.red,
    info: chalk.white,
    muted: chalk.gray,
    accent: chalk.magenta
  };

  // 图标
  static icons = {
    success: '✅',
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️',
    loading: '⏳',
    arrow: '→',
    back: '🔙',
    home: '🏠',
    settings: '⚙️',
    add: '➕',
    edit: '✏️',
    delete: '🗑️',
    launch: '🚀',
    list: '📋',
    current: '🎯',
    search: '🔍'
  };

  // 创建标题
  static createTitle(text, icon = '') {
    const fullIcon = icon ? `${icon} ` : '';
    return chalk.bold.cyan(`\n╭─────────────────────────────────────╮\n│ ${fullIcon}${chalk.white(text)}\n╰─────────────────────────────────────╯`);
  }

  // 创建分隔线
  static createSeparator() {
    return chalk.gray('─'.repeat(45));
  }

  // 创建项目列表
  static createItem(label, value, isSelected = false) {
    const icon = isSelected ? this.icons.current : '•';
    const color = isSelected ? this.colors.primary : this.colors.info;
    return `${color(icon)} ${label}`;
  }

  // 创建操作按钮
  static createButton(label, action, icon = '') {
    const fullIcon = icon ? `${icon} ` : '';
    return `${this.colors.accent(fullIcon)}${this.colors.info(label)}`;
  }

  // 创建状态指示器
  static createStatus(status, label) {
    const statusConfig = {
      current: { icon: this.icons.current, color: this.colors.success },
      active: { icon: '🟢', color: this.colors.success },
      inactive: { icon: '⚫', color: this.colors.muted },
      loading: { icon: this.icons.loading, color: this.colors.warning },
      error: { icon: this.icons.error, color: this.colors.error }
    };

    const config = statusConfig[status] || statusConfig.inactive;
    return `${config.color(config.icon)} ${this.colors.info(label)}`;
  }

  // 格式化供应商信息
  static formatProvider(provider) {
    const status = provider.current ? 'current' : 'inactive';
    const statusText = this.createStatus(status, provider.name);
    const displayName = this.colors.secondary(`(${provider.displayName})`);
    return `${statusText} ${displayName}`;
  }

  // 创建进度条
  static createProgressBar(current, total, width = 30) {
    const progress = Math.floor((current / total) * width);
    const empty = width - progress;
    const filled = '█'.repeat(progress);
    const emptySpace = '░'.repeat(empty);
    const percentage = Math.floor((current / total) * 100);
    
    return `${this.colors.primary(filled)}${this.colors.muted(emptySpace)} ${this.colors.info(percentage + '%')}`;
  }

  // 创建表格
  static createTable(headers, rows) {
    const columnWidths = headers.map(header => Math.max(header.length, ...rows.map(row => String(row[headers.indexOf(header)]).length)));
    
    let result = '';
    
    // 表头
    const headerRow = headers.map((header, i) => header.padEnd(columnWidths[i])).join(' │ ');
    result += `${this.colors.primary(headerRow)}\n`;
    
    // 分隔线
    const separator = columnWidths.map(width => '─'.repeat(width)).join('─┼─');
    result += `${this.colors.muted(separator)}\n`;
    
    // 数据行
    rows.forEach(row => {
      const dataRow = row.map((cell, i) => String(cell).padEnd(columnWidths[i])).join(' │ ');
      result += `${this.colors.info(dataRow)}\n`;
    });
    
    return result;
  }

  // 创建卡片式布局
  static createCard(title, content, icon = '') {
    const lines = content.split('\n');
    const maxLineLength = Math.max(...lines.map(line => line.length));
    const horizontalBorder = '─'.repeat(maxLineLength + 4);
    
    let result = `${this.colors.primary(`┌─${horizontalBorder}─┐`)}\n`;
    result += `${this.colors.primary('│')}  ${chalk.bold.white(icon ? `${icon} ` : '')}${chalk.bold.white(title)}${' '.repeat(maxLineLength - title.length - (icon ? 2 : 0))}  ${this.colors.primary('│')}\n`;
    result += `${this.colors.primary('├─')}${this.colors.muted(horizontalBorder)}${this.colors.primary('─┤')}\n`;
    
    lines.forEach(line => {
      result += `${this.colors.primary('│')}  ${this.colors.info(line)}${' '.repeat(maxLineLength - line.length)}  ${this.colors.primary('│')}\n`;
    });
    
    result += `${this.colors.primary('└─')}${this.colors.muted(horizontalBorder)}${this.colors.primary('─┘')}`;
    return result;
  }

  // 创建操作菜单
  static createMenu(title, options) {
    let result = `${this.createTitle(title, this.icons.list)}\n\n`;
    
    options.forEach((option, index) => {
      const number = this.colors.muted(`[${index + 1}]`);
      const icon = option.icon || '•';
      const description = option.description ? this.colors.muted(` - ${option.description}`) : '';
      result += `${number} ${this.colors.accent(icon)} ${this.colors.info(option.label)}${description}\n`;
    });
    
    result += `\n${this.colors.muted(this.createSeparator())}\n`;
    result += `${this.colors.warning('请选择操作 (输入数字): ')}`;
    
    return result;
  }

  // 创建确认对话框
  static createConfirmDialog(message, options = ['确认', '取消']) {
    return `${this.colors.warning(message)}\n\n` +
           `${this.colors.success('[Y]')} ${this.colors.info(options[0])}  ` +
           `${this.colors.error('[N]')} ${this.colors.info(options[1])}`;
  }

  // 格式化时间
  static formatTime(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`;
    if (diff < 2592000000) return `${Math.floor(diff / 86400000)} 天前`;
    
    return date.toLocaleDateString('zh-CN');
  }

  // 创建搜索框
  static createSearchBox(placeholder = '搜索...') {
    return `${this.colors.info(this.icons.search)} ${this.colors.muted(placeholder)}`;
  }

  // 创建提示框
  static createTooltip(text) {
    return `${this.colors.muted('💡 ' + text)}`;
  }

  // 创建加载动画
  static createLoadingAnimation(text = '加载中...') {
    const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    let frameIndex = 0;
    
    return setInterval(() => {
      process.stdout.write(`\r${this.colors.warning(frames[frameIndex])} ${this.colors.info(text)}`);
      frameIndex = (frameIndex + 1) % frames.length;
    }, 100);
  }

  // 清除加载动画
  static clearLoadingAnimation(interval) {
    clearInterval(interval);
    process.stdout.write('\r');
  }

  // 创建快捷键提示
  static createShortcutHint(key, action) {
    return `${this.colors.muted('[')}${this.colors.primary(key)}${this.colors.muted(']')} ${this.colors.info(action)}`;
  }

  // 创建 ESC 键提示
  static createESCHint(action = '返回') {
    return `${this.colors.muted('[')}${this.colors.primary('ESC')}${this.colors.muted(']')} ${this.colors.info(action)}`;
  }
}

module.exports = { UIHelper };