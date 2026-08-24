import { BadRequestException } from '@nestjs/common';
import { strFromU8, unzipSync } from 'fflate';

export const importFields = [
  'graduations',
  'highestGraduation',
  'lastGraduationDate',
  'graduationsThisYear',
  'firstName',
  'lastName',
  'gender',
  'email',
  'phone',
  'birthDate',
  'street',
  'postalCode',
  'city',
  'country',
  'nationality',
] as const;
export type ImportField = (typeof importFields)[number];
export type ImportPerson = Record<ImportField, string | number | null> & {
  sourceRow: number;
  graduations: string | null;
  warnings: string[];
};

// Maps normalized header text (see normalizeHeader) to the internal field it
// represents. Existing keys must never change meaning or be removed - only
// add synonyms - so previously working imports keep matching identically.
const headers: Record<string, ImportField> = {
  hochstegraduierung: 'highestGraduation',
  hoechstegraduierung: 'highestGraduation',
  aktuellegraduierung: 'highestGraduation',
  aktuellergrad: 'highestGraduation',
  aktuellerguertel: 'highestGraduation',
  aktuellergurtel: 'highestGraduation',
  guertel: 'highestGraduation',
  gurtel: 'highestGraduation',
  grad: 'highestGraduation',
  graduierung: 'highestGraduation',
  belt: 'highestGraduation',
  currentbelt: 'highestGraduation',
  currentgrade: 'highestGraduation',

  letztegraduierung: 'lastGraduationDate',
  letzteguertelpruefung: 'lastGraduationDate',
  letzteprufung: 'lastGraduationDate',
  letztepruefung: 'lastGraduationDate',
  datumletzteprufung: 'lastGraduationDate',
  prufungsdatum: 'lastGraduationDate',
  pruefungsdatum: 'lastGraduationDate',
  lastgraduationdate: 'lastGraduationDate',
  lastexamdate: 'lastGraduationDate',
  lastbeltexam: 'lastGraduationDate',

  graduierungendiesesjahr: 'graduationsThisYear',
  prufungenimjahr: 'graduationsThisYear',
  pruefungenimjahr: 'graduationsThisYear',
  prufungenaktuellesjahr: 'graduationsThisYear',
  pruefungenaktuellesjahr: 'graduationsThisYear',
  prufungendiesesjahr: 'graduationsThisYear',
  pruefungendiesesjahr: 'graduationsThisYear',
  graduationsthisyear: 'graduationsThisYear',
  examsthisyear: 'graduationsThisYear',

  vorname: 'firstName',
  firstname: 'firstName',
  nachname: 'lastName',
  lastname: 'lastName',
  surname: 'lastName',
  geschlecht: 'gender',
  gender: 'gender',
  email: 'email',
  emailadresse: 'email',
  mail: 'email',
  telefon: 'phone',
  telefonnummer: 'phone',
  phone: 'phone',
  mobil: 'phone',
  mobile: 'phone',
  geburtsdatum: 'birthDate',
  geburtstag: 'birthDate',
  birthdate: 'birthDate',
  dateofbirth: 'birthDate',
  strasse: 'street',
  street: 'street',
  plz: 'postalCode',
  postleitzahl: 'postalCode',
  postalcode: 'postalCode',
  zip: 'postalCode',
  zipcode: 'postalCode',
  ort: 'city',
  stadt: 'city',
  city: 'city',
  land: 'country',
  country: 'country',
  nationalitat: 'nationality',
  staatsangehorigkeit: 'nationality',
  nationality: 'nationality',
};

export interface ParsedMemberWorkbook {
  sheetNames: string[];
  recognizedFields: ImportField[];
  ignoredFields: string[];
  unknownGreenFields: string[];
  missingFields: ImportField[];
  formatMatches: boolean;
  green: { styleIds: number[]; colors: string[] };
  rows: ImportPerson[];
}

export function parseMemberWorkbook(buffer: Buffer): ParsedMemberWorkbook {
  if (buffer.length > 10 * 1024 * 1024)
    throw new BadRequestException('Die Datei ist größer als 10 MB.');
  let zip: Record<string, Uint8Array>;
  try {
    zip = unzipSync(buffer);
  } catch {
    throw new BadRequestException('Ungültige XLSX-Datei.');
  }
  const required = ['[Content_Types].xml', 'xl/workbook.xml', 'xl/styles.xml'];
  if (required.some((name) => !zip[name]) || zip['xl/vbaProject.bin'])
    throw new BadRequestException('Nur makrofreie XLSX-Dateien sind erlaubt.');
  const workbook = xml(zip, 'xl/workbook.xml');
  const sheetNames = [...workbook.matchAll(/<sheet\b[^>]*name="([^"]+)"/g)].map((m) =>
    decode(m[1]!),
  );
  const strings = sharedStrings(xml(zip, 'xl/sharedStrings.xml', true));
  const styles = xml(zip, 'xl/styles.xml');
  const theme = xml(zip, 'xl/theme/theme1.xml', true);
  const green = greenStyles(styles, theme);
  const sheetName = Object.keys(zip).find((name) => /^xl\/worksheets\/sheet\d+\.xml$/.test(name));
  if (!sheetName)
    throw new BadRequestException('Die Arbeitsmappe enthält kein lesbares Tabellenblatt.');
  const sheet = xml(zip, sheetName);
  const columnStyles = columnDefaultStyles(sheet);
  const cells = parseCells(sheet, strings, columnStyles);
  const headerCells = cells.filter((cell) => cell.row === 1);
  const columns = new Map<string, ImportField>();
  const ignoredFields: string[] = [];
  const unknownGreenFields: string[] = [];
  for (const cell of headerCells) {
    const field = headers[normalizeHeader(cell.value)];
    if (green.styleIds.includes(cell.style) && field) columns.set(cell.column, field);
    else if (!green.styleIds.includes(cell.style) && cell.value) ignoredFields.push(cell.value);
    else if (green.styleIds.includes(cell.style) && !field)
      unknownGreenFields.push(cell.value || cell.column);
  }
  // DokuMe exports omit H1. Accept this only when the green column contains a
  // plausible comma-separated belt/pass/qualification history.
  for (const column of unique(
    cells.filter((c) => c.row > 1 && green.styleIds.includes(c.style)).map((c) => c.column),
  )) {
    if (columns.has(column)) continue;
    const values = cells.filter((c) => c.column === column && c.row > 1).map((c) => c.value);
    if (values.some(isGraduationHistory)) columns.set(column, 'graduations');
    else unknownGreenFields.push(column);
  }
  const rows: ImportPerson[] = [];
  for (const rowNumber of unique(cells.filter((c) => c.row > 1).map((c) => c.row))) {
    const raw = new Map(cells.filter((c) => c.row === rowNumber).map((c) => [c.column, c]));
    const person = Object.fromEntries(
      importFields.map((field) => [field, null]),
    ) as unknown as ImportPerson;
    person.sourceRow = rowNumber;
    person.warnings = [];
    for (const [column, field] of columns) {
      const cell = raw.get(column);
      if (!cell || !green.styleIds.includes(cell.style)) continue;
      let value: string | number | null = clean(cell.value);
      if (field === 'birthDate' || field === 'lastGraduationDate') {
        const original = value;
        value = parseGermanDate(value);
        if (original !== null && value === null)
          person.warnings.push(`${field}: ungültiges Datum „${original}“ wurde nicht übernommen.`);
      }
      if (field === 'graduationsThisYear') {
        const number = value === null ? null : Number(value);
        if (number !== null && (!Number.isInteger(number) || number < 0)) {
          person.warnings.push(
            `Graduierungen dieses Jahr: ungültiger Wert „${value}“ wurde nicht übernommen.`,
          );
          value = null;
        } else value = number;
      }
      if (field === 'phone' && cell.type !== 's' && value !== null)
        person.warnings.push(
          'Telefonnummer war numerisch gespeichert; eine führende Null kann fehlen.',
        );
      (person as unknown as Record<string, unknown>)[field] = value;
    }
    if (person.graduations) {
      const currentFromHistory =
        splitAchievements(String(person.graduations)).graduations[0]?.label ?? null;
      if (!person.highestGraduation) {
        person.highestGraduation = currentFromHistory;
      } else if (
        currentFromHistory &&
        currentFromHistory.trim().toLowerCase() !==
          String(person.highestGraduation).trim().toLowerCase()
      ) {
        person.warnings.push(
          `highestGraduation: Spaltenwert „${person.highestGraduation}“ weicht von der Prüfungshistorie („${currentFromHistory}“) ab.`,
        );
      }
    }
    if (person.firstName || person.lastName) rows.push(person);
  }
  const recognizedFields = unique([...columns.values()]);
  const missingFields = importFields.filter((field) => !recognizedFields.includes(field));
  return {
    sheetNames,
    recognizedFields,
    ignoredFields: unique(ignoredFields),
    unknownGreenFields: unique(unknownGreenFields),
    missingFields,
    formatMatches:
      sheetNames.includes('DokuMe Sheet') &&
      green.colors.includes('9BBB59') &&
      recognizedFields.includes('firstName') &&
      recognizedFields.includes('lastName') &&
      recognizedFields.includes('birthDate') &&
      unknownGreenFields.length === 0,
    green,
    rows,
  };
}

export function splitAchievements(value: string | null) {
  const graduations: Array<{ label: string; reference: string | null }> = [];
  const qualifications: Array<{ label: string; reference: string | null }> = [];
  for (const part of value
    ?.split(',')
    .map((x) => x.trim())
    .filter(Boolean) ?? []) {
    const match = part.match(/^(.*?)\s*\(([^()]*)\)$/);
    const label = (match?.[1] ?? part).trim();
    const entry = { label, reference: match?.[2]?.trim() ?? null };
    (/\b(?:[1-8]\.?\s*Kyu|[1-9]\.?\s*Dan)\b/i.test(label) ? graduations : qualifications).push(
      entry,
    );
  }
  return { graduations, qualifications };
}

type Cell = { column: string; row: number; style: number; value: string; type: string };
function xml(zip: Record<string, Uint8Array>, name: string, optional = false) {
  if (!zip[name]) {
    if (optional) return '';
    throw new BadRequestException(`XLSX-Struktur fehlt: ${name}`);
  }
  return strFromU8(zip[name]);
}
function sharedStrings(value: string) {
  return [...value.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) =>
    [...m[1]!.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((x) => decode(x[1]!)).join(''),
  );
}
function greenStyles(styles: string, theme: string) {
  const scheme = [
    ...theme.matchAll(
      /<a:(\w+)>\s*<(?:a:)?(?:srgbClr[^>]*val|sysClr[^>]*lastClr)="([0-9A-Fa-f]{6})"/g,
    ),
  ].map((m) => [m[1]!, m[2]!.toUpperCase()] as const);
  const themeOrder = [
    'dk1',
    'lt1',
    'dk2',
    'lt2',
    'accent1',
    'accent2',
    'accent3',
    'accent4',
    'accent5',
    'accent6',
    'hlink',
    'folHlink',
  ];
  const fills = [
    ...(styles.match(/<fills[^>]*>([\s\S]*?)<\/fills>/)?.[1] ?? '').matchAll(
      /<fill>([\s\S]*?)<\/fill>/g,
    ),
  ].map((m) => m[1]!);
  const greenFillIds: number[] = [];
  const colors: string[] = [];
  fills.forEach((fill, index) => {
    if (!/patternType="solid"/.test(fill)) return;
    const rgb = fill.match(/<fgColor[^>]*rgb="(?:FF)?([0-9A-Fa-f]{6})"/)?.[1]?.toUpperCase();
    const themeIndex = Number(fill.match(/<fgColor[^>]*theme="(\d+)"/)?.[1]);
    const resolved = rgb ?? scheme.find(([name]) => name === themeOrder[themeIndex])?.[1];
    if (resolved && isReferenceGreen(resolved)) {
      greenFillIds.push(index);
      colors.push(resolved);
    }
  });
  const xfs = [
    ...(styles.match(/<cellXfs[^>]*>([\s\S]*?)<\/cellXfs>/)?.[1] ?? '').matchAll(
      /<xf\b([^>]*)\/?>(?:[\s\S]*?<\/xf>)?/g,
    ),
  ].map((m) => Number(m[1]!.match(/fillId="(\d+)"/)?.[1] ?? 0));
  return {
    styleIds: xfs
      .map((fill, index) => (greenFillIds.includes(fill) ? index : -1))
      .filter((x) => x >= 0),
    colors: unique(colors),
  };
}
function isReferenceGreen(rgb: string) {
  const r = parseInt(rgb.slice(0, 2), 16),
    g = parseInt(rgb.slice(2, 4), 16),
    b = parseInt(rgb.slice(4, 6), 16);
  return g > r * 1.05 && g > b * 1.15 && r >= 120 && g >= 140 && b <= 140;
}
function columnDefaultStyles(sheet: string) {
  const result = new Map<number, number>();
  for (const m of sheet.matchAll(/<col\b([^>]*)\/?>(?:<\/col>)?/g)) {
    const attrs = m[1]!;
    const min = Number(attrs.match(/min="(\d+)"/)?.[1]),
      max = Number(attrs.match(/max="(\d+)"/)?.[1]);
    const style = Number(attrs.match(/style="(\d+)"/)?.[1] ?? 0);
    for (let i = min; i <= max; i++) result.set(i, style);
  }
  return result;
}
function parseCells(sheet: string, strings: string[], defaults: Map<number, number>): Cell[] {
  const result: Cell[] = [];
  for (const m of sheet.matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)) {
    const attrs = m[1]!,
      body = m[2]!;
    const ref = attrs.match(/r="([A-Z]+)(\d+)"/);
    if (!ref) continue;
    const type = attrs.match(/t="([^"]+)"/)?.[1] ?? 'n';
    const raw = body.match(/<v>([\s\S]*?)<\/v>/)?.[1] ?? '';
    const column = ref[1]!;
    const colIndex = [...column].reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0);
    result.push({
      column,
      row: Number(ref[2]!),
      style: Number(attrs.match(/s="(\d+)"/)?.[1] ?? defaults.get(colIndex) ?? 0),
      type,
      value: type === 's' ? (strings[Number(raw)] ?? '') : decode(raw),
    });
  }
  return result;
}
function normalizeHeader(v: string) {
  return v
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]/g, '');
}
function clean(v: string): string | null {
  const x = v.trim();
  return !x || x === '-' || x.toLowerCase() === 'null' ? null : x;
}
function parseGermanDate(v: string | number | null): string | null {
  if (v === null) return null;
  const m = String(v).match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (!m) return null;
  const day = m[1]!,
    month = m[2]!,
    year = m[3]!;
  const d = new Date(Date.UTC(+year, +month - 1, +day));
  return d.getUTCFullYear() === +year && d.getUTCMonth() === +month - 1 && d.getUTCDate() === +day
    ? `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
    : null;
}
function isGraduationHistory(v: string) {
  return v.includes(',') && /(?:Kyu|Dan|Judopass|Graduierungslizenz)/i.test(v);
}
function decode(v: string) {
  return v
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}
function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}
