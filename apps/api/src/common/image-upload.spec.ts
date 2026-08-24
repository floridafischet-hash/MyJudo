import { BadRequestException } from '@nestjs/common';
import { resolveImageUpload } from './image-upload';

function upload(originalname: string, buffer: Buffer): Express.Multer.File {
  return { originalname, buffer, size: buffer.length } as Express.Multer.File;
}

describe('image upload validation', () => {
  it('rejects content without a supported image signature', () => {
    expect(() =>
      resolveImageUpload(upload('avatar.png', Buffer.from('not an image')), 1024),
    ).toThrow(BadRequestException);
  });

  it('rejects a mismatch between extension and detected content', () => {
    const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
    expect(() => resolveImageUpload(upload('avatar.jpg', png), 1024)).toThrow(
      'Dateiendung und Bildinhalt stimmen nicht überein.',
    );
  });

  it('rejects an image larger than the configured limit', () => {
    const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(10)]);
    expect(() => resolveImageUpload(upload('avatar.jpg', jpeg), 12)).toThrow(
      'Das Bild ist zu groß.',
    );
  });
});
