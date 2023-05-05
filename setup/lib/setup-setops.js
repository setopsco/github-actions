// Node.js core
const os = require('os');
const fs = require('fs').promises;
const path = require('path');

// External
const core = require('@actions/core');
const github = require('@actions/github');
const tc = require('@actions/tool-cache');
const decompress = require('decompress');
const decompressBzip2 = require('decompress-bzip2');

// SetOps
const releases = require('./releases')
const cli = require('./setops-cli')

const supportedOSPlatforms = ["darwin", "linux"]
const supportedArches = ["amd64"]

// arch in [arm, x32, x64...] (https://nodejs.org/api/os.html#os_os_arch)
// return value in [amd64, 386, arm]
function mapArch(arch) {
  const mappings = {
    x32: '386',
    x64: 'amd64'
  };
  return mappings[arch] || arch;
}

const triggeredByDependabot = github.context.actor == 'dependabot[bot]'

async function downloadCLI(url, githubToken) {
  core.debug(`Downloading SetOps CLI from ${url}`);
  const pathToDownload = await tc.downloadTool(url, undefined, `token ${githubToken}`);

  const pathToCLI = await fs.mkdtemp(path.join(os.tmpdir(), 'setops-'));

  core.debug(`Extracting SetOps CLI bz2 file to ${pathToCLI}`);
  await decompress(pathToDownload, pathToCLI, {
    plugins: [
      decompressBzip2({ path: 'setops' })
    ]
  });

  await fs.chmod(path.join(pathToCLI, "setops"), 0o755)

  return pathToCLI;
}

async function run() {
  try {
    // Gather OS details
    const osPlatform = os.platform();
    const osArch = mapArch(os.arch());

    if (!supportedOSPlatforms.includes(osPlatform)) {
      throw new Error(`OS platform ${osPlatform} not supported`);
    }
    if (!supportedArches.includes(osArch)) {
      throw new Error(`OS architecture ${osArch} not supported`);
    }

    // Gather GitHub Actions inputs
    const version = core.getInput('setops_version');
    const loginOrganization = core.getInput('setops_organization');
    const loginUsername = core.getInput('setops_username');
    const loginPassword = core.getInput('setops_password');
    const apiUrl = core.getInput('setops_api_url');
    const githubToken = core.getInput('github_token');

    if ((loginUsername || loginPassword || loginOrganization) && !(loginUsername && loginPassword && loginOrganization)) {
      const errorMsg = 'When providing setops_username, setops_password or setops_organization, all of them must be set.'
      const dependabotHint = '\nThis run was triggered by Dependabot. If you want to grant Dependabot access to your SetOps credentials, add them to the dedicated Dependabot Secrets in the repository settings.'
      throw new Error(errorMsg + (triggeredByDependabot) ? dependabotHint : '');
    }

    if (!apiUrl) {
      throw new Error(
        `Please provide a valid SetOps API URL or use or use the default value`
      );
    }

    core.debug(`Getting download url for SetOps version ${version}: ${osPlatform} ${osArch}`);
    const downloadUrl = await releases.getDownloadUrl(version, osPlatform, osArch, githubToken);
    if (!downloadUrl) {
      throw new Error(`SetOps version ${version} not available for ${osPlatform} and ${osArch}`);
    }

    // Download requested version
    const pathToCLI = await downloadCLI(downloadUrl, githubToken);

    // Add to path
    core.addPath(pathToCLI);

    // Add credentials to file if they are provided
    if (loginUsername && loginPassword && loginOrganization && apiUrl) {
      await cli.login(loginOrganization, loginUsername, loginPassword, apiUrl)
    }
  } catch (error) {
    core.error(error);
    throw error;
  }
}

module.exports = run;
