const readline = require('readline');

class EscNavigationManager {
  constructor(input = process.stdin, options = {}) {
    this.input = input;
    this.handlers = [];
    this.pendingTimeout = null;
    this.escapePending = false;
    this.triggerDelay = typeof options.triggerDelay === 'number' ? options.triggerDelay : 100;
    this.listenerBound = false;
    this.rawModeEnabled = false;
    this.previousRawMode = null;
    this.postCallbackDelay = typeof options.postCallbackDelay === 'number' ? options.postCallbackDelay : 50;

    this.supported = Boolean(
      this.input &&
      typeof this.input.on === 'function' &&
      typeof this.input.removeListener === 'function' &&
      typeof this.input.setRawMode === 'function'
    );

    this.handleData = this.handleData.bind(this);
  }

  isSupported() {
    return this.supported;
  }

  register(options = {}) {
    if (!this.isSupported()) {
      return null;
    }

    const handler = {
      id: Symbol('esc-handler'),
      onTrigger: typeof options.onTrigger === 'function' ? options.onTrigger : null,
      once: options.once !== false,
      postDelay: typeof options.postDelay === 'number' ? options.postDelay : this.postCallbackDelay
    };

    this.handlers.push(handler);
    this.ensureListening();
    return handler;
  }

  unregister(handler) {
    if (!this.isSupported() || !handler) {
      return;
    }

    const index = this.handlers.indexOf(handler);
    if (index === -1) {
      return;
    }

    this.handlers.splice(index, 1);
    if (this.handlers.length === 0) {
      this.teardown();
    }
  }

  reset() {
    if (!this.isSupported()) {
      return;
    }

    this.handlers = [];
    this.teardown();
  }

  handleData(chunk) {
    if (!this.handlers.length) {
      return;
    }

    const data = typeof chunk === 'string' ? chunk : chunk.toString('utf8');
    if (!data) {
      return;
    }

    for (const char of data) {
      if (char === '\u001b') {
        this.escapePending = true;
        this.scheduleTrigger();
      } else if (this.escapePending) {
        // 遇到其它字符说明这是组合键 (例如方向键)
        this.cancelPending();
      }
    }
  }

  scheduleTrigger() {
    if (this.pendingTimeout) {
      clearTimeout(this.pendingTimeout);
    }

    this.pendingTimeout = setTimeout(() => {
      this.pendingTimeout = null;
      const shouldTrigger = this.escapePending;
      this.escapePending = false;
      if (shouldTrigger) {
        this.triggerTopHandler();
      }
    }, this.triggerDelay);
  }

  cancelPending() {
    if (this.pendingTimeout) {
      clearTimeout(this.pendingTimeout);
      this.pendingTimeout = null;
    }
    this.escapePending = false;
  }

  triggerTopHandler() {
    if (!this.handlers.length) {
      return;
    }

    const handler = this.handlers[this.handlers.length - 1];
    if (!handler) {
      return;
    }

    if (handler.once) {
      this.handlers.pop();
    }

    if (!this.handlers.length) {
      this.teardown();
    }

    if (handler.onTrigger) {
      setTimeout(() => {
        try {
          handler.onTrigger();
        } catch (error) {
          // 在ESC回调中抛出的错误不应终止进程
          // 交由调用方自行处理记录
        }
      }, handler.postDelay);
    }
  }

  ensureListening() {
    if (this.listenerBound || !this.isSupported()) {
      return;
    }

    readline.emitKeypressEvents(this.input);

    if (typeof this.input.setMaxListeners === 'function') {
      try {
        const currentMax = this.input.getMaxListeners();
        if (currentMax !== 0 && currentMax < 50) {
          this.input.setMaxListeners(50);
        }
      } catch (error) {
        // 某些输入流可能不支持获取/设置监听器上限
      }
    }

    if (this.input.isTTY && !this.rawModeEnabled) {
      try {
        this.previousRawMode = typeof this.input.isRaw === 'boolean' ? this.input.isRaw : null;
        this.input.setRawMode(true);
        this.rawModeEnabled = true;
      } catch (error) {
        this.supported = false;
        this.handlers = [];
        return;
      }
    }

    if (typeof this.input.resume === 'function') {
      try {
        this.input.resume();
      } catch (error) {
        // 某些输入流不支持 resume，忽略即可
      }
    }

    this.input.on('data', this.handleData);
    this.listenerBound = true;
  }

  teardown() {
    if (!this.isSupported()) {
      this.cancelPending();
      return;
    }

    if (this.listenerBound) {
      this.input.removeListener('data', this.handleData);
      this.listenerBound = false;
    }

    this.cancelPending();

    if (this.rawModeEnabled && this.input.isTTY) {
      try {
        const restoreRaw = typeof this.previousRawMode === 'boolean' ? this.previousRawMode : false;
        this.input.setRawMode(restoreRaw);
      } catch (error) {
        // 忽略还原失败
      }

      this.rawModeEnabled = false;
    }
  }
}

module.exports = { EscNavigationManager };
