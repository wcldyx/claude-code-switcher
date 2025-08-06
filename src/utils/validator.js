const validator = {
  validateName(name) {
    if (!name || typeof name !== 'string') {
      return '供应商名称不能为空';
    }
    
    if (name.length < 2) {
      return '供应商名称至少需要2个字符';
    }
    
    if (name.length > 50) {
      return '供应商名称不能超过50个字符';
    }
    
    if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
      return '供应商名称只能包含字母、数字、下划线和连字符';
    }
    
    return null;
  },

  validateDisplayName(displayName) {
    if (!displayName || typeof displayName !== 'string') {
      return '显示名称不能为空';
    }
    
    if (displayName.trim().length < 1) {
      return '显示名称不能为空';
    }
    
    if (displayName.length > 100) {
      return '显示名称不能超过100个字符';
    }
    
    return null;
  },

  validateUrl(url) {
    if (!url || typeof url !== 'string') {
      return 'URL不能为空';
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

  maskToken(token) {
    if (!token || token.length < 8) {
      return token;
    }
    
    const start = token.substring(0, 4);
    const end = token.substring(token.length - 4);
    const stars = '*'.repeat(Math.min(token.length - 8, 4));
    
    return `${start}${stars}${end}`;
  }
};

module.exports = { validator };