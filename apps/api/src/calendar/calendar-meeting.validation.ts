import { CalendarMeetingProvider } from './calendar-event.entity';

// Known join-link hosts per provider. `null` means "any host is accepted"
// (the generic "other" provider), everything else is an allowlist so a
// mislabeled or spoofed link is rejected rather than trusted at face value.
const ALLOWED_HOSTS: Record<CalendarMeetingProvider, string[] | null> = {
  [CalendarMeetingProvider.GoogleMeet]: ['meet.google.com'],
  [CalendarMeetingProvider.MicrosoftTeams]: ['teams.microsoft.com', 'teams.live.com'],
  [CalendarMeetingProvider.Other]: null,
};

// Pure so it can be unit tested without standing up the service. The DTO
// already enforces "https URL, well-formed" via class-validator; this only
// checks the host against the selected provider.
export function meetingHostMatchesProvider(
  url: string,
  provider: CalendarMeetingProvider,
): boolean {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return false;
  }
  const hosts = ALLOWED_HOSTS[provider];
  return !hosts || hosts.includes(host);
}
