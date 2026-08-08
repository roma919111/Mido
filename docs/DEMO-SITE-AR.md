# MAX SHOW TV — موقع تجريبي

## رابط مباشر (يعمل الآن)

**https://beast-edges-grade-cabin.trycloudflare.com**

- افتح من **المتصفح** (Chrome / Safari)
- واجهة MAX SHOW TV كاملة
- بوسترات TMDB + Latest Movies/Series
- الضغط على بوستر → يفتح Netflix

> هذا الرابط مؤقت (نفق Cloudflare). للرابط الدائم فعّل GitHub Pages أدناه.

---

## رابط دائم — GitHub Pages

1. افتح: https://github.com/roma919111/Mido/settings/pages
2. **Source** → **GitHub Actions**
3. انتظر workflow **Deploy Stream Hub UI** ينجح
4. الرابط الدائم: **https://roma919111.github.io/Mido/**

---

## تشغيل محلي (على جهازك)

```bash
cd stream-hub
cp .env.example .env.production
# أضف: VITE_TMDB_API_KEY=your-key
npm install
npm run demo
```

افتح: http://localhost:5173

---

## ملاحظات

- الموقع التجريبي **لا يحتاج APK**
- TMDB مدمج في البناء — لا سيرفر خارجي
- Netflix يفتح في المتصفح/التطبيق (deeplink)
