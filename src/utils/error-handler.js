const chalk = require('chalk');
const { Logger } = require('./utils/logger');

class ErrorHandler {
  static handle(error, context = '') {
    const contextStr = context ? `[${context}] ` : '';
    
    switch (error.type) {
      case 'CONFIG_NOT_FOUND':
        Logger.error(`${contextStr}配置文件不存在，请先添加供应商`);
        break;
      case 'PROVIDER_NOT_FOUND':
        Logger.error(`${contextStr}指定的供应商不存在`);
        break;
      case 'INVALID_TOKEN':
        Logger.error(`${contextStr}Token格式无效`);
        break;
      case 'INVALID_URL':
        Logger.error(`${contextStr}URL格式无效`);
        break;
      case 'INVALID_NAME':
        Logger.error(`${contextStr}供应商名称格式无效`);
        break;
      case 'FILE_PERMISSION':
        Logger.error(`${contextStr}文件权限不足`);
        break;
      case 'NETWORK_ERROR':
        Logger.error(`${contextStr}网络连接错误`);
        break;
      default:
        Logger.error(`${contextStr}${error.message || '未知错误'}`);
        break;
    }
  }

  static createError(type, message, originalError = null) {
    const error = new Error(message);
    error.type = type;
    error.originalError = originalError;
    return error;
  }

  static async withErrorHandling(fn, context = '') {
    try {
      return await fn();
    } catch (error) {
      this.handle(error, context);
      throw error;
    }
  }
}

module.exports = { ErrorHandler };