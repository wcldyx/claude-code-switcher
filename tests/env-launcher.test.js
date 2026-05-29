const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  buildClaudeSpawnConfig,
  buildEnvVariables,
  clearInterruptResidue,
  isUserInterruptExit,
  parseWindowsCmdShim,
  readClaudePathCache,
  resolveWindowsClaudeTarget,
  writeClaudePathCache
} = require('../src/utils/env-launcher');

describe('env-launcher', () => {
  describe('buildEnvVariables', () => {
    test('should set new default model environment variables', () => {
      const env = buildEnvVariables({
        authMode: 'api_key',
        baseUrl: 'https://api.example.com',
        authToken: 'test-token',
        models: {
          opus: 'claude-opus-custom',
          sonnet: 'claude-sonnet-custom',
          haiku: 'claude-haiku-custom'
        }
      });

      expect(env.ANTHROPIC_BASE_URL).toBe('https://api.example.com');
      expect(env.ANTHROPIC_API_KEY).toBe('test-token');
      expect(env.ANTHROPIC_DEFAULT_OPUS_MODEL).toBe('claude-opus-custom');
      expect(env.ANTHROPIC_DEFAULT_SONNET_MODEL).toBe('claude-sonnet-custom');
      expect(env.ANTHROPIC_DEFAULT_HAIKU_MODEL).toBe('claude-haiku-custom');
      expect(env.ANTHROPIC_MODEL).toBeUndefined();
      expect(env.ANTHROPIC_SMALL_FAST_MODEL).toBeUndefined();
      expect(env.CLAUDE_CODE_AUTO_COMPACT_WINDOW).toBe('258000');
      expect(env.CLAUDE_AUTOCOMPACT_PCT_OVERRIDE).toBe('70');
      expect(env.BASH_MAX_OUTPUT_LENGTH).toBe('12000');
      expect(env.TASK_MAX_OUTPUT_LENGTH).toBe('16000');
    });

    test('should set configured runtime environment variables', () => {
      const env = buildEnvVariables({
        authMode: 'oauth_token',
        authToken: 'sk-ant-oat01-test-token',
        runtimeEnv: {
          autoCompactWindow: 24000,
          autoCompactPctOverride: 60,
          bashMaxOutputLength: 8000,
          taskMaxOutputLength: 10000
        }
      });

      expect(env.CLAUDE_CODE_OAUTH_TOKEN).toBe('sk-ant-oat01-test-token');
      expect(env.CLAUDE_CODE_AUTO_COMPACT_WINDOW).toBe('24000');
      expect(env.CLAUDE_AUTOCOMPACT_PCT_OVERRIDE).toBe('60');
      expect(env.BASH_MAX_OUTPUT_LENGTH).toBe('8000');
      expect(env.TASK_MAX_OUTPUT_LENGTH).toBe('10000');
    });
  });

  describe('buildClaudeSpawnConfig', () => {
    test('should not launch Claude through cmd.exe on Windows', () => {
      const env = {
        CC_CLAUDE_PATH: 'C:\\tools\\claude.exe'
      };

      const config = buildClaudeSpawnConfig(['--continue'], env, true);

      expect(config.command).toBe('C:\\tools\\claude.exe');
      expect(config.args).toEqual(['--continue']);
      expect(config.options.shell).toBe(false);
    });
  });

  describe('parseWindowsCmdShim', () => {
    test('should convert npm cmd shim to node script launch', () => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-switcher-'));
      const shimPath = path.join(dir, 'claude.cmd');
      fs.mkdirSync(path.join(dir, 'node_modules', '@anthropic-ai', 'claude-code'), { recursive: true });
      fs.writeFileSync(
        shimPath,
        '"%_prog%" "%dp0%\\node_modules\\@anthropic-ai\\claude-code\\cli.js" %*\n'
      );

      const target = parseWindowsCmdShim(shimPath);

      expect(target.command).toBe(process.execPath);
      expect(target.argsPrefix).toEqual([
        path.join(dir, 'node_modules', '@anthropic-ai', 'claude-code', 'cli.js')
      ]);

      fs.rmSync(dir, { recursive: true, force: true });
    });
  });

  describe('Claude path cache', () => {
    test('should read cached Windows Claude target', () => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-switcher-cache-'));
      const commandPath = path.join(dir, 'claude.exe');
      fs.writeFileSync(commandPath, '');

      writeClaudePathCache({
        command: commandPath,
        argsPrefix: ['cli.js']
      });

      expect(readClaudePathCache()).toEqual({
        command: commandPath,
        argsPrefix: ['cli.js']
      });

      fs.rmSync(dir, { recursive: true, force: true });
    });

    test('should use cached Windows Claude target before lookup', () => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-switcher-cache-'));
      const commandPath = path.join(dir, 'claude.exe');
      fs.writeFileSync(commandPath, '');

      writeClaudePathCache({
        command: commandPath,
        argsPrefix: []
      });

      const target = resolveWindowsClaudeTarget({});

      expect(target).toEqual({
        command: commandPath,
        argsPrefix: []
      });

      fs.rmSync(dir, { recursive: true, force: true });
    });
  });

  describe('isUserInterruptExit', () => {
    test('should treat Ctrl+C exit codes as user interrupts', () => {
      expect(isUserInterruptExit(3221225786, null, true)).toBe(true);
      expect(isUserInterruptExit(130, null, false)).toBe(true);
      expect(isUserInterruptExit(null, 'SIGINT', false)).toBe(true);
    });

    test('should not treat ordinary failures as user interrupts', () => {
      expect(isUserInterruptExit(1, null, true)).toBe(false);
      expect(isUserInterruptExit(9009, null, true)).toBe(false);
    });
  });

  describe('clearInterruptResidue', () => {
    test('should clear the current terminal line', () => {
      const writeSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);

      clearInterruptResidue();

      expect(writeSpy).toHaveBeenCalledWith('\r\x1b[2K');
      writeSpy.mockRestore();
    });
  });
});
