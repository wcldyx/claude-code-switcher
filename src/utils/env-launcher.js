const spawn = require('cross-spawn');

function clearTerminal() {
  if (!process.stdout || typeof process.stdout.write !== 'function') {
    return;
  }

  try {
    process.stdout.write('\x1bc');
  } catch (error) {
    // 某些终端可能不支持 RIS 序列，忽略即可
  }

  const sequence = process.platform === 'win32'
    ? '\x1b[3J\x1b[2J\x1b[0f'
    : '\x1b[3J\x1b[2J\x1b[H';
  try {
    process.stdout.write(sequence);
  } catch (error) {
    // 忽略清屏失败
  }
}

function buildEnvVariables(config) {
  const env = { ...process.env };

  if (config.authMode === 'oauth_token') {
    env.CLAUDE_CODE_OAUTH_TOKEN = config.authToken;
  } else if (config.authMode === 'api_key') {
    env.ANTHROPIC_BASE_URL = config.baseUrl;
    env.ANTHROPIC_API_KEY = config.authToken;
  } else {
    env.ANTHROPIC_BASE_URL = config.baseUrl;
    env.ANTHROPIC_AUTH_TOKEN = config.authToken;
  }

  if (config.models && config.models.primary) {
    env.ANTHROPIC_MODEL = config.models.primary;
  }

  if (config.models && config.models.smallFast) {
    env.ANTHROPIC_SMALL_FAST_MODEL = config.models.smallFast;
  }

  return env;
}

async function executeWithEnv(config, launchArgs = []) {
  const env = buildEnvVariables(config);
  const args = [...launchArgs];

  clearTerminal();

  return new Promise((resolve, reject) => {
    const child = spawn('claude', args, {
      stdio: 'inherit',
      env,
      shell: true
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Claude Code 退出，代码: ${code}`));
      }
    });

    child.on('error', reject);
  });
}

module.exports = { executeWithEnv };
