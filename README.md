# 🔐 FileLock — 离线文件加密工具

> 一个**单 HTML 文件**的离线文件加密工具，零依赖、完全私密、跨平台。
> 支持 **标准加密**、**图片隐写（可否认）**、**自解密 HTML** 三种模式。

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Offline](https://img.shields.io/badge/100%25-Offline-blue.svg)](FileLock.html)
[![Steganography](https://img.shields.io/badge/Steganography-Deniable-green.svg)](FileLock.html)
[![Self-decrypting](https://img.shields.io/badge/Self--decrypting-HTML-orange.svg)](FileLock.html)

## 📸 功能总览

![FileLock 使用流程](poster.png)

*三大功能：标准加密（.locked）、图片隐写（可否认）、自解密 HTML。全程浏览器本地完成。*

---

## ✨ 特性

| 特性 | 说明 |
|------|------|
| 🛡 **完全离线** | 使用浏览器原生 Web Crypto API，文件**从不离开你的设备** |
| 🔑 **AES-256-GCM** | 军事级加密标准，带认证标签防篡改 |
| 🔐 **PBKDF2** | 密码经 10 万次迭代派生密钥，暴力破解极难 |
| 🖼 **可否认隐写** | 加密数据藏入 PNG 像素最低位，**无密码者看不出图里有数据** |
| 📄 **自解密 HTML** | 生成一个独立 HTML 文件，对方双击即可解密，无需 FileLock |
| 📦 **单文件** | 一个 `FileLock.html`，双击即用，无需安装 |
| 🌐 **跨平台** | Windows / macOS / Linux / 手机浏览器均可用 |
| 🎯 **零依赖** | 不联网、不加载任何外部脚本 |

---

## 🚀 使用方法

### 方式一：直接下载
1. 下载 `FileLock.html`
2. 双击用浏览器打开
3. 选择功能标签 → 设置密码 → 执行

### 方式二：克隆仓库
```bash
git clone https://github.com/wengkit218-pixel/filelock.git
cd filelock
# 用浏览器打开 FileLock.html
```

---

## 📖 三种模式使用流程

### 🔒 模式一：标准加密（.locked）
1. 点击「加密」标签
2. 拖拽或选择要加密的文件
3. 输入强密码（建议 12+ 字符，含大小写+数字+符号）
4. 点击「加密文件」
5. 下载 `.locked` 文件（原始文件名已嵌入，可安全分享）

### 🔓 模式二：标准解密
1. 点击「解密」标签
2. 选择 `.locked` 文件
3. 输入加密时的密码
4. 点击「解密文件」恢复原文件

### 🖼 模式三：可否认隐写（Steganography）
1. 点击「隐写」标签 → 选择「隐藏」
2. 选择一张**不透明 PNG** 作为封面图
3. 选择要隐藏的文件，设置密码
4. 点击「隐藏到图片」
5. 下载 `xxx.stego.png` —— 看起来是普通照片，实则内含加密数据
6. 解密：隐写标签 → 选择「提取」→ 选 `.stego.png` → 输密码 → 恢复文件

> ⚠ **传输警告**：请通过邮件附件 / 网盘发送 `.stego.png`，**不要用微信/QQ 直接发**（会被压缩成 JPG 破坏隐写数据）。

### 📄 模式四：自解密 HTML（Self-decrypting）
1. 点击「自解密」标签
2. 选择文件，设置密码
3. 点击「生成自解密 HTML」
4. 下载 `文件名.locked.html` —— 一个独立 HTML 文件
5. 把此 HTML 发给对方，对方**双击打开 → 输入密码 → 自动解密下载**，无需安装 FileLock

---

## 🔐 安全说明

- **密码派生**：PBKDF2-SHA256，10 万次迭代
- **加密算法**：AES-256-GCM（带认证标签，防篡改）
- **随机 IV**：每个文件使用独立随机初始化向量
- **密钥管理**：密钥仅存在于内存，绝不落盘或上传
- **标准格式**：`FLK100` 魔数 + 版本 + Salt + IV + 原始文件名 + 密文
- **可否认隐写**：隐写数据用**密码派生的 keystream 做 XOR 混淆**后再嵌入 PNG 最低位。无密码者读取图片 LSB 得到的只是随机噪声，**无法察觉图中含有加密数据**，也无法用统计工具检测。
- **自解密 HTML**：解密逻辑内嵌于生成的 HTML 中（仅含 Web Crypto 调用，无外部依赖），密码正确才恢复原文件。

⚠️ **重要**：忘记密码 = 文件永久无法恢复。请务必记住密码！

---

## 🧪 技术实现

### 标准加密文件结构（.locked）
```
┌──────────┬────────┬────────┬──────┬────────────┬──────────┬───────────┐
│ MAGIC(6B)│ VER(1) │ SALT   │ IV   │ NAME_LEN(2) │ NAME     │ CIPHERTEXT│
│ "FLK100" │ 0x01   │ 16B    │ 12B  │            │ 变长     │ AES-GCM   │
└──────────┴────────┴────────┴──────┴────────────┴──────────┴───────────┘
```

### 可否认隐写结构
```
封面 PNG 像素最低位（LSB）：
[ xorSalt(16B, 明文) ][ XOR混淆后的 payload ]
payload = STEG_MAGIC(4B) + 数据长度(4B) + AES-256-GCM密文
XOR keystream = PBKDF2(密码, xorSalt, 迭代10万次) → 混淆后 LSB 呈随机分布
```

### 依赖
- `crypto.subtle` (Web Crypto API) — 现代浏览器原生支持
- 无任何外部库或 CDN

---

## 📋 支持的浏览器

| 浏览器 | 支持 |
|--------|------|
| Chrome / Edge 60+ | ✅ |
| Firefox 55+ | ✅ |
| Safari 11+ | ✅ |
| 手机浏览器 | ✅ |

---

## 🤝 贡献

欢迎 PR！特别是：
- 批量 / 文件夹加密
- 更多隐写载体格式（GIF / 无损 WebP）
- 中文界面优化
- 更多算法选项

---

## 📄 许可证

[MIT License](LICENSE) — 免费用于个人和商业用途

---

## ⭐ 如果这个工具帮到你，请点个 Star！

你的支持是我继续做开源工具的动力 🚀
