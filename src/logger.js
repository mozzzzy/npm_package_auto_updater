
/*
 * Variables
 */

const BG_RED = '\u001b[41m';
const BG_GREEN = '\u001b[42m';
const BG_YELLOW = '\u001b[43m';
const BG_BLUE = '\u001b[44m';
const BG_MAGENTA = '\u001b[45m';
const BG_CYAN = '\u001b[46m';
const RESET = '\u001b[0m';

/*
 * Classes
 */

class Logger {
  // private
  #logLevel
  #addColor

  #log(msg, logLevel) {
    if (msg === undefined) {
      msg = '';
    }
    if (typeof logLevel !== 'object' || logLevel === null) {
      throw new Error(`Invalid argument. type of logLevel should be an object.`);
    }
    if (typeof logLevel.color !== 'string') {
      throw new Error(`Invalid argument. type of logLevel.color should be a string.`);
    }
    if (typeof logLevel.index !== 'number') {
      throw new Error(`Invalid argument. type of logLevel.index should be a number.`);
    }
    if (typeof logLevel.prefix !== 'string') {
      throw new Error(`Invalid argument. type of logLevel.prefix should be a string.`);
    }

    if (this.#logLevel.index >= logLevel.index) {
      const coloredPrefix = this.#addColor ? `${logLevel.color}${logLevel.prefix}${RESET}` : logLevel.prefix;
      if (typeof msg === 'string') {
        console.log(`${coloredPrefix} ${msg}`);
        return;
      }
      process.stdout.write(`${coloredPrefix} `);
      console.log(msg);
    }
  }

  // public
  constructor(logLevel, addColor) {
    if (typeof logLevel !== 'object' || logLevel === null) {
      throw new Error(`Invalid argument. type of logLevel should be an object.`);
    }
    if (typeof logLevel.color !== 'string') {
      throw new Error(`Invalid argument. type of logLevel.color should be a string.`);
    }
    if (typeof logLevel.index !== 'number') {
      throw new Error(`Invalid argument. type of logLevel.index should be a number.`);
    }
    if (typeof logLevel.prefix !== 'string') {
      throw new Error(`Invalid argument. type of logLevel.prefix should be a string.`);
    }
    this.#logLevel = logLevel;
    this.#addColor = addColor !== undefined ? addColor : true;
  }
  debug(msg) {
    this.#log(msg, Logger.static.DEBUG);
  }
  info(msg) {
    this.#log(msg, Logger.static.INFO);
  }
  notice(msg) {
    this.#log(msg, Logger.static.NOTICE);
  }
  warn(msg) {
    this.#log(msg, Logger.static.WARN);
  }
  error(msg) {
    this.#log(msg, Logger.static.ERROR);
  }
  crit(msg) {
    this.#log(msg, Logger.static.CRIT);
  }
};

Logger.static = {
  DEBUG: {
    color: BG_BLUE,
    index: 5,
    prefix: ' DEBUG ',
  },
  INFO: {
    color: BG_GREEN,
    index: 4,
    prefix: ' INFO ',
  },
  NOTICE: {
    color: BG_CYAN,
    index: 3,
    prefix: ' NOTICE ',
  },
  WARN: {
    color: BG_YELLOW,
    index: 2,
    prefix: ' WARN ',
  },
  ERROR: {
    color: BG_RED,
    index: 1,
    prefix: ' ERROR ',
  },
  CRIT: {
    color: BG_MAGENTA,
    index: 0,
    prefix: ' CRITICAL ',
  },
};

module.exports = Logger;