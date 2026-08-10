import { parseNjvIcs } from './njv-calendar-sync.service';

describe('parseNjvIcs', () => {
  it('parses official-style events without trusting unsafe URLs', () => {
    const events = parseNjvIcs(`BEGIN:VCALENDAR\r
VERSION:2.0\r
BEGIN:VEVENT\r
UID:njv-123\r
DTSTART:20260906T090000Z\r
DTEND:20260906T120000Z\r
SUMMARY:LMM U15\r
DESCRIPTION:NJV Termin\r
LOCATION:Hannover\r
URL:javascript:alert(1)\r
END:VEVENT\r
END:VCALENDAR\r
`);
    expect(events).toEqual([
      expect.objectContaining({
        uid: 'njv-123',
        title: 'LMM U15',
        location: 'Hannover',
        sourceUrl: null,
        allDay: false,
      }),
    ]);
  });

  it('rejects events with an invalid time range', () => {
    expect(() =>
      parseNjvIcs(`BEGIN:VCALENDAR\r
VERSION:2.0\r
BEGIN:VEVENT\r
UID:invalid\r
DTSTART:20260906T120000Z\r
DTEND:20260906T090000Z\r
SUMMARY:Ungültig\r
END:VEVENT\r
END:VCALENDAR\r
`),
    ).toThrow('Invalid event');
  });
});
