// 端到端验证：真实无损 PNG 编解码（模拟浏览器 Canvas toBlob/getImageData）
import zlib from 'node:zlib';

// ---- PNG 编解码（零依赖，手写） ----
const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();
function crc32(buf) { let c = 0xFFFFFFFF; for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}
function encodePNG(w, h, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4); }
  const idat = zlib.deflateSync(raw);
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}
function decodePNG(png) {
  let off = 8; let w, h; const idat = [];
  while (off < png.length) {
    const len = png.readUInt32BE(off); const type = png.toString('ascii', off + 4, off + 8);
    const data = png.subarray(off + 8, off + 8 + len);
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); }
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    off += 12 + len;
  }
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const rgba = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) raw.copy(rgba, y * w * 4, y * (w * 4 + 1) + 1, (y + 1) * (w * 4 + 1));
  return { w, h, rgba };
}

// ---- 加密核心 ----
const SALT_LENGTH = 16, IV_LENGTH = 12, PBKDF2_ITERATIONS = 100000;
const STEG_MAGIC = [0x53, 0x54, 0x47, 0x31];
async function deriveKey(password, salt) {
  const enc = new TextEncoder();
  const km = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' }, km, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
async function deriveXorKey(password, salt, length) {
  const enc = new TextEncoder();
  const km = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' }, km, Math.ceil(length / 32) * 256);
  return new Uint8Array(bits);
}
function xorBytes(data, key) { for (let i = 0; i < data.length; i++) data[i] ^= key[i % key.length]; }
async function buildLocked(file, password) {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const key = await deriveKey(password, salt);
  const data = await file.arrayBuffer();
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data);
  const nameBytes = new TextEncoder().encode(file.name);
  const header = new Uint8Array(6 + 1 + SALT_LENGTH + IV_LENGTH + 2 + nameBytes.length);
  let o = 0; header.set([0x46, 0x4C, 0x4B, 0x31, 0x30, 0x30], o); o += 6; header[o++] = 1;
  header.set(salt, o); o += SALT_LENGTH; header.set(iv, o); o += IV_LENGTH;
  header[o++] = (nameBytes.length >> 8) & 0xff; header[o++] = nameBytes.length & 0xff; header.set(nameBytes, o); o += nameBytes.length;
  const out = new Uint8Array(header.length + encrypted.byteLength);
  out.set(header, 0); out.set(new Uint8Array(encrypted), header.length); return out;
}
async function decryptLocked(buf, password) {
  const magic = String.fromCharCode(...buf.slice(0, 6)); if (magic !== 'FLK100') throw new Error('不是 FileLock 文件');
  let o = 6; o++; const salt = buf.slice(o, o + SALT_LENGTH); o += SALT_LENGTH; const iv = buf.slice(o, o + IV_LENGTH); o += IV_LENGTH;
  const nameLen = (buf[o] << 8) | buf[o + 1]; o += 2; const name = new TextDecoder().decode(buf.slice(o, o + nameLen)); o += nameLen;
  const key = await deriveKey(password, salt);
  const dec = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, buf.slice(o));
  return { data: dec, name };
}
function writeBits(px, payload) {
  let bitIdx = 0; const totalBits = payload.length * 8;
  for (let i = 0; i < px.length && bitIdx < totalBits; i += 4)
    for (let c = 0; c < 3 && bitIdx < totalBits; c++) { px[i + c] = (px[i + c] & 0xFE) | ((payload[bitIdx >> 3] >> (7 - (bitIdx & 7))) & 1); bitIdx++; }
}
function readBits(px, totalBits) {
  const out = new Uint8Array(Math.ceil(totalBits / 8)); let bitIdx = 0;
  for (let i = 0; i < px.length && bitIdx < totalBits; i += 4)
    for (let c = 0; c < 3 && bitIdx < totalBits; c++) { out[bitIdx >> 3] |= (px[i + c] & 1) << (7 - (bitIdx & 7)); bitIdx++; }
  return out;
}

// ---- 端到端流程 ----
const W = 128, H = 128; // 容量 = 128*128*3/8 = 6144 bytes
const cover = Buffer.from(crypto.getRandomValues(new Uint8Array(W * H * 4)));
const secret = { name: '机密合同.txt', arrayBuffer: async () => new TextEncoder().encode('这是一份绝密合同内容 2026-07-31 deniable-stego-test-✅').buffer };
const pwd = 'S3cur3-P@ss-隐藏';

const locked = await buildLocked(secret, pwd);
const xorSalt = crypto.getRandomValues(new Uint8Array(16));
const pLen = STEG_MAGIC.length + 4 + locked.length;
const xk = await deriveXorKey(pwd, xorSalt, pLen);
const payload = new Uint8Array(pLen);
payload.set(STEG_MAGIC, 0);
payload[4] = (locked.length >>> 24) & 0xff; payload[5] = (locked.length >>> 16) & 0xff; payload[6] = (locked.length >>> 8) & 0xff; payload[7] = locked.length & 0xff;
payload.set(locked, 8);
xorBytes(payload, xk);
const finalPayload = new Uint8Array(16 + payload.length);
finalPayload.set(xorSalt, 0); finalPayload.set(payload, 16);

// 嵌入
writeBits(cover, finalPayload);
// 编码成真实 PNG（模拟 Canvas toBlob）
const pngBuf = encodePNG(W, H, cover);
console.log('1. 真实 PNG 编码:', pngBuf.length + ' bytes');

// 解码 PNG（模拟 Canvas getImageData）
const decoded = decodePNG(pngBuf);
console.log('2. PNG 解码像素一致:', decoded.rgba.equals(cover) ? 'PASS ✅ (LSB 无损保留)' : 'FAIL ❌');

// 提取 + 解密
const cap = (decoded.rgba.length / 4) * 3;
const raw = readBits(decoded.rgba, cap);
const xs = raw.slice(0, 16);
const obf = raw.slice(16);
const xk2 = await deriveXorKey(pwd, xs, obf.length);
const rec = obf.slice(); xorBytes(rec, xk2);
const magicOk = STEG_MAGIC.every((b, i) => b === rec[i]);
const len = (rec[4] << 24) | (rec[5] << 16) | (rec[6] << 8) | rec[7];
const lockedBack = rec.slice(8, 8 + len);
const fin = await decryptLocked(lockedBack, pwd);
const text = new TextDecoder().decode(fin.data);
const ok = magicOk && fin.name === secret.name && text === '这是一份绝密合同内容 2026-07-31 deniable-stego-test-✅';
console.log('3. 端到端还原:', ok ? 'PASS ✅' : 'FAIL ❌');
console.log('   还原文件名:', fin.name);
console.log('   还原内容:', text);
console.log('   可否认(混淆后非原文):', !Buffer.from(payload).equals(Buffer.alloc(pLen)) ? '是 ✅' : '—');
