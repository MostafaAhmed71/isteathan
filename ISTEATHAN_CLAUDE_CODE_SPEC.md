# استئذان — Implementation Specification for Claude Code

## 1. Project Overview

Build a production-ready responsive Arabic RTL web application named **استئذان** for a primary school.

The application manages student permission/exit requests:

1. Parent logs in using National ID + password.
2. Parent sees only the students linked to their account.
3. Parent selects a student and submits a permission request with a reason.
4. The system automatically determines the student's grade and class.
5. The request appears in real time on the screen of that class only.
6. Class staff can approve or reject the request.
7. Parent immediately sees the updated status.
8. School management can manage students, parents, classes, users, and requests.

### School Structure

- Grades: 1 through 6 primary.
- Sections per grade: A, B, C, D.
- Total classes: 24.
- Arabic UI:
  - الصف الأول: أ، ب، ج، د
  - الصف الثاني: أ، ب، ج، د
  - ...
  - الصف السادس: أ، ب، ج، د

## 2. Product Principles

The product must be extremely simple.

- Arabic RTL everywhere.
- Mobile-first.
- Responsive on Android, iPhone, tablets, and desktop.
- No unnecessary features.
- Large touch-friendly buttons.
- Clear status colors.
- No parent-side manual selection of class.
- No OTP in MVP.
- No public registration.
- Accounts are created/managed by school administration.
- Realtime updates are required for requests.
- Do not expose student data across parents/classes.

## 3. Recommended Stack

Use:

- React
- Vite
- TypeScript
- Tailwind CSS
- Supabase
  - PostgreSQL database
  - Authentication
  - Realtime
  - Row Level Security
- React Router
- A lightweight component/icon library if needed, but avoid unnecessary dependencies.

If the repository already has a working stack, preserve it unless there is a strong technical reason to change it.

## 4. Authentication

### Parent

Login fields:

- National ID
- Password

No OTP.

The parent must not self-register.

Parent accounts are created by the school administrator.

### Class Staff

Login:

- Username or configured account identifier
- Password

Each class account can only access its assigned class.

### Administrator

Administrator account with management permissions.

Use Supabase Auth for authentication where practical.

IMPORTANT:
- Never store plaintext passwords in application tables.
- Do not use National ID as the password.
- National ID is an identifier, not a secret.
- Protect sensitive data with RLS.
- Never trust a client-provided `guardian_id`, `student_id`, or `class_id` for authorization.

## 5. User Roles

### PARENT

Can:
- Login.
- View linked children only.
- Submit a permission request for a linked child.
- View their own requests.
- View request status.
- View rejection reason if supplied.

Cannot:
- View other parents.
- View unrelated students.
- Choose/change the student's class.
- Approve/reject requests.
- Access administration.

### CLASS_STAFF

Can:
- Login.
- View requests for assigned class only.
- See pending requests in realtime.
- Approve a request.
- Reject a request.
- Enter rejection reason.
- View request history for their class.

Cannot:
- View other classes.
- Manage students.
- Manage parents.
- Change student class.

### ADMIN

Can:
- Manage parents.
- Manage students.
- Manage classes.
- Manage class staff.
- Import students.
- View all requests.
- Filter/search requests.
- View request history.
- Create/deactivate accounts.

## 6. Core Database Model

Create these tables.

### profiles

```sql
id uuid primary key references auth.users(id)
full_name text not null
role text not null check (role in ('PARENT', 'CLASS_STAFF', 'ADMIN'))
national_id text unique
phone text
is_active boolean default true
created_at timestamptz default now()
updated_at timestamptz default now()
```

### classes

```sql
id uuid primary key default gen_random_uuid()
grade integer not null check (grade between 1 and 6)
section text not null check (section in ('أ', 'ب', 'ج', 'د'))
name text not null
staff_profile_id uuid references profiles(id)
is_active boolean default true
created_at timestamptz default now()

unique (grade, section)
```

There must be exactly 24 default classes.

Example:

- 1 أ
- 1 ب
- 1 ج
- 1 د
- ...
- 6 أ
- 6 ب
- 6 ج
- 6 د

### students

```sql
id uuid primary key default gen_random_uuid()
national_id text unique not null
full_name text not null
grade integer not null check (grade between 1 and 6)
class_id uuid not null references classes(id)
guardian_id uuid not null references profiles(id)
is_active boolean default true
created_at timestamptz default now()
updated_at timestamptz default now()
```

If the school later needs multiple guardians per student, refactor to a junction table. For MVP, one primary guardian relationship is sufficient.

### permission_requests

```sql
id uuid primary key default gen_random_uuid()
student_id uuid not null references students(id)
guardian_id uuid not null references profiles(id)
class_id uuid not null references classes(id)

reason text not null

status text not null default 'PENDING'
check (status in ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'))

rejection_reason text

created_at timestamptz default now()
decided_at timestamptz
decided_by uuid references profiles(id)
updated_at timestamptz default now()
```

IMPORTANT:
- `guardian_id` must match the student's actual guardian.
- `class_id` must match the student's current class.
- The client must not be allowed to manipulate these relationships arbitrarily.

## 7. Database Constraints and Security

Implement Supabase Row Level Security.

### Parent RLS

A parent can:

- Select only their own profile.
- Select only students where `students.guardian_id = auth.uid()`.
- Insert permission requests only for their own linked students.
- Select only their own permission requests.
- Never update approval fields/status directly.

### Class Staff RLS

A class staff user can:

- Select requests where `permission_requests.class_id` belongs to their assigned class.
- Approve/reject only requests in their assigned class.
- Update only the permitted decision fields.

Prefer secure database functions/RPC for approval/rejection rather than broad client-side UPDATE permissions.

### Admin RLS

Admin can manage all relevant entities.

## 8. Important Authorization Rule

Never trust:

```text
student_id
guardian_id
class_id
```

sent by the browser.

For creating a request:

1. Authenticate the parent.
2. Verify the selected student belongs to `auth.uid()`.
3. Read the student's actual class.
4. Create the request using the verified guardian and class.
5. Ignore any client-provided class/guardian relationship.

For approval/rejection:

1. Authenticate the class staff.
2. Verify the request belongs to the staff's assigned class.
3. Update the request.
4. Record `decided_by` and `decided_at`.

## 9. Parent UX

### Login

Route:

`/login`

Screen:

```text
استئذان

رقم الهوية
[________________]

كلمة المرور
[________________]

[ دخول ]
```

Add clear validation messages.

Do not expose whether an arbitrary National ID exists more than necessary.

### Parent Home

Route:

`/parent`

Show:

```text
مرحبًا، [اسم ولي الأمر]

أبنائي

[ Student Card ]
اسم الطالب
الصف الثالث — ب
[ طلب استئذان ]

[ Student Card ]
اسم الطالب
الصف الخامس — أ
[ طلب استئذان ]
```

Do not show unrelated students.

### New Permission Request

Route example:

`/parent/permission/new/:studentId`

Display:

- Student name
- Grade
- Class
- Reason input

Grade/class are read-only.

Button:

`إرسال طلب الاستئذان`

After submission:

```text
تم إرسال الطلب بنجاح
الطالب: أحمد محمد
الفصل: الثالث — ب
الحالة: قيد الانتظار
```

### Parent Request History

Show:

- Student
- Date/time
- Reason
- Status
- Rejection reason when applicable

Statuses:

- قيد الانتظار
- تمت الموافقة
- تم الرفض
- ملغي

Use realtime subscription so status changes appear without refresh.

## 10. Class Staff UX

Route:

`/class`

After login, show assigned class automatically.

Header:

```text
الصف الثالث — ب
طلبات الاستئذان
```

Pending requests must be visually dominant.

Example:

```text
أحمد محمد

ولي الأمر: محمد أحمد
السبب: موعد طبي
الوقت: 10:35 ص

[ رفض ]    [ موافقة ]
```

New requests appear immediately through Supabase Realtime.

No refresh should be required.

### Approval

When clicking `موافقة`:

Show a small confirmation dialog:

```text
هل تريد الموافقة على استئذان أحمد محمد؟

[ إلغاء ] [ موافقة ]
```

On confirmation:

- Set status = APPROVED
- Set decided_at
- Set decided_by

### Rejection

Click `رفض`.

Show:

```text
سبب الرفض
[________________________]

[ إلغاء ] [ تأكيد الرفض ]
```

Save rejection reason if required by product settings.

Then:

- Set status = REJECTED
- Set rejection_reason
- Set decided_at
- Set decided_by

## 11. Duplicate Request Rule

A student must not have multiple pending permission requests at the same time.

Before creating a request:

- Check for existing PENDING request for that student.
- If one exists, prevent submission and show:

```text
يوجد بالفعل طلب استئذان قيد الانتظار لهذا الطالب.
```

Implement a database-level safeguard where possible.

## 12. Realtime

Supabase Realtime must be enabled for `permission_requests`.

### Parent subscription

Parent listens only to requests belonging to the authenticated parent.

When class staff approves/rejects:

- Parent UI updates immediately.

### Class subscription

Class staff listens only to requests belonging to their assigned class.

When parent creates a request:

- New request appears immediately.

Do not subscribe clients to all requests.

## 13. Admin Dashboard

Route:

`/admin`

Dashboard cards:

```text
طلبات اليوم
قيد الانتظار
تمت الموافقة
تم الرفض
```

### Requests page

Route:

`/admin/requests`

Features:

- Search by student name.
- Search by parent name.
- Filter by grade.
- Filter by class.
- Filter by status.
- Filter by date.
- View details.

Table columns:

- الطالب
- الصف
- الفصل
- ولي الأمر
- السبب
- الحالة
- وقت الطلب
- وقت القرار

## 14. Student Management

Route:

`/admin/students`

CRUD:

- Create
- Read
- Update
- Deactivate

Fields:

- Student National ID
- Full name
- Grade
- Class
- Parent

Validation:

- Student National ID required.
- Full name required.
- Grade 1–6.
- Class must belong to selected grade.
- Parent required.

## 15. Parent Management

Route:

`/admin/parents`

Fields:

- National ID
- Full name
- Phone
- Account status
- Password setup/reset workflow

Show linked children.

Example:

```text
محمد أحمد

الأبناء:
- أحمد محمد — 3 ب
- خالد محمد — 5 أ
```

## 16. Class Management

Route:

`/admin/classes`

Show all 24 classes.

Each class:

- Grade
- Section
- Staff account
- Active/inactive

Prevent duplicate grade/section combinations.

## 17. Staff Management

Route:

`/admin/staff`

Allow admin to:

- Create class staff account.
- Assign staff to a class.
- Change assigned class.
- Activate/deactivate account.

## 18. Import Students

Provide CSV/XLSX import.

Required columns:

```text
student_national_id
student_name
grade
section
guardian_national_id
guardian_name
guardian_phone
```

Import workflow:

1. Upload file.
2. Parse file.
3. Validate rows.
4. Show errors before importing.
5. Admin confirms.
6. Insert/update valid records.
7. Show import summary.

Example validation errors:

- Duplicate student National ID.
- Invalid grade.
- Invalid section.
- Missing parent National ID.
- Missing student name.

Do not partially import silently.

## 19. Request History

Every request must retain:

- Student
- Parent
- Class
- Reason
- Status
- Created timestamp
- Decision timestamp
- Decision user
- Rejection reason

Admin must be able to audit the record.

## 20. Routes

Suggested route structure:

```text
/login

/parent
/parent/permission/new/:studentId
/parent/requests

/class

/admin
/admin/requests
/admin/students
/admin/parents
/admin/classes
/admin/staff
/admin/import
```

Use route guards based on role.

Unauthorized users must be redirected.

## 21. UI Design

Use a clean school-management interface.

Requirements:

- Arabic RTL.
- Modern but conservative.
- No gradients.
- No excessive animation.
- High readability.
- Large buttons.
- Good contrast.
- Mobile-first.
- Consistent cards.
- Confirmation dialogs for destructive/important actions.

Status colors:

- Pending: amber/orange.
- Approved: green.
- Rejected: red.
- Cancelled: neutral gray.

## 22. Responsive Requirements

Test at minimum:

- 360px width.
- 390px width.
- 430px width.
- Tablet portrait.
- Tablet landscape.
- Desktop 1280px+.

No horizontal scrolling.

Buttons must be touch-friendly.

Class screen should be usable continuously on a tablet or desktop monitor.

## 23. Error Handling

Show Arabic user-friendly messages.

Examples:

```text
بيانات الدخول غير صحيحة.

حدث خطأ أثناء إرسال الطلب.

لا يمكن إرسال طلب جديد، يوجد طلب قيد الانتظار.

انتهت صلاحية الجلسة، يرجى تسجيل الدخول مرة أخرى.

ليس لديك صلاحية للوصول إلى هذه الصفحة.

تعذر تحميل البيانات، حاول مرة أخرى.
```

Do not show raw database errors to users.

Log technical errors for developers.

## 24. Empty States

Parent:

```text
لا يوجد أبناء مرتبطون بهذا الحساب.
يرجى مراجعة إدارة المدرسة.
```

Class:

```text
لا توجد طلبات استئذان معلقة.
```

Admin:

```text
لا توجد نتائج مطابقة للبحث.
```

## 25. Loading States

Use skeletons or simple loading indicators.

Never show blank screens while data is loading.

Disable submit buttons during network requests to prevent duplicate submissions.

## 26. Security Requirements

Mandatory:

- Supabase RLS.
- Role-based authorization.
- Secure authentication.
- No plaintext passwords.
- No sensitive data in localStorage unless strictly necessary.
- Validate all inputs.
- Sanitize displayed text.
- Prevent IDOR by server-side authorization.
- Prevent parent from accessing another student's record.
- Prevent class staff from accessing another class.
- Prevent parent from approving/rejecting requests through API manipulation.
- Audit approval/rejection actions.

## 27. Performance

Target:

- Fast initial load.
- Minimal unnecessary database queries.
- Pagination for admin request history.
- Realtime subscriptions scoped to the user's authorized data.
- Avoid loading all students/requests into the browser.

## 28. Notifications

MVP:

- In-app realtime status updates.

Do not implement SMS, WhatsApp, email, or push notifications unless explicitly requested.

The architecture should allow them later.

## 29. Seed Data

Create seed data for development:

24 classes:

```text
1 أ, 1 ب, 1 ج, 1 د
2 أ, 2 ب, 2 ج, 2 د
3 أ, 3 ب, 3 ج, 3 د
4 أ, 4 ب, 4 ج, 4 د
5 أ, 5 ب, 5 ج, 5 د
6 أ, 6 ب, 6 ج, 6 د
```

Create sample:

- Admin.
- Class staff for at least 3 classes.
- Several parents.
- Multiple students per parent.
- Pending, approved, and rejected requests.

Do not use real personal data in seed data.

## 30. Development Order

Implement in this order:

### Phase 1 — Foundation
- Project setup.
- Tailwind.
- RTL.
- Supabase connection.
- Environment variables.
- Routing.
- Authentication.

### Phase 2 — Database
- Tables.
- Constraints.
- Indexes.
- RLS.
- Secure functions/RPC where required.
- Seed data.

### Phase 3 — Parent
- Login.
- Parent dashboard.
- Children.
- Create request.
- Request history.
- Realtime status.

### Phase 4 — Class
- Class dashboard.
- Pending requests.
- Realtime incoming requests.
- Approve.
- Reject.
- Request history.

### Phase 5 — Admin
- Dashboard.
- Student CRUD.
- Parent CRUD.
- Class management.
- Staff management.
- Request management.
- Import.

### Phase 6 — QA
Test:
- Authentication.
- Authorization.
- RLS.
- Parent isolation.
- Class isolation.
- Realtime.
- Duplicate request prevention.
- Responsive layouts.
- Error handling.

## 31. Acceptance Criteria

The implementation is complete only when all of these work:

### Parent

- [ ] Parent can log in with National ID + password.
- [ ] Parent sees only linked children.
- [ ] Parent cannot access unrelated students.
- [ ] Parent can create a request for a linked child.
- [ ] Parent cannot select/change class.
- [ ] Student class is determined automatically.
- [ ] Duplicate pending requests are prevented.
- [ ] Parent sees request status.
- [ ] Parent receives realtime status changes.

### Class

- [ ] Staff sees only their assigned class.
- [ ] New requests appear without refresh.
- [ ] Request contains student, parent, reason, and time.
- [ ] Staff can approve.
- [ ] Staff can reject.
- [ ] Rejection reason is stored.
- [ ] Decision user and timestamp are stored.

### Admin

- [ ] Admin can manage students.
- [ ] Admin can manage parents.
- [ ] Admin can manage classes.
- [ ] Admin can manage class staff.
- [ ] Admin can import students.
- [ ] Admin can view all requests.
- [ ] Admin can filter/search requests.

### Security

- [ ] RLS enabled.
- [ ] Parent data isolation verified.
- [ ] Class data isolation verified.
- [ ] Unauthorized routes blocked.
- [ ] Client cannot override guardian/class relationships.
- [ ] No plaintext passwords.

### Responsive

- [ ] 360px mobile works.
- [ ] 390px mobile works.
- [ ] Tablet works.
- [ ] Desktop works.
- [ ] No horizontal scrolling.

## 32. Important Scope Restrictions

Do NOT add:

- Attendance.
- Grades.
- Payments.
- School bus management.
- Messaging system.
- Parent-teacher chat.
- WhatsApp integration.
- SMS.
- Push notifications.
- OTP.
- Public registration.
- Complex workflow approvals.

These are outside the MVP.

The core product is:

**Parent login → choose child → submit permission → request appears instantly in child's class → approve/reject → parent sees result.**

## 33. Expected Deliverables

Claude Code should produce:

1. Working application.
2. Supabase SQL migrations.
3. RLS policies.
4. Secure RPC/functions where needed.
5. Seed data.
6. Responsive RTL UI.
7. Authentication and route guards.
8. Realtime request updates.
9. Admin dashboard.
10. CSV/XLSX import.
11. README with setup instructions.
12. `.env.example`.
13. Clear deployment instructions.

## 34. Environment Variables

Use `.env` for secrets.

Provide `.env.example`.

Never commit real secrets.

Expected variables:

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

Do not expose Supabase service-role keys in the frontend.

## 35. Final Implementation Rule

Prioritize correctness and security over visual complexity.

The system should feel like a very simple school utility:

**ولي الأمر يرسل الطلب.  
الفصل يستقبل الطلب فورًا.  
المسؤول يوافق أو يرفض.  
ولي الأمر يعرف النتيجة.**

Do not introduce unnecessary abstractions or features that make this workflow harder to use.
