import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { detectDownload, DownloadsService } from './downloads.service';
import { zipSync, strToU8 } from 'fflate';
describe('DownloadsService authorization', () => {
  it('filters visible downloads by user, group and role on the server', async () => {
    const query = jest.fn().mockResolvedValue([]);
    const service = new DownloadsService(
      { query } as unknown as DataSource,
      { get: jest.fn() } as unknown as ConfigService,
    );
    await service.list({ id: 'user-1', organizationId: 'org-1', authorizationVersion: 0 });
    const [sql, args] = query.mock.calls[0] as [string, string[]];
    expect(sql).toContain('download_groups');
    expect(sql).toContain('download_roles');
    expect(sql).toContain('download_users');
    expect(args).toEqual(['org-1', 'user-1']);
  });

  it('binds only the organization parameter for the admin list', async () => {
    const query = jest.fn().mockResolvedValue([]);
    const service = new DownloadsService(
      { query } as unknown as DataSource,
      { get: jest.fn() } as unknown as ConfigService,
    );
    await service.list({ id: 'admin-1', organizationId: 'org-1', authorizationVersion: 0 }, true);
    const [sql, args] = query.mock.calls[0] as [string, string[]];
    expect(sql).not.toContain('x."userId"=$2');
    expect(args).toEqual(['org-1']);
  });
});

describe('download content validation', () => {
  it('accepts matching PDF and Office signatures', () => {
    expect(detectDownload(Buffer.from('%PDF-1.7\n'), 'graduierung.pdf')).toBe('application/pdf');
    const docx = Buffer.from(
      zipSync({ '[Content_Types].xml': strToU8('<Types/>'), 'word/document.xml': strToU8('<w/>') }),
    );
    expect(detectDownload(docx, 'formular.docx')).toContain('wordprocessingml');
  });

  it('rejects executable or extension-mismatched content', () => {
    expect(detectDownload(Buffer.from('MZ executable'), 'angriff.pdf')).toBeNull();
    expect(detectDownload(Buffer.from('%PDF-1.7'), 'angriff.jpg')).toBeNull();
  });
});
