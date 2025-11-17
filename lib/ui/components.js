const blessed = require('blessed');
const contrib = require('blessed-contrib');
const { getTheme, boxChars, icons } = require('./themes');

class UIComponents {
  constructor(screen, themeName = 'default') {
    this.screen = screen;
    this.theme = getTheme(themeName);
  }

  /**
   * Create a box container
   */
  createBox(options) {
    return blessed.box({
      border: {
        type: 'line',
        fg: this.theme.border.fg
      },
      style: {
        fg: this.theme.info,
        bg: this.theme.border.bg,
        border: {
          fg: this.theme.border.fg
        }
      },
      ...options
    });
  }

  /**
   * Create a list widget
   */
  createList(options) {
    return blessed.list({
      border: {
        type: 'line',
        fg: this.theme.border.fg
      },
      style: {
        fg: this.theme.list.fg,
        bg: this.theme.list.bg,
        selected: this.theme.list.selected,
        item: this.theme.list.item,
        border: {
          fg: this.theme.border.fg
        }
      },
      keys: true,
      vi: true,
      mouse: true,
      ...options
    });
  }

  /**
   * Create a log viewer
   */
  createLog(options) {
    return blessed.log({
      border: {
        type: 'line',
        fg: this.theme.border.fg
      },
      style: {
        fg: this.theme.log.fg,
        bg: this.theme.log.bg,
        border: {
          fg: this.theme.border.fg
        }
      },
      scrollbar: {
        ch: ' ',
        style: {
          fg: this.theme.log.scrollbar.fg,
          bg: this.theme.log.scrollbar.bg
        }
      },
      scrollable: true,
      alwaysScroll: true,
      mouse: true,
      keys: true,
      vi: true,
      ...options
    });
  }

  /**
   * Create a progress bar
   */
  createProgressBar(options) {
    return blessed.progressbar({
      border: {
        type: 'line',
        fg: this.theme.border.fg
      },
      style: {
        fg: this.theme.progress.filled,
        bg: this.theme.border.bg,
        bar: {
          fg: this.theme.progress.filled,
          bg: this.theme.progress.empty
        },
        border: {
          fg: this.theme.border.fg
        }
      },
      filled: 0,
      ...options
    });
  }

  /**
   * Create a table widget using contrib
   */
  createTable(options) {
    return contrib.table({
      keys: true,
      vi: true,
      mouse: true,
      interactive: false,
      style: {
        fg: this.theme.info,
        bg: this.theme.border.bg,
        border: {
          fg: this.theme.border.fg
        },
        header: {
          fg: this.theme.primary,
          bold: true
        },
        cell: {
          fg: this.theme.info
        }
      },
      columnSpacing: 3,
      columnWidth: [20, 15, 40],
      ...options
    });
  }

  /**
   * Create a gauge (circular progress)
   */
  createGauge(options) {
    return contrib.gauge({
      stroke: this.theme.primary,
      fill: this.theme.success,
      ...options
    });
  }

  /**
   * Create a status indicator
   */
  createStatusIndicator(status) {
    const statusConfig = {
      running: { icon: icons.running, color: this.theme.status.running },
      completed: { icon: icons.success, color: this.theme.status.completed },
      failed: { icon: icons.error, color: this.theme.status.failed },
      pending: { icon: icons.pending, color: this.theme.status.pending },
      warning: { icon: icons.warning, color: this.theme.status.warning }
    };

    const config = statusConfig[status] || statusConfig.pending;
    return {
      icon: config.icon,
      color: config.color,
      text: `{${config.color}-fg}${config.icon}{/} ${status.toUpperCase()}`
    };
  }

  /**
   * Create a button
   */
  createButton(options) {
    return blessed.button({
      mouse: true,
      keys: true,
      shrink: true,
      padding: {
        left: 2,
        right: 2
      },
      style: {
        fg: 'black',
        bg: this.theme.primary,
        focus: {
          bg: this.theme.secondary,
          fg: 'white'
        },
        hover: {
          bg: this.theme.highlight
        }
      },
      ...options
    });
  }

  /**
   * Create a text input field
   */
  createTextbox(options) {
    return blessed.textbox({
      mouse: true,
      keys: true,
      inputOnFocus: true,
      border: {
        type: 'line',
        fg: this.theme.border.fg
      },
      style: {
        fg: this.theme.info,
        bg: this.theme.border.bg,
        focus: {
          fg: this.theme.primary,
          bg: this.theme.border.bg,
          border: {
            fg: this.theme.primary
          }
        }
      },
      ...options
    });
  }

  /**
   * Create a loading spinner
   */
  createLoadingBox(message = 'Loading...') {
    const box = this.createBox({
      top: 'center',
      left: 'center',
      width: '50%',
      height: 5,
      content: `{center}${icons.running} ${message}{/center}`,
      tags: true
    });

    let frame = 0;
    const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

    const interval = setInterval(() => {
      box.setContent(`{center}${frames[frame]} ${message}{/center}`);
      this.screen.render();
      frame = (frame + 1) % frames.length;
    }, 80);

    box.destroy = () => {
      clearInterval(interval);
      box.detach();
    };

    return box;
  }

  /**
   * Show a message box
   */
  showMessage(title, message, type = 'info') {
    const colors = {
      info: this.theme.info,
      success: this.theme.success,
      warning: this.theme.warning,
      error: this.theme.error
    };

    const iconMap = {
      info: icons.info,
      success: icons.success,
      warning: icons.warning,
      error: icons.error
    };

    const box = blessed.box({
      top: 'center',
      left: 'center',
      width: '50%',
      height: 'shrink',
      padding: 1,
      border: {
        type: 'line',
        fg: colors[type]
      },
      style: {
        fg: colors[type],
        bg: this.theme.border.bg,
        border: {
          fg: colors[type]
        }
      },
      label: ` ${iconMap[type]} ${title} `,
      content: message,
      tags: true
    });

    this.screen.append(box);
    box.focus();

    box.key(['enter', 'escape', 'q'], () => {
      box.destroy();
      this.screen.render();
    });

    this.screen.render();
    return box;
  }

  /**
   * Create a confirmation dialog
   */
  createConfirmDialog(title, message, callback) {
    const dialog = blessed.box({
      top: 'center',
      left: 'center',
      width: '50%',
      height: 7,
      border: {
        type: 'line',
        fg: this.theme.primary
      },
      style: {
        fg: this.theme.info,
        bg: this.theme.border.bg,
        border: {
          fg: this.theme.primary
        }
      },
      label: ` ${title} `,
      content: `${message}\n\n[Y]es / [N]o / [Q]uit / [Esc]`,
      tags: true
    });

    this.screen.append(dialog);
    dialog.focus();

    dialog.key(['y'], () => {
      dialog.destroy();
      this.screen.render();
      callback(true);
    });

    dialog.key(['n', 'escape', 'q'], () => {
      dialog.destroy();
      this.screen.render();
      callback(false);
    });

    this.screen.render();
    return dialog;
  }
}

module.exports = UIComponents;
