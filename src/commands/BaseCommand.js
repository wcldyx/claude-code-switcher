const readline = require('readline');
const chalk = require('chalk');
const { Logger } = require('../utils/logger');

class BaseCommand {
  constructor() {
    this.escListeners = new Set(); // 跟踪所有活动的监听器
  }

  // 创建 ESC 键监听器 - 优化版本
  createESCListener(callback, returnMessage = '返回上级菜单') {
    if (!process.stdin.setRawMode) {
      return null;
    }

    readline.emitKeypressEvents(process.stdin);
    process.stdin.setRawMode(true);
    
    let escTimeout = null;
    
    const listener = (str, key) => {
      if (key.name === 'escape') {
        // 清除之前的超时
        if (escTimeout) {
          clearTimeout(escTimeout);
        }
        
        // 设置超时来区分真正的ESC键和其他组合键
        escTimeout = setTimeout(() => {
          this.cleanupListener(listenerObj);
          
          // 清理屏幕并显示返回信息
          this.clearScreen();
          console.log(chalk.yellow(`🔙 ESC键 - ${returnMessage}`));
          console.log();
          
          if (callback) {
            // 使用setTimeout让界面切换更流畅
            setTimeout(callback, 50);
          }
        }, 30); // 30ms延迟，优化响应速度
      } else if (escTimeout) {
        // 如果是其他键，清除ESC超时（表示是组合键）
        clearTimeout(escTimeout);
        escTimeout = null;
      }
    };
    
    process.stdin.on('keypress', listener);
    
    // 创建监听器对象
    const listenerObj = {
      listener,
      escTimeout,
      cleanup: () => {
        if (escTimeout) {
          clearTimeout(escTimeout);
          escTimeout = null;
        }
        try {
          process.stdin.setRawMode(false);
          process.stdin.removeListener('keypress', listener);
        } catch (error) {
          // 忽略清理时的错误
        }
      }
    };
    
    // 跟踪监听器
    this.escListeners.add(listenerObj);
    return listenerObj;
  }

  // 清理屏幕 - 优化版本
  clearScreen() {
    // 使用更可靠的清屏方法
    if (process.platform === 'win32') {
      process.stdout.write('\x1b[2J\x1b[0f');
    } else {
      process.stdout.write('\x1b[2J\x1b[H');
    }
  }

  // 移除指定的 ESC 键监听器
  removeESCListener(listener) {
    if (!listener) return;
    
    if (typeof listener === 'object' && listener.cleanup) {
      this.cleanupListener(listener);
    } else if (process.stdin.setRawMode) {
      // 旧的监听器函数（保持向后兼容）
      try {
        process.stdin.setRawMode(false);
        process.stdin.removeListener('keypress', listener);
      } catch (error) {
        // 忽略清理时的错误
      }
    }
  }

  // 内部清理方法
  cleanupListener(listenerObj) {
    if (listenerObj && this.escListeners.has(listenerObj)) {
      listenerObj.cleanup();
      this.escListeners.delete(listenerObj);
    }
  }

  // 清理所有监听器 - 防止内存泄漏
  cleanupAllListeners() {
    for (const listener of this.escListeners) {
      listener.cleanup();
    }
    this.escListeners.clear();
  }

  // 统一错误处理
  async handleError(error, context) {
    Logger.error(`${context}失败: ${error.message}`);
    throw error;
  }

  // 安全的异步执行包装器
  async safeExecute(operation, context = '操作') {
    try {
      return await operation();
    } catch (error) {
      await this.handleError(error, context);
    } finally {
      // 确保清理资源
      this.cleanupAllListeners();
    }
  }

  // 析构函数 - 确保资源清理
  destroy() {
    this.cleanupAllListeners();
  }
}

module.exports = { BaseCommand };