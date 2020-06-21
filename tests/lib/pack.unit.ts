import { expect } from 'chai';
import fs from 'fs-extra';
import pathLib from 'path';
import { Readable } from 'stream';
import tar from 'tar';

// NOTE: This is necessary or the import will pull in the dist version
// eslint-disable-next-line unicorn/import-index
import { createPackage } from '../../index';
import { packDirectory } from '../../lib/pack';

const OUTPUT_PATH = pathLib.join(__dirname, '../output');
const RESOURCES_PATH = pathLib.join(__dirname, '../resources/pack');

describe('pack unit tests', () => {
  beforeEach(async () => {
    await fs.remove(OUTPUT_PATH);
    await fs.ensureDir(OUTPUT_PATH);
  });

  it('pack directory - basic', async () => {
    const cwd = pathLib.join(RESOURCES_PATH, 'basic');
    const target = pathLib.join(OUTPUT_PATH, 'package.tgz');

    const contents = await packDirectory(cwd, target);

    expect(contents.files.map(({ path }) => path)).to.eql([
      './index.js',
      './tests/something.astd.js',
      './something.js',
      './config.json',
      './package.json',
    ]);
    expect(await fs.pathExists(target)).to.eql(true);
  });

  it('pack directory - using npmignore', async () => {
    const cwd = pathLib.join(RESOURCES_PATH, 'ignore');
    const target = pathLib.join(OUTPUT_PATH, 'package.tgz');

    const contents = await packDirectory(cwd, target);

    expect(contents.files.map(({ path }) => path)).to.eql(['./index.js', './tests/something.astd.js', './something.js', './package.json']);
    expect(await fs.pathExists(target)).to.eql(true);
  });

  it('pack directory - using files in package', async () => {
    const cwd = pathLib.join(RESOURCES_PATH, 'files');
    const target = pathLib.join(OUTPUT_PATH, 'package.tgz');

    const contents = await packDirectory(cwd, target);

    expect(contents.files.map(({ path }) => path)).to.eql(['./index.js', './package.json']);
    expect(await fs.pathExists(target)).to.eql(true);
  });

  it('pack and return string', async () => {
    const cwd = pathLib.join(RESOURCES_PATH, 'files');

    const packageString = await new Promise((resolve) => {
      let fileString;
      createPackage(cwd, async ({ target }) => {
        fileString = await fs.readFile(target, 'base64');
      }).then(() => resolve(fileString));
    });

    const stream = new Readable();
    stream.push(packageString, 'base64');
    stream.push(null);
    await new Promise((resolve) => stream.pipe(tar.x({ C: OUTPUT_PATH })).on('close', () => resolve()));

    const files = await fs.readdir(OUTPUT_PATH);

    expect(files).to.eql(['index.js', 'package.json']);
  });
});
