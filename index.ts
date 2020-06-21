import Bluebird from 'bluebird';
import crypto from 'crypto';
import fs from 'fs-extra';
import os from 'os';
import path from 'path';

import { logSummary, packDirectory, PackSummaryInterface } from './lib/pack';

export { logSummary, PackSummaryInterface };

export interface PackResultInterface {
  target: string;
  summary: PackSummaryInterface;
}

/**
 * Create package
 *
 * NOTE: This has to use a callback so that it can delete the file afterwards
 *
 * @param {string} pkgDir
 * @param {(result: PackResultInterface) => void} packageCallback
 * @returns {Promise<void}
 */
export const createPackage = async (pkgDir: string, packageCallback: (result: PackResultInterface) => void): Promise<void> => {
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

  return Bluebird.resolve().then(async () => {
    await fs.ensureDir(tmpDir);
    const target = path.join(tmpDir, 'package.tgz');
    const summary = await packDirectory(pkgDir, target);
    return packageCallback({ target, summary });
  });
  // .finally(() => fs.remove(tmpDir));
};
