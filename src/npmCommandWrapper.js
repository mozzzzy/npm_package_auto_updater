const { execSync } = require('child_process');

const NpmCommandWrapper = {
  info: async function (pkgName) {
    if (pkgName === undefined) {
      throw new Error(`Invalid argument. pkgName is undefined.`);
    }
    try {
      const stdout = await execSync(`npm info ${pkgName} --json`);
      return JSON.parse(stdout.toString());
    } catch (err) {
      throw err;
    }
  },

  install: async function () {
    try {
      await execSync('npm install');
    } catch (err) {
      throw err;
    }
  },

  list: async function () {
    try {
      const stdout = await execSync('npm list --json');
      return JSON.parse(stdout.toString());
    } catch (err) {
      throw err;
    }
  },

  outdated: async function () {
    let outdatedPackages = undefined;
    try {
      await execSync('npm outdated --json');
    } catch (err) {
      // Note:
      // If npm outdated find outdated packages, it returns 1 and exec() function failed.
      // The following code checks this case.
      // (1) If npm outdated find outdated packages, err.code is 1, and err.signal is null
      if (err.status !== 1 || err.signal !== null) {
        throw err;
      }
      // (2) If npm outdated find outdated packages, stdout is json object of following format.
      //   {
      //     "PACKAGE_NAME": {
      //       "current": "PACKAGE_VERSION",
      //       "wanted": "PACKAGE_VERSION",
      //       "latest": "PACKAGE_VERSION",
      //       ...
      //     },
      //     ...
      //   }
      if (err.stdout.length === 0) {
        throw err;
      }
      try {
        outdatedPackages = JSON.parse(err.stdout.toString());
      } catch (parseErr) {
        throw err;
      }
      if (typeof outdatedPackages !== 'object' || outdatedPackages === null) {
        throw err;
      } else {
        for (const outdatedPackageInfo of Object.values(outdatedPackages)) {
          if (typeof outdatedPackageInfo.current !== 'string' ||
            typeof outdatedPackageInfo.wanted !== 'string' ||
            typeof outdatedPackageInfo.latest !== 'string') {
            throw err;
          }
        }
      }
      return outdatedPackages;
    }
  },
};

module.exports = NpmCommandWrapper;