jest.mock('../src/utils/logger', () => ({
  Logger: {
    info: jest.fn(),
    warning: jest.fn(),
    success: jest.fn(),
    error: jest.fn(),
    fatal: jest.fn()
  }
}));

const { switchCommand, EnvSwitcher } = require('../src/commands/switch');

describe('switchCommand 直启逻辑', () => {
  let validateProviderSpy;
  let launchProviderSpy;
  let showProviderSelectionSpy;
  let destroySpy;

  beforeEach(() => {
    validateProviderSpy = jest.spyOn(EnvSwitcher.prototype, 'validateProvider');
    launchProviderSpy = jest.spyOn(EnvSwitcher.prototype, 'launchProvider').mockResolvedValue(undefined);
    showProviderSelectionSpy = jest
      .spyOn(EnvSwitcher.prototype, 'showProviderSelection')
      .mockResolvedValue(undefined);
    destroySpy = jest.spyOn(EnvSwitcher.prototype, 'destroy').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('cc provider 时跳过启动参数选择，使用默认启动参数', async () => {
    const provider = { name: 'demo', launchArgs: ['--continue'] };
    validateProviderSpy.mockResolvedValue(provider);

    await switchCommand('demo');

    expect(validateProviderSpy).toHaveBeenCalledWith('demo');
    expect(launchProviderSpy).toHaveBeenCalledWith(provider, [
      '--dangerously-skip-permissions',
      '--continue'
    ]);
    expect(showProviderSelectionSpy).not.toHaveBeenCalled();
    expect(destroySpy).toHaveBeenCalledTimes(1);
  });

  test('cc provider 后可追加 Claude Code 启动参数', async () => {
    const provider = { name: 'demo', launchArgs: ['--continue'] };
    validateProviderSpy.mockResolvedValue(provider);

    await switchCommand('demo', ['--print', 'hi']);

    expect(launchProviderSpy).toHaveBeenCalledWith(provider, [
      '--dangerously-skip-permissions',
      '--continue',
      '--print',
      'hi'
    ]);
    expect(destroySpy).toHaveBeenCalledTimes(1);
  });

  test('未传 provider 时进入供应商选择界面', async () => {
    await switchCommand();

    expect(showProviderSelectionSpy).toHaveBeenCalledTimes(1);
    expect(validateProviderSpy).not.toHaveBeenCalled();
    expect(destroySpy).toHaveBeenCalledTimes(1);
  });

  test('JSON 配置可关闭直启最高权限默认参数', () => {
    const switcher = new EnvSwitcher();
    switcher.configManager.config = {
      preferences: {
        defaultDangerouslySkipPermissions: false
      }
    };

    expect(switcher.buildLaunchArgs({ launchArgs: ['--continue'] })).toEqual(['--continue']);
    switcher.destroy();
  });

  test('交互启动参数默认勾选全局默认和供应商默认参数', () => {
    const switcher = new EnvSwitcher();
    switcher.configManager.config = {
      preferences: {
        defaultDangerouslySkipPermissions: true
      }
    };

    const args = switcher.getAvailableLaunchArgs({ launchArgs: ['--continue'] });
    const checkedArgs = args.filter(arg => arg.checked).map(arg => arg.name);

    expect(checkedArgs).toEqual(['--continue', '--dangerously-skip-permissions']);
    switcher.destroy();
  });
});
