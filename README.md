# استئذان

تطبيق ويب عربي (RTL) لإدارة طلبات استئذان — مدارس نخبة الشمال الأهلية.

المسار الأساسي: ولي الأمر يرسل طلبًا → يظهر فورًا عند الفصل → موافقة/رفض → ولي الأمر يرى النتيجة.

## المتطلبات

- Node.js 20+
- مشروع Supabase

## الإعداد السريع

```bash
cp .env.example .env
# عبّئ VITE_SUPABASE_URL و VITE_SUPABASE_ANON_KEY
# للبذرة: SUPABASE_SERVICE_ROLE_KEY (من Project Settings → API)
```

### 1) قاعدة البيانات

في Supabase Dashboard → SQL Editor نفّذ بالترتيب:

1. `supabase/migrations/001_schema.sql`
2. `supabase/migrations/002_rls.sql`
3. `supabase/migrations/003_rpc.sql`

أو مع رابط Postgres:

```bash
SUPABASE_DB_URL='postgresql://...' npm run db:apply
```

فعّل Realtime لجدول `permission_requests` إن لم يُفعَّل تلقائيًا.

### 2) البذرة التجريبية

```bash
npm run db:seed
```

حسابات تجريبية:

| الدور | المعرف | كلمة المرور |
|--------|---------|-------------|
| إدارة | `admin` | `Admin123!` |
| موظف فصل | `staff3b` / `staff5a` / `staff1a` | `Staff123!` |
| ولي أمر | `1000000001` أو `1000000002` | `Parent123!` |

### 3) تشغيل الواجهة

```bash
npm run dev
```

يفتح: http://127.0.0.1:5173/

> **مهم — `/mnt/E` (NTFS):** `npm install` و`vite` يفشلون هناك (`vite: not found` / `esbuild EACCES`).
> `npm run dev` و`npm run build` ينسخان المشروع تلقائيًا إلى `~/work/isteathan` ويشغّلان منه.
>
> أو مباشرة:
> ```bash
> cd ~/work/isteathan && npm run vite:dev
> ```

### 4) إنشاء الحسابات من لوحة الإدارة

انشر الدالة:

```bash
supabase functions deploy admin-create-user
```

بدونها يمكن إنشاء الحسابات عبر `npm run db:seed` فقط.

## المسارات

- `/login`
- `/parent` · `/parent/permission/new/:studentId` · `/parent/requests`
- `/class`
- `/admin` · طلبات · طلاب · أولياء · فصول · موظفون · استيراد

## النشر على استضافة (هوستنجر / Apache / LiteSpeed)

```bash
npm run build
```

ارفع **محتويات** مجلد `dist` إلى `public_html` (وليس المجلد نفسه).

`public/.htaccess` يُنسخ تلقائيًا إلى `dist` وهو ضروري: بدونه يظهر
«Page Not Found» عند تحديث أي صفحة داخلية مثل `/admin/guide`، لأن الخادم
يبحث عن مجلد بهذا الاسم بدل تسليم `index.html` للتطبيق.

بعد كل رفع جديد: افتح الموقع واعمل تحديثًا قسريًا (Ctrl+Shift+R) مرة واحدة
حتى يحدّث الـ Service Worker نفسه.

> حذف الحسابات من لوحة الإدارة يمر عبر `/api/admin-delete-user` أثناء التطوير فقط.
> على الاستضافة يجب نشر دالة Supabase:
> ```bash
> supabase functions deploy admin-delete-user
> ```

## إشعارات WhatsApp (WPPConnect)

لا تعمل من الاستضافة الثابتة وحدها. شغّل البوابة على جهاز/سيرفر فيه Chrome:

```bash
cd whatsapp-gateway && npm install && cd ..
npm run whatsapp:gateway
```

ثم نفّذ `supabase/migrations/009_whatsapp_notifications.sql` في SQL Editor.
من لوحة الإدارة → **مشرفو الاستئذان**: أدخل الاسم والرقم، وامسح رمز QR عند أول تشغيل.

## متغيرات البيئة

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=   # سكربتات فقط — لا تضعها في Vite
SUPABASE_DB_URL=             # اختياري لتطبيق الترحيلات
```

## PWA

قابلة للتثبيت (app shell فقط). بدون push أو كاش لبيانات الطلاب/الطلبات.

```bash
npm run build
npm run check:pwa
```

النشر يتطلب HTTPS.

## الرخصة

استخدام داخلي للمدرسة.
