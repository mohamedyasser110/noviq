# Client Portal & Demo Data — Noviq

Two linked interfaces, one API (`backend/routes/portal.js`):

| Side | URL | What it does |
| ---- | --- | ------------ |
| Admin workspace | `https://api-production-adb9.up.railway.app/admin/` → **Client Projects** | Create projects for a client email, move the 5 delivery steps (slider + status), attach/advance contracts, message the client |
| Client dashboard | `/en/account` (or `/ar/account`) | Project cards with expandable steps, structured contracts, update feed with read receipts, message-the-team composer |

The link is the notification feed: every admin write that matters
(project created / status moved / step saved / contract attached or
advanced / direct message) drops a row the client reads at `/account`;
the two-way conversation below is a separate thread with per-side read
state; client profile edits are visible to the admin instantly.

## Try it (2 minutes)

1. Client login: `demo@noviq.local` / `Demo1234!` → open `/en/account`.
   You see: 1 project at 55%, 5 steps (2 done), contract `NOVIQ-2026-001`
   ($4,800.00 USD), unread updates, and the team conversation.
2. Admin login → **Client Projects** → **Open** the project → drag the
   *Development* slider → **Save step**. The headline % recalculates.
3. Reload `/en/account`: the new % and step state are already there.
4. Admin → **Client Projects** → **Messages** → **Open chat** (or **Reply**
   for the quick window, or **Reply in chat** from a Contacts modal) →
   send. It appears in the client thread AND under *Latest updates*.
5. Client → type in the conversation → send. Admin **Client Projects**
   badge counts up; the thread shows it with a "new" marker.
6. Client → **Edit profile** → change name/phone → **Save changes**.
   The admin thread header shows the new phone immediately.
7. Client → *Latest updates* → filter **Unread**, or **Mark all read**
   to clear the badge in one call (`POST /api/portal/notifications/read-all`).
8. Admin → **Client Projects** table → type in the search box or pick a
   status tab to narrow the list without refetching.
9. Client → **Change photo** (PNG/JPG/WebP/GIF, 2MB) → avatar shows in
   admin conversations, projects and chat headers.
10. Client → **Request a project** (preset category/budget/timeline) →
    admin **Requests** tab → approve/reject with note → **＋ Project**
    prefills creation from the request.

## The 5 delivery steps (seeded + used by the admin page)

1. Discovery & Scope — done (100%)
2. UI/UX Design — done (100%)
3. Development — in-progress (65%)
4. Testing & Review — in-progress (10%)
5. Launch & Handover — pending (0%)

Headline progress = weight-averaged mean (equal weights → plain average).

## Re-seeding

```powershell
# local (DB_PATH-aware, refuses a nonexistent folder)
node backend/scripts/seed-portal-demo.js

# production (admin-only endpoint, idempotent — re-running creates nothing)
# POST /api/admin/portal/seed-demo with the admin Bearer token
```

In the admin panel, an empty project list offers **load the demo data**,
which calls the same endpoint.

## Endpoints (all covered by `portal.test.js` + `portal-admin-extra.test.js`
+ `portal-messages-profile.test.js`)
- Client: `GET /api/portal/me|projects|projects/:id|contracts|notifications`,
  `POST /api/portal/notifications/:id/read`, `POST …/read-all` (mark all read),
  `POST /api/portal/contact`,
  `GET|PUT /api/portal/profile` (name + phone; email immutable),
  `GET|POST /api/portal/messages` (own thread; opening marks team rows read)
- Admin: `GET|POST /api/admin/portal/projects`, `PUT|DELETE …/projects/:id`,
  `POST …/projects/:id/milestones`, `PUT|DELETE …/milestones/:id`,
  `GET|POST /api/admin/portal/contracts`, `PUT …/contracts/:id`,
  `POST /api/admin/portal/notifications`, `POST …/seed-demo`,
  `GET /api/admin/portal/messages`, `GET …/messages/:userId` (marks client
  rows read), `POST …/messages` (reply as the team + notification)

Tables: `client_messages(user_id, sender, body, is_read)` with per-side
read state; `users.phone` + `users.avatar` (migrated); `project_requests`
(title/category/budget/timeline/description/status/admin_note);
`contracts.file` (migrated) holding
an `images/uploads/…` PDF/image attached in Client Projects (validated
server-side: uploads-relative only, no URLs, no traversal). `/portal/me`
reports `unreadMessages` inside the headline `unread` badge.

Ownership rule: every client read is scoped by `user_id` from the token
(404, never 403, for another user's rows); client tokens get 403 on all
`/api/admin/portal/*` routes.
