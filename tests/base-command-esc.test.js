const EventEmitter = require('events');

jest.mock('readline', () => ({
  emitKeypressEvents: jest.fn()
}));

const promptMockInstances = [];
jest.mock('inquirer', () => {
  const prompt = jest.fn(() => {
    let resolve;
    let reject;
    const promise = new Promise((res, rej) => {
      resolve = res;
      reject = rej;
    });
    const ui = { close: jest.fn() };
    promise.ui = ui;
    promptMockInstances.push({ promise, resolve, reject, ui });
    return promise;
  });
  prompt._instances = promptMockInstances;
  return { prompt };
});

jest.mock('../src/utils/logger', () => ({
  Logger: {
    error: jest.fn()
  }
}));

const { BaseCommand } = require('../src/commands/BaseCommand');
const inquirer = require('inquirer');

class FakeInput extends EventEmitter {
  constructor() {
    super();
    this.isTTY = true;
    this.isRaw = false;
  }

  setRawMode(value) {
    this.isRaw = value;
  }

  resume() {
    // noop for测试环境
  }
}

describe('BaseCommand ESC 集成', () => {
  let input;
  let baseCommand;
  let logSpy;
  let writeSpy;

  beforeEach(() => {
    jest.useFakeTimers();
    input = new FakeInput();
    baseCommand = new BaseCommand({ input });
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    writeSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    promptMockInstances.length = 0;
    inquirer.prompt.mockClear();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    logSpy.mockRestore();
    writeSpy.mockRestore();
  });

  test('按下ESC会打印提示并执行回调', async () => {
    const callback = jest.fn();
    baseCommand.createESCListener(callback, '返回测试');

    input.emit('data', '\u001b');
    jest.runAllTimers();
    await Promise.resolve();

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('🔙 ESC键 - 返回测试'));
    expect(callback).toHaveBeenCalledTimes(1);
  });

  test('移除监听器后不触发回调', () => {
    const callback = jest.fn();
    const token = baseCommand.createESCListener(callback, '返回测试');

    baseCommand.removeESCListener(token);
    input.emit('data', '\u001b');
    jest.runAllTimers();

    expect(callback).not.toHaveBeenCalled();
  });

  test('ESC触发时会关闭进行中的Prompt并返回取消错误', async () => {
    const promptPromise = baseCommand.prompt([{ type: 'input', name: 'demo' }]);
    expect(inquirer.prompt).toHaveBeenCalledTimes(1);
    const [{ reject, ui }] = promptMockInstances;

    baseCommand.createESCListener(() => {}, '测试取消');
    input.emit('data', '\u001b');
    jest.runAllTimers();

    expect(ui.close).toHaveBeenCalledTimes(1);
    await expect(promptPromise).rejects.toMatchObject({ code: 'ESC_CANCELLED' });

    // 手动触发reject以防Promise未被处理
    reject(new Error('test cleanup'));
  });
});
