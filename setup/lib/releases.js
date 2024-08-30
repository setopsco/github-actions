const { Octokit } = require('@octokit/rest');
const semver = require('semver');

async function getDownloadUrl(versionConstraint, os, arch, githubToken) {
  octokitOptions = githubToken ? { auth: githubToken } : {}
  const octokit = new Octokit(octokitOptions);
  const response = await octokit.repos.listReleases({ owner: "setopsco", repo: "releases" });
  const releases = response.data

  const releaseVersions = releases
    .map(release => release.tag_name.substring(1)) // remove the "v" in the version
    .sort((a, b) => semver.rcompare(a, b)); // sort via semver

  // Test version constraint
  // "latest" and "next" will return invalid but that's ok because we check it explicitly
  const validVersionConstraint = semver.validRange(versionConstraint, { includePrerelease: false, loose: true });

  var version
  // Include prelease versions, like v1.0.0-rc1 or v1.0.1-dev
  if (versionConstraint == 'next') {
    version = releaseVersions[0]
  } else if (versionConstraint == 'latest') {
    version = releaseVersions.filter(version => {
      const prereleaseComponents = semver.prerelease(version);
      return prereleaseComponents == null || prereleaseComponents.length == 0
    })[0];
  } else if (validVersionConstraint) {
    version = matchVersion(releaseVersions, validVersionConstraint, false);
  } else {
    throw new Error(`${versionConstraint} is not a valid version`);
  }

  if (!version) {
    return undefined
  }

  const latestRelease = releases.find(release => release.tag_name == "v" + version)
  if (!latestRelease) {
    throw new Error(`could not find a release`);
  }

  const build = latestRelease.assets.find(asset => asset.name == `setops-cli_v${version}_${os}_${arch}.bz2`)
  return build ? build.browser_download_url : undefined
}

function matchVersion(versions, range, includePrerelease) {
  // If a prerelease version range is given, it will only match in that series (0.14-rc0, 0.14-rc1)
  // unless includePrerelease is set to true
  // https://www.npmjs.com/package/semver#prerelease-tags
  return semver.maxSatisfying(versions, range, { includePrerelease });
}

module.exports = { getDownloadUrl };
