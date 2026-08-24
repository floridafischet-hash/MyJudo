import { strToU8, zipSync } from 'fflate';

// Builds a minimal, macro-free XLSX buffer whose header row and data cells
// are all styled with the "reference green" fill the DokuMe import parser
// requires (see member-import.parser.ts / greenStyles). Used by tests that
// need a synthetic green workbook without shipping a binary fixture file.
export function buildGreenWorkbook(headers: string[], dataRows: string[][]): Buffer {
  const columnLetter = (index: number) => String.fromCharCode(65 + index);
  const cellXml = (col: number, row: number, value: string) =>
    `<c r="${columnLetter(col)}${row}" s="1" t="str"><v>${value
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')}</v></c>`;
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
      '<styleSheet><fills count="2">' +
        '<fill><patternFill patternType="none"/></fill>' +
        '<fill><patternFill patternType="solid"><fgColor rgb="FF9BBB59"/><bgColor indexed="64"/></patternFill></fill>' +
        '</fills><cellXfs count="2"><xf fillId="0"/><xf fillId="1"/></cellXfs></styleSheet>',
    ),
    'xl/worksheets/sheet1.xml': strToU8(
      `<worksheet><sheetData>${sheetRows}</sheetData></worksheet>`,
    ),
  };
  return Buffer.from(zipSync(files));
}
