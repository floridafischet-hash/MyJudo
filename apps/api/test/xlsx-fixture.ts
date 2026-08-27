import { strToU8, zipSync } from 'fflate';

// Builds a minimal, macro-free XLSX buffer whose header row and data cells
// are all styled with the "reference green" fill the DokuMe import parser
// requires (see member-import.parser.ts / greenStyles). Used by tests that
// need a synthetic green workbook without shipping a binary fixture file.
export function buildGreenWorkbook(headers: string[], dataRows: string[][]): Buffer {
  return buildWorkbook(headers, dataRows, { greenCells: true });
}

export function buildWorkbook(
  headers: string[],
  dataRows: string[][],
  options: {
    greenCells?: boolean;
    inlineStrings?: boolean;
    includeUnusedGreenStyle?: boolean;
  } = {},
): Buffer {
  const columnLetter = (index: number) => String.fromCharCode(65 + index);
  const encode = (value: string) =>
    value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
  const cellXml = (col: number, row: number, value: string) => {
    const style = options.greenCells ? ' s="1"' : '';
    return options.inlineStrings
      ? `<c r="${columnLetter(col)}${row}"${style} t="inlineStr"><is><t>${encode(value)}</t></is></c>`
      : `<c r="${columnLetter(col)}${row}"${style} t="str"><v>${encode(value)}</v></c>`;
  };
  const rowXml = (values: string[], row: number) =>
    `<row r="${row}">${values.map((v, col) => cellXml(col, row, v)).join('')}</row>`;
  const sheetRows = [headers, ...dataRows]
    .map((values, index) => rowXml(values, index + 1))
    .join('');
  const files: Record<string, Uint8Array> = {
    '[Content_Types].xml': strToU8('<Types/>'),
    'xl/workbook.xml': strToU8(
      '<workbook><sheets><sheet name="DokuMe Sheet" sheetId="1" r:id="rId1"/></sheets></workbook>',
    ),
    'xl/styles.xml': strToU8(
      options.greenCells || options.includeUnusedGreenStyle
        ? '<styleSheet><fills count="2">' +
            '<fill><patternFill patternType="none"/></fill>' +
            '<fill><patternFill patternType="solid"><fgColor rgb="FF9BBB59"/><bgColor indexed="64"/></patternFill></fill>' +
            '</fills><cellXfs count="2"><xf fillId="0"/><xf fillId="1"/></cellXfs></styleSheet>'
        : '<styleSheet><fills count="1"><fill><patternFill patternType="none"/></fill></fills>' +
            '<cellXfs count="1"><xf fillId="0"/></cellXfs></styleSheet>',
    ),
    'xl/worksheets/sheet1.xml': strToU8(
      `<worksheet><sheetData>${sheetRows}</sheetData></worksheet>`,
    ),
  };
  return Buffer.from(zipSync(files));
}
