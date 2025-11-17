const blessed = require('blessed');
const chalk = require('chalk');

/**
 * Blessed-based wizard form
 * Alternative to prompts/inquirer that works with blessed screens
 */
class WizardForm {
  constructor(screen) {
    this.screen = screen;
    this.form = null;
    this.fields = [];
    this.values = {};
  }

  /**
   * Show wizard form and collect input
   */
  async show(questions, defaults = {}) {
    return new Promise((resolve, reject) => {
      // Create form container
      this.form = blessed.form({
        parent: this.screen,
        keys: true,
        vi: true,
        top: 'center',
        left: 'center',
        width: '80%',
        height: '90%',
        border: {
          type: 'line',
          fg: 'cyan'
        },
        style: {
          fg: 'white',
          bg: 'black',
          border: {
            fg: 'cyan'
          }
        },
        label: ' Easy Deploy Setup Wizard ',
        scrollable: true,
        alwaysScroll: true,
        scrollbar: {
          ch: ' ',
          style: {
            inverse: true
          }
        }
      });

      // Add title
      blessed.text({
        parent: this.form,
        top: 0,
        left: 2,
        content: chalk.cyan('Let\'s set up your deployment project!\n'),
        tags: true
      });

      let currentTop = 2;
      const fieldHeight = 4;

      // Create fields for each question
      questions.forEach((q, index) => {
        // Label
        blessed.text({
          parent: this.form,
          top: currentTop,
          left: 2,
          content: `{cyan-fg}${q.message}:{/cyan-fg}`,
          tags: true
        });

        currentTop += 1;

        if (q.type === 'select') {
          // Radio list for select
          const list = blessed.list({
            parent: this.form,
            name: q.name,
            top: currentTop,
            left: 4,
            width: '90%',
            height: Math.min(q.choices.length + 2, 8),
            border: {
              type: 'line'
            },
            style: {
              selected: {
                bg: 'cyan',
                fg: 'black'
              },
              border: {
                fg: 'white'
              }
            },
            keys: true,
            vi: true,
            items: q.choices.map(c => c.title || c.name)
          });

          list.select(q.initial || 0);

          list.on('select', (item, index) => {
            this.values[q.name] = q.choices[index].value;
          });

          this.fields.push({ name: q.name, widget: list, type: 'select', choices: q.choices });
          currentTop += Math.min(q.choices.length + 2, 8) + 1;

        } else if (q.type === 'confirm') {
          // Checkbox for confirm
          const checkbox = blessed.checkbox({
            parent: this.form,
            name: q.name,
            top: currentTop,
            left: 4,
            width: '90%',
            height: 3,
            border: {
              type: 'line'
            },
            style: {
              selected: {
                bg: 'cyan',
                fg: 'black'
              }
            },
            keys: true,
            mouse: true
          });

          if (q.initial) {
            checkbox.check();
          }

          checkbox.on('check', () => {
            this.values[q.name] = true;
          });

          checkbox.on('uncheck', () => {
            this.values[q.name] = false;
          });

          this.fields.push({ name: q.name, widget: checkbox, type: 'confirm' });
          currentTop += 4;

        } else {
          // Textbox for text/number input
          const textbox = blessed.textbox({
            parent: this.form,
            name: q.name,
            top: currentTop,
            left: 4,
            width: '90%',
            height: 3,
            border: {
              type: 'line'
            },
            style: {
              focus: {
                border: {
                  fg: 'cyan'
                }
              }
            },
            inputOnFocus: true,
            keys: true,
            mouse: true,
            value: (q.initial || defaults[q.name] || '').toString()
          });

          textbox.on('submit', () => {
            this.values[q.name] = textbox.getValue();
          });

          this.fields.push({ name: q.name, widget: textbox, type: q.type });
          currentTop += 4;
        }
      });

      // Add submit button
      const submitButton = blessed.button({
        parent: this.form,
        mouse: true,
        keys: true,
        shrink: true,
        top: currentTop + 1,
        left: 'center',
        padding: {
          left: 5,
          right: 5,
          top: 1,
          bottom: 1
        },
        content: 'Continue',
        style: {
          fg: 'black',
          bg: 'cyan',
          focus: {
            bg: 'blue'
          }
        }
      });

      // Submit handler
      submitButton.on('press', () => {
        // Collect all values
        this.fields.forEach(field => {
          if (field.type === 'select') {
            const selectedIndex = field.widget.selected;
            this.values[field.name] = field.choices[selectedIndex].value;
          } else if (field.type === 'confirm') {
            this.values[field.name] = field.widget.checked;
          } else {
            this.values[field.name] = field.widget.getValue() || '';
          }
        });

        this.form.destroy();
        this.screen.render();
        resolve(this.values);
      });

      // Cancel on escape
      this.form.key(['escape'], () => {
        this.form.destroy();
        this.screen.render();
        reject(new Error('Wizard cancelled'));
      });

      // Focus first field
      if (this.fields.length > 0) {
        this.fields[0].widget.focus();
      }

      this.screen.render();
    });
  }
}

module.exports = WizardForm;
