import { CalendarMeetingProvider } from './calendar-event.entity';
import { meetingHostMatchesProvider } from './calendar-meeting.validation';

describe('meetingHostMatchesProvider', () => {
  it('accepts a genuine Google Meet link for the Google Meet provider', () => {
    expect(
      meetingHostMatchesProvider(
        'https://meet.google.com/abc-defg-hij',
        CalendarMeetingProvider.GoogleMeet,
      ),
    ).toBe(true);
  });

  it('rejects a non-Google-Meet host labelled as Google Meet', () => {
    expect(
      meetingHostMatchesProvider('https://evil.example/abc', CalendarMeetingProvider.GoogleMeet),
    ).toBe(false);
  });

  it('accepts genuine Microsoft Teams links', () => {
    expect(
      meetingHostMatchesProvider(
        'https://teams.microsoft.com/l/meetup-join/abc',
        CalendarMeetingProvider.MicrosoftTeams,
      ),
    ).toBe(true);
    expect(
      meetingHostMatchesProvider(
        'https://teams.live.com/meet/123',
        CalendarMeetingProvider.MicrosoftTeams,
      ),
    ).toBe(true);
  });

  it('rejects a Google Meet link labelled as Microsoft Teams', () => {
    expect(
      meetingHostMatchesProvider(
        'https://meet.google.com/abc-defg-hij',
        CalendarMeetingProvider.MicrosoftTeams,
      ),
    ).toBe(false);
  });

  it('accepts any well-formed https host for the generic "other" provider', () => {
    expect(
      meetingHostMatchesProvider('https://meet.jit.si/some-room', CalendarMeetingProvider.Other),
    ).toBe(true);
  });

  it('rejects a malformed URL', () => {
    expect(meetingHostMatchesProvider('not a url', CalendarMeetingProvider.Other)).toBe(false);
  });
});
