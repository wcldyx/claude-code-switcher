#!/usr/bin/env node

const { program } = require('commander');
const chalk = require('chalk');
const { registry } = require('../src/CommandRegistry');
const { t } = require('../src/utils/i18n');
const pkg = require('../package.json');

const BUILTIN_COMMANDS = new Set(['add', 'remove', 'list', 'current', 'edit', 'help']);

function scheduleUpdateCheck() {
  const timer = setTimeout(() => {
    const { checkForUpdates } = require('../src/utils/update-checker');
    checkForUpdates({ packageName: pkg.name, currentVersion: pkg.version, background: true });
  }, 2000);

  if (typeof timer.unref === 'function') {
    timer.unref();
  }
}

// Set up CLI
program
  .name('cc')
  .description(t('cli.description'))
  .helpOption('-h, --help', t('cli.help'))
  .version(pkg.version, '-v, -V, --version', t('cli.version'));

// Check for updates before any command runs
program.hook('preAction', () => {
  scheduleUpdateCheck();
});

// Default command - show provider selection
program
  .argument('[provider]', t('cli.providerArg'))
  .action(async (provider) => {
    try {
      const { main } = require('../src/index');
      await main(provider);
    } catch (error) {
      console.error(chalk.red(t('cli.executeFailed')), error.message);
      process.exit(1);
    }
  });

// Add command
program
  .command('add')
  .description(t('cli.add'))
  .action(async () => {
    try {
      await registry.executeCommand('add');
    } catch (error) {
      console.error(chalk.red(t('cli.addFailed')), error.message);
      process.exit(1);
    }
  });

// Remove command
program
  .command('remove')
  .argument('[provider]', t('cli.removeArg'))
  .description(t('cli.remove'))
  .action(async (provider) => {
    try {
      await registry.executeCommand('remove', provider);
    } catch (error) {
      console.error(chalk.red(t('cli.removeFailed')), error.message);
      process.exit(1);
    }
  });

// List command
program
  .command('list')
  .description(t('cli.list'))
  .action(async () => {
    try {
      await registry.executeCommand('list');
    } catch (error) {
      console.error(chalk.red(t('cli.listFailed')), error.message);
      process.exit(1);
    }
  });

// Current command
program
  .command('current')
  .description(t('cli.current'))
  .action(async () => {
    try {
      await registry.executeCommand('current');
    } catch (error) {
      console.error(chalk.red(t('cli.currentFailed')), error.message);
      process.exit(1);
    }
  });

// Edit command
program
  .command('edit')
  .argument('[provider]', t('cli.editArg'))
  .description(t('cli.edit'))
  .action(async (provider) => {
    try {
      await registry.executeCommand('edit', provider);
    } catch (error) {
      console.error(chalk.red(t('cli.editFailed')), error.message);
      process.exit(1);
    }
  });

// Parse arguments
const rawArgs = process.argv.slice(2);
const shouldUseDirectProviderMode =
  rawArgs.length > 0 &&
  !rawArgs[0].startsWith('-') &&
  !BUILTIN_COMMANDS.has(rawArgs[0]);

async function runDirectProviderMode(provider, claudeArgs) {
  try {
    scheduleUpdateCheck();
    const { main } = require('../src/index');
    await main(provider, claudeArgs);
  } catch (error) {
    console.error(chalk.red(t('cli.executeFailed')), error.message);
    process.exit(1);
  }
}

if (shouldUseDirectProviderMode) {
  const [provider, ...claudeArgs] = rawArgs;
  runDirectProviderMode(provider, claudeArgs);
} else {
  program.parse();
}
