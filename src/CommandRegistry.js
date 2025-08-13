class CommandRegistry {
  constructor() {
    this.commands = new Map();
    this.lazyCommands = new Map();
  }

  // 注册懒加载命令
  registerLazy(name, loader) {
    this.lazyCommands.set(name, loader);
  }

  // 获取命令（懒加载）
  async getCommand(name) {
    if (this.commands.has(name)) {
      return this.commands.get(name);
    }

    if (this.lazyCommands.has(name)) {
      const loader = this.lazyCommands.get(name);
      const command = await loader();
      this.commands.set(name, command);
      return command;
    }

    throw new Error(`命令 '${name}' 未注册`);
  }

  // 执行命令
  async executeCommand(name, ...args) {
    const command = await this.getCommand(name);
    return await command(...args);
  }

  // 清理所有缓存的命令
  clear() {
    this.commands.clear();
  }
}

// 单例实例
const registry = new CommandRegistry();

// 注册所有懒加载命令
registry.registerLazy('switch', async () => {
  const { switchCommand } = require('./commands/switch');
  return switchCommand;
});

registry.registerLazy('add', async () => {
  const { addCommand } = require('./commands/add');
  return addCommand;
});

registry.registerLazy('remove', async () => {
  const { removeCommand } = require('./commands/remove');
  return removeCommand;
});

registry.registerLazy('list', async () => {
  const { listCommand } = require('./commands/list');
  return listCommand;
});

registry.registerLazy('current', async () => {
  const { currentCommand } = require('./commands/current');
  return currentCommand;
});

registry.registerLazy('edit', async () => {
  const { editCommand } = require('./commands/edit');
  return editCommand;
});

module.exports = { CommandRegistry, registry };