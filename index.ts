import Bluebird from 'bluebird';
import cacache from 'cacache';
import crypto from 'crypto';
import fs from 'fs-extra';
import os from 'os';
import path from 'path';

import { logSummary, packDirectory } from './lib/pack';

const createPackage = async (pkgDir: string, packageCallback: Function): Promise<void> => {
  if (!pkgDir) {
    throw new Error('pkgDir must be provided');
  }

  if (!packageCallback) {
    throw new Error('packageCallback must be provided');
  }

  // eslint-disable-next-line no-magic-numbers
  const rand = crypto.randomBytes(4).toString('hex');
  const tmpFolder = `pack-${process.pid}-${rand}`;
  const tmpDir = path.resolve(os.tmpdir(), tmpFolder);

  return Bluebird.resolve()
    .then(() =>
      cacache.tmp.withTmp(tmpDir, async (dir) => {
        const target = path.join(dir, 'package.tgz');
        const summary = await packDirectory(pkgDir, target);
        return packageCallback({ target, summary });
      })
    )
    .finally(() => fs.remove(tmpDir));
};

export { logSummary, createPackage };
