# FileLock 发布文案包

> 一次性粘贴即用。Kit 复制粘贴就行。

---

## Reddit - r/privacy

**Title (max 300 chars):**
I built a single-file offline file encryptor (AES-256-GCM) — works by double-clicking an HTML file, zero install, zero network

**Body:**
```

## FileLock — single HTML file, AES-256-GCM, fully offline

I got tired of "encrypted file" tools that either:

- Require installing sketchy desktop apps
- Phone home to "verify your license"
- Upload your file to a server first

So I built **FileLock**. It's **one HTML file**. You download it, double-click, it opens in your browser. Drag your file in, set a password, get an encrypted `.locked` file. Done.

**How it works:**

- 🔒 **AES-256-GCM** (military-grade, authenticated encryption)
- 🔑 **PBKDF2-SHA256, 100,000 iterations** (brute-force resistant)
- 📦 **Single HTML file**, 21KB, no install
- 🌐 **Cross-platform**: Windows / macOS / Linux / phone browsers
- 🚫 **100% offline**: file never leaves your device, no telemetry, no CDN

**Tech:**

- Web Crypto API (`crypto.subtle`) — browser-native, no deps
- File format: `FLK100` magic + version + salt + IV + filename + ciphertext
- Open source (MIT), GitHub: [github.com/wengkit218-pixel/filelock](https://github.com/wengkit218-pixel/filelock)

**Use cases I've thought of:**

- Send sensitive files via email/cloud without trusting the platform
- Encrypt before uploading to Google Drive / Dropbox / OneDrive
- Personal backup encryption
- Whistleblowers, journalists, anyone who needs local-only crypto

**Honest caveats:**

- Forget your password = file is gone forever (that's the trade-off)
- It's a v1 — no folder encryption, no batch mode yet (PRs welcome)
- Built in a weekend, so audit before trusting it with state secrets

If you want to try it: just download `FileLock.html` and double-click. That's literally it.

---

*Cross-posted from my dev log.*

```

---

## Hacker News - Show HN

**Title:**
Show HN: FileLock – Single-file offline AES-256-GCM encryption (just an HTML file)

**URL:** `https://github.com/wengkit218-pixel/filelock`

**Comment (first):**
```

Hey HN,

I built FileLock because I was frustrated by "encrypted file" tools that all seem to want to either install a desktop app, register an account, or upload my file to "verify the encryption." 

The whole tool is one HTML file (21KB). You download it, double-click, it opens in your browser, you drag your file in, set a password, and get an encrypted `.locked` file. Zero install. Zero network. Zero telemetry.

Under the hood:
- Web Crypto API (`crypto.subtle`) — browser-native AES-GCM
- PBKDF2-SHA256, 100k iterations for key derivation
- Random salt + IV per file
- Custom `.locked` format with embedded filename (so you don't need to remember the original name)

It's MIT licensed and the whole thing fits in 600 lines of HTML+JS.

Happy to answer technical questions or take PRs. The two biggest things missing right now are folder encryption and batch mode — I'll probably add those next.

```

---

## Reddit - r/selfhosted (alternate)

**Title:**
Built a single-file offline encryption tool for backing up sensitive files before uploading to cloud

**Body:**
```

## FileLock — encrypt files locally before they touch the cloud

If you self-host, you probably also use some cloud storage for offsite backup. Problem: do you trust the cloud provider with your raw files?

**FileLock** encrypts files **locally** before they go anywhere. Workflow:

1. Encrypt file with FileLock (gets `.locked`)
2. Upload `.locked` to Google Drive / Dropbox / Backblaze / S3 / etc.
3. Even if the cloud is breached, attackers get ciphertext

**Why not VeraCrypt / gpg?**

- VeraCrypt: requires full-disk or container setup, overkill for single files
- gpg: key management friction for most users
- FileLock: download HTML, double-click, done. No keys to manage (password only)

**Specs:**
- AES-256-GCM + PBKDF2 100k
- Single HTML file, 21KB, no install
- Cross-platform (Win/Mac/Linux/phone)
- Open source MIT

[github.com/wengkit218-pixel/filelock](https://github.com/wengkit218-pixel/filelock)

```

---

## Reddit - r/webdev / r/programming

**Title:**
I built a Web Crypto API file encryptor that fits in one HTML file — 21KB, zero dependencies

**Body:**
```

## FileLock: 600 lines of HTML+JS, full file encryption

Built this weekend as a learning project for the **Web Crypto API**.

**Stack:**

- Pure HTML + vanilla JS (no React, no bundler, no CDN)
- `crypto.subtle.encrypt({name:'AES-GCM'}, ...)` for the actual crypto
- `crypto.subtle.deriveKey` with PBKDF2 for password → key
- File API + `Blob` for the download
- ~21KB single HTML file

**Things I learned:**

1. `crypto.subtle` is async, so you can't use it synchronously — pattern is: derive key → encrypt → get ArrayBuffer → create Blob
2. PBKDF2 with 100k iterations takes ~1-2 seconds in a browser (feels slow, but it's the whole point — slows brute force)
3. AES-GCM is authenticated — tampering with ciphertext throws an error automatically, no separate HMAC needed
4. The `File` object is weird — you read it with `arrayBuffer()`, not `text()`

**Repo:** [github.com/wengkit218-pixel/filelock](https://github.com/wengkit218-pixel/filelock)

PRs welcome, especially on:
- Folder encryption (recursive drag-drop)
- Batch mode (encrypt multiple files in one go)
- Argon2 key derivation (slower, but stronger)

```

---

## Twitter / X

**Tweet 1 (主推):**
```

🚀 Just shipped FileLock — a single HTML file that does AES-256-GCM encryption.

Download → double-click → drag file → set password → done.

No install. No network. 21KB.

github.com/wengkit218-pixel/filelock

```

**Tweet 2 (技术):**
```

TIL: `crypto.subtle.encrypt` is the entire API surface you need to build a real file encryption tool.

PBKDF2 for key derivation (100k iter)
AES-GCM for actual encryption (authenticated)

~600 lines of vanilla JS. No framework, no deps.

```

**Tweet 3 (使用场景):**
```

Encrypt before upload.

Use case: you want to put tax docs / medical records / family photos in Google Drive but don't trust Google to read them.

Workflow:
1. FileLock → encrypt → .locked
2. Upload .locked to anywhere
3. Cloud gets ciphertext. You keep the password.

That's it.

```

---

## 发布顺序建议

1. **先发 Hacker News**（技术观众，转化率高，可能上首页）
2. **同日发 Reddit r/privacy**（隐私爱好者，目标用户）
3. **次日发 Reddit r/webdev / r/programming**（开发者观众，引 star）
4. **Twitter/X** 随时发，作为 backup

**注意事项：**
- HN 发完 30 分钟内不要离开页面，要回复评论
- Reddit 发完自己也要顶一两条评论带技术细节
- 每个平台的文案风格不同，**不要复制粘贴**通用版
- 如果 HN 上首页（>100 分），当天可能 500+ star