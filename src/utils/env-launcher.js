const spawn = require("cross-spawn");
const { execFileSync, spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { DEFAULT_RUNTIME_ENV } = require("../config");

const CLAUDE_PATH_CACHE = path.join(os.homedir(), ".cc-claude-path-cache.json");
const CLAUDE_PATH_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function clearTerminal() {
  if (!process.stdout || typeof process.stdout.write !== "function") {
    return;
  }

  try {
    process.stdout.write("\x1bc");
  } catch (error) {
    // 某些终端可能不支持 RIS 序列，忽略即可
  }

  const sequence =
    process.platform === "win32"
      ? "\x1b[3J\x1b[2J\x1b[0f"
      : "\x1b[3J\x1b[2J\x1b[H";
  try {
    process.stdout.write(sequence);
  } catch (error) {
    // 忽略清屏失败
  }
}

function buildEnvVariables(config) {
  const env = { ...process.env };

  if (config.authMode === "oauth_token") {
    env.CLAUDE_CODE_OAUTH_TOKEN = config.authToken;
  } else if (config.authMode === "api_key") {
    env.ANTHROPIC_BASE_URL = config.baseUrl;
    env.ANTHROPIC_API_KEY = config.authToken;
  } else {
    env.ANTHROPIC_BASE_URL = config.baseUrl;
    env.ANTHROPIC_AUTH_TOKEN = config.authToken;
  }

  if (config.models && config.models.opus) {
    env.ANTHROPIC_DEFAULT_OPUS_MODEL = config.models.opus;
  }

  if (config.models && config.models.sonnet) {
    env.ANTHROPIC_DEFAULT_SONNET_MODEL = config.models.sonnet;
  }

  if (config.models && config.models.haiku) {
    env.ANTHROPIC_DEFAULT_HAIKU_MODEL = config.models.haiku;
  }

  const runtimeEnv = {
    ...DEFAULT_RUNTIME_ENV,
    ...(config.runtimeEnv || {})
  };

  env.CLAUDE_CODE_AUTO_COMPACT_WINDOW = String(runtimeEnv.autoCompactWindow);
  env.CLAUDE_AUTOCOMPACT_PCT_OVERRIDE = String(runtimeEnv.autoCompactPctOverride);
  env.BASH_MAX_OUTPUT_LENGTH = String(runtimeEnv.bashMaxOutputLength);
  env.TASK_MAX_OUTPUT_LENGTH = String(runtimeEnv.taskMaxOutputLength);

  return env;
}

function getFreshWindowsPath(env) {
  try {
    const output = execFileSync(
      "powershell.exe",
      [
        "-NoProfile",
        "-Command",
        "$m=[Environment]::GetEnvironmentVariable('Path','Machine');$u=[Environment]::GetEnvironmentVariable('Path','User');if($m -and $u){$m+';'+$u}elseif($m){$m}else{$u}",
      ],
      { encoding: "utf8", env }
    );

    const freshPath = String(output || "").trim();
    return freshPath || null;
  } catch {
    return null;
  }
}

function clearInterruptResidue() {
  if (!process.stdout || typeof process.stdout.write !== "function") {
    return;
  }

  try {
    process.stdout.write("\r\x1b[2K");
    if (process.platform === "win32") {
      process.stdout.write("\x1b[2J\x1b[0f");
    }
  } catch {
    // 忽略终端清理失败
  }
}

function restoreTerminalInput(windowsConsoleMode = null) {
  if (process.stdout && typeof process.stdout.write === "function") {
    try {
      process.stdout.write("\x1b[?25h\r\x1b[2K");
    } catch {
      // 忽略终端恢复失败
    }
  }

  if (
    process.stdin &&
    process.stdin.isTTY &&
    typeof process.stdin.setRawMode === "function"
  ) {
    try {
      process.stdin.setRawMode(false);
    } catch {
      // 忽略 raw mode 恢复失败
    }
  }

  if (process.platform === "win32") {
    restoreWindowsConsoleMode(windowsConsoleMode);
  }
}

function getWindowsConsoleMode() {
  try {
    const output = execFileSync(
      "powershell.exe",
      [
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-Command",
        [
          "$sig='[DllImport(\"kernel32.dll\")]public static extern IntPtr GetStdHandle(int nStdHandle);[DllImport(\"kernel32.dll\")]public static extern bool GetConsoleMode(IntPtr hConsoleHandle,out int lpMode);';",
          "$k=Add-Type -MemberDefinition $sig -Name WinConsoleModeRead -Namespace CC -PassThru;",
          "$in=$k::GetStdHandle(-10);$out=$k::GetStdHandle(-11);",
          "$im=0;$om=0;[void]$k::GetConsoleMode($in,[ref]$im);[void]$k::GetConsoleMode($out,[ref]$om);",
          "Write-Output \"$im,$om\";"
        ].join("")
      ],
      { encoding: "utf8" }
    );
    const [inputMode, outputMode] = String(output || "")
      .trim()
      .split(",")
      .map(value => Number(value));

    if (Number.isFinite(inputMode) && Number.isFinite(outputMode)) {
      return { inputMode, outputMode };
    }
  } catch {
  }

  return null;
}

function restoreWindowsConsoleMode(savedMode = null) {
  const inputMode = savedMode?.inputMode ?? 503;
  const outputMode = savedMode?.outputMode ?? 7;

  try {
    spawnSync(
      "powershell.exe",
      [
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-Command",
        [
          "$sig='[DllImport(\"kernel32.dll\")]public static extern IntPtr GetStdHandle(int nStdHandle);[DllImport(\"kernel32.dll\")]public static extern bool GetConsoleMode(IntPtr hConsoleHandle,out int lpMode);[DllImport(\"kernel32.dll\")]public static extern bool SetConsoleMode(IntPtr hConsoleHandle,int dwMode);';",
          "$k=Add-Type -MemberDefinition $sig -Name WinConsoleMode -Namespace CC -PassThru;",
          "$in=$k::GetStdHandle(-10);$out=$k::GetStdHandle(-11);",
          "$m=0;if($k::GetConsoleMode($in,[ref]$m)){[void]$k::SetConsoleMode($in," + inputMode + ")};",
          "$m=0;if($k::GetConsoleMode($out,[ref]$m)){[void]$k::SetConsoleMode($out," + outputMode + ")};"
        ].join("")
      ],
      {
        stdio: "ignore",
        windowsHide: true
      }
    );
  } catch {
    // 忽略 Windows 控制台模式恢复失败
  }
}

function parseWindowsCmdShim(commandPath) {
  if (!/\.cmd$/i.test(commandPath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(commandPath, "utf8");
    const dir = path.dirname(commandPath);
    const scriptMatch = content.match(/"%dp0%\\([^"]+\.js)"/i);
    if (!scriptMatch) {
      return null;
    }

    const scriptPath = path.join(dir, scriptMatch[1]);
    return {
      command: process.execPath,
      argsPrefix: [scriptPath]
    };
  } catch {
    return null;
  }
}

function readClaudePathCache() {
  try {
    const cache = JSON.parse(fs.readFileSync(CLAUDE_PATH_CACHE, "utf8"));
    if (!cache || typeof cache !== "object") {
      return null;
    }
    if (Date.now() - Number(cache.checkedAt || 0) > CLAUDE_PATH_CACHE_TTL_MS) {
      return null;
    }
    if (!cache.command || typeof cache.command !== "string") {
      return null;
    }
    if (!fs.existsSync(cache.command)) {
      return null;
    }
    return {
      command: cache.command,
      argsPrefix: Array.isArray(cache.argsPrefix) ? cache.argsPrefix : []
    };
  } catch {
    return null;
  }
}

function writeClaudePathCache(target) {
  if (!target || !target.command || target.command === "claude") {
    return;
  }

  try {
    fs.writeFileSync(CLAUDE_PATH_CACHE, JSON.stringify({
      command: target.command,
      argsPrefix: target.argsPrefix || [],
      checkedAt: Date.now()
    }, null, 2));
  } catch {
  }
}

function refreshClaudePathCache(env) {
  setTimeout(() => {
    try {
      writeClaudePathCache(resolveWindowsClaudeTarget(env, { useCache: false }));
    } catch {
    }
  }, 0).unref?.();
}

function resolveWindowsClaudeTarget(env, options = {}) {
  const forcedClaudePath = env.CC_CLAUDE_PATH && String(env.CC_CLAUDE_PATH).trim();
  if (forcedClaudePath) {
    return { command: forcedClaudePath, argsPrefix: [] };
  }

  if (options.useCache !== false) {
    const cachedTarget = readClaudePathCache();
    if (cachedTarget) {
      refreshClaudePathCache(env);
      return cachedTarget;
    }
  }

  try {
    const output = execFileSync("where.exe", ["claude"], {
      encoding: "utf8",
      env
    });
    const candidates = String(output || "")
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(Boolean);

    const directCandidate = candidates.find(candidate => !/\.(cmd|bat|ps1)$/i.test(candidate));
    if (directCandidate) {
      const target = { command: directCandidate, argsPrefix: [] };
      writeClaudePathCache(target);
      return target;
    }

    const cmdCandidate = candidates.find(candidate => /\.cmd$/i.test(candidate));
    const parsedShim = cmdCandidate ? parseWindowsCmdShim(cmdCandidate) : null;
    if (parsedShim) {
      writeClaudePathCache(parsedShim);
      return parsedShim;
    }

    const target = { command: candidates[0] || "claude", argsPrefix: [] };
    writeClaudePathCache(target);
    return target;
  } catch {
    return { command: "claude", argsPrefix: [] };
  }
}

function buildClaudeSpawnConfig(args, env, isWindows) {
  if (isWindows) {
    const target = resolveWindowsClaudeTarget(env);
    return {
      command: target.command,
      args: [...target.argsPrefix, ...args],
      options: {
        stdio: "inherit",
        env,
        shell: false
      }
    };
  }

  return {
    command: "claude",
    args,
    options: {
      stdio: "inherit",
      env,
      shell: false
    }
  };
}

function isUserInterruptExit(code, signal, isWindows) {
  if (signal === "SIGINT") {
    return true;
  }

  if (code === 130) {
    return true;
  }

  // Windows STATUS_CONTROL_C_EXIT. Node reports it as an unsigned process code.
  if (isWindows && code === 3221225786) {
    return true;
  }

  return false;
}

async function executeWithEnv(config, launchArgs = []) {
  const env = buildEnvVariables(config);
  const args = [...launchArgs];

  clearTerminal();

  return new Promise((resolve, reject) => {
    const isWindows = process.platform === "win32";
    const runtimeEnv = { ...env };
    const windowsConsoleMode = isWindows ? getWindowsConsoleMode() : null;

    if (isWindows) {
      const freshPath = getFreshWindowsPath(runtimeEnv);
      if (freshPath) {
        runtimeEnv.Path = freshPath;
        runtimeEnv.PATH = freshPath;
      }
    }

    restoreTerminalInput(windowsConsoleMode);

    const spawnConfig = buildClaudeSpawnConfig(args, runtimeEnv, isWindows);
    const child = spawn(spawnConfig.command, spawnConfig.args, spawnConfig.options);

    const handleParentSigint = () => {
      // Ctrl+C 会传给子进程；父进程先保持存活，等待 close 后恢复终端状态。
    };
    process.on("SIGINT", handleParentSigint);

    const cleanup = () => {
      process.removeListener("SIGINT", handleParentSigint);
      restoreTerminalInput(windowsConsoleMode);
    };

    child.on("close", (code, signal) => {
      cleanup();
      if (isUserInterruptExit(code, signal, isWindows)) {
        clearInterruptResidue();
        resolve();
      } else if (code === 0) {
        resolve();
      } else {
        if (isWindows && code === 9009) {
          reject(
            new Error(
              "未找到 claude 命令，请先安装 @anthropic-ai/claude-code 或确保 claude 已加入 PATH。"
            )
          );
          return;
        }
        reject(new Error(`Claude Code 退出，代码: ${code}`));
      }
    });

    child.on("error", (error) => {
      cleanup();
      if (isWindows && error && error.code === "ENOENT") {
        reject(
          new Error(
            "未找到 claude 命令，请先安装 @anthropic-ai/claude-code 或确保 claude 已加入 PATH。"
          )
        );
        return;
      }
      reject(error);
    });
  });
}

module.exports = {
  executeWithEnv,
  buildEnvVariables,
  buildClaudeSpawnConfig,
  resolveWindowsClaudeTarget,
  parseWindowsCmdShim,
  isUserInterruptExit,
  clearInterruptResidue,
  getWindowsConsoleMode,
  restoreWindowsConsoleMode,
  readClaudePathCache,
  writeClaudePathCache,
  refreshClaudePathCache
};
