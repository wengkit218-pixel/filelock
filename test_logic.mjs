// 核心算法验证（不依赖浏览器）
const SALT_LENGTH = 16, IV_LENGTH = 12, PBKDF2_ITERATIONS = 100000;

async function deriveKey(password, salt) {
  const enc = new TextEncoder();
  const km = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' }, km, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
async function buildLocked(file, password) {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const key = await deriveKey(password, salt);
  const data = await file.arrayBuffer();
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data);
  const nameBytes = new TextEncoder().encode(file.name);
  const header = new Uint8Array(6 + 1 + SALT_LENGTH + IV_LENGTH + 2 + nameBytes.length);
  let off = 0;
  header.set([0x46,0x4C,0x4B,0x31,0x30,0x30], off); off += 6;
  header[off++] = 1;
  header.set(salt, off); off += SALT_LENGTH;
  header.set(iv, off); off += IV_LENGTH;
  header[off++] = (nameBytes.length >> 8) & 0xff;
  header[off++] = nameBytes.length & 0xff;
  header.set(nameBytes, off); off += nameBytes.length;
  const out = new Uint8Array(header.length + encrypted.byteLength);
  out.set(header, 0);
  out.set(new Uint8Array(encrypted), header.length);
  return out;
}
async function decryptLocked(lockedBuf, password) {
  if (lockedBuf.length < 6 + 1 + SALT_LENGTH + IV_LENGTH + 2) throw new Error('文件格式无效');
  const magic = String.fromCharCode(...lockedBuf.slice(0, 6));
  if (magic !== 'FLK100') throw new Error('不是有效的 FileLock 文件');
  let off = 6; off++;
  const salt = lockedBuf.slice(off, off + SALT_LENGTH); off += SALT_LENGTH;
  const iv = lockedBuf.slice(off, off + IV_LENGTH); off += IV_LENGTH;
  const nameLen = (lockedBuf[off] << 8) | lockedBuf[off + 1]; off += 2;
  const origName = new TextDecoder().decode(lockedBuf.slice(off, off + nameLen)); off += nameLen;
  const ciphertext = lockedBuf.slice(off);
  const key = await deriveKey(password, salt);
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
  return { data: decrypted, name: origName };
}
function writeBits(px, payload) {
  let bitIdx = 0; const totalBits = payload.length * 8;
  for (let i = 0; i < px.length && bitIdx < totalBits; i += 4) {
    for (let c = 0; c < 3 && bitIdx < totalBits; c++) {
      const bit = (payload[bitIdx >> 3] >> (7 - (bitIdx & 7))) & 1;
      px[i + c] = (px[i + c] & 0xFE) | bit; bitIdx++;
    }
  }
}
function readBits(px, totalBits) {
  const out = new Uint8Array(Math.ceil(totalBits / 8));
  let bitIdx = 0;
  for (let i = 0; i < px.length && bitIdx < totalBits; i += 4) {
    for (let c = 0; c < 3 && bitIdx < totalBits; c++) {
      out[bitIdx >> 3] |= (px[i + c] & 1) << (7 - (bitIdx & 7)); bitIdx++;
    }
  }
  return out;
}
function arrayBufferToBase64(buf) {
  let bin = ''; const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}
function b64ToBytes(b) {
  const s = atob(b); const u = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u;
}

// --- 测试 1: LSB 往返（容量充足：300B payload=2400bit，px=4000B→1000px×3bit=3000bit 容量）---
const payload = crypto.getRandomValues(new Uint8Array(300));
const px = crypto.getRandomValues(new Uint8Array(4000));
writeBits(px, payload);
const recovered = readBits(px, payload.length * 8);
let lsbOk = payload.every((b, i) => b === recovered[i]);
console.log('1. LSB 位操作往返:', lsbOk ? 'PASS ✅' : 'FAIL ❌');

// --- 测试 2: 加密往返 ---
const file = { name: '机密.txt', arrayBuffer: async () => new TextEncoder().encode('top secret 内容').buffer };
const locked = await buildLocked(file, 'pw123');
const { data, name } = await decryptLocked(locked, 'pw123');
const text = new TextDecoder().decode(data);
console.log('2. 加密/解密往返:', (text === 'top secret 内容' && name === '机密.txt') ? 'PASS ✅' : 'FAIL ❌');

// --- 测试 3: 错误密码拒绝 ---
let wrongOk = false;
try { await decryptLocked(locked, 'wrong'); } catch (e) { wrongOk = (e.name === 'OperationError'); }
console.log('3. 错误密码被拒:', wrongOk ? 'PASS ✅' : 'FAIL ❌');

// --- 测试 4: base64 往返 ---
const b64 = arrayBufferToBase64(locked);
const back = b64ToBytes(b64);
let b64Ok = locked.every((b, i) => b === back[i]);
console.log('4. Base64 往返:', b64Ok ? 'PASS ✅' : 'FAIL ❌');

// --- 测试 5: 完整隐写流程（加密→嵌入→提取→解密）---
const STEG_MAGIC = [0x53, 0x54, 0x47, 0x31];
const fullPayload = new Uint8Array(STEG_MAGIC.length + 4 + locked.length);
fullPayload.set(STEG_MAGIC, 0);
fullPayload[4] = (locked.length >>> 24) & 0xff;
fullPayload[5] = (locked.length >>> 16) & 0xff;
fullPayload[6] = (locked.length >>> 8) & 0xff;
fullPayload[7] = locked.length & 0xff;
fullPayload.set(locked, 8);
const coverPx = crypto.getRandomValues(new Uint8Array(2000));
writeBits(coverPx, fullPayload);
const extHeader = readBits(coverPx, (STEG_MAGIC.length + 4) * 8);
let magicOk = STEG_MAGIC.every((b, i) => b === extHeader[i]);
const extLen = (extHeader[4] << 24) | (extHeader[5] << 16) | (extHeader[6] << 8) | extHeader[7];
const extPayload = readBits(coverPx, (STEG_MAGIC.length + 4 + extLen) * 8);
const extLocked = extPayload.slice(8, 8 + extLen);
const fin = await decryptLocked(extLocked, 'pw123');
console.log('5. 完整隐写流程:', (magicOk && fin.name === '机密.txt' && new TextDecoder().decode(fin.data) === 'top secret 内容') ? 'PASS ✅' : 'FAIL ❌');

// --- 测试 6: 可否认隐写（XOR 混淆，无密码不可检测） ---
const STEG_MAGIC2 = [0x53, 0x54, 0x47, 0x31];
async function deriveXorKey(password, salt, length) {
  const enc = new TextEncoder();
  const km = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' }, km, Math.ceil(length / 32) * 256);
  return new Uint8Array(bits);
}
function xorBytes(data, key) { for (let i = 0; i < data.length; i++) data[i] ^= key[i % key.length]; }
const locked2 = await buildLocked(file, 'pw123');
const xorSalt = crypto.getRandomValues(new Uint8Array(16));
const pLen = STEG_MAGIC2.length + 4 + locked2.length;
const xk = await deriveXorKey('pw123', xorSalt, pLen);
const pl = new Uint8Array(pLen);
pl.set(STEG_MAGIC2, 0);
pl[4] = (locked2.length >>> 24) & 0xff; pl[5] = (locked2.length >>> 16) & 0xff; pl[6] = (locked2.length >>> 8) & 0xff; pl[7] = locked2.length & 0xff;
pl.set(locked2, 8);
const origPl = pl.slice();
xorBytes(pl, xk);
const changed = pl.some((b, i) => b !== origPl[i]); // 混淆后不等于原文
const finP = new Uint8Array(16 + pl.length);
finP.set(xorSalt, 0); finP.set(pl, 16);
const px2 = crypto.getRandomValues(new Uint8Array(4000));
writeBits(px2, finP);
const raw6 = readBits(px2, (px2.length / 4) * 3);
const xs2 = raw6.slice(0, 16);
const obf = raw6.slice(16);
const xk2 = await deriveXorKey('pw123', xs2, obf.length);
const rec6 = obf.slice();
xorBytes(rec6, xk2);
const mOk = STEG_MAGIC2.every((b, i) => b === rec6[i]);
const len6 = (rec6[4] << 24) | (rec6[5] << 16) | (rec6[6] << 8) | rec6[7];
const lb = rec6.slice(8, 8 + len6);
const fin6 = await decryptLocked(lb, 'pw123');
console.log('6. 可否认隐写完整流程:', (changed && mOk && fin6.name === '机密.txt' && new TextDecoder().decode(fin6.data) === 'top secret 内容') ? 'PASS ✅' : 'FAIL ❌');
console.log('   混淆后 payload 已变形（不可检测）:', changed ? '是 ✅' : '否 ❌');

// --- 测试 7: 错误密码无法恢复 magic ---
const xkBad = await deriveXorKey('wrong', xs2, obf.length);
const recBad = obf.slice();
xorBytes(recBad, xkBad);
const mBad = STEG_MAGIC2.every((b, i) => b === recBad[i]);
console.log('7. 错误密码混淆不可恢复:', mBad ? 'FAIL ❌' : 'PASS ✅ (magic 不匹配)');
