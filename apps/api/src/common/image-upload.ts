import { BadRequestException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { mkdir, readFile, unlink, writeFile } from 'fs/promises';
import { join } from 'path';

const EXTENSION_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};
const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp'];

export function detectImageMime(buffer: Buffer): string | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff)
    return 'image/jpeg';
  if (
    buffer.length >= 8 &&
    buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  )
    return 'image/png';
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString() === 'RIFF' &&
    buffer.subarray(8, 12).toString() === 'WEBP'
  )
    return 'image/webp';
  return null;
}

/** Validates an uploaded image against a size limit, extension allow-list and magic bytes. */
export function resolveImageUpload(
  file: Express.Multer.File | undefined,
  maxBytes: number,
): { mime: string; extension: string } {
  if (!file?.buffer?.length) throw new BadRequestException('Bilddatei fehlt.');
  if (file.buffer.length > maxBytes)
    throw new BadRequestException(
      `Das Bild ist zu groß. Maximal erlaubt sind ${Math.round(maxBytes / (1024 * 1024))} MB.`,
    );
  const originalExtension = file.originalname.split('.').pop()?.toLowerCase();
  if (!originalExtension || !ALLOWED_EXTENSIONS.includes(originalExtension))
    throw new BadRequestException('Erlaubt sind nur JPG-, PNG- und WEBP-Bilder.');
  const mime = detectImageMime(file.buffer);
  if (!mime) throw new BadRequestException('Ungültige Bilddatei.');
  const extension = EXTENSION_BY_MIME[mime]!;
  const extensionMatchesMime =
    (mime === 'image/jpeg' && ['jpg', 'jpeg'].includes(originalExtension)) ||
    originalExtension === extension;
  if (!extensionMatchesMime)
    throw new BadRequestException('Dateiendung und Bildinhalt stimmen nicht überein.');
  return { mime, extension };
}

export async function storeImage(root: string, buffer: Buffer, extension: string): Promise<string> {
  const stored = `${randomUUID()}.${extension}`;
  await mkdir(root, { recursive: true });
  await writeFile(join(root, stored), buffer);
  return stored;
}

export function readImage(root: string, storedName: string): Promise<Buffer> {
  return readFile(join(root, storedName));
}

export async function deleteImage(root: string, storedName: string | null | undefined): Promise<void> {
  if (!storedName) return;
  await unlink(join(root, storedName)).catch(() => undefined);
}
