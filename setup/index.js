const core = require('@actions/core');
const setup = require('./lib/setup-setops');

function handleError(err) {
  console.error(err);
  core.setFailed(err.message);
}

process.on('unhandledRejection', handleError);

setup().catch(handleError);
