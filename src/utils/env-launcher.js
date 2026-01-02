const spawn = require("cross-spawn");
const { execFileSync } = require("child_process");

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

  if (config.models && config.models.primary) {
    env.ANTHROPIC_MODEL = config.models.primary;
  }

  if (config.models && config.models.smallFast) {
    env.ANTHROPIC_SMALL_FAST_MODEL = config.models.smallFast;
  }

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

async function executeWithEnv(config, launchArgs = []) {
  const env = buildEnvVariables(config);
  const args = [...launchArgs];

  clearTerminal();

  return new Promise((resolve, reject) => {
    const isWindows = process.platform === "win32";
    const runtimeEnv = { ...env };

    if (isWindows) {
      const freshPath = getFreshWindowsPath(runtimeEnv);
      if (freshPath) {
        runtimeEnv.Path = freshPath;
        runtimeEnv.PATH = freshPath;
      }
    }

    const forcedClaudePath =
      isWindows &&
      runtimeEnv.CC_CLAUDE_PATH &&
      String(runtimeEnv.CC_CLAUDE_PATH).trim();

    const child = forcedClaudePath
      ? spawn(forcedClaudePath, args, {
          stdio: "inherit",
          env: runtimeEnv,
          shell: false,
        })
      : spawn(
          isWindows ? "cmd.exe" : "claude",
          isWindows ? ["/s", "/c", "claude", ...args] : args,
          {
            stdio: "inherit",
            env: runtimeEnv,
            shell: isWindows ? false : true,
          }
        );

    child.on("close", (code) => {
      if (code === 0) {
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

    child.on("error", reject);
  });
}

module.exports = { executeWithEnv };
