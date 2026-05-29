const messages = {
  zh: {
    cli: {
      description: 'Claude Code环境变量快速切换工具',
      version: '显示版本号',
      providerArg: '直接切换到指定供应商',
      add: '添加新供应商配置',
      removeArg: '要删除的供应商名称',
      remove: '删除供应商配置',
      list: '列出所有供应商',
      current: '显示当前配置',
      editArg: '要编辑的供应商名称',
      edit: '编辑供应商配置',
      help: '显示帮助',
      executeFailed: '❌ 执行失败:',
      addFailed: '❌ 添加失败:',
      removeFailed: '❌ 删除失败:',
      listFailed: '❌ 列表失败:',
      currentFailed: '❌ 获取当前配置失败:',
      editFailed: '❌ 编辑失败:'
    },
    update: {
      available: '🔔 检测到新版本 {latest}，当前版本 {current}',
      command: '更新命令: ',
      prompt: '是否立即更新并重启？',
      installing: '开始更新，请稍候...',
      failed: '更新失败，请稍后重试或手动执行: ',
      success: '更新成功，正在重启...'
    }
  },
  en: {
    cli: {
      description: 'Claude Code environment switcher',
      version: 'Show version',
      providerArg: 'Start a provider directly',
      add: 'Add a provider configuration',
      removeArg: 'Provider name to remove',
      remove: 'Remove a provider configuration',
      list: 'List saved providers',
      current: 'Show current provider configuration',
      editArg: 'Provider name to edit',
      edit: 'Edit a provider configuration',
      help: 'Show help',
      executeFailed: '❌ Execution failed:',
      addFailed: '❌ Add failed:',
      removeFailed: '❌ Remove failed:',
      listFailed: '❌ List failed:',
      currentFailed: '❌ Failed to get current configuration:',
      editFailed: '❌ Edit failed:'
    },
    update: {
      available: '🔔 New version {latest} is available. Current version: {current}',
      command: 'Update command: ',
      prompt: 'Update now and restart?',
      installing: 'Updating, please wait...',
      failed: 'Update failed. Try again later or run manually: ',
      success: 'Update successful. Restarting...'
    }
  }
};

function normalizeLocale(value) {
  const locale = String(value || '').trim().toLowerCase();
  if (!locale) {
    return null;
  }
  return locale.startsWith('zh') ? 'zh' : 'en';
}

function detectLocale(env = process.env) {
  const explicitLocale = normalizeLocale(env.CC_LANG || env.CC_LOCALE);
  if (explicitLocale) {
    return explicitLocale;
  }

  const envLocale = normalizeLocale(env.LC_ALL || env.LC_MESSAGES || env.LANG || env.LANGUAGE);
  if (envLocale) {
    return envLocale;
  }

  try {
    return normalizeLocale(Intl.DateTimeFormat().resolvedOptions().locale) || 'zh';
  } catch {
    return 'zh';
  }
}

function getMessage(locale, key) {
  return key.split('.').reduce((current, part) => {
    if (!current || typeof current !== 'object') {
      return undefined;
    }
    return current[part];
  }, messages[locale]);
}

function formatMessage(template, params = {}) {
  return String(template).replace(/\{(\w+)\}/g, (_, key) => {
    return Object.prototype.hasOwnProperty.call(params, key) ? String(params[key]) : `{${key}}`;
  });
}

function t(key, params = {}, locale = detectLocale()) {
  const message = getMessage(locale, key) || getMessage('zh', key) || key;
  return formatMessage(message, params);
}

module.exports = {
  detectLocale,
  t
};
