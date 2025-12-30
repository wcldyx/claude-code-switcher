#!/usr/bin/env node

const { program } = require('commander');
const chalk = require('chalk');
const { main } = require('../src/index');
const { registry } = require('../src/CommandRegistry');
const pkg = require('../package.json');
const { checkForUpdates } = require('../src/utils/update-checker');

// Set up CLI
program
  .name('cc')
  .description('Claude Code环境变量快速切换工具')
  .version(pkg.version, '-v, -V, --version', '显示版本号');

// Check for updates before any command runs
program.hook('preAction', async () => {
  checkForUpdates({ packageName: pkg.name, currentVersion: pkg.version });
});

// Default command - show provider selection
program
  .argument('[provider]', '直接切换到指定供应商')
  .action(async (provider) => {
    try {
      await main(provider);
    } catch (error) {
      console.error(chalk.red('❌ 执行失败:'), error.message);
      process.exit(1);
    }
  });

// Add command
program
  .command('add')
  .description('添加新供应商配置')
  .action(async () => {
    try {
      await registry.executeCommand('add');
    } catch (error) {
      console.error(chalk.red('❌ 添加失败:'), error.message);
      process.exit(1);
    }
  });

// Remove command
program
  .command('remove')
  .argument('[provider]', '要删除的供应商名称')
  .description('删除供应商配置')
  .action(async (provider) => {
    try {
      await registry.executeCommand('remove', provider);
    } catch (error) {
      console.error(chalk.red('❌ 删除失败:'), error.message);
      process.exit(1);
    }
  });

// List command
program
  .command('list')
  .description('列出所有供应商')
  .action(async () => {
    try {
      await registry.executeCommand('list');
    } catch (error) {
      console.error(chalk.red('❌ 列表失败:'), error.message);
      process.exit(1);
    }
  });

// Current command
program
  .command('current')
  .description('显示当前配置')
  .action(async () => {
    try {
      await registry.executeCommand('current');
    } catch (error) {
      console.error(chalk.red('❌ 获取当前配置失败:'), error.message);
      process.exit(1);
    }
  });

// Edit command
program
  .command('edit')
  .argument('[provider]', '要编辑的供应商名称')
  .description('编辑供应商配置')
  .action(async (provider) => {
    try {
      await registry.executeCommand('edit', provider);
    } catch (error) {
      console.error(chalk.red('❌ 编辑失败:'), error.message);
      process.exit(1);
    }
  });

// Parse arguments
program.parse();
