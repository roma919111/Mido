# Stream Hub

واجهة ويب (PWA) بسيطة — **مجلد منفصل** عن مشروع Mido/VYRONIX.

تسجّل دخولاً واحداً إلى Stream Hub، ثم تتصفّح محتوى منظّم وتفتح **الروابط الرسمية** لـ Netflix / شاهد / TOD في المتصفح أو التطبيق الأصلي.

**لا WebView للتشغيل · لا تجاوز DRM · لا تضمين محتوى محمي.**

## الرابط العام — موقع تجريبي (GitHub Pages)

**https://roma919111.github.io/Mido/**

- يعمل من **المتصفح** مباشرة — بدون APK
- بوسترات TMDB + واجهة MAX SHOW TV
- الضغط على بوستر → يفتح Netflix في المتصفح/التطبيق

بعد تفعيل Pages من [إعدادات الم repo](https://github.com/roma919111/Mido/settings/pages) → **Source: GitHub Actions**

- **Android:** افتح الرابط في **Chrome** → ⋮ → «تثبيت التطبيق»
- **iPhone:** Safari → Share → Add to Home Screen

## التشغيل

```bash
cd stream-hub
npm install
cp .env.example .env
npm run dev
```

افتح **Chrome على اللابتوب**: `http://localhost:5173`

---

## الموبايل — لماذا localhost لا يعمل؟

`localhost` على الموبايل = **الموبايل نفسه**، مو اللابتوب.

### الطريقة 1 — نفس Wi‑Fi (الأسهل)

1. على **Mac** شغّل: `npm run dev`
2. اعرف IP اللابتوب:
   ```bash
   ipconfig getifaddr en0
   ```
3. على **الموبايل** (نفس Wi‑Fi) افتح:
   ```
   http://192.168.x.x:5173
   ```
   (استبدل بالـ IP الحقيقي)

4. إذا ما فتح: **System Settings → Network → Firewall** — اسمح لـ Node/Vite

### الطريقة 2 — رابط عام (أي شبكة)

على **Mac** (بعد `npm run dev`):

```bash
npm run tunnel
```

يعطيك رابط `https://....trycloudflare.com` — افتحه من الموبايل.

### الطريقة 3 — Cursor Cloud

إذا الكود على **Cloud Agent** مو على Mac:
- الموبايل **ما يقدر** يوصل `localhost:5173`
- **Clone** المشروع على Mac وشغّل محلياً، أو استخدم `npm run tunnel`

---

## تسجيل الدخول

## البناء للإنتاج

```bash
npm run build
npm run preview
```

الملفات في `dist/` — انشرها على HTTPS أو لفّها في **Android TWA**.

## تثبيت كتطبيق Android

1. **`npm run build`** ثم انشر `dist/` على HTTPS.
2. **PWA:** من Chrome → «إضافة إلى الشاشة الرئيسية».
3. **TWA:** [Bubblewrap](https://github.com/GoogleChromeLabs/bubblewrap) — الروابط الخارجية تفتح في Chrome Custom Tabs.

## إعداد حسابات المنصات

سجّل الدخول **مرة واحدة** في Chrome على الجهاز إلى netflix.com / shahid / tod.tv.

## تخصيص المحتوى

عدّل `src/data/catalog.ts`.

## الأمان

`.env` للاستخدام العائلي/kiosk. للإنتاج العام أضف backend auth.
