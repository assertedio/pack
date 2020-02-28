const { expect } = require('chai');
const fs = require('fs').promises;
const path = require('path');
const fse = require('fs-extra');

const pack = require('../../lib/pack');

const OUTPUT_PATH = path.join(__dirname, '../output');
const RESOURCES_PATH = path.join(__dirname, '../resources/pack');

describe('pack unit tests', () => {
  beforeEach(async () => {
    await fse.remove(OUTPUT_PATH);
    await fse.ensureDir(OUTPUT_PATH);
  });

  it('pack directory - basic', async () => {
    const cwd = path.join(RESOURCES_PATH, 'basic');
    const target = path.join(OUTPUT_PATH, 'package.tgz');

    const contents = await pack.packDirectory(cwd, target, null, false, false);

    expect(contents.files.map(({ path }) => path)).to.eql([
      "index.js",
      "tests/something.astd.js",
      "something.js",
      "config.json",
      "package.json"
    ]);
    expect(await fse.pathExists(target)).to.eql(true);
  });

  it('pack directory - using npmignore', async () => {
    const cwd = path.join(RESOURCES_PATH, 'ignore');
    const target = path.join(OUTPUT_PATH, 'package.tgz');

    const contents = await pack.packDirectory(cwd, target, null, false, false);

    expect(contents.files.map(({ path }) => path)).to.eql([
      "index.js",
      "tests/something.astd.js",
      "something.js",
      "package.json"
    ]);
    expect(await fse.pathExists(target)).to.eql(true);
  });

  it('pack directory - using files in package', async () => {
    const cwd = path.join(RESOURCES_PATH, 'files');
    const target = path.join(OUTPUT_PATH, 'package.tgz');

    const contents = await pack.packDirectory(cwd, target, null, false, false);

    expect(contents.files.map(({ path }) => path)).to.eql([
      "index.js",
      "package.json"
    ]);
    expect(await fse.pathExists(target)).to.eql(true);
  });
});
