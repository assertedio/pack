import byteSize from 'byte-size';
import columnify from 'columnify';
import fs from 'fs-extra';
import packlist from 'npm-packlist';
import log from 'npmlog';
import ssri from 'ssri';
import tar from 'tar';

export const getSummary = async (target: string) => {
  const bundledWanted = new Set<string>([]);
  const files = [] as { path: string; size: number; mode: string }[];
  const bundled = new Set();
  let totalEntries = 0;
  let totalEntrySize = 0;

  await tar.t({
    file: target,
    onentry(entry) {
      totalEntries++;
      totalEntrySize += entry.size;
      const p = entry.path;
      if (p.startsWith('package/node_modules/')) {
        const name = p.match(/^package\/node_modules\/((?:@[^/]+\/)?[^/]+)/)[1];
        if (bundledWanted.has(name)) {
          bundled.add(name);
        }
      } else {
        files.push({
          path: entry.path.replace(/^package\//, ''),
          size: entry.size,
          mode: entry.mode,
        });
      }
    },
    strip: 1,
  });

  const stat = await fs.stat(target);
  const integrity = await ssri.fromStream(fs.createReadStream(target), {
    algorithms: ['sha1', 'sha512'],
  });

  const shasum = integrity.sha1[0].hexDigest();
  return {
    size: stat.size,
    unpackedSize: totalEntrySize,
    shasum,
    integrity: ssri.parse(integrity.sha512[0]),
    files,
    entryCount: totalEntries,
    bundled: [...bundled],
  };
};

export const packDirectory = async (dir: string, target: string) => {
  const tarOpt = {
    file: target,
    cwd: dir,
    prefix: 'package/',
    portable: true,
    // Provide a specific date in the 1980s for the benefit of zip,
    // which is confounded by files dated at the Unix epoch 0.
    mtime: new Date('1985-10-26T08:15:00.000Z'),
    gzip: true,
  };

  const files = await packlist({ path: dir });

  // NOTE: node-tar does some Magic Stuff depending on prefixes for files
  //       specifically with @ signs, so we just neutralize that one
  //       and any such future "features" by prepending `./`
  await tar.create(
    tarOpt,
    files.map((f) => `./${f}`)
  );

  return getSummary(target);
};

export const logSummary = (tarball): void => {
  log.notice('=== Tarball Contents ===');
  if (tarball.files.length > 0) {
    log.notice(
      '',
      columnify(
        tarball.files.map((f) => {
          const bytes = byteSize(f.size);
          return { path: f.path, size: `${bytes.value}${bytes.unit}` };
        }),
        {
          include: ['size', 'path'],
          showHeaders: false,
        }
      )
    );
  }
  if (tarball.bundled.length > 0) {
    log.notice('=== Bundled Dependencies ===');
    tarball.bundled.forEach((name) => log.notice('', name));
  }
  log.notice('=== Tarball Details ===');
  log.notice(
    '',
    columnify(
      [
        tarball.filename && { name: 'filename:', value: tarball.filename },
        { name: 'package size:', value: byteSize(tarball.size) },
        { name: 'unpacked size:', value: byteSize(tarball.unpackedSize) },
        { name: 'shasum:', value: tarball.shasum },
        {
          name: 'integrity:',
          // eslint-disable-next-line no-magic-numbers
          value: `${tarball.integrity.toString().slice(0, 20)}[...]${tarball.integrity.toString().slice(80)}`,
        },
        tarball.bundled.length && { name: 'bundled deps:', value: tarball.bundled.length },
        tarball.bundled.length && { name: 'bundled files:', value: tarball.entryCount - tarball.files.length },
        tarball.bundled.length && { name: 'own files:', value: tarball.files.length },
        { name: 'total files:', value: tarball.entryCount },
      ].filter((x) => x),
      {
        include: ['name', 'value'],
        showHeaders: false,
      }
    )
  );
  log.notice('', '');
};
