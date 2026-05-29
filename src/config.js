const fs = require('fs/promises');
const path = require('path');
const os = require('os');
const chalk = require('chalk');

const DEFAULT_RUNTIME_ENV = {
  autoCompactWindow: 258000,
  autoCompactPctOverride: 70,
  bashMaxOutputLength: 12000,
  taskMaxOutputLength: 16000
};

async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readJSON(filePath) {
  const content = await fs.readFile(filePath, 'utf8');
  return JSON.parse(content);
}

async function writeJSON(filePath, data, options = {}) {
  const spaces = Object.prototype.hasOwnProperty.call(options, 'spaces')
    ? options.spaces
    : 2;
  await fs.writeFile(filePath, JSON.stringify(data, null, spaces));
}

class ConfigManager {
  constructor() {
    this.configPath = path.join(os.homedir(), '.cc-config.json');
    this.config = null; // 延迟加载
    this.isLoaded = false;
    this.lastModified = null;
    this.loadPromise = null; // 防止并发加载
  }

  getDefaultConfig() {
    return {
      version: '1.0.0',
      currentProvider: null,
      preferences: {
        defaultDangerouslySkipPermissions: true
      },
      providers: {}
    };
  }

  async load(forceReload = false) {
    // 如果正在加载，等待当前加载完成
    if (this.loadPromise) {
      return await this.loadPromise;
    }

    // 如果已经加载且不是强制重载，直接返回缓存
    if (this.isLoaded && !forceReload) {
      // 检查文件是否被外部修改
      const needsReload = await this.checkIfModified();
      if (!needsReload) {
        return this.config;
      }
    }

    // 创建加载Promise
    this.loadPromise = this._performLoad();
    try {
      const result = await this.loadPromise;
      this.loadPromise = null;
      return result;
    } catch (error) {
      this.loadPromise = null;
      throw error;
    }
  }

  async _performLoad() {
    try {
      if (await pathExists(this.configPath)) {
        const data = await readJSON(this.configPath);

        if (!data || typeof data !== 'object' || Array.isArray(data)) {
          // 配置文件被写成非对象内容时，重置为默认配置
          this.config = this.getDefaultConfig();
          await this._performSave();
        } else {
          this.config = { ...this.getDefaultConfig(), ...data };
        }

        // 迁移旧配置
        const preferencesMigrated = this._normalizePreferences();
        const authModesMigrated = this._migrateAuthModes();
        const launchArgsMigrated = this._migrateLaunchArgs();
        const modelsMigrated = this._migrateModelConfig();
        const runtimeEnvMigrated = this._migrateRuntimeEnvConfig();
        const migrated = preferencesMigrated || authModesMigrated || launchArgsMigrated || modelsMigrated || runtimeEnvMigrated;
        if (migrated) {
          await this._performSave();
        }

        const stat = await fs.stat(this.configPath);
        this.lastModified = stat.mtime;
      } else {
        this.config = this.getDefaultConfig();
        await this._performSave();
      }
      this.isLoaded = true;
      return this.config;
    } catch (error) {
      if (error.message.includes('Unexpected end of JSON input')) {
        // 处理空文件或损坏的JSON文件
        this.config = this.getDefaultConfig();
        await this._performSave();
        this.isLoaded = true;
        return this.config;
      }
      console.error(chalk.red('❌ 加载配置失败:'), error.message);
      throw error;
    }
  }

  _migrateAuthModes() {
    let migrated = false;

    // 迁移旧的 api_token 模式到新的 auth_token 模式
    if (this.config.providers) {
      Object.keys(this.config.providers).forEach(key => {
        const provider = this.config.providers[key];
        if (provider.authMode === 'api_token') {
          provider.authMode = 'auth_token';
          migrated = true;
        }
      });
    }

    return migrated;
  }

  _normalizePreferences() {
    const defaultPreferences = this.getDefaultConfig().preferences;
    const currentPreferences = this.config.preferences;

    if (!currentPreferences || typeof currentPreferences !== 'object' || Array.isArray(currentPreferences)) {
      this.config.preferences = { ...defaultPreferences };
      return true;
    }

    const normalizedPreferences = {
      ...defaultPreferences,
      ...currentPreferences
    };
    const migrated = JSON.stringify(normalizedPreferences) !== JSON.stringify(currentPreferences);
    this.config.preferences = normalizedPreferences;

    return migrated;
  }

  _migrateLaunchArgs() {
    let migrated = false;

    if (this.config.providers) {
      Object.keys(this.config.providers).forEach(key => {
        const provider = this.config.providers[key];
        if (Array.isArray(provider.launchArgs) && provider.launchArgs.includes('--chrome')) {
          provider.launchArgs = provider.launchArgs.filter(arg => arg !== '--chrome');
          migrated = true;
        }
      });
    }

    return migrated;
  }

  _migrateModelConfig() {
    let migrated = false;

    if (this.config.providers) {
      Object.keys(this.config.providers).forEach(key => {
        const provider = this.config.providers[key];
        if (!provider.models || typeof provider.models !== 'object') {
          return;
        }

        if (provider.models.primary && !provider.models.sonnet) {
          provider.models.sonnet = provider.models.primary;
          migrated = true;
        }

        if (provider.models.smallFast && !provider.models.haiku) {
          provider.models.haiku = provider.models.smallFast;
          migrated = true;
        }

        if (Object.prototype.hasOwnProperty.call(provider.models, 'primary')) {
          delete provider.models.primary;
          migrated = true;
        }

        if (Object.prototype.hasOwnProperty.call(provider.models, 'smallFast')) {
          delete provider.models.smallFast;
          migrated = true;
        }
      });
    }

    return migrated;
  }

  _normalizeRuntimeEnv(runtimeEnv) {
    const normalized = { ...DEFAULT_RUNTIME_ENV };
    if (!runtimeEnv || typeof runtimeEnv !== 'object' || Array.isArray(runtimeEnv)) {
      return normalized;
    }

    Object.keys(DEFAULT_RUNTIME_ENV).forEach(key => {
      const value = Number(runtimeEnv[key]);
      if (Number.isFinite(value) && value > 0) {
        if (key === 'autoCompactPctOverride') {
          normalized[key] = Math.min(Math.floor(value), 100);
        } else {
          normalized[key] = Math.floor(value);
        }
      }
    });

    return normalized;
  }

  _migrateRuntimeEnvConfig() {
    let migrated = false;

    if (this.config.providers) {
      Object.keys(this.config.providers).forEach(key => {
        const provider = this.config.providers[key];
        const normalized = this._normalizeRuntimeEnv(provider.runtimeEnv);
        if (JSON.stringify(provider.runtimeEnv) !== JSON.stringify(normalized)) {
          provider.runtimeEnv = normalized;
          migrated = true;
        }
      });
    }

    return migrated;
  }

  async checkIfModified() {
    try {
      if (!this.lastModified || !await pathExists(this.configPath)) {
        return true;
      }
      const stat = await fs.stat(this.configPath);
      return stat.mtime > this.lastModified;
    } catch (error) {
      return true; // 出错时重新加载
    }
  }

  async save(config = this.config) {
    // 确保配置已加载
    await this.ensureLoaded();
    if (config) {
      this.config = config;
    }
    return await this._performSave();
  }

  async _performSave() {
    try {
      await writeJSON(this.configPath, this.config, { spaces: 2 });
      // 更新最后修改时间
      const stat = await fs.stat(this.configPath);
      this.lastModified = stat.mtime;
      return true;
    } catch (error) {
      console.error(chalk.red('❌ 保存配置失败:'), error.message);
      throw error;
    }
  }

  // 确保配置已加载的辅助方法
  async ensureLoaded() {
    if (!this.isLoaded) {
      await this.load();
    }
  }

  async addProvider(name, providerConfig) {
    await this.ensureLoaded();
    
    this.config.providers[name] = {
      name,
      displayName: providerConfig.displayName || name,
      baseUrl: providerConfig.baseUrl,
      authToken: providerConfig.authToken,
      authMode: providerConfig.authMode || 'api_key',
      launchArgs: providerConfig.launchArgs || [],
      runtimeEnv: this._normalizeRuntimeEnv(providerConfig.runtimeEnv),
      models: {
        opus: providerConfig.opusModel || null,
        sonnet: providerConfig.sonnetModel || null,
        haiku: providerConfig.haikuModel || null
      },
      createdAt: new Date().toISOString(),
      lastUsed: new Date().toISOString(),
      current: false
    };

    // 如果是第一个供应商或设置为默认，则设为当前供应商
    if (Object.keys(this.config.providers).length === 1 || providerConfig.setAsDefault) {
      // 重置所有供应商的current状态
      Object.keys(this.config.providers).forEach(key => {
        this.config.providers[key].current = false;
      });
      
      // 设置新的当前供应商
      this.config.providers[name].current = true;
      this.config.providers[name].lastUsed = new Date().toISOString();
      this.config.currentProvider = name;
    }

    return await this.save();
  }

  async removeProvider(name) {
    await this.ensureLoaded();
    
    if (!this.config.providers[name]) {
      throw new Error(`供应商 '${name}' 不存在`);
    }

    delete this.config.providers[name];

    // 如果删除的是当前供应商，清空当前供应商
    if (this.config.currentProvider === name) {
      this.config.currentProvider = null;
    }

    return await this.save();
  }

  async setCurrentProvider(name) {
    await this.ensureLoaded();
    
    if (!this.config.providers[name]) {
      throw new Error(`供应商 '${name}' 不存在`);
    }

    // 重置所有供应商的current状态
    Object.keys(this.config.providers).forEach(key => {
      this.config.providers[key].current = false;
    });

    // 设置新的当前供应商
    this.config.providers[name].current = true;
    this.config.providers[name].lastUsed = new Date().toISOString();
    this.config.currentProvider = name;

    return await this.save();
  }

  shouldDefaultDangerouslySkipPermissions() {
    const preferences = this.config?.preferences || this.getDefaultConfig().preferences;
    return preferences.defaultDangerouslySkipPermissions !== false;
  }

  getDefaultLaunchArgs() {
    return this.shouldDefaultDangerouslySkipPermissions()
      ? ['--dangerously-skip-permissions']
      : [];
  }

  getProvider(name) {
    // 同步方法，但需要先确保配置已加载
    if (!this.isLoaded) {
      throw new Error('配置未加载，请先调用 load() 方法');
    }
    return this.config.providers[name];
  }

  listProviders() {
    // 同步方法，但需要先确保配置已加载
    if (!this.isLoaded) {
      throw new Error('配置未加载，请先调用 load() 方法');
    }
    return Object.keys(this.config.providers).map(name => ({
      name,
      ...this.config.providers[name]
    }));
  }

  getCurrentProvider() {
    // 同步方法，但需要先确保配置已加载
    if (!this.isLoaded) {
      throw new Error('配置未加载，请先调用 load() 方法');
    }
    if (!this.config.currentProvider) {
      return null;
    }
    return this.getProvider(this.config.currentProvider);
  }

  async reset() {
    this.config = this.getDefaultConfig();
    this.isLoaded = true;
    return await this._performSave();
  }
}

module.exports = { ConfigManager, DEFAULT_RUNTIME_ENV };
