const { spawn } = require('child_process')
const process = require('process')
const os = require('os')
const path = require('path')
const fs = require('fs')
const core = require('@actions/core')

const cmd = 'setops'

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir)
  }
}

function login(organization, username, password, apiUrl) {
  // required to set up Docker credentials helper during login
  const binDir = path.join(os.homedir(), "bin")
  ensureDir(binDir)
  core.addPath(binDir)

  // prepare args
  const args = ["login", "--url", apiUrl, "--service-user"]
  const options = {
    encoding: 'utf-8',
    stdio: ['pipe', process.stdout, process.stderr]
  }

  return new Promise(function (resolve, reject) {
    console.log(`Execute setops login for user ${username} in organization ${organization}`)
    const childProcess = spawn(cmd, args, options)
    childProcess.stdin.write(`${organization}\n${username}\n${password}\n`)

    childProcess.on('exit', function (code) {
      if (code !== 0) {
        reject(`Process exited with code ${code}`)
      } else {
        resolve()
      }
    })
    childProcess.on('error', function (err) {
      reject(err)
    })
  })
}

module.exports = { login }
