module.exports = {
  env: {
    jest: true,
  },
  extends: ['airbnb-base'],
  parserOptions: {
    ecmaVersion: 13,
  },
  rules: {
    // I disable no-continue rule.
    // 'continue' statement is usable for me to early return.
    // 'no-continue' rule prevent me from do early return and
    // make me write long codes in a if block.
    'no-continue': 'off',
    // I disable no-restricted-syntax rule.
    // This rule prevent me from for ... of loop of Map.keys() and Map.entries().
    // The reason to prevent it is the following.
    // > iterators/generators require regenerator-runtime,
    //   which is too heavyweight for this guide to allow them.
    // But I don't care about performance in this script.
    'no-restricted-syntax': 'off',
  },
};
