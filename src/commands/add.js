const inquirer = require('inquirer');
const chalk = require('chalk');
const { ConfigManager } = require('../config');
const { validator } = require('../utils/validator');
const { Logger } = require('../utils/logger');

class ProviderAdder {
  constructor() {
    this.configManager = new ConfigManager();
  }

  async interactive() {
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'name',
        message: '请输入供应商名称 (用于命令行):',
        validate: (input) => {
          const error = validator.validateName(input);
          if (error) return error;
          return true;
        },
        transformer: (input) => input.toLowerCase()
      },
      {
        type: 'input',
        name: 'displayName',
        message: '请输入供应商显示名称:',
        validate: (input) => {
          const error = validator.validateDisplayName(input);
          if (error) return error;
          return true;
        }
      },
      {
        type: 'input',
        name: 'baseUrl',
        message: '请输入API基础URL:',
        validate: (input) => {
          const error = validator.validateUrl(input);
          if (error) return error;
          return true;
        }
      },
      {
        type: 'password',
        name: 'authToken',
        message: '请输入认证Token:',
        validate: (input) => {
          const error = validator.validateToken(input);
          if (error) return error;
          return true;
        },
        mask: '*'
      },
      {
        type: 'confirm',
        name: 'setAsDefault',
        message: '是否设置为默认供应商?',
        default: false
      }
    ]);

    await this.saveProvider(answers);
  }

  async saveProvider(answers) {
    try {
      await this.configManager.load();
      
      // 检查供应商是否已存在
      if (this.configManager.getProvider(answers.name)) {
        const overwrite = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'overwrite',
            message: `供应商 '${answers.name}' 已存在，是否覆盖?`,
            default: false
          }
        ]);

        if (!overwrite.overwrite) {
          Logger.warning('操作已取消');
          return;
        }
      }

      await this.configManager.addProvider(answers.name, {
        displayName: answers.displayName,
        baseUrl: answers.baseUrl,
        authToken: answers.authToken,
        setAsDefault: answers.setAsDefault
      });

      Logger.success(`供应商 '${answers.displayName}' 添加成功！`);
      
      // 显示添加的配置信息
      console.log(chalk.blue('\n配置详情:'));
      console.log(chalk.gray(`  名称: ${answers.name}`));
      console.log(chalk.gray(`  显示名称: ${answers.displayName}`));
      console.log(chalk.gray(`  基础URL: ${answers.baseUrl}`));
      console.log(chalk.gray(`  Token: ${validator.maskToken(answers.authToken)}`));
      
    } catch (error) {
      Logger.error(`添加供应商失败: ${error.message}`);
      throw error;
    }
  }
}

async function addCommand() {
  const adder = new ProviderAdder();
  await adder.interactive();
}

module.exports = { addCommand, ProviderAdder };