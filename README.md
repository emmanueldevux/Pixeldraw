# Uxlly — AI Content Automation Platform

Generate stunning social media graphics, copy, and campaigns with AI. Automate your content pipeline with scheduled jobs that deliver via email, Telegram, or direct social posting.

## Features

- **AI Studio** — Chat + generation panel side-by-side
- **Modular AI** — DeepSeek V3 (default), swappable to OpenAI or Claude via one env var
- **Image Generation** — ChatGPT image API (gpt-image-1 / DALL-E 3)
- **Content Calendar** — Visual month view with drag-and-drop scheduling
- **Scheduled Jobs** — Auto-generate content 2x/day with Vercel Cron
- **Multi-Delivery** — Email (SMTP), Telegram Bot, direct social posting
- **Brand System** — Brands → Channels → Style Guides → Content
- **12 Platform Presets** — Instagram (Post/Story/Reel), TikTok, X/Twitter, LinkedIn (Post/Carousel), Facebook, YouTube Thumbnail, Pinterest, Threads, Snapchat
- **Multi-tenant Foundation** — Ready for SaaS expansion

## Tech Stack

- **Framework:** Next.js 14 (App Router) + TypeScript
- **Styling:** Tailwind CSS + custom design tokens
- **Database:** PostgreSQL via Prisma ORM
- **Auth:** NextAuth.js (Google OAuth + Email/Password)
- **Storage:** Cloudflare R2 (10GB free, no egress)
- **AI Text:** DeepSeek V3 / OpenAI / Claude (modular)
- **AI Images:** OpenAI (gpt-image-1 / DALL-E 3)
- **Deployment:** Vercel

## Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Set up environment

```bash
cp .env.example .env.local
# Edit .env.local with your API keys
```

### 3. Set up database

Use [Supabase](https://supabase.com) or [Neon](https://neon.tech) for a free PostgreSQL database.

```bash
npx prisma db push    # Create tables
npx prisma generate   # Generate client
```

### 4. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `NEXTAUTH_SECRET` | Yes | `openssl rand -base64 32` |
| `NEXTAUTH_URL` | Yes | `http://localhost:3000` |
| `GOOGLE_CLIENT_ID` | For Google login | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | For Google login | Google OAuth secret |
| `DEEPSEEK_API_KEY` | For text AI | DeepSeek API key |
| `OPENAI_API_KEY` | For images | OpenAI API key |
| `AI_TEXT_PROVIDER` | No | `deepseek` (default), `openai`, or `anthropic` |
| `R2_*` | For storage | Cloudflare R2 credentials |
| `SMTP_*` | For email delivery | SMTP server details |
| `TELEGRAM_BOT_TOKEN` | For Telegram | Telegram bot token |
| `CRON_SECRET` | For scheduled jobs | Secret for cron verification |

## Scheduled Jobs (Vercel Cron)

Add to `vercel.json`:

```json
{
  "crons": [{
    "path": "/api/cron",
    "schedule": "0 9,17 * * *"
  }]
}
```

This runs at 9 AM and 5 PM UTC daily.

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── (auth)/             # Login & signup
│   ├── (dashboard)/        # Main app pages
│   │   ├── dashboard/      # Overview
│   │   ├── ai/             # AI Studio (chat + generation)
│   │   ├── projects/       # Content channels
│   │   ├── calendar/       # Visual month calendar
│   │   ├── jobs/           # Scheduled automation
│   │   └── settings/       # API keys & config
│   └── api/                # API routes
│       ├── auth/           # NextAuth + signup
│       ├── ai/             # Chat + image generation
│       ├── projects/       # Brand/channel CRUD
│       ├── jobs/           # Job CRUD
│       ├── calendar/       # Calendar posts
│       └── cron/           # Vercel Cron handler
├── components/
│   ├── layout/             # Sidebar, Header, AuthProvider
│   ├── projects/           # Onboarding modal
│   └── ui/                 # Button, Input, Modal, Card, Badge, Avatar, Select
├── lib/
│   ├── ai/
│   │   ├── provider.ts     # Modular AI router
│   │   ├── providers/      # DeepSeek, OpenAI, Claude
│   │   └── skills/         # Copywriting, Image Prompt
│   ├── delivery/           # Email, Telegram, Social
│   ├── auth.ts             # NextAuth config
│   ├── db.ts               # Prisma client
│   ├── storage.ts          # Cloudflare R2
│   ├── platforms.ts        # 12 platform presets
│   └── utils.ts            # Helpers
└── types/                  # TypeScript definitions
```

## Switching AI Providers

Change `AI_TEXT_PROVIDER` in `.env.local`:

```bash
# Cheapest — DeepSeek V3
AI_TEXT_PROVIDER="deepseek"

# Best quality — OpenAI GPT-4o
AI_TEXT_PROVIDER="openai"

# Alternative — Claude
AI_TEXT_PROVIDER="anthropic"
```

All providers share the same interface. No code changes needed.

## License

Private — built with Uxlly.
