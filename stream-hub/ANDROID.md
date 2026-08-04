# Stream Hub — تطبيق Android

## تحميل APK جاهز (الأسهل)

1. افتح **GitHub → Actions → Build Stream Hub APK**
2. اختر آخر تشغيل ناجح (✓)
3. حمّل **stream-hub-debug-apk** → `app-debug.apk`
4. انقله للموبايل وثبّته (اسمح بالتثبيت من مصادر غير معروفة)

---

## بناء APK يدوياً (على Mac)

### المتطلبات
- [Android Studio](https://developer.android.com/studio)
- JDK 17+

### خطوات

```bash
cd stream-hub
npm install
npm run build:android
npm run open:android
```

في Android Studio:
1. **Build → Build Bundle(s) / APK(s) → Build APK(s)**
2. APK جاهز في: `android/app/build/outputs/apk/debug/app-debug.apk`
3. انقله للموبايل وثبّته

---

## الاستخدام

1. ثبّت **Netflix / شاهد / TOD** من Play Store
2. سجّل دخول **مرة** في كل تطبيق
3. افتح **Stream Hub** → اختر فيلم → **تشغيل**
4. يفتح **تطبيق Netflix** مباشرة على صفحة الفيلم
5. **رجوع** → Stream Hub

---

## ملاحظة مهمة — التشغيل التلقائي

**Play التلقائي** على Netflix **ممنوع** من Netflix نفسه — لا يمكن برمجياً.

التطبيق يفتح **صفحة الفilm مباشرة** (`/watch/`) — أسرع مسار ممكن.

---

## Stream Hub login

- المستخدم: `admin`
- كلمة المرور: `changeme`
