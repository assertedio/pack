const BB = require('bluebird')

const cacache = require('cacache')
const path = require('path')
const readJson = BB.promisify(require('read-package-json'))

const pack = require('./lib/pack');

function createPackage(pkgDir) {
  if (!pkgDir) {
    throw new Error('pkgDir must be provided')
  }

  return readJson(path.join(pkgDir, 'package.json')).then((pkg) => {
    return cacache.tmp.withTmp(pack.tmpDir, {tmpPrefix: 'fromDir'}, (tmpDir) => {
      const target = path.join(tmpDir, 'package.tgz')
      return pack.packDirectory(pkgDir, target, null, true)
        .tap((c) => { contents = c })
        .then((c) => pack.logContents(c))
        .then(() => { pkg, target })
    })
  });
}

module.exports = { createPackage };
