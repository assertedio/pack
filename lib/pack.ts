import byteSize from 'byte-size';
import columnify from 'columnify';
import fs from 'fs-extra';
import packlist from 'npm-packlist';
import log from 'npmlog';
import ssri from 'ssri';
import tar from 'tar';

export interface PackSummaryInterface {
  size: number;
  unpackedSize: number;
  shasum: string;
  integrity: string;
  files: { path: string; size: number; mode: string }[];
  entryCount: number;
  bundled: string[];
}

export const getSummary = async (target: string): Promise<PackSummaryInterface> => {
  const bundledWanted = new Set<string>([]);
  const files = [] as { path: string; size: number; mode: string }[];
  const bundled = new Set<string>();
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

export const packDirectory = async (dir: string, target: string): Promise<PackSummaryInterface> => {
  const tarOpt = {
    file: target,
    cwd: dir,
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

export const logSummary = (summary: PackSummaryInterface): void => {
  log.notice('=== Tarball Contents ===');
  if (summary.files.length > 0) {
    log.notice(
      '',
      columnify(
        summary.files.map((f) => {
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
  if (summary.bundled.length > 0) {
    log.notice('=== Bundled Dependencies ===');
    summary.bundled.forEach((name) => log.notice('', name));
  }
  log.notice('=== Tarball Details ===');
  log.notice(
    '',
    columnify(
      [
        { name: 'package size:', value: byteSize(summary.size) },
        { name: 'unpacked size:', value: byteSize(summary.unpackedSize) },
        { name: 'shasum:', value: summary.shasum },
        {
          name: 'integrity:',
          // eslint-disable-next-line no-magic-numbers
          value: `${summary.integrity.toString().slice(0, 20)}[...]${summary.integrity.toString().slice(80)}`,
        },
        summary.bundled.length && { name: 'bundled deps:', value: summary.bundled.length },
        summary.bundled.length && { name: 'bundled files:', value: summary.entryCount - summary.files.length },
        summary.bundled.length && { name: 'own files:', value: summary.files.length },
        { name: 'total files:', value: summary.entryCount },
      ].filter((x) => x),
      {
        include: ['name', 'value'],
        showHeaders: false,
      }
    )
  );
  log.notice('', '');
};
