import { existsSync, readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { buildGreenWorkbook, buildWorkbook } from '../../test/xlsx-fixture';
import { parseMemberWorkbook, splitAchievements } from './member-import.parser';

describe('DokuMe green member workbook parser', () => {
  const inbound = '/home/jarvis/.openclaw/media/inbound';
  const fixture = existsSync(inbound)
    ? readdirSync(inbound).find((name) => name.startsWith('members_') && name.endsWith('.xlsx'))
    : undefined;

  (fixture ? it : it.skip)(
    'analyzes the provided reference workbook and imports only green fields',
    () => {
      const result = parseMemberWorkbook(readFileSync(join(inbound, fixture!)));
      expect(result.sheetNames).toEqual(['DokuMe Sheet']);
      expect(result.green).toEqual({ styleIds: [1], colors: ['9BBB59'] });
      expect(result.formatMatches).toBe(true);
      expect(result.rows).toHaveLength(4);
      expect(result.recognizedFields).toEqual(
        expect.arrayContaining([
          'graduations',
          'highestGraduation',
          'lastGraduationDate',
          'firstName',
          'lastName',
          'birthDate',
          'street',
          'postalCode',
          'nationality',
        ]),
      );
      expect(result.ignoredFields).toEqual(
        expect.arrayContaining(['ID', 'Verein', 'Landesverband']),
      );
      expect(result.rows[0]).toMatchObject({
        firstName: 'Maik',
        lastName: 'Kaden',
        birthDate: '1987-01-09',
        highestGraduation: '2. Dan - Schwarz',
        lastGraduationDate: '2023-02-05',
        phone: null,
        street: null,
      });
      expect(result.rows[2]).toMatchObject({
        firstName: 'Stefan',
        birthDate: '1990-08-24',
        postalCode: '27711',
        city: 'Osterholz-Scharmbeck',
      });
      expect(result.rows[1]?.warnings).toContain(
        'Telefonnummer war numerisch gespeichert; eine führende Null kann fehlen.',
      );
    },
  );

  it('separates belt graduations from qualifications and evidence', () => {
    const result = splitAchievements(
      'Judopass (J-1),8. Kyu - Weiß-Gelb (K-1),1. Dan - Schwarz (D-1),Ehrenkodex (E-1)',
    );
    expect(result.graduations.map((x) => x.label)).toEqual([
      '8. Kyu - Weiß-Gelb',
      '1. Dan - Schwarz',
    ]);
    expect(result.qualifications.map((x) => x.label)).toEqual(['Judopass', 'Ehrenkodex']);
  });
});

describe('synthetic green workbooks (header synonyms and history-derived grade)', () => {
  it('recognizes common alternate column headers alongside the original ones', () => {
    const buffer = buildGreenWorkbook(
      ['Vorname', 'Nachname', 'Geburtsdatum', 'Gürtel', 'Prüfungsdatum'],
      [['Anna', 'Beispiel', '01.02.2000', '1. Kyu - Braun', '10.03.2024']],
    );
    const result = parseMemberWorkbook(buffer);
    expect(result.recognizedFields).toEqual(
      expect.arrayContaining([
        'firstName',
        'lastName',
        'birthDate',
        'highestGraduation',
        'lastGraduationDate',
      ]),
    );
    expect(result.rows[0]).toMatchObject({
      firstName: 'Anna',
      lastName: 'Beispiel',
      highestGraduation: '1. Kyu - Braun',
      lastGraduationDate: '2024-03-10',
    });
  });

  it('derives the current grade from the graduation history when no explicit grade column exists', () => {
    const buffer = buildGreenWorkbook(
      ['Vorname', 'Nachname', 'Bisherige Gürtel'],
      [['Anna', 'Beispiel', 'Judopass (J-1),2. Kyu - Blau (K-2),3. Kyu - Grün (K-3)']],
    );
    const result = parseMemberWorkbook(buffer);
    expect(result.recognizedFields).toContain('graduations');
    expect(result.rows[0]?.highestGraduation).toBe('2. Kyu - Blau');
  });

  it('warns when the explicit grade column disagrees with the graduation history', () => {
    const buffer = buildGreenWorkbook(
      ['Vorname', 'Nachname', 'Höchste Graduierung', 'Bisherige Gürtel'],
      [['Anna', 'Beispiel', '1. Dan - Schwarz', 'Judopass (J-1),2. Kyu - Blau (K-2)']],
    );
    const result = parseMemberWorkbook(buffer);
    expect(result.rows[0]?.highestGraduation).toBe('1. Dan - Schwarz');
    expect(result.rows[0]?.warnings).toEqual([
      expect.stringContaining('weicht von der Prüfungshistorie'),
    ]);
  });
});

describe('plain workbook compatibility', () => {
  it('imports inline strings without green formatting', () => {
    const result = parseMemberWorkbook(
      buildWorkbook(
        ['Vorname', 'Nachname', 'Geburtsdatum', 'E-Mail'],
        [['Anna', 'Beispiel', '01.02.2000', 'anna@example.org']],
        { inlineStrings: true },
      ),
    );

    expect(result.recognizedFields).toEqual(
      expect.arrayContaining(['firstName', 'lastName', 'birthDate', 'email']),
    );
    expect(result.rows[0]).toMatchObject({
      firstName: 'Anna',
      lastName: 'Beispiel',
      birthDate: '2000-02-01',
      email: 'anna@example.org',
    });
  });

  it('ignores an unused green style and accepts Excel serial dates', () => {
    const result = parseMemberWorkbook(
      buildWorkbook(['Vorname', 'Nachname', 'Geburtsdatum'], [['Max', 'Mustermann', '36557']], {
        includeUnusedGreenStyle: true,
      }),
    );

    expect(result.green.styleIds).toEqual([1]);
    expect(result.recognizedFields).toEqual(
      expect.arrayContaining(['firstName', 'lastName', 'birthDate']),
    );
    expect(result.rows[0]).toMatchObject({
      firstName: 'Max',
      lastName: 'Mustermann',
      birthDate: '2000-02-01',
    });
  });
});
