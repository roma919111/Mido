# Stream Hub

واجهة ويب (PWA) بسيطة — **مجلد منفصل** عن مشروع Mido/VYRONIX.

تسجّل دخولاً واحداً إلى Stream Hub، ثم تتصفّح محتوى منظّم وتفتح **الروابط الرسمية** لـ Netflix / شاهد / TOD في المتصفح أو التطبيق الأصلي.

**لا WebView للتشغيل · لا تجاوز DRM · لا تضمين محتوى محمي.**

## التشغيل

```bash
cd stream-hub
npm install
cp .env.example .env
npm run dev
```

افتح `http://localhost:5173`

**افتراضي:** `admin` / `changeme` (غيّرها في `.env`)

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
