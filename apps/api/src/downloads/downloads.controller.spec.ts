import { REQUIRED_PERMISSIONS } from '../rbac/permissions.decorator';
import { DownloadsController } from './downloads.controller';
describe('DownloadsController', () => {
  it('protects administrative upload and deletion server-side', () => {
    // Decorator metadata is attached to the method function itself.
    expect(
      // eslint-disable-next-line @typescript-eslint/unbound-method
      Reflect.getMetadata(REQUIRED_PERMISSIONS, DownloadsController.prototype['create']),
    ).toEqual(['roles.manage']);
    expect(
      // eslint-disable-next-line @typescript-eslint/unbound-method
      Reflect.getMetadata(REQUIRED_PERMISSIONS, DownloadsController.prototype['remove']),
    ).toEqual(['roles.manage']);
  });
});
