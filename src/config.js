const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const chalk = require('chalk');

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
      if (await fs.pathExists(this.configPath)) {
        const stat = await fs.stat(this.configPath);
        const data = await fs.readJSON(this.configPath);
        this.config = { ...this.getDefaultConfig(), ...data };
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

  async checkIfModified() {
    try {
      if (!this.lastModified || !await fs.pathExists(this.configPath)) {
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
      await fs.writeJSON(this.configPath, this.config, { spaces: 2 });
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
      authMode: providerConfig.authMode || 'api_token',
      launchArgs: providerConfig.launchArgs || [],
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

module.exports = { ConfigManager };