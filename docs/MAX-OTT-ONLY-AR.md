# MAX SHOW TV — Netflix · Shahid · TOD (بدون IPTV)

## ماذا يفعل التطبيق؟

- **يعرض** محتوى المنصات الرسمية عبر **TMDB** (بوسترات + تقييمات)
- **يفتح** Netflix / Shahid / TOD عبر **deeplink** من واجهتك
- **واجهة مقفولة** (Kiosk) + زر **← MAX** للرجوع
- **لا M3U · لا IPTV · لا أكواد تفعيل**

## الإعداد

```bash
# .env (السيرفر Next.js — port 3000)
TMDB_API_KEY=your-key-from-themoviedb.org

npm run dev

# stream-hub (port 5173)
cd stream-hub && npm run dev
```

افتح: http://localhost:5173

## للعميل

1. يفتح MAX SHOW TV (APK أو PWA)
2. يختار Netflix / Shahid / TOD من الشريط
3. يتصفح المحتوى من TMDB
4. ▶ → deeplink للتطبيق الرسمي
5. ← MAX للرجوع

## اشتراك العميل

| ما تبيعه أنت | ما يدفعه العميل elsewhere |
|--------------|---------------------------|
| برنامج MAX SHOW TV | — |
| — | Netflix / Shahid / TOD (رسمي) |

## حدود تقنية

- الفيديو **لا يُشغَّل داخل MAX** — DRM
- deeplink + TMDB = أقصى تكامل قانوني
