/*
 * Builtin Packages
 */

const fs = require('fs');

/*
 * External Packages
 */

const semver = require('semver');

/*
 * Internal Packages
 */

const Arguments = require('./arguments');
const Logger = require('./logger');
const NpmCommandWrapper = require('./npmCommandWrapper');
const PackageJsonAccessor = require('./packageJsonAccessor');

/*
 * Variables
 */

let logger;

/*
 * Functions
 */

// The following functions create dependency trees like the following.
//
//   (Tree1)            (Tree2)
//
//     pkgA               pkgA
//                         ^
//                         | (depends on)
//                        pkgB
//
//
//   (Tree3)              (Tree5)
//
//     pkgA     pkgB        pkgA
//      ^        ^           ^
//      |        |           | (depends on)
//      +--------+           +--------+
//      | (depends on)       |        |
//     pkgC                 pkgB     pkgC
//
//
//   (Tree5)
//
//     pkgA <------------+
//      ^                |
//      | (depends on)   |
//      |                |
//     pkgB              | (depends on)
//      ^                |
//      | (depends on)   |
//      |                |
//     pkgC -------------+
//
const addTreeNode = (depPkgList, rootPkgName, tree, allTreeNodes) => {
  const rootPkgInfo = depPkgList.get(rootPkgName);
  if (rootPkgInfo === undefined) {
    throw new Error(`${rootPkgName} should be in depPkgList. But not found.`);
  }
  if (allTreeNodes.has(rootPkgName)) {
    // If the tree node of rootPkgName, use it.
    tree.set(rootPkgName, allTreeNodes.get(rootPkgName));
  } else {
    // Create new tree node.
    const treeNode = {
      current: rootPkgInfo.current,
      latest: rootPkgInfo.latest,
      available: rootPkgInfo.available,
      dependsOn: new Map(rootPkgInfo.dependsOn),
      isDependedBy: new Map(rootPkgInfo.isDependedBy),
    };
    tree.set(rootPkgName, treeNode);
    allTreeNodes.set(rootPkgName, treeNode);
  }
  // Go to next tree node
  for (const nextPkgName of rootPkgInfo.isDependedBy.keys()) {
    addTreeNode(depPkgList, nextPkgName, tree, allTreeNodes);
  }
};

const createDependencyTrees = (depPkgList, trees, allTreeNodes) => {
  for (const [pkgName, pkgInfo] of depPkgList) {
    // Find root package of each tree.
    // The root package is the package which is depends on no other package.
    if (pkgInfo.dependsOn.size > 0) {
      continue;
    }
    logger.info(`Create the dependency tree whose root node is ${pkgName}.`);
    const tree = new Map();
    addTreeNode(depPkgList, pkgName, tree, allTreeNodes);
    trees.push(tree);

    logger.info(
      `  -> Created the dependency tree whose root node is ${pkgName} successfully.`,
    );
    logger.debug('Tree is the following.');
    logger.debug(tree);
  }
};

const updateTreeNode = async (
  trees,
  tree,
  depPkgName,
  candidateIsTooHigh,
  acceptableVersion,
) => {
  const treeNode = tree.get(depPkgName);

  logger.debug(`Select the candidate for update of ${depPkgName}.`);
  if (treeNode.updateCandidate === undefined) {
    // First time selection of update candidate
    logger.debug(
      'No candidate version has been set yet. This is the first time to select. Set the latest version to the candidate.',
    );
    treeNode.updateCandidate = treeNode.latest;
    logger.debug(
      `  -> Set the candidate version to ${treeNode.updateCandidate}.`,
    );
  } else if (candidateIsTooHigh) {
    logger.debug(
      'The candidate version has been set. But the version is too high. Lower the version.',
    );
    const depPkgInfo = tree.get(depPkgName);
    // Find current candidate version from all available versions.
    let currentCandidateIndex;
    for (let i = depPkgInfo.available.length - 1; i >= 0; i -= 1) {
      if (depPkgInfo.updateCandidate === depPkgInfo.available[i]) {
        currentCandidateIndex = i;
        break;
      }
    }
    // The current candidate is the oldest version of depPkg. No more candidates.
    if (currentCandidateIndex === 0) {
      throw new Error(
        `The candidate of ${depPkgName} is the oldest version. No more older version. Candidate does not found.`,
      );
    }
    // Set next update candidate.
    if (acceptableVersion) {
      for (let i = currentCandidateIndex - 1; i >= 0; i -= 1) {
        const nextUpdateCandidate = depPkgInfo.available[i];
        if (semver.satisfies(nextUpdateCandidate, acceptableVersion)) {
          treeNode.updateCandidate = nextUpdateCandidate;
          break;
        }
        if (i === 0) {
          throw new Error(`Candidate of ${depPkgName} does not found.`);
        }
      }
    } else {
      treeNode.updateCandidate = depPkgInfo.available[currentCandidateIndex - 1];
    }
    logger.debug(`  -> Set candidate version to ${treeNode.updateCandidate}.`);
  } else {
    logger.debug('  -> The candidate version has been already set.');
  }

  // Get candidate version's package info.
  const depPkgNameWithVersion = `${depPkgName}@${treeNode.updateCandidate}`;
  const info = await NpmCommandWrapper.info(depPkgNameWithVersion);

  // Check acceptable version range of parent packages.
  if (treeNode.dependsOn.size > 0) {
    logger.debug(
      `Check that ${depPkgNameWithVersion} can use whose dependencies.`,
    );
  }
  for (const depDepPkgName of treeNode.dependsOn.keys()) {
    logger.debug(`${depPkgNameWithVersion} depends on ${depDepPkgName}.`);
    const acceptableVersionOfDepDep = info.dependencies[depDepPkgName]
      ? info.dependencies[depDepPkgName]
      : info.peerDependencies[depDepPkgName];
    if (acceptableVersionOfDepDep === undefined) {
      throw new Error(
        `${depDepPkgName} should be the dependency or peerDependency of ${depPkgNameWithVersion}. `
          + `But failed to get acceptable version from npm info ${depPkgNameWithVersion}.`,
      );
    }
    logger.debug(`The accepted version range is ${acceptableVersionOfDepDep}.`);

    // Check if updateCandidate of depDepPkg matches with acceptableVersion.
    const parentTreeNode = tree.get(depDepPkgName);
    if (parentTreeNode === undefined) {
      // Note:
      // In this case, depDepPkg is in deferent tree. And this is the first time to update depPkg.
      // So depDepPkg has not been updated yet. It's ok to skip checking.
      // Because it should be updated later.
      logger.debug(
        `${depDepPkgName} does not exist in current dependency tree. It is checked in deferent tree.`,
      );
      continue;
    }
    if (parentTreeNode.updateCandidate === undefined) {
      // Note:
      // In this case, depDepPkg is in the same tree, But it has not been updated yet.
      // This can happen when the tree is like the following and the update is
      // executed in the order of PkgA, C, B.
      //
      //               PkgA <--+
      //                ^      |
      //                |      |
      //               PkgB    |
      //                ^      |
      //                |      |
      //               PkgC - -+
      //
      //       I should update depDepPkg (in this case, PkgB) first.
      logger.debug(
        `${depDepPkgName} exists in current dependency tree. But it's candidate version has not been selected. I'm going to select ${depDepPkgName} first.`,
      );
      treeNode.updateCandidate = undefined;
      return;
    }

    logger.debug(
      `${depDepPkgName}'s candidate version is ${parentTreeNode.updateCandidate}.`,
    );
    if (
      semver.satisfies(
        parentTreeNode.updateCandidate,
        acceptableVersionOfDepDep,
      )
    ) {
      logger.debug(
        `${depPkgName}@${treeNode.updateCandidate} can use ${depDepPkgName}@${parentTreeNode.updateCandidate}.`,
      );
      continue;
    }
    logger.debug(
      `${depPkgName}@${treeNode.updateCandidate} can not use dependency ${depDepPkgName}@${parentTreeNode.updateCandidate}.`,
    );
    if (
      semver.lt(
        parentTreeNode.updateCandidate,
        semver.minVersion(acceptableVersionOfDepDep),
      )
    ) {
      // Lower the version of depPkg.
      logger.debug(
        `The version of ${depPkgName} is too high. Try to lower the version of ${depPkgName}.`,
      );
      // Note: disable no-await-in-loop because tree must be updated sequentially.
      // eslint-disable-next-line no-await-in-loop
      await updateTreeNode(trees, tree, depPkgName, true);
      return;
    }
    // Note:
    // This case indicates that the version of depPkg is too low or
    // the version of depDepPackage is too high.
    // I can't increase the version of depPkg.
    // Because the selection of candidate version of depPkg starts from latest,
    // and some dependency lower the version if needed.
    // Increasing the version of depPkg will causes infinity loop.
    logger.debug(
      `The version of ${depDepPkgName} is too high. Try to lower the version of ${depDepPkgName}.`,
    );

    // Note: disable no-await-in-loop because tree must be updated sequentially.
    // eslint-disable-next-line no-await-in-loop
    await updateTreeNode(
      trees,
      tree,
      depDepPkgName,
      true,
      acceptableVersionOfDepDep,
    );
    return;
  }

  // If the candidate which had already been selected was changed,
  // It need to check again the other trees which contain this package.
  if (candidateIsTooHigh) {
    logger.debug(
      `The candidate version for ${depPkgName} which had already been selected was changed. Recheck other trees which contains this package if exist.`,
    );
    // Find tree which contains depPkg.
    for (const otherTree of trees) {
      for (const otherTreePkgName of otherTree.keys()) {
        if (otherTreePkgName === depPkgName) {
          const isSameTree = (tree1, tree2) => {
            if (tree1.size !== tree2.size) {
              return false;
            }
            for (const pkgName of tree1.keys()) {
              if (tree2.has(pkgName) === false) {
                return false;
              }
            }
            return true;
          };

          // Check that otherTree is current tree or not.
          if (isSameTree(tree, otherTree)) {
            break;
          }
          // If find the tree, recheck.
          logger.debug(
            `The tree contains ${depPkgName} is found. Recheck this tree.`,
          );

          // Note: disable no-await-in-loop because tree must be updated sequentially.
          // eslint-disable-next-line no-await-in-loop
          await updateTreeNode(trees, tree, depPkgName);
          logger.debug('Rechecked the tree Successfully.');
          break;
        }
      }
    }
    logger.debug('Rechecked other trees successfully.');
  }

  // Go to next tree node
  logger.debug(`Selected candidate version of ${depPkgName} successfully.`);
  for (const nextPkgName of treeNode.isDependedBy.keys()) {
    logger.debug(
      `Select the candidate version of next package ${nextPkgName}. this depends on ${depPkgName}.`,
    );
    // Note: disable no-await-in-loop because tree must be updated sequentially.
    // eslint-disable-next-line no-await-in-loop
    await updateTreeNode(trees, tree, nextPkgName);
  }
};

const main = async (packageJsonPath) => {
  const args = new Arguments(process.argv);
  const logLevel = args.getBoolean('-debug')
    ? Logger.static.DEBUG
    : Logger.static.INFO;
  const dryrun = !!args.getBoolean('-dryrun');
  const needHelp = !!(args.getBoolean('-help') || args.getBoolean('-h'));
  const setCaret = !!args.getBoolean('-set-caret');
  const setTilde = !!args.getBoolean('-set-tilde');

  if (needHelp) {
    // eslint-disable-next-line no-console
    console.log('npm_package_auto_updater [option]');
    // eslint-disable-next-line no-console
    console.log('');
    // eslint-disable-next-line no-console
    console.log('option');
    // eslint-disable-next-line no-console
    console.log('  -debug     : Enable debug logging.');
    // eslint-disable-next-line no-console
    console.log(
      "  -dryrun    : Do only check. Don't modify package.json, package-lock.json and node_modules.",
    );
    // eslint-disable-next-line no-console
    console.log('  -h, -help  : Show help message.');
    // eslint-disable-next-line no-console
    console.log("  -set-caret : Add '^' when update package versions.");
    // eslint-disable-next-line no-console
    console.log("  -set-tilde : Add '~' when update package versions.");
    // eslint-disable-next-line no-console
    console.log(
      "               Note that this option has priority over '-set-caret'.",
    );
    // eslint-disable-next-line no-console
    console.log('');
    return;
  }

  logger = new Logger(logLevel);

  if (fs.existsSync('./node_modules') === false) {
    // npm install should be executed before npm list.
    logger.error(
      "'node_modules' directory is not found. Please run 'npm i' first.",
    );
    return;
  }

  // Get all dependencies (like dependencies, depDependencies, peerDependencies ...) from npm list.
  let dependencies;
  try {
    logger.info(
      "Execute 'npm list' to get the dependency list of the npm project.",
    );
    const list = await NpmCommandWrapper.list();
    dependencies = list.dependencies;
    if (dependencies === undefined) {
      throw new Error("Dependencies were not found in response of 'npm list'.");
    }
    logger.info('  -> Executed npm list successfully.');
  } catch (err) {
    logger.error(`  -> Failed to execute npm list: ${err}`);
    return;
  }

  // Debug logging
  logger.debug('Target npm project has the following dependencies.');
  for (const [depPkgName, depPkgInfo] of Object.entries(dependencies)) {
    logger.debug(`  * ${depPkgName}: ${depPkgInfo.version}`);
  }

  // Get the current installed version, the latest version,
  // and the peerDependency list about each project's dependency using npm info.
  // Note:
  //   The devDependencies of the target npm project's dependency are not processed.
  //   Because the devDependencies of the dependency is not needed by the target npm project.
  //   And the dependencies of the target npm project's dependency are not processed.
  //   Because the dependencies of npm project's dependency is installed
  //   independently of other dependencies.
  logger.info(
    "Get the peerDependency list of the project's dependencies using npm info.",
  );
  const depPkgNames = Object.keys(dependencies);
  const depPkgList = new Map();
  // Element of depPkgList will be the following format.
  //   <PACKAGE NAME> : {
  //     current: <CURRENT INSTALLED VERSION>,
  //     latest: <LATEST VERSION>,
  //     available: [
  //       <AVAILABLE VERSION RANGE>,
  //       <AVAILABLE VERSION RANGE>,
  //       ...
  //     ],
  //     dependsOn: {
  //       <DEPENDING PACKAGE NAME>: <VERSION RANGE>,
  //       <DEPENDING PACKAGE NAME>: <VERSION RANGE>,
  //       ...
  //     },
  //     isDependedBy: {
  //       <DEPENDED PACKAGE NAME>: <REQUIRED VERSION RANGE>,
  //       <DEPENDED PACKAGE NAME>: <REQUIRED VERSION RANGE>,
  //       ...
  //     }
  //   }
  for (const depPkgName of depPkgNames) {
    logger.info(`Execute npm info for ${depPkgName}.`);

    // Note: disable no-await-in-loop because tree must be updated sequentially.
    // eslint-disable-next-line no-await-in-loop
    const info = await NpmCommandWrapper.info(depPkgName);
    logger.info(`  -> Executed npm info for ${depPkgName} successfully.`);

    const peerDepsOfDep = new Map();
    if (
      info.peerDependencies !== undefined
      && typeof info.peerDependencies === 'object'
      && info.peerDependencies !== null
    ) {
      for (const [peerDepOfDep, acceptableVersionRange] of Object.entries(
        info.peerDependencies,
      )) {
        if (
          depPkgNames.some(
            (otherDepPkgName) => otherDepPkgName === peerDepOfDep,
          )
        ) {
          peerDepsOfDep.set(peerDepOfDep, acceptableVersionRange);
        }
      }
    }
    depPkgList.set(depPkgName, {
      current: dependencies[depPkgName].version,
      latest: info.version,
      available: info.versions,
      dependsOn: peerDepsOfDep,
      isDependedBy: new Map(), // This field will be filled by the following logic.
    });
  }
  for (const [depPkgName, depPkgInfo] of depPkgList.entries()) {
    for (const [
      depOfDepPkgName,
      requiredVersionRange,
    ] of depPkgInfo.dependsOn.entries()) {
      depPkgList
        .get(depOfDepPkgName)
        .isDependedBy.set(depPkgName, requiredVersionRange);
    }
  }
  logger.info(
    "  -> Got the peerDependency list of the project's dependencies successfully.",
  );

  // Create peerDependency trees of the project's dependencies.
  logger.info("Create peerDependency trees of the project's dependencies.");
  const trees = [];
  const allTreeNodes = new Map();
  createDependencyTrees(depPkgList, trees, allTreeNodes);
  logger.info('  -> Created peerDependency trees successfully.');

  // Update dependencies from root node.
  logger.info('Update dependency trees.');
  for (const tree of trees) {
    // Find root node.
    for (const [depPkgName, depPkgInfo] of tree.entries()) {
      if (depPkgInfo.dependsOn.size === 0) {
        logger.info(`Update dependency tree whose root node is ${depPkgName}.`);
        // Note: disable no-await-in-loop because tree must be updated sequentially.
        // eslint-disable-next-line no-await-in-loop
        await updateTreeNode(trees, tree, depPkgName);
        // debug logging
        logger.info(
          `  -> Updated dependency tree whose root node is ${depPkgName} successfully.`,
        );
        logger.debug(tree);
        break;
      }
    }
  }
  logger.info('  -> Updated dependency trees successfully.');

  const packageJsonAccessor = new PackageJsonAccessor(packageJsonPath);
  const updatedPkgs = new Map();
  for (const [pkgName, pkgInfo] of allTreeNodes) {
    if (setTilde) {
      pkgInfo.updateVersion = `~${pkgInfo.updateCandidate}`;
    } else if (setCaret) {
      pkgInfo.updateVersion = `^${pkgInfo.updateCandidate}`;
    } else {
      pkgInfo.updateVersion = pkgInfo.updateCandidate;
    }
    pkgInfo.currentVersionInPackageJson = packageJsonAccessor.getVersion(pkgName);
    if (pkgInfo.currentVersionInPackageJson !== pkgInfo.updateVersion) {
      updatedPkgs.set(pkgName, pkgInfo);
    }
  }
  if (updatedPkgs.size === 0) {
    logger.info('All packages are up to date.');
    return;
  }

  // Print update result of all packages.
  logger.info();
  logger.info('Update the following packages.');
  for (const [pkgName, pkgInfo] of updatedPkgs) {
    logger.info(
      `  * ${pkgName}: ${pkgInfo.currentVersionInPackageJson} -> ${pkgInfo.updateVersion}`,
    );
  }
  logger.info();

  if (!dryrun) {
    logger.info('Update package.json.');
    for (const [pkgName, pkgInfo] of updatedPkgs) {
      packageJsonAccessor.setVersion(pkgName, pkgInfo.updateVersion);
    }
    logger.info('  -> Updated package.json successfully.');
  } else {
    logger.notice('dryrun mode is set. Skip changing package.json.');
  }
};

module.exports = main;
