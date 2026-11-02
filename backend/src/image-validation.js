export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const MAX_BASE64_LENGTH = Math.ceil(MAX_IMAGE_BYTES / 3) * 4;
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

export function parseImage(base64) {
  if (typeof base64 !== 'string' || base64.length > MAX_BASE64_LENGTH) return null;
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) return null;

  const data = Buffer.from(base64, 'base64');
  if (!data.length || data.length > MAX_IMAGE_BYTES || data.toString('base64') !== base64) return null;

  if (data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return { data, mime: 'image/jpeg' };
  if (data.subarray(0, 8).equals(PNG_SIGNATURE)) return { data, mime: 'image/png' };
  return null;
}
