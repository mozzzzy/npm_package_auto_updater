# npm_package_auto_updater
![master](https://github.com/mozzzzy/npm_package_auto_updater/actions/workflows/node.js.yml/badge.svg?branch=master)
![master](https://github.com/mozzzzy/npm_package_auto_updater/actions/workflows/daily_build.yml/badge.svg?branch=master)

## What
NPM package auto updater.

## Install
```bash
$ npm install -g npm_package_auto_updater
```

## Uninstall
```bash
$ npm uninstall -g npm_package_auto_updater
```

## Usage
```bash
$ npm-package-auto-updater -h   
npm_package_auto_updater [option]

option
  -debug     : Enable debug logging.
  -dryrun    : Do only check. Don't modify package.json, package-lock.json and node_modules.
  -h, -help  : Show help message.
  -set-caret : Add '^' when update package versions.
  -set-tilde : Add '~' when update package versions.
               Note that this option has priority over '-set-caret'.

```
