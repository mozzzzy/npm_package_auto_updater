# npm_package_auto_updater
![master](https://github.com/mozzzzy/npm_package_auto_updater/actions/workflows/node.js.yml/badge.svg?branch=master)
![master](https://github.com/mozzzzy/npm_package_auto_updater/actions/workflows/daily_build.yml/badge.svg?branch=master)

## What
NPM package auto updater.  
This npm package provides a command to update dependencies of package.json automatically.

## Install
```bash
$ npm install -g npm_package_auto_updater
```

## Uninstall
```bash
$ npm uninstall -g npm_package_auto_updater
```

## Usage
It is simple.  
Go to the directory which has package.json and execute the following command.
```bash
$ npm-package-auto-updater
```

`npm-package-auto-updater` has the following options.
```bash
$ npm-package-auto-updater -h   
npm_package_auto_updater [option]

option
  -debug     : Enable debug logging.
  -dryrun    : Do only check. Don't modify package.json.
  -h, -help  : Show help message.
  -set-caret : Add '^' when update package versions.
  -set-tilde : Add '~' when update package versions.
               Note that this option has priority over '-set-caret'.

```
