const fs = require('fs-extra');
const path = require('path');
const os = require('os');

class Storage {
  static async ensureConfigDir() {
    const configDir = path.join(os.homedir(), '.cc-config');
    await fs.ensureDir(configDir);
    return configDir;
  }

  static async readConfig() {
    const configPath = path.join(os.homedir(), '.cc-config.json');
    try {
      if (await fs.pathExists(configPath)) {
        return await fs.readJSON(configPath);
      }
      return null;
    } catch (error) {
      throw new Error(`读取配置文件失败: ${error.message}`);
    }
  }

  static async writeConfig(config) {
    const configPath = path.join(os.homedir(), '.cc-config.json');
    try {
      await fs.writeJSON(configPath, config, { spaces: 2 });
      return true;
    } catch (error) {
      throw new Error(`写入配置文件失败: ${error.message}`);
    }
  }

  static async backupConfig() {
    const configPath = path.join(os.homedir(), '.cc-config.json');
    const backupPath = path.join(os.homedir(), '.cc-config.backup.json');
    
    if (await fs.pathExists(configPath)) {
      await fs.copy(configPath, backupPath);
      return backupPath;
    }
    return null;
  }

  static async restoreConfig(backupPath) {
    const configPath = path.join(os.homedir(), '.cc-config.json');
    if (await fs.pathExists(backupPath)) {
      await fs.copy(backupPath, configPath);
      return true;
    }
    return false;
  }
}

module.exports = { Storage };