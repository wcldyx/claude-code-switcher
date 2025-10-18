const inquirer = require('inquirer');
const CheckboxPrompt = require('inquirer/lib/prompts/checkbox');
const chalk = require('chalk');
const figures = require('figures');

class LocalizedCheckboxPrompt extends CheckboxPrompt {
  render(error) {
    let message = this.getQuestion();
    let bottomContent = '';

    if (!this.dontShowHints) {
      message += chalk.gray(' （空格切换选中，a 全选，i 反选，回车继续）');
    }

    if (this.status === 'answered') {
      message += chalk.cyan(this.selection.join(', '));
    } else {
      const choicesStr = renderChoices(this.opt.choices, this.pointer);
      const indexPosition = this.opt.choices.indexOf(
        this.opt.choices.getChoice(this.pointer)
      );
      const realIndexPosition =
        this.opt.choices.reduce((acc, value, i) => {
          if (i > indexPosition) {
            return acc;
          }

          if (value.type === 'separator') {
            return acc + 1;
          }

          let line = value.name;
          if (typeof line !== 'string') {
            return acc + 1;
          }

          line = line.split('\n');
          return acc + line.length;
        }, 0) - 1;

      message +=
        '\n' + this.paginator.paginate(choicesStr, realIndexPosition, this.opt.pageSize);
    }

    if (error) {
      bottomContent = chalk.red('>> ') + error;
    }

    this.screen.render(message, bottomContent);
  }
}

function renderChoices(choices, pointer) {
  let output = '';
  let separatorOffset = 0;

  choices.forEach((choice, index) => {
    if (choice.type === 'separator') {
      separatorOffset++;
      output += ' ' + choice + '\n';
      return;
    }

    if (choice.disabled) {
      separatorOffset++;
      output += ' - ' + choice.name;
      output += ` (${typeof choice.disabled === 'string' ? choice.disabled : '禁用'})`;
    } else {
      const line = getCheckbox(choice.checked) + ' ' + choice.name;
      if (index - separatorOffset === pointer) {
        output += chalk.cyan(figures.pointer + line);
      } else {
        output += ' ' + line;
      }
    }

    output += '\n';
  });

  return output.replace(/\n$/, '');
}

function getCheckbox(checked) {
  return checked ? chalk.green(figures.radioOn) : figures.radioOff;
}

inquirer.registerPrompt('checkbox', LocalizedCheckboxPrompt);

module.exports = {};
