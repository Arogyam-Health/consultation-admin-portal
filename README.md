# 🏥 The Obesity Killer — Consultative Scheduler & OTP Platform

This is the production-ready backend, API endpoints, database migration scripts, and Admin Scheduling System SPA built with Next.js (App Router), Supabase (PostgreSQL), and real-time WebSockets.

---

## 🚀 Features

1. **OTP Verification System**:
   - Swappable OTP Provider (`MockOtpProvider` for local development, `VatiOtpProvider` for live WhatsApp delivery).
   - Rate limiting (max 3 OTP requests per phone per 10 mins).
   - Session expiration, maximum verification attempts limit (5 attempts), and prevention of multi-use tokens.

2. **Real-time Slot Engine**:
   - Dynamic slots generation checking working hours, leaves, and custom overrides.
   - Admin option to configure custom duration per slot for any day.
   - Manually block / unblock individual slots.
   - **Real-time Updates**: Real-time push using WebSocket server (`ws` running on port `4001`) automatically broadcasting slot bookings, releases, blocks, and updates.

3. **Secure Transactional Booking**:
   - Atomic conditional slot allocations ensuring double-booking is physically impossible at the database level.
   - Integrates with Shopify order/customer identifiers and assessment session tokens.

4. **Interactive Swagger Documentation**:
   - Accessible at `/api/docs`.
   - Full schema definitions and interactive testing console.

---

## 🛠️ Tech Stack
- **Framework**: Next.js 14/15/16 (App Router)
- **Database**: Supabase / PostgreSQL (Server-side service-role key to bypass RLS)
- **Real-Time**: Native WebSocket server (`ws`)
- **Authentication**: JWT-based administrator authorization (salted and hashed with bcryptjs)
- **Testing**: Jest + ts-jest

---

## 📦 Directory Structure
- [migrations/001_init.sql](file:///home/nitin/Documents/Intern/obsk/server/migrations/001_init.sql) — PostgreSQL Database Schema
- [src/lib/supabase.ts](file:///home/nitin/Documents/Intern/obsk/server/src/lib/supabase.ts) — Supabase connection singleton
- [src/lib/otp/](file:///home/nitin/Documents/Intern/obsk/server/src/lib/otp/) — Swappable Vati / Mock OTP providers
- [src/lib/slots/generator.ts](file:///home/nitin/Documents/Intern/obsk/server/src/lib/slots/generator.ts) — Calendar and Slot generation engine
- [src/lib/websocket/server.ts](file:///home/nitin/Documents/Intern/obsk/server/src/lib/websocket/server.ts) — WebSocket broadcaster
- [src/app/admin/page.tsx](file:///home/nitin/Documents/Intern/obsk/server/src/app/admin/page.tsx) — Full Admin Panel SPA (dashboard, scheduling, override rules, leave, bookings)
- [src/__tests__/](file:///home/nitin/Documents/Intern/obsk/server/src/__tests__/) — Unit and Integration tests

---

## 🚀 Setup & Execution

### 1. Database Setup
Create tables in your Supabase database by copying the contents of [migrations/001_init.sql](file:///home/nitin/Documents/Intern/obsk/server/migrations/001_init.sql) and executing it in the **Supabase SQL Editor**.
This script generates all tables, indexes, triggers, and creates default seed data:
- **Tables created**:
  - `consultant_admin_users`
  - `consultant_profiles`
  - `consultant_working_hours`
  - `consultant_slot_overrides`
  - `consultant_leaves`
  - `consultant_slots`
  - `consultant_otp_verifications`
  - `consultant_assessment_sessions`
  - `consultant_bookings`
- **Default Admin Login**: `admin@theobesitykiller.com` / `Admin@123`
- **Default Consultant**: Dr. Priya Sharma with working hours Mon-Sat, 9 AM - 6 PM (30 min slots).

### 2. Environment Configuration
Create a `.env` file in the root folder with:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key

JWT_SECRET=use-a-secure-secret-key-string-here
JWT_EXPIRES_IN=8h

OTP_PROVIDER=mock  # Set to "vati" for live WhatsApp OTPs
VATI_API_ENDPOINT=https://live-mt-server.wati.io/api/v1/sendTemplateMessage
VATI_API_KEY=your-wati-api-bearer-key

WS_PORT=4001
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 3. Run Development Server
```bash
npm run dev
```

### 4. Run Automated Tests
```bash
npm test
```

---

## 📡 Endpoints to Test

| Method | Endpoint | Description | Auth Required |
|:---|:---|:---|:---|
| **POST** | `/api/admin/auth/login` | Log in as admin and receive JWT token | No |
| **POST** | `/api/otp/send` | Send OTP. In mock mode, returns `debug_otp` in body | No |
| **POST** | `/api/otp/verify` | Verify the OTP code | No |
| **GET** | `/api/slots` | Retrieve public slots for date range (e.g. `?from=2026-07-15&to=2026-07-22`) | No |
| **POST** | `/api/bookings` | Book an available slot. Requires verified `otp_session_id` | No |
| **GET** | `/api/docs` | Swagger Interactive API Documentation | No |
| **GET** | `/api/ws-info` | WebSocket connection guidelines and status | No |

---

## 📺 Admin Dashboard Access
Visit `/admin` in your browser to manage:
- Weekly Working Hours
- Custom Single-day schedule Overrides / Date Blocks
- Real-time Slot Generation & Manual blocking
- Booking Management status updates
