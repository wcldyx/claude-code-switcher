const chalk = require('chalk');
const inquirer = require('inquirer');
const spawn = require('cross-spawn');

function compareVersions(a, b) {
  const pa = String(a).split('.').map(Number);
  const pb = String(b).split('.').map(Number);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const na = pa[i] || 0;
    const nb = pb[i] || 0;
    if (na > nb) return 1;
    if (na < nb) return -1;
  }
  return 0;
}

function getLatestVersion(pkgName, timeoutMs = 4000) {
  return new Promise((resolve, reject) => {
    let done = false;
    const child = spawn('npm', ['view', pkgName, 'version', '--json'], {
      shell: process.platform === 'win32',
      stdio: ['ignore', 'pipe', 'ignore'],
    });

    let out = '';
    child.stdout.on('data', (d) => (out += d.toString()))

    const t = setTimeout(() => {
      if (done) return;
      done = true;
      try { child.kill(); } catch {}
      resolve(null);
    }, timeoutMs);

    child.on('error', () => {
      if (done) return;
      done = true;
      clearTimeout(t);
      resolve(null);
    });

    child.on('close', () => {
      if (done) return;
      done = true;
      clearTimeout(t);
      const text = (out || '').trim();
      if (!text) return resolve(null);
      try {
        const parsed = JSON.parse(text);
        if (typeof parsed === 'string') return resolve(parsed);
        if (Array.isArray(parsed)) return resolve(parsed[parsed.length - 1] || null);
        if (parsed && parsed.version) return resolve(parsed.version);
        return resolve(String(text));
      } catch {
        return resolve(text);
      }
    });
  });
}

async function checkForUpdates({ packageName, currentVersion }) {
  try {
    if (
      process.env.NODE_ENV === 'test' ||
      process.env.CC_NO_UPDATE_CHECK === '1' ||
      process.env.CI === 'true'
    ) {
      return;
    }

    const latest = await getLatestVersion(packageName);
    if (!latest) return;

    if (compareVersions(latest, currentVersion) > 0) {
      const installCmd = `npm i -g ${packageName}@latest`;
      console.log('\n' + chalk.yellow(`🔔 检测到新版本 ${latest}，当前版本 ${currentVersion}`));
      console.log(chalk.gray('更新命令: ') + chalk.cyan(installCmd) + '\n');
      const interactive = Boolean(process.stdin.isTTY && process.stdout.isTTY);
      if (!interactive) {
        return;
      }

      const { doUpdate } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'doUpdate',
          message: '是否立即更新并重启？',
          default: false,
        },
      ]);

      if (!doUpdate) return;

      console.log(chalk.yellow('开始更新，请稍候...'));
      await new Promise((resolve) => {
        const child = spawn('npm', ['i', '-g', `${packageName}@latest`], {
          shell: process.platform === 'win32',
          stdio: 'inherit',
        });
        child.on('close', (code) => resolve(code === 0));
      }).then((ok) => {
        if (!ok) {
          console.log(chalk.red('更新失败，请稍后重试或手动执行: ') + chalk.cyan(installCmd));
          return;
        }
        console.log(chalk.green('更新成功，正在重启...'));
        const child = spawn('cc', process.argv.slice(2), {
          shell: true,
          stdio: 'inherit',
        });
        child.on('close', (code) => {
          process.exit(code || 0);
        });
      });
    }
  } catch {
  }
}

module.exports = { checkForUpdates };
