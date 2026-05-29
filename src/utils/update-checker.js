const chalk = require('chalk');
const spawn = require('cross-spawn');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { t } = require('./i18n');

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CACHE_PATH = path.join(os.homedir(), '.cc-update-check.json');

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
      shell: false,
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

function readUpdateCache() {
  try {
    const cache = JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8'));
    if (!cache || typeof cache !== 'object') {
      return null;
    }
    return cache;
  } catch {
    return null;
  }
}

function writeUpdateCache(packageName, latest) {
  try {
    fs.writeFileSync(CACHE_PATH, JSON.stringify({
      packageName,
      latest,
      checkedAt: Date.now()
    }, null, 2));
  } catch {
  }
}

function refreshUpdateCache(packageName) {
  return getLatestVersion(packageName, 4000).then(latest => {
    if (latest) {
      writeUpdateCache(packageName, latest);
    }
    return latest;
  }).catch(() => null);
}

function isFreshCache(cache, packageName) {
  return Boolean(
    cache &&
    cache.packageName === packageName &&
    cache.latest &&
    Date.now() - Number(cache.checkedAt || 0) < CACHE_TTL_MS
  );
}

async function checkForUpdates({ packageName, currentVersion, background = false }) {
  try {
    if (
      process.env.NODE_ENV === 'test' ||
      process.env.CC_NO_UPDATE_CHECK === '1' ||
      process.env.CI === 'true'
    ) {
      return;
    }

    const cache = readUpdateCache();
    const latest = isFreshCache(cache, packageName) ? cache.latest : null;

    if (background) {
      if (!latest) {
        refreshUpdateCache(packageName);
      }
      return;
    }

    if (!latest) {
      const refreshedLatest = await refreshUpdateCache(packageName);
      if (!refreshedLatest) return;
      return await checkForUpdates({ packageName, currentVersion, background });
    }

    if (!latest) return;

    if (compareVersions(latest, currentVersion) > 0) {
      const installCmd = `npm i -g ${packageName}@latest`;
      console.log('\n' + chalk.yellow(t('update.available', { latest, current: currentVersion })));
      console.log(chalk.gray(t('update.command')) + chalk.cyan(installCmd) + '\n');
      const interactive = Boolean(process.stdin.isTTY && process.stdout.isTTY);
      if (!interactive) {
        return;
      }

      const inquirer = require('inquirer');
      const { doUpdate } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'doUpdate',
          message: t('update.prompt'),
          default: false,
        },
      ]);

      if (!doUpdate) return;

      console.log(chalk.yellow(t('update.installing')));
      await new Promise((resolve) => {
        const child = spawn('npm', ['i', '-g', `${packageName}@latest`], {
          shell: false,
          stdio: 'inherit',
        });
        child.on('close', (code) => resolve(code === 0));
      }).then((ok) => {
        if (!ok) {
          console.log(chalk.red(t('update.failed')) + chalk.cyan(installCmd));
          return;
        }
        console.log(chalk.green(t('update.success')));
        const child = spawn(process.execPath, [process.argv[1], ...process.argv.slice(2)], {
          shell: false,
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
