const fs = require('fs-extra');
const path = require('path');
const os = require('os');

const CONFLICT_ENV_KEYS = [
  'ANTHROPIC_API_KEY',
  'ANTHROPIC_AUTH_TOKEN',
  'ANTHROPIC_BASE_URL',
  'CLAUDE_CODE_OAUTH_TOKEN',
  'ANTHROPIC_MODEL',
  'ANTHROPIC_SMALL_FAST_MODEL'
];

const SETTINGS_FILE_NAMES = ['settings.local.json', 'settings.json'];

function unique(array) {
  return Array.from(new Set(array.filter(Boolean)));
}

function timestampSuffix() {
  const now = new Date();
  const pad = (num) => String(num).padStart(2, '0');
  return [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
    '_',
    pad(now.getHours()),
    pad(now.getMinutes()),
    pad(now.getSeconds())
  ].join('');
}

function resolveCandidatePaths() {
  const candidates = [];

  if (process.env.CLAUDE_SETTINGS_PATH) {
    candidates.push(process.env.CLAUDE_SETTINGS_PATH);
  }

  const cwd = process.cwd();
  if (cwd) {
    for (const fileName of SETTINGS_FILE_NAMES) {
      candidates.push(path.join(cwd, '.claude', fileName));
    }
  }

  const homeDir = os.homedir();
  if (homeDir) {
    for (const fileName of SETTINGS_FILE_NAMES) {
      candidates.push(path.join(homeDir, '.claude', fileName));
    }
  }

  if (process.platform === 'win32') {
    const baseDirs = unique([process.env.APPDATA, process.env.LOCALAPPDATA]);
    for (const baseDir of baseDirs) {
      if (!baseDir) {
        continue;
      }
      for (const fileName of SETTINGS_FILE_NAMES) {
        candidates.push(path.join(baseDir, 'claude', fileName));
      }
    }
  }

  return unique(candidates);
}

async function loadSettingsFile() {
  const candidates = resolveCandidatePaths();
  for (const candidate of candidates) {
    try {
      if (await fs.pathExists(candidate)) {
        const data = await fs.readJson(candidate);
        return { path: candidate, data };
      }
    } catch (error) {
      throw new Error(`读取 Claude 设置文件失败 (${candidate}): ${error.message}`);
    }
  }
  return null;
}

function detectConflictKeys(settings) {
  if (!settings || typeof settings !== 'object') {
    return [];
  }
  const env = settings.env;
  if (!env || typeof env !== 'object') {
    return [];
  }

  return CONFLICT_ENV_KEYS.filter((key) => Object.prototype.hasOwnProperty.call(env, key));
}

async function backupSettingsFile(filePath) {
  const dir = path.dirname(filePath);
  const backupName = `settings.backup-${timestampSuffix()}.json`;
  const backupPath = path.join(dir, backupName);
  await fs.copy(filePath, backupPath, { overwrite: false, errorOnExist: false });
  return backupPath;
}

function clearConflictKeys(settings, keys) {
  if (!settings || !settings.env) {
    return settings;
  }

  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(settings.env, key)) {
      delete settings.env[key];
    }
  }

  if (Object.keys(settings.env).length === 0) {
    delete settings.env;
  }

  return settings;
}

async function saveSettingsFile(filePath, data) {
  await fs.writeJson(filePath, data, { spaces: 2 });
}

async function findSettingsConflict() {
  const fileInfo = await loadSettingsFile();
  if (!fileInfo) {
    return null;
  }

  const conflictKeys = detectConflictKeys(fileInfo.data);
  if (!conflictKeys.length) {
    return null;
  }

  return {
    filePath: fileInfo.path,
    settings: fileInfo.data,
    keys: conflictKeys
  };
}

module.exports = {
  findSettingsConflict,
  backupSettingsFile,
  clearConflictKeys,
  saveSettingsFile
};
