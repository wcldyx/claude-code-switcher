const validator = {
  validateName(name) {
    if (!name || typeof name !== 'string') {
      return '供应商名称不能为空';
    }
    
    if (name.trim().length === 0) {
      return '供应商名称不能为空或只包含空格';
    }
    
    if (name.length > 100) {
      return '供应商名称不能超过100个字符';
    }
    
    return null;
  },

  validateDisplayName(displayName) {
    // 允许空值，表示可选
    if (displayName === null || displayName === undefined || displayName === '') {
      return null;
    }
    
    if (typeof displayName !== 'string') {
      return '显示名称必须是字符串';
    }
    
    if (displayName.length > 100) {
      return '显示名称不能超过100个字符';
    }
    
    return null;
  },

  validateUrl(url, required = true) {
    if (!url || typeof url !== 'string') {
      return required ? 'URL不能为空' : null;
    }
    
    try {
      new URL(url);
    } catch (error) {
      return '请输入有效的URL';
    }
    
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return 'URL必须以http://或https://开头';
    }
    
    return null;
  },

  validateToken(token) {
    if (!token || typeof token !== 'string') {
      return 'Token不能为空';
    }
    
    if (token.length < 10) {
      return 'Token长度不能少于10个字符';
    }
    
    if (token.length > 500) {
      return 'Token长度不能超过500个字符';
    }
    
    return null;
  },

  validateModel(model) {
    // 允许空值，表示可选
    if (!model) {
      return null;
    }
    
    if (typeof model !== 'string') {
      return '模型名称必须是字符串';
    }
    
    if (model.trim().length === 0) {
      return '模型名称不能为空字符串';
    }
    
    if (model.length > 100) {
      return '模型名称不能超过100个字符';
    }
    
    return null;
  },

  validateLaunchArgs(args) {
    if (!Array.isArray(args)) {
      return '启动参数必须是数组';
    }
    
    const validArgs = [
      '--dangerously-skip-permissions',
      '--no-confirm', 
      '--allow-all',
      '--auto-approve',
      '--yes',
      '--force'
    ];
    
    for (const arg of args) {
      if (!validArgs.includes(arg)) {
        return `无效的启动参数: ${arg}`;
      }
    }
    
    return null;
  },

  getAvailableLaunchArgs() {
    return [
      {
        name: '--dangerously-skip-permissions',
        description: '跳过权限检查（最大化权限）',
        checked: false
      },
      {
        name: '--no-confirm',
        description: '跳过确认提示',
        checked: false
      },
      {
        name: '--allow-all',
        description: '允许所有操作',
        checked: false
      },
      {
        name: '--auto-approve',
        description: '自动批准操作',
        checked: false
      },
      {
        name: '--yes',
        description: '自动回答yes',
        checked: false
      },
      {
        name: '--force',
        description: '强制执行操作',
        checked: false
      }
    ];
  }
};

module.exports = { validator };