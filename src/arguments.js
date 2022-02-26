class Arguments {
  // private
  #argv

  #searchOption(key) {
    if (typeof key !== 'string') {
      throw new Error(`Invalid argument. type of key should be a string.`);
    }
    if (key.startsWith(`-`) === false) {
      key = '-' + key;
    }
    for (const arg of this.#argv) {
      if (arg.startsWith(key)) {
        return arg;
      }
    }
    return undefined;
  }

  // public
  constructor(argv) {
    // Note: Array.from() is not deep copy.
    // But it's ok because type of argv's elements are string. 
    this.#argv = Array.from(argv);
  }

  getBoolean(key) {
    const arg = this.#searchOption(key);
    if (arg === undefined) {
      return undefined;
    }
    const valuePattern = /(?<==).*/;
    const value = arg.match(valuePattern);
    if (value === undefined) {
      return undefined;
    }
    if (value === null) {
      return true;
    }
    if (value[0].match(/[tT]rue/)) {
      return true;
    }
    if (value[0].match(/[fF]alse/)) {
      return false;
    }
    return undefined;
  }
};

module.exports = Arguments;