# Claude Code Switcher

Switch Claude Code API providers from one CLI, and manage official accounts, third-party gateways, model aliases, and launch arguments.

[中文](./README.md)

> This project was built with AI assistance using [Claude Code](https://claude.ai/code).

## Screenshots

### Provider Selection

![Provider selection](./docs/images/WindowsTerminal.exe_20251023_092310.png)

### Launch Configuration

![Launch configuration](./docs/images/WindowsTerminal.exe_20251019_214821.png)

### Demo

![Demo](./docs/images/动画.gif)

## What It Does

Use this tool when you need to:

- Switch between multiple Claude Code API providers
- Save multiple accounts, tokens, or third-party API endpoints
- Configure different model aliases per provider
- Start Claude Code directly with default launch arguments
- Detect conflicting environment variables in `.claude/settings.json`

All provider settings are stored in `~/.cc-config.json`, and `cc` applies the selected environment before launching Claude Code.

## Installation

```bash
npm install -g @wcldyx/claude-code-switcher
```

Run:

```bash
cc
```

Select a provider, and the tool will set environment variables and start Claude Code.

## Commands

```bash
cc                         # Open the provider picker
cc <provider>              # Start a provider directly
cc <provider> [args...]    # Start directly and pass Claude Code arguments through
cc add                     # Add a provider
cc list                    # List providers
cc current                 # Show the current provider
cc edit                    # Edit a provider
cc remove                  # Remove a provider
```

Examples:

```bash
cc work
cc work --continue
cc work --print "hello"
```

`cc` only sets environment variables and forwards launch arguments. It does not change the meaning of official Claude Code CLI flags.

## Language

The tool detects the system language and selects Chinese or English automatically. You can also force the locale with environment variables:

```bash
CC_LANG=en cc
CC_LANG=zh-CN cc
```

CLI help, top-level errors, and update prompts currently support Chinese and English. Interactive menu copy will continue to be extracted incrementally.

## Authentication Modes

### API Key Mode

For most third-party providers.

Sets:

```text
ANTHROPIC_BASE_URL
ANTHROPIC_API_KEY
```

### Auth Token Mode

For providers compatible with Anthropic auth tokens.

Sets:

```text
ANTHROPIC_BASE_URL
ANTHROPIC_AUTH_TOKEN
```

### OAuth Token Mode

For official Claude Code OAuth.

Sets:

```text
CLAUDE_CODE_OAUTH_TOKEN
```

OAuth mode does not require `ANTHROPIC_BASE_URL`.

## Model Configuration

The tool uses Claude Code's newer default model environment variables:

```text
ANTHROPIC_DEFAULT_OPUS_MODEL
ANTHROPIC_DEFAULT_SONNET_MODEL
ANTHROPIC_DEFAULT_HAIKU_MODEL
```

When adding or editing a provider, you can configure Opus, Sonnet, and Haiku model aliases separately.

Legacy configuration is migrated automatically:

```text
models.primary   -> models.sonnet
models.smallFast -> models.haiku
```

The tool no longer sets the legacy `ANTHROPIC_MODEL` or `ANTHROPIC_SMALL_FAST_MODEL` variables.

## Connection Checks

Provider status checks send a small test request. Model selection follows "read user configuration first, then prefer the cheapest model":

```text
Configured Haiku
ANTHROPIC_DEFAULT_HAIKU_MODEL
Configured Sonnet
ANTHROPIC_DEFAULT_SONNET_MODEL
Configured Opus
ANTHROPIC_DEFAULT_OPUS_MODEL
Built-in default Haiku
```

OAuth token providers are not checked.

## Launch Arguments

The tool can save and forward Claude Code launch arguments, such as:

```text
--continue
--dangerously-skip-permissions
```

By default, the "highest permission" argument is selected, and direct launch with `cc <provider>` automatically includes:

```text
--dangerously-skip-permissions
```

To disable this default behavior, edit `~/.cc-config.json`:

```json
{
  "preferences": {
    "defaultDangerouslySkipPermissions": false
  }
}
```

When disabled:

- The interactive launch screen will not preselect highest permission
- `cc <provider>` will not automatically append highest permission
- If a provider explicitly saves this argument in `launchArgs`, it still applies

## Configuration File

Configuration is stored at:

```text
~/.cc-config.json
```

Example:

```json
{
  "version": "1.0.0",
  "currentProvider": "deepseek",
  "preferences": {
    "defaultDangerouslySkipPermissions": true
  },
  "providers": {
    "deepseek": {
      "name": "deepseek",
      "displayName": "DeepSeek",
      "authMode": "api_key",
      "baseUrl": "https://api.example.com",
      "authToken": "your-token",
      "launchArgs": [],
      "models": {
        "opus": null,
        "sonnet": "deepseek-chat",
        "haiku": "deepseek-chat"
      }
    }
  }
}
```

Tokens are stored in a local JSON file. Protect this file and do not commit or share it.

## Conflict Detection

If `.claude/settings.json` or `.claude/settings.local.json` contains the same environment variables, those values may override this tool's provider configuration.

The tool detects and offers to back up and remove these conflicting variables:

```text
ANTHROPIC_API_KEY
ANTHROPIC_AUTH_TOKEN
ANTHROPIC_BASE_URL
CLAUDE_CODE_OAUTH_TOKEN
ANTHROPIC_DEFAULT_OPUS_MODEL
ANTHROPIC_DEFAULT_SONNET_MODEL
ANTHROPIC_DEFAULT_HAIKU_MODEL
```

Backup files are named:

```text
settings.backup-YYYYMMDD_HHmmss.json
```

## FAQ

**Q: Can third-party DeepSeek or gateway providers use Claude Code's Chrome integration?**  
A: No. Claude Code's Chrome integration depends on the official account and service path. It does not apply to third-party provider flows, so this tool no longer exposes the `--chrome` launch option.

**Q: Are tokens encrypted?**  
A: No. They are stored locally in `~/.cc-config.json`. Protect the file permissions yourself.

**Q: How do I reset everything?**  
A: Delete `~/.cc-config.json` and run `cc add` again.

**Q: Can I move the config to another computer?**  
A: Yes. Copy `~/.cc-config.json` to the same location on the new machine.

**Q: What platforms are supported?**  
A: Windows, macOS, and Linux. Node.js 14 or newer is required.

## Changelog

### v2.0.0

- Removed the third-party-inapplicable `--chrome` launch option
- Added Opus / Sonnet / Haiku default model variables
- Removed legacy model variable output
- Added JSON configuration for disabling default highest permission
- Direct launch with `cc <provider>` applies the default highest permission argument
- Connection checks prefer the cheapest configured model: Haiku -> Sonnet -> Opus
- Improved startup performance with lazy-loaded prompts, SDK, and launcher modules
- Moved update checks to the background
- Improved Windows Ctrl+C handling by restoring console mode and cleaning residual output
- Cached the Windows Claude Code executable path to reduce synchronous launch delay
- Added English documentation in `README.en.md`
- Added foundational i18n support for CLI help and update prompts

### v1.0.24

- Fixed and improved provider configuration management

### v1.0.13

- Added streaming provider status checks
- Changed batch status checks to progressive per-provider updates
- Improved status icons and latency display

### v1.0.9

- Added Claude settings conflict detection
- Added backup and cleanup for conflicting environment variables
- Improved ESC key navigation

## Feedback

- [Issues](https://github.com/wcldyx/claude-code-switcher/issues)
- [New issue](https://github.com/wcldyx/claude-code-switcher/issues/new)
