const EventEmitter = require('events');

jest.mock('readline', () => ({
  emitKeypressEvents: jest.fn()
}));

const { EscNavigationManager } = require('../src/navigation/EscNavigationManager');

class FakeInput extends EventEmitter {
  constructor() {
    super();
    this.isTTY = true;
    this.isRaw = false;
    this.setRawModeCalls = [];
    this.resumeCalls = 0;
  }

  setRawMode(value) {
    this.isRaw = value;
    this.setRawModeCalls.push(value);
  }

  resume() {
    this.resumeCalls += 1;
  }
}

describe('EscNavigationManager', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  test('触发顶部监听器并正确清理', () => {
    const input = new FakeInput();
    const manager = new EscNavigationManager(input, { triggerDelay: 20, postCallbackDelay: 5 });
    const callback = jest.fn();

    manager.register({ onTrigger: callback });

    input.emit('data', '\u001b');
    jest.advanceTimersByTime(25);

    expect(callback).toHaveBeenCalledTimes(1);
    expect(input.setRawModeCalls).toEqual([true, false]);
    expect(input.resumeCalls).toBeGreaterThan(0);
  });

  test('栈式监听器按后进先出执行', () => {
    const input = new FakeInput();
    const manager = new EscNavigationManager(input, { triggerDelay: 20, postCallbackDelay: 5 });
    const first = jest.fn();
    const second = jest.fn();

    manager.register({ onTrigger: first });
    manager.register({ onTrigger: second });

    input.emit('data', '\u001b');
    jest.advanceTimersByTime(25);

    expect(second).toHaveBeenCalledTimes(1);
    expect(first).not.toHaveBeenCalled();

    input.emit('data', '\u001b');
    jest.advanceTimersByTime(25);

    expect(first).toHaveBeenCalledTimes(1);
  });

  test('移除监听器后不会触发回调', () => {
    const input = new FakeInput();
    const manager = new EscNavigationManager(input, { triggerDelay: 20, postCallbackDelay: 5 });
    const callback = jest.fn();

    const token = manager.register({ onTrigger: callback });
    manager.unregister(token);

    input.emit('data', '\u001b');
    jest.advanceTimersByTime(25);

    expect(callback).not.toHaveBeenCalled();
    expect(input.setRawModeCalls).toEqual([true, false]);
  });

  test('方向键组合不会触发ESC回退', () => {
    const input = new FakeInput();
    const manager = new EscNavigationManager(input, { triggerDelay: 100, postCallbackDelay: 5 });
    const callback = jest.fn();

    manager.register({ onTrigger: callback });

    input.emit('data', '\u001b');
    jest.advanceTimersByTime(60);
    input.emit('data', '[');
    input.emit('data', 'B');
    jest.advanceTimersByTime(200);

    expect(callback).not.toHaveBeenCalled();
  });
});
