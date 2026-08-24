import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateProjectDto } from './dto/project.dto';

describe('CreateProjectDto', () => {
  it('accepts initial checklists and validates their items', async () => {
    const dto = plainToInstance(CreateProjectDto, {
      title: 'Turniervorbereitung',
      status: 'active',
      members: [],
      initialChecklists: [
        {
          title: 'Organisation',
          items: ['Halle buchen', 'Matten organisieren'],
        },
      ],
    });

    await expect(validate(dto)).resolves.toEqual([]);
  });

  it('rejects an empty initial checklist title', async () => {
    const dto = plainToInstance(CreateProjectDto, {
      title: 'Turniervorbereitung',
      status: 'active',
      members: [],
      initialChecklists: [{ title: '', items: ['Halle buchen'] }],
    });

    expect(await validate(dto)).not.toHaveLength(0);
  });
});
