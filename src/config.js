const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const chalk = require('chalk');

class ConfigManager {
  constructor() {
    this.configPath = path.join(os.homedir(), '.cc-config.json');
    this.config = this.getDefaultConfig();
  }

  getDefaultConfig() {
    return {
      version: '1.0.0',
      currentProvider: null,
      providers: {}
    };
  }

  async load() {
    try {
      if (await fs.pathExists(this.configPath)) {
        const data = await fs.readJSON(this.configPath);
        this.config = { ...this.getDefaultConfig(), ...data };
      } else {
        await this.save(this.config);
      }
      return this.config;
    } catch (error) {
      if (error.message.includes('Unexpected end of JSON input')) {
        // 处理空文件或损坏的JSON文件
        await this.save(this.config);
        return this.config;
      }
      console.error(chalk.red('❌ 加载配置失败:'), error.message);
      throw error;
    }
  }

  async save(config = this.config) {
    try {
      await fs.writeJSON(this.configPath, config, { spaces: 2 });
      this.config = config;
      return true;
    } catch (error) {
      console.error(chalk.red('❌ 保存配置失败:'), error.message);
      throw error;
    }
  }

  async addProvider(name, providerConfig) {
    await this.load();
    
    this.config.providers[name] = {
      name,
      displayName: providerConfig.displayName || name,
      baseUrl: providerConfig.baseUrl,
      authToken: providerConfig.authToken,
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
    await this.load();
    
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
    await this.load();
    
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
    return this.config.providers[name];
  }

  listProviders() {
    return Object.keys(this.config.providers).map(name => ({
      name,
      ...this.config.providers[name]
    }));
  }

  getCurrentProvider() {
    if (!this.config.currentProvider) {
      return null;
    }
    return this.getProvider(this.config.currentProvider);
  }

  async reset() {
    this.config = this.getDefaultConfig();
    return await this.save();
  }
}

module.exports = { ConfigManager };