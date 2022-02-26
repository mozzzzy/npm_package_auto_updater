const { readFileSync, writeFileSync } = require('fs');

class PackageJsonAccessor {
  //
  // Private
  //
  #packageJson
  #packageJsonPath
  //
  // Public
  //
  constructor(packageJsonPath) {
    this.#packageJsonPath = packageJsonPath;
    this.#packageJson = JSON.parse(readFileSync(packageJsonPath).toString());
  }

  getVersion(packageName) {
    if (this.#packageJson.devDependencies !== undefined) {
      for (const [name, version] of Object.entries(this.#packageJson.devDependencies)) {
        if (name === packageName) {
          return version;
        }
      }
    }
    if (this.#packageJson.dependencies !== undefined) {
      for (const [name, version] of Object.entries(this.#packageJson.dependencies)) {
        if (name === packageName) {
          return version;
        }
      }
    }
    return undefined;
  }

  setVersion(packageName, version) {
    let packageIsFound = false;
    if (this.#packageJson.devDependencies !== undefined) {
      for (const name of Object.keys(this.#packageJson.devDependencies)) {
        if (name === packageName) {
          this.#packageJson.devDependencies[name] = version;
          packageIsFound = true;
          break;
        }
      }
    }
    if (this.#packageJson.dependencies !== undefined) {
      for (const name of Object.keys(this.#packageJson.dependencies)) {
        if (name === packageName) {
          this.#packageJson.dependencies[name] = version;
          packageIsFound = true;
          break;
        }
      }
    }
    if (!packageIsFound) {
      throw new Error(`Package ${packageName} was not found in package.json.`);
    }
    writeFileSync(this.#packageJsonPath, JSON.stringify(this.#packageJson, undefined, 2));
  }

  updatePackage(packageName, latestVersion) {
    const currentVersion = this.getVersion(packageName);
    if (currentVersion === undefined) {
      throw new Error(`Package ${packageName} was not found in package.json.`);
    }
    const newVersion = `^${latestVersion}`;
    console.log(`Update ${packageName} from ${currentVersion} to ${newVersion} in package.json.`);
    this.setVersion(packageName, newVersion);
  }
};

module.exports = PackageJsonAccessor;