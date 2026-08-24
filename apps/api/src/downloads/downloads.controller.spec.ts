import { REQUIRED_PERMISSIONS } from '../rbac/permissions.decorator';
import { DownloadsController } from './downloads.controller';
describe('DownloadsController', () => {
  it('protects administrative upload and deletion server-side', () => {
    expect(Reflect.getMetadata(REQUIRED_PERMISSIONS, DownloadsController.prototype.create)).toEqual(
      ['roles.manage'],
    );
    expect(Reflect.getMetadata(REQUIRED_PERMISSIONS, DownloadsController.prototype.remove)).toEqual(
      ['roles.manage'],
    );
  });
});
