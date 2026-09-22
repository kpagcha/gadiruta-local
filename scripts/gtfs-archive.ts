import { buffer } from 'node:stream/consumers';
import { parse } from 'csv-parse/sync';
import { fromBufferPromise, type Entry, type ZipFile } from 'yauzl';

/** A decoded GTFS CSV row keyed by its trimmed header names. */
export type CsvRow = Record<string, string>;

/** Throw a consistent data error when an archive cannot produce a trustworthy snapshot. */
function fail(message: string): never {
  throw new Error(`GTFS data error: ${message}`);
}

/** Convert an unknown caught value into the diagnostic text supplied by its source. */
function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Identify errors already annotated with the processor's GTFS data context. */
function isGtfsDataError(error: unknown): boolean {
  return error instanceof Error && error.message.startsWith('GTFS data error:');
}

/**
 * Convert CTAN's bare interior quotes into standard CSV quote escapes.
 *
 * A quote with ordinary field content on both sides cannot be a field boundary. This preserves
 * CTAN labels such as `"Oasis " Viveros " (V)"` without replacing CSV parsing itself.
 */
function repairCtanInteriorQuotes(text: string): string {
  return text.replaceAll(/(?<=[^",\r\n])"(?=[^",\r\n])/g, '""');
}

/**
 * Parse one GTFS CSV table into records keyed by trimmed header names.
 *
 * CSV parsing stays deliberately permissive only for CTAN's known interior-quote issue. Row
 * lengths and normalized headers are validated here so malformed tables cannot shift fields.
 */
export function parseCsv(text: string): CsvRow[] {
  let parsedRows: string[][];

  try {
    parsedRows = parse(repairCtanInteriorQuotes(text), {
      bom: true,
      relax_column_count: true,
      relax_quotes: true,
      skip_empty_lines: true,
    });
  } catch (error: unknown) {
    fail(`CSV parsing failed: ${errorMessage(error)}`);
  }

  const rows = parsedRows.filter((row) => row.some((value) => value !== ''));
  const [header, ...valueRows] = rows;
  if (header === undefined || header.length === 0) {
    fail('CSV table has no header.');
  }

  const columns = header.map((column) => column.trim());
  if (new Set(columns).size !== columns.length || columns.some((column) => column === '')) {
    fail('CSV header contains duplicate or empty columns.');
  }

  return valueRows.map((valuesRow, rowIndex) => {
    if (valuesRow.length !== columns.length) {
      fail(`CSV row ${rowIndex + 2} has ${valuesRow.length} fields; expected ${columns.length}.`);
    }

    return Object.fromEntries(columns.map((column, columnIndex) => [column, valuesRow[columnIndex] ?? '']));
  });
}

/** Read and strictly UTF-8 decode one ZIP entry while retaining the entry name in failures. */
async function readZipEntryText(archive: ZipFile, entry: Entry): Promise<string> {
  try {
    const contents = await buffer(await archive.openReadStreamPromise(entry));
    return new TextDecoder('utf-8', { fatal: true }).decode(contents);
  } catch (error: unknown) {
    fail(`ZIP entry ${entry.fileName} cannot be read: ${errorMessage(error)}`);
  }
}

/**
 * Read UTF-8 text entries from a GTFS ZIP archive, rejecting duplicate filenames.
 *
 * `yauzl` owns ZIP metadata, ZIP64, compression, size, and stream-integrity handling. This
 * module only retains the decoded files needed by the GTFS processor and its useful diagnostics.
 */
export async function readZipTextFiles(bytes: Uint8Array): Promise<Map<string, string>> {
  let archive: ZipFile;

  try {
    archive = await fromBufferPromise(Buffer.from(bytes), { validateEntrySizes: true });
  } catch (error: unknown) {
    fail(`could not open ZIP archive: ${errorMessage(error)}`);
  }

  const files = new Map<string, string>();
  try {
    for await (const entry of archive.eachEntry()) {
      if (files.has(entry.fileName)) {
        fail(`ZIP archive contains duplicate entry ${entry.fileName}.`);
      }

      files.set(entry.fileName, await readZipEntryText(archive, entry));
    }
  } catch (error: unknown) {
    if (isGtfsDataError(error)) {
      throw error;
    }
    fail(`could not read ZIP archive: ${errorMessage(error)}`);
  } finally {
    archive.close();
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
