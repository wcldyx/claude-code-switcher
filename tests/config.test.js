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

  describe('load', () => {
    test('should recover when config file contains non-object JSON value', async () => {
      const fs = require('fs-extra');
      await fs.writeFile(testConfigPath, 'null');

      configManager.isLoaded = false;
      configManager.config = null;
      configManager.lastModified = null;
      configManager.loadPromise = null;

      const config = await configManager.load(true);
      expect(config).toEqual(configManager.getDefaultConfig());

      const persisted = await fs.readJSON(testConfigPath);
      expect(persisted).toEqual(configManager.getDefaultConfig());
    });

    test('should recover when config file contains array JSON value', async () => {
      const fs = require('fs-extra');
      await fs.writeFile(testConfigPath, '[]');

      configManager.isLoaded = false;
      configManager.config = null;
      configManager.lastModified = null;
      configManager.loadPromise = null;

      const config = await configManager.load(true);
      expect(config).toEqual(configManager.getDefaultConfig());

      const persisted = await fs.readJSON(testConfigPath);
      expect(persisted).toEqual(configManager.getDefaultConfig());
    });

    test('should remove deprecated chrome launch arg during migration', async () => {
      const fs = require('fs-extra');
      await fs.writeJSON(testConfigPath, {
        version: '1.0.0',
        currentProvider: 'test',
        providers: {
          test: {
            name: 'test',
            displayName: 'Test Provider',
            launchArgs: ['--continue', '--chrome', '--dangerously-skip-permissions']
          }
        }
      });

      configManager.isLoaded = false;
      configManager.config = null;
      configManager.lastModified = null;
      configManager.loadPromise = null;

      const config = await configManager.load(true);
      expect(config.providers.test.launchArgs).toEqual([
        '--continue',
        '--dangerously-skip-permissions'
      ]);

      const persisted = await fs.readJSON(testConfigPath);
      expect(persisted.providers.test.launchArgs).toEqual([
        '--continue',
        '--dangerously-skip-permissions'
      ]);
    });

    test('should migrate legacy model fields to default model aliases', async () => {
      const fs = require('fs-extra');
      await fs.writeJSON(testConfigPath, {
        version: '1.0.0',
        currentProvider: 'test',
        providers: {
          test: {
            name: 'test',
            displayName: 'Test Provider',
            models: {
              primary: 'claude-sonnet-legacy',
              smallFast: 'claude-haiku-legacy'
            }
          }
        }
      });

      configManager.isLoaded = false;
      configManager.config = null;
      configManager.lastModified = null;
      configManager.loadPromise = null;

      const config = await configManager.load(true);
      expect(config.providers.test.models).toEqual({
        sonnet: 'claude-sonnet-legacy',
        haiku: 'claude-haiku-legacy'
      });

      const persisted = await fs.readJSON(testConfigPath);
      expect(persisted.providers.test.models).toEqual({
        sonnet: 'claude-sonnet-legacy',
        haiku: 'claude-haiku-legacy'
      });
    });
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
      expect(config.providers.test.models).toEqual({
        opus: null,
        sonnet: null,
        haiku: null
      });
      expect(config.providers.test.runtimeEnv).toEqual({
        autoCompactWindow: 258000,
        autoCompactPctOverride: 70,
        bashMaxOutputLength: 12000,
        taskMaxOutputLength: 16000
      });
    });

    test('should migrate missing runtime env settings to defaults', async () => {
      const fs = require('fs-extra');
      await fs.writeJSON(testConfigPath, {
        version: '1.0.0',
        currentProvider: 'test',
        providers: {
          test: {
            name: 'test',
            displayName: 'Test Provider'
          }
        }
      });

      configManager.isLoaded = false;
      configManager.config = null;
      configManager.lastModified = null;
      configManager.loadPromise = null;

      const config = await configManager.load(true);
      expect(config.providers.test.runtimeEnv).toEqual({
        autoCompactWindow: 258000,
        autoCompactPctOverride: 70,
        bashMaxOutputLength: 12000,
        taskMaxOutputLength: 16000
      });
    });

    test('should store default model aliases', async () => {
      await configManager.addProvider('test', {
        displayName: 'Test Provider',
        baseUrl: 'https://test.com',
        authToken: 'test-token-123456',
        opusModel: 'claude-opus-custom',
        sonnetModel: 'claude-sonnet-custom',
        haikuModel: 'claude-haiku-custom'
      });

      const config = await configManager.load();
      expect(config.providers.test.models).toEqual({
        opus: 'claude-opus-custom',
        sonnet: 'claude-sonnet-custom',
        haiku: 'claude-haiku-custom'
      });
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
      expect(validator.validateName('Claude Official')).toBeNull();
      expect(validator.validateName('我的Claude供应商')).toBeNull();
      expect(validator.validateName('Provider@Company.com')).toBeNull();
      expect(validator.validateName('🚀 Fast Provider')).toBeNull();
    });

    test('should reject invalid names', () => {
      expect(validator.validateName('')).toBe('供应商名称不能为空');
      expect(validator.validateName('   ')).toBe('供应商名称不能为空或只包含空格');
      expect(validator.validateName('a'.repeat(101))).toBe('供应商名称不能超过100个字符');
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
      expect(validator.validateToken('a'.repeat(5000))).toBeNull();
    });

    test('should reject invalid tokens', () => {
      expect(validator.validateToken('')).toBe('Token不能为空');
      expect(validator.validateToken('short')).toBe('Token长度不能少于10个字符');
    });
  });

  describe('validateModel', () => {
    test('should accept valid model names', () => {
      expect(validator.validateModel('kimi-k2-turbo-preview')).toBeNull();
      expect(validator.validateModel('gpt-4-turbo')).toBeNull();
      expect(validator.validateModel('claude-3-sonnet')).toBeNull();
      expect(validator.validateModel('')).toBeNull(); // 允许空值
      expect(validator.validateModel(null)).toBeNull(); // 允许null
      expect(validator.validateModel(undefined)).toBeNull(); // 允许undefined
    });

    test('should reject invalid model names', () => {
      expect(validator.validateModel('   ')).toBe('模型名称不能为空字符串');
      expect(validator.validateModel(123)).toBe('模型名称必须是字符串');
      expect(validator.validateModel('a'.repeat(101))).toBe('模型名称不能超过100个字符');
    });
  });

  describe('getAvailableLaunchArgs', () => {
    test('should select dangerous permissions by default', () => {
      const dangerousArg = validator
        .getAvailableLaunchArgs()
        .find(arg => arg.name === '--dangerously-skip-permissions');

      expect(dangerousArg).toBeDefined();
      expect(dangerousArg.checked).toBe(true);
    });
  });

});
