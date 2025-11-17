/**
 * Color themes for terminal UI
 */

const themes = {
  default: {
    primary: 'cyan',
    secondary: 'blue',
    success: 'green',
    warning: 'yellow',
    error: 'red',
    info: 'white',
    muted: 'gray',
    highlight: 'magenta',

    // Box styles
    border: {
      fg: 'cyan',
      bg: 'black'
    },

    // List styles
    list: {
      fg: 'white',
      bg: 'black',
      selected: {
        fg: 'black',
        bg: 'cyan',
        bold: true
      },
      item: {
        fg: 'white'
      }
    },

    // Progress bar
    progress: {
      bar: {
        fg: 'cyan',
        bg: 'black'
      },
      filled: 'cyan',
      empty: 'gray'
    },

    // Log viewer
    log: {
      fg: 'white',
      bg: 'black',
      scrollbar: {
        fg: 'cyan',
        bg: 'gray'
      }
    },

    // Status indicators
    status: {
      running: 'yellow',
      completed: 'green',
      failed: 'red',
      pending: 'gray',
      warning: 'yellow'
    }
  },

  dark: {
    primary: 'blue',
    secondary: 'cyan',
    success: 'green',
    warning: 'yellow',
    error: 'red',
    info: 'white',
    muted: 'gray',
    highlight: 'magenta',

    border: {
      fg: 'blue',
      bg: 'black'
    },

    list: {
      fg: 'white',
      bg: 'black',
      selected: {
        fg: 'black',
        bg: 'blue',
        bold: true
      }
    },

    progress: {
      filled: 'blue',
      empty: 'gray'
    }
  },

  light: {
    primary: 'blue',
    secondary: 'cyan',
    success: 'green',
    warning: 'yellow',
    error: 'red',
    info: 'black',
    muted: 'gray',
    highlight: 'magenta',

    border: {
      fg: 'blue',
      bg: 'white'
    },

    list: {
      fg: 'black',
      bg: 'white',
      selected: {
        fg: 'white',
        bg: 'blue',
        bold: true
      }
    }
  }
};

/**
 * Get theme by name
 * @param {string} name - Theme name
 * @returns {object} Theme object
 */
function getTheme(name = 'default') {
  return themes[name] || themes.default;
}

/**
 * ASCII box drawing characters
 */
const boxChars = {
  single: {
    topLeft: '┌',
    topRight: '┐',
    bottomLeft: '└',
    bottomRight: '┘',
    horizontal: '─',
    vertical: '│',
    leftT: '├',
    rightT: '┤',
    topT: '┬',
    bottomT: '┴',
    cross: '┼'
  },

  double: {
    topLeft: '╔',
    topRight: '╗',
    bottomLeft: '╚',
    bottomRight: '╝',
    horizontal: '═',
    vertical: '║',
    leftT: '╠',
    rightT: '╣',
    topT: '╦',
    bottomT: '╩',
    cross: '╬'
  },

  rounded: {
    topLeft: '╭',
    topRight: '╮',
    bottomLeft: '╰',
    bottomRight: '╯',
    horizontal: '─',
    vertical: '│',
    leftT: '├',
    rightT: '┤',
    topT: '┬',
    bottomT: '┴',
    cross: '┼'
  },

  bold: {
    topLeft: '┏',
    topRight: '┓',
    bottomLeft: '┗',
    bottomRight: '┛',
    horizontal: '━',
    vertical: '┃',
    leftT: '┣',
    rightT: '┫',
    topT: '┳',
    bottomT: '┻',
    cross: '╋'
  }
};

/**
 * Status icons
 */
const icons = {
  success: '✓',
  error: '✗',
  warning: '⚠',
  info: 'ℹ',
  running: '⟳',
  pending: '○',
  completed: '●',
  arrow: '→',
  bullet: '•',
  docker: '🐳',
  git: '⎇',
  database: '🗄',
  server: '🖥',
  lock: '🔒',
  key: '🔑'
};

module.exports = {
  themes,
  getTheme,
  boxChars,
  icons
};
