const { ConfigManager } = require('../src/config');
const { validator } = require('../src/utils/validator');

describe('ConfigManager', () => {
  let configManager;
  let testConfigPath;

  beforeEach(async () => {
    // 使用临时配置文件进行测试
    testConfigPath = './test-config.json';
    configManager = new ConfigManager();
    configManager.configPath = testConfigPath;
    
    // 初始化配置
    await configManager.load();
  });

  afterEach(async () => {
    // 清理测试文件
    const fs = require('fs-extra');
    if (await fs.pathExists(testConfigPath)) {
      await fs.remove(testConfigPath);
    }
  });

  describe('addProvider', () => {
    test('should add provider successfully', async () => {
      const result = await configManager.addProvider('test', {
        displayName: 'Test Provider',
        baseUrl: 'https://test.com',
        authToken: 'test-token-123456'
      });

      expect(result).toBe(true);
      
      const config = await configManager.load();
      expect(config.providers.test).toBeDefined();
      expect(config.providers.test.name).toBe('test');
      expect(config.providers.test.displayName).toBe('Test Provider');
      expect(config.providers.test.baseUrl).toBe('https://test.com');
      expect(config.providers.test.authToken).toBe('test-token-123456');
    });

    test('should set first provider as current', async () => {
      await configManager.addProvider('test', {
        displayName: 'Test Provider',
        baseUrl: 'https://test.com',
        authToken: 'test-token-123456'
      });

      const config = await configManager.load();
      expect(config.providers.test.current).toBe(true);
      expect(config.currentProvider).toBe('test');
    });
  });

  describe('removeProvider', () => {
    beforeEach(async () => {
      await configManager.addProvider('test', {
        displayName: 'Test Provider',
        baseUrl: 'https://test.com',
        authToken: 'test-token-123456'
      });
    });

    test('should remove provider successfully', async () => {
      const result = await configManager.removeProvider('test');
      
      expect(result).toBe(true);
      
      const config = await configManager.load();
      expect(config.providers.test).toBeUndefined();
    });

    test('should throw error for non-existent provider', async () => {
      await expect(configManager.removeProvider('non-existent'))
        .rejects.toThrow('供应商 \'non-existent\' 不存在');
    });
  });

  describe('listProviders', () => {
    beforeEach(async () => {
      await configManager.addProvider('test1', {
        displayName: 'Test Provider 1',
        baseUrl: 'https://test1.com',
        authToken: 'test-token-1'
      });
      
      await configManager.addProvider('test2', {
        displayName: 'Test Provider 2',
        baseUrl: 'https://test2.com',
        authToken: 'test-token-2'
      });
    });

    test('should return all providers', () => {
      const providers = configManager.listProviders();
      
      expect(providers).toHaveLength(2);
      expect(providers[0].name).toBe('test1');
      expect(providers[1].name).toBe('test2');
    });
  });
});

describe('validator', () => {
  describe('validateName', () => {
    test('should accept valid names', () => {
      expect(validator.validateName('test')).toBeNull();
      expect(validator.validateName('test_provider')).toBeNull();
      expect(validator.validateName('test-provider')).toBeNull();
      expect(validator.validateName('test123')).toBeNull();
    });

    test('should reject invalid names', () => {
      expect(validator.validateName('')).toBe('供应商名称不能为空');
      expect(validator.validateName('a')).toBe('供应商名称至少需要2个字符');
      expect(validator.validateName('a'.repeat(51))).toBe('供应商名称不能超过50个字符');
      expect(validator.validateName('test provider')).toBe('供应商名称只能包含字母、数字、下划线和连字符');
    });
  });

  describe('validateUrl', () => {
    test('should accept valid URLs', () => {
      expect(validator.validateUrl('https://example.com')).toBeNull();
      expect(validator.validateUrl('http://example.com')).toBeNull();
      expect(validator.validateUrl('https://api.example.com/v1')).toBeNull();
    });

    test('should reject invalid URLs', () => {
      expect(validator.validateUrl('')).toBe('URL不能为空');
      expect(validator.validateUrl('not-a-url')).toBe('请输入有效的URL');
      expect(validator.validateUrl('ftp://example.com')).toBe('URL必须以http://或https://开头');
    });
  });

  describe('validateToken', () => {
    test('should accept valid tokens', () => {
      expect(validator.validateToken('sk-ant-123456')).toBeNull();
      expect(validator.validateToken('test-token-123456')).toBeNull();
    });

    test('should reject invalid tokens', () => {
      expect(validator.validateToken('')).toBe('Token不能为空');
      expect(validator.validateToken('short')).toBe('Token长度不能少于10个字符');
      expect(validator.validateToken('a'.repeat(501))).toBe('Token长度不能超过500个字符');
    });
  });

  describe('maskToken', () => {
    test('should mask token correctly', () => {
      expect(validator.maskToken('sk-ant-1234567890')).toBe('sk-a****7890');
      expect(validator.maskToken('short')).toBe('short');
      expect(validator.maskToken('')).toBe('');
    });
  });
});