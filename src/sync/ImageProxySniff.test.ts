import { describe, it, expect } from 'vitest';
import { sniffImageMimeType } from '@/lib/mediaHeuristics';

describe('Image Proxy Magic Byte Sniffing', () => {
  it('correctly identifies JPEG magic bytes', () => {
    const jpegBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
    expect(sniffImageMimeType(jpegBytes)).toBe('image/jpeg');
  });

  it('correctly identifies PNG magic bytes', () => {
    const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(sniffImageMimeType(pngBytes)).toBe('image/png');
  });

  it('correctly identifies GIF magic bytes', () => {
    const gifBytes = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);
    expect(sniffImageMimeType(gifBytes)).toBe('image/gif');
  });

  it('correctly identifies WEBP magic bytes', () => {
    // 'RIFF' + 4 bytes size + 'WEBP'
    const webpBytes = new Uint8Array([
      0x52, 0x49, 0x46, 0x46,
      0x00, 0x00, 0x00, 0x00,
      0x57, 0x45, 0x42, 0x50
    ]);
    expect(sniffImageMimeType(webpBytes)).toBe('image/webp');
  });

  it('correctly identifies ICO magic bytes', () => {
    const icoBytes = new Uint8Array([0x00, 0x00, 0x01, 0x00]);
    expect(sniffImageMimeType(icoBytes)).toBe('image/x-icon');
  });

  it('correctly identifies AVIF magic bytes', () => {
    // 4 bytes size + 'ftyp' + 'avif'
    const avifBytes = new Uint8Array([
      0x00, 0x00, 0x00, 0x1c,
      0x66, 0x74, 0x79, 0x70,
      0x61, 0x76, 0x69, 0x66
    ]);
    expect(sniffImageMimeType(avifBytes)).toBe('image/avif');
  });

  it('correctly identifies SVG markup', () => {
    const svgBytes = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"></svg>');
    expect(sniffImageMimeType(svgBytes)).toBe('image/svg+xml');

    const xmlSvgBytes = new TextEncoder().encode('<?xml version="1.0"?><svg viewBox="0 0 10 10"></svg>');
    expect(sniffImageMimeType(xmlSvgBytes)).toBe('image/svg+xml');
  });

  it('returns null for unknown binary data so caller can fall back to image/jpeg', () => {
    const randomBytes = new Uint8Array([0x01, 0x02, 0x03, 0x04]);
    expect(sniffImageMimeType(randomBytes)).toBeNull();
  });
});
