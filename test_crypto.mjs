// Test: replicate FileLock.html crypto logic in Node (Web Crypto API)
import { webcrypto as crypto } from 'node:crypto';

const PBKDF2_ITERATIONS = 100000;
const SALT_LENGTH = 16;
const IV_LENGTH = 12;

// Simulate a small file
const originalContent = new TextEncoder().encode('测试 FileLock 加密往返 / Hello FileLock 12345!@#$');
const originalName = 'secret-笔记.txt';

function formatSize(b) { return b + ' B'; }

async function deriveKey(password, salt) {
  const keyMaterial = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

// ---- Encrypt ----
const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
const key = await deriveKey('MyStrongPassword123!', salt);

const encrypted = await crypto.subtle.encrypt(
  { name: 'AES-GCM', iv }, key, originalContent
);

const nameBytes = new TextEncoder().encode(originalName);
const header = new Uint8Array(6 + 1 + SALT_LENGTH + IV_LENGTH + 2 + nameBytes.length);
let off = 0;
header.set(new Uint8Array([0x46, 0x4C, 0x4B, 0x31, 0x30, 0x30]), off); off += 6; // FLK100
header[off++] = 1;
header.set(salt, off); off += SALT_LENGTH;
header.set(iv, off); off += IV_LENGTH;
header[off++] = (nameBytes.length >> 8) & 0xff;
header[off++] = nameBytes.length & 0xff;
header.set(nameBytes, off); off += nameBytes.length;

const locked = new Uint8Array(header.length + encrypted.byteLength);
locked.set(header, 0);
locked.set(new Uint8Array(encrypted), header.length);

console.log('✅ 加密成功');
console.log('  原始:', originalName, formatSize(originalContent.length));
console.log('  加密后:', originalName + '.locked', formatSize(locked.length));

// ---- Decrypt (wrong password first) ----
try {
  const badKey = await deriveKey('WrongPassword', salt);
  await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, badKey, locked.slice(header.length));
  console.log('❌ 错误：错误密码居然解密成功了');
} catch (e) {
  console.log('✅ 错误密码被正确拒绝:', e.name);
}

// ---- Decrypt (correct password) ----
const buf = locked;
const magic = String.fromCharCode(...buf.slice(0, 6));
if (magic !== 'FLK100') throw new Error('MAGIC mismatch');
let o2 = 6;
const version = buf[o2++];
const salt2 = buf.slice(o2, o2 + SALT_LENGTH); o2 += SALT_LENGTH;
const iv2 = buf.slice(o2, o2 + IV_LENGTH); o2 += IV_LENGTH;
const nameLen = (buf[o2] << 8) | buf[o2 + 1]; o2 += 2;
const origName2 = new TextDecoder().decode(buf.slice(o2, o2 + nameLen)); o2 += nameLen;
const ciphertext2 = buf.slice(o2);

const key2 = await deriveKey('MyStrongPassword123!', salt2);
const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv2 }, key2, ciphertext2);

const decryptedText = new TextDecoder().decode(decrypted);
console.log('✅ 解密成功');
console.log('  恢复文件名:', origName2);
console.log('  恢复内容:', decryptedText);

// Verify
const ok = decryptedText === new TextDecoder().decode(originalContent) && origName2 === originalName;
console.log(ok ? '\n🎉 往返测试通过！逻辑完全正确' : '\n❌ 测试失败');
process.exit(ok ? 0 : 1);
