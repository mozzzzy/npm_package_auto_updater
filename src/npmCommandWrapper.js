const { execSync } = require('child_process');

const NpmCommandWrapper = {
  async info(pkgName) {
    if (pkgName === undefined) {
      throw new Error('Invalid argument. pkgName is undefined.');
    }
    const stdout = await execSync(`npm info ${pkgName} --json`);
    return JSON.parse(stdout.toString());
  },

  async list() {
    const stdout = await execSync('npm list --json');
    return JSON.parse(stdout.toString());
  },
};

module.exports = NpmCommandWrapper;
