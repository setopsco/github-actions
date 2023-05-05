const { Octokit } = require('@octokit/rest');
const semver = require('semver');

async function getDownloadUrl(versionConstraint, os, arch, githubToken) {
  octokitOptions = githubToken ? { auth: githubToken } : {}
  const octokit = new Octokit(octokitOptions);
  const response = await octokit.repos.listReleases({ owner: "setopsco", repo: "releases" });
  const releases = response.data
  const releaseVersions = releases.map(release => release.tag_name.substring(1)) // remove the "v" in the version

  // Test version constraint
  // "latest" will return invalid but that's ok because we check it explicitly
  const validVersion = semver.validRange(versionConstraint, { includePrerelease: false, loose: true });

  var version
  if (versionConstraint == 'latest') {
    version = releaseVersions.sort((a, b) => semver.rcompare(a, b))[0];
  } else if (validVersion) {
    version = matchVersion(releaseVersions, validVersion, false);
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
