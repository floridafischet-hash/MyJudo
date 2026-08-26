import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SaveCalendarEventDto } from './dto/calendar-event.dto';

describe('SaveCalendarEventDto without online meeting', () => {
  it('normalizes null meeting fields to undefined and validates successfully', async () => {
    const dto = plainToInstance(SaveCalendarEventDto, {
      title: 'Training',
      startsAt: '2026-08-26T18:00:00.000Z',
      endsAt: '2026-08-26T19:00:00.000Z',
      meetingProvider: null,
      meetingUrl: null,
      meetingNotes: null,
    });
    expect(await validate(dto)).toEqual([]);
    expect(dto.meetingProvider).toBeUndefined();
    expect(dto.meetingUrl).toBeUndefined();
    expect(dto.meetingNotes).toBeUndefined();
  });
});
