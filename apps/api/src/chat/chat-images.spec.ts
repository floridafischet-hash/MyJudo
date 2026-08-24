import { detectImage } from './chat.service';
describe('chat image validation', () => {
  it('accepts real JPEG, PNG and WEBP signatures', () => {
    expect(detectImage(Buffer.from([255, 216, 255, 0]))).toBe('image/jpeg');
    expect(detectImage(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))).toBe('image/png');
    expect(detectImage(Buffer.from('RIFFxxxxWEBP'))).toBe('image/webp');
  });
  it('rejects executable or disguised content', () => {
    expect(detectImage(Buffer.from('MZ executable'))).toBeNull();
    expect(detectImage(Buffer.from('<script>'))).toBeNull();
  });
});
