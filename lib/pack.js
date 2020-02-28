'use strict'

// npm pack <pkg>
// Packs the specified package into a .tgz file, which can then
// be installed.

const BB = require('bluebird')

const byteSize = require('byte-size')
const cacache = require('cacache')
const columnify = require('columnify')
const fs = require('graceful-fs')
const log = require('npmlog')
const move = require('move-concurrently')
const path = require('path')
const readJson = BB.promisify(require('read-package-json'))
const tar = require('tar')
const packlist = require('npm-packlist')
const ssri = require('ssri')


// Taken from npm.js:449
const os = require('os')
const crypto = require('crypto')

const rand = crypto.randomBytes(4).toString('hex');
const tmpFolder = 'npm-' + process.pid + '-' + rand;
const tmpDir = path.resolve(os.tmpdir(), tmpFolder);
module.exports.tmpDir = tmpDir;

module.exports.packDirectory = packDirectory
function packDirectory (dir, target, filename, logIt, dryRun) {
  return cacache.tmp.withTmp(tmpDir, {tmpPrefix: 'packing'}, (tmp) => {
    const tmpTarget = path.join(tmp, path.basename(target))

    const tarOpt = {
      file: tmpTarget,
      cwd: dir,
      prefix: 'package/',
      portable: true,
      // Provide a specific date in the 1980s for the benefit of zip,
      // which is confounded by files dated at the Unix epoch 0.
      mtime: new Date('1985-10-26T08:15:00.000Z'),
      gzip: true
    }

    return BB.resolve(packlist({ path: dir }))
      // NOTE: node-tar does some Magic Stuff depending on prefixes for files
      //       specifically with @ signs, so we just neutralize that one
      //       and any such future "features" by prepending `./`
      .then((files) => tar.create(tarOpt, files.map((f) => `./${f}`)))
      .then(() => getContents({}, tmpTarget, filename, logIt))
      // thread the content info through
      .tap(() => {
        if (dryRun) {
          log.verbose('pack', '--dry-run mode enabled. Skipping write.')
        } else {
          return move(tmpTarget, target, {Promise: BB, fs})
        }
      })
  })
}

module.exports.logContents = logContents
function logContents (tarball) {
  log.notice('')
  log.notice('=== Tarball Contents ===')
  if (tarball.files.length) {
    log.notice('', columnify(tarball.files.map((f) => {
      const bytes = byteSize(f.size)
      return {path: f.path, size: `${bytes.value}${bytes.unit}`}
    }), {
      include: ['size', 'path'],
      showHeaders: false
    }))
  }
  if (tarball.bundled.length) {
    log.notice('=== Bundled Dependencies ===')
    tarball.bundled.forEach((name) => log.notice('', name))
  }
  log.notice('=== Tarball Details ===')
  log.notice('', columnify([
    {name: 'name:', value: tarball.name},
    {name: 'version:', value: tarball.version},
    tarball.filename && {name: 'filename:', value: tarball.filename},
    {name: 'package size:', value: byteSize(tarball.size)},
    {name: 'unpacked size:', value: byteSize(tarball.unpackedSize)},
    {name: 'shasum:', value: tarball.shasum},
    {
      name: 'integrity:',
      value: tarball.integrity.toString().substr(0, 20) + '[...]' + tarball.integrity.toString().substr(80)},
    tarball.bundled.length && {name: 'bundled deps:', value: tarball.bundled.length},
    tarball.bundled.length && {name: 'bundled files:', value: tarball.entryCount - tarball.files.length},
    tarball.bundled.length && {name: 'own files:', value: tarball.files.length},
    {name: 'total files:', value: tarball.entryCount}
  ].filter((x) => x), {
    include: ['name', 'value'],
    showHeaders: false
  }))
  log.notice('', '')
}

function getContents (pkg, target, filename, silent) {
  const bundledWanted = new Set([])
  const files = []
  const bundled = new Set()
  let totalEntries = 0
  let totalEntrySize = 0
  return tar.t({
    file: target,
    onentry (entry) {
      totalEntries++
      totalEntrySize += entry.size
      const p = entry.path
      if (p.startsWith('package/node_modules/')) {
        const name = p.match(/^package\/node_modules\/((?:@[^/]+\/)?[^/]+)/)[1]
        if (bundledWanted.has(name)) {
          bundled.add(name)
        }
      } else {
        files.push({
          path: entry.path.replace(/^package\//, ''),
          size: entry.size,
          mode: entry.mode
        })
      }
    },
    strip: 1
  })
    .then(() => BB.all([
      BB.fromNode((cb) => fs.stat(target, cb)),
      ssri.fromStream(fs.createReadStream(target), {
        algorithms: ['sha1', 'sha512']
      })
    ]))
    .then(([stat, integrity]) => {
      const shasum = integrity['sha1'][0].hexDigest()
      return {
        size: stat.size,
        unpackedSize: totalEntrySize,
        shasum,
        integrity: ssri.parse(integrity['sha512'][0]),
        filename,
        files,
        entryCount: totalEntries,
        bundled: Array.from(bundled)
      }
    })
}

