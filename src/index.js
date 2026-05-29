const { Logger } = require('./utils/logger');

async function main(providerName, launchArgs = []) {
  try {
    const { switchCommand } = require('./commands/switch');
    if (providerName) {
      // 直接切换到指定供应商
      await switchCommand(providerName, launchArgs);
    } else {
      // 显示供应商选择界面
      await switchCommand();
    }
  } catch (error) {
    Logger.fatal(`程序执行失败: ${error.message}`);
  }
}

module.exports = { main };
