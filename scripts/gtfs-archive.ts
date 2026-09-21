import { inflateRawSync } from 'node:zlib';

/** A decoded GTFS CSV row keyed by its trimmed header names. */
export type CsvRow = Record<string, string>;

/** Throw a consistent data error when an archive cannot produce a trustworthy snapshot. */
function fail(message: string): never {
  throw new Error(`GTFS data error: ${message}`);
}

/**
 * Parse one GTFS CSV table into records keyed by trimmed header names.
 *
 * CTAN's current feed contains unescaped interior quotes in a few stop labels. Those quotes are
 * preserved as text until a field boundary closes the value, while all other malformed row shapes
 * still fail generation rather than shifting columns silently.
 */
export function parseCsv(text: string): CsvRow[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  let sawContent = false;

  /** Commit the current field before moving to the next CSV delimiter. */
  const addField = () => {
    row.push(field);
    field = '';
  };

  /** Commit a non-empty record and reset the parser state for the next line. */
  const addRow = () => {
    addField();
    if (row.some((value) => value !== '')) {
      rows.push(row);
    }
    row = [];
    sawContent = false;
  };

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index] ?? '';

    if (quoted) {
      if (character === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 1;
        } else if (
          text[index + 1] === undefined ||
          text[index + 1] === ',' ||
          text[index + 1] === '\r' ||
          text[index + 1] === '\n'
        ) {
          quoted = false;
        } else {
          // CTAN currently has labels such as `"Oasis " Viveros " (V)"`.
          // Treat an interior quote as display text until a field boundary closes the value.
          field += '"';
        }
      } else if (character === '\r' && text[index + 1] === '\n') {
        field += '\n';
        index += 1;
      } else {
        field += character;
      }
      continue;
    }

    if (character === '"') {
      if (field !== '') {
        fail(`unexpected quote in CSV field near character ${index}.`);
      }
      quoted = true;
      sawContent = true;
    } else if (character === ',') {
      addField();
      sawContent = true;
    } else if (character === '\n') {
      addRow();
    } else if (character === '\r') {
      if (text[index + 1] !== '\n') {
        addRow();
      }
    } else {
      field += character;
      sawContent = true;
    }
  }

  if (quoted) {
    fail('unterminated quoted CSV field.');
  }
  if (sawContent || field !== '' || row.length > 0) {
    addRow();
  }

  const [header, ...values] = rows;
  if (header === undefined || header.length === 0) {
    fail('CSV table has no header.');
  }

  const columns = header.map((column) => column.replace(/^\uFEFF/, '').trim());
  if (new Set(columns).size !== columns.length || columns.some((column) => column === '')) {
    fail('CSV header contains duplicate or empty columns.');
  }

  return values.map((valuesRow, rowIndex) => {
    if (valuesRow.length !== columns.length) {
      fail(`CSV row ${rowIndex + 2} has ${valuesRow.length} fields; expected ${columns.length}.`);
    }

    return Object.fromEntries(
      columns.map((column, columnIndex) => [column, valuesRow[columnIndex] ?? '']),
    );
  });
}

/** Read one little-endian 16-bit value from ZIP metadata. */
function unsigned16(bytes: Uint8Array, offset: number): number {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint16(offset, true);
}

/** Read one little-endian 32-bit value from ZIP metadata. */
function unsigned32(bytes: Uint8Array, offset: number): number {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(offset, true);
}

/**
 * Find the final ZIP directory marker, allowing for the format's optional 65,535-byte comment.
 *
 * This small reader intentionally supports only the conventional ZIP layout used by the verified
 * CTAN archive; a future source that needs ZIP64 should introduce that support with a fixture.
 */
function findEndOfCentralDirectory(bytes: Uint8Array): number {
  const earliestOffset = Math.max(0, bytes.length - 65_557);

  for (let offset = bytes.length - 22; offset >= earliestOffset; offset -= 1) {
    if (unsigned32(bytes, offset) === 0x06054b50) {
      return offset;
    }
  }

  fail('ZIP archive has no end-of-central-directory record.');
}

/**
 * Read stored and deflated UTF-8 files from the flat GTFS ZIP archive.
 *
 * The snapshot generator needs only named text tables, so this avoids adding a general ZIP
 * dependency while rejecting compression methods and duplicate paths it cannot interpret safely.
 */
export function readZipTextFiles(bytes: Uint8Array): Map<string, string> {
  const decoder = new TextDecoder('utf-8', { fatal: true });
  const endOffset = findEndOfCentralDirectory(bytes);
  const entryCount = unsigned16(bytes, endOffset + 10);
  let offset = unsigned32(bytes, endOffset + 16);
  const files = new Map<string, string>();

  for (let entryIndex = 0; entryIndex < entryCount; entryIndex += 1) {
    if (unsigned32(bytes, offset) !== 0x02014b50) {
      fail('ZIP archive has an invalid central-directory record.');
    }

    const compression = unsigned16(bytes, offset + 10);
    const compressedSize = unsigned32(bytes, offset + 20);
    const uncompressedSize = unsigned32(bytes, offset + 24);
    const filenameLength = unsigned16(bytes, offset + 28);
    const extraLength = unsigned16(bytes, offset + 30);
    const commentLength = unsigned16(bytes, offset + 32);
    const localOffset = unsigned32(bytes, offset + 42);
    const nameStart = offset + 46;
    const filename = decoder.decode(bytes.subarray(nameStart, nameStart + filenameLength));

    if (unsigned32(bytes, localOffset) !== 0x04034b50) {
      fail(`ZIP entry ${filename} has an invalid local-file record.`);
    }

    const localFilenameLength = unsigned16(bytes, localOffset + 26);
    const localExtraLength = unsigned16(bytes, localOffset + 28);
    const dataStart = localOffset + 30 + localFilenameLength + localExtraLength;
    const compressed = bytes.subarray(dataStart, dataStart + compressedSize);
    const contents =
      compression === 0
        ? compressed
        : compression === 8
          ? inflateRawSync(compressed)
          : fail(`ZIP entry ${filename} uses unsupported compression method ${compression}.`);

    if (contents.byteLength !== uncompressedSize) {
      fail(`ZIP entry ${filename} has an unexpected uncompressed size.`);
    }
    if (files.has(filename)) {
      fail(`ZIP archive contains duplicate entry ${filename}.`);
    }

    files.set(filename, decoder.decode(contents));
    offset += 46 + filenameLength + extraLength + commentLength;
  }

  return files;
}

/** Parse a required GTFS table and retain its filename when CSV parsing fails. */
export function readGtfsTable(files: ReadonlyMap<string, string>, filename: string): CsvRow[] {
  const contents = files.get(filename);
  if (contents === undefined) {
    fail(`archive does not contain ${filename}.`);
  }

  try {
    return parseCsv(contents);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`${filename}: ${message}`, { cause: error });
  }
}
