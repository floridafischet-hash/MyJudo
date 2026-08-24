import { REQUIRED_PERMISSIONS } from '../rbac/permissions.decorator';
import { AdminChatController } from './admin-chat.controller';

describe('AdminChatController authorization', () => {
  it('requires the existing server-side admin permission for every action', () => {
    expect(Reflect.getMetadata(REQUIRED_PERMISSIONS, AdminChatController)).toEqual([
      'roles.manage',
    ]);
  });
});
