# NexoraCare — Management System

Complete wellness & healthcare center management platform built with **Next.js 14** and **PostgreSQL**.

## Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | Next.js 14 (App Router), TypeScript |
| Styling | Custom CSS variables (12 themes), Google Fonts |
| Database | PostgreSQL via Prisma ORM |
| Auth | Custom JWT (bcryptjs) |
| Payments | Stripe |
| Communications | Twilio (SMS/Voice), SendGrid (Email) |
| Push Notifications | Firebase FCM |

## Quick Start

### 1. Prerequisites
- Node.js 18+
- PostgreSQL running locally (or a cloud connection)

### 2. Install dependencies
```bash
npm install
```

### 3. Configure environment
Edit `.env.local` with your credentials:
```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/nexora_care"
NEXTAUTH_SECRET="your-secret-here"
JWT_SECRET="your-jwt-secret"
# Add Stripe, Twilio, SendGrid keys as needed
```

### 4. Set up database
```bash
# Generate Prisma client
npm run db:generate

# Push schema to PostgreSQL
npm run db:push

# Seed with demo data
npm run db:seed
```

### 5. Run the app
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000)

## Demo Credentials

| Role | Username | Password |
|------|----------|----------|
| Admin | `admin` | `admin123` |
| Staff | `staff1` | `staff123` |
| Staff | `staff2` | `staff123` |

## Features

### Core
- **Appointments** — Full CRUD, status transitions, delivery tracking, rescheduling
- **Customers** — CRM with WhatsApp templates, call logging, appointment history
- **Services** — Treatment catalog with pricing
- **Specialists** — Provider roster by type (Doctor, Stylist, Therapist, Esthetician, Nail Artist)
- **Branches** — Multi-location management

### Operations
- **Dashboard** — Live KPIs with animated counters, live clock, upcoming schedule
- **Payments** — Transaction history, Stripe integration
- **Reports** — Revenue analytics, appointment metrics, performance insights
- **Staff Absence** — Leave and absence tracking
- **Call Logs** — Twilio voice call history
- **Backup** — Full JSON data export

### UX
- **12 Color Themes** — Rose, Ocean, Forest, Sunset, Gold, Sapphire, Crimson, Amber, Emerald, Summer, Violet, Slate
- **Bilingual** — English & Arabic with RTL support
- **Responsive** — Desktop sidebar, mobile drawer nav
- **Accessibility** — Semantic HTML, ARIA labels

## Project Structure

```
nexora-care/
├── app/
│   ├── (dashboard)/          # Protected dashboard pages
│   │   ├── layout.tsx        # Dashboard layout with Navbar
│   │   ├── dashboard/        # KPI dashboard
│   │   ├── appointments/     # Core booking management
│   │   ├── customers/        # CRM
│   │   ├── services/         # Service catalog
│   │   ├── providers/        # Specialists
│   │   ├── branches/         # Multi-location
│   │   ├── payments/         # Transactions
│   │   ├── reports/          # Analytics
│   │   ├── messages/         # Internal messaging
│   │   ├── staff-absence/    # Leave management
│   │   ├── call-logs/        # Call history
│   │   ├── specialists/      # Public staff directory
│   │   ├── backup/           # Data export
│   │   └── profile/          # User account
│   ├── api/                  # API routes
│   ├── login/                # Authentication page
│   ├── globals.css           # Design system + 12 themes
│   ├── layout.tsx            # Root layout
│   └── providers.tsx         # Context providers
├── components/
│   ├── Navbar.tsx            # Sidebar + mobile topbar
│   └── ProtectedRoute.tsx    # Auth guard
├── context/
│   ├── AuthContext.tsx       # JWT auth state
│   ├── ThemeContext.tsx      # Theme switching
│   ├── BranchContext.tsx     # Multi-branch state
│   └── LanguageContext.tsx   # EN/AR i18n
├── lib/
│   ├── prisma.ts             # Prisma client singleton
│   ├── auth.ts               # JWT utilities
│   └── utils.ts              # Helpers
├── types/
│   └── index.ts              # TypeScript types
└── prisma/
    ├── schema.prisma         # Database schema
    └── seed.ts               # Demo data
```
