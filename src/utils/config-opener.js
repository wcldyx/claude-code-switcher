const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const CC_CONFIG_FILE = path.join(os.homedir(), '.cc-config.json');

function ensureConfigExists() {
  return fs.pathExists(CC_CONFIG_FILE);
}

function openFileWithDefaultApp(filePath) {
  return new Promise((resolve, reject) => {
    let command;
    let args = [];

    if (process.platform === 'win32') {
      command = 'cmd';
      args = ['/c', 'start', '', filePath];
    } else if (process.platform === 'darwin') {
      command = 'open';
      args = [filePath];
    } else {
      command = 'xdg-open';
      args = [filePath];
    }

    const child = spawn(command, args, { stdio: 'ignore', detached: true });
    child.on('error', reject);
    child.unref();
    resolve();
  });
}

async function openCCConfigFile() {
  if (!(await ensureConfigExists())) {
    throw new Error('未找到 ~/.cc-config.json，请先运行 cc add 创建配置');
  }
  await openFileWithDefaultApp(CC_CONFIG_FILE);
}

module.exports = {
  openCCConfigFile
};
