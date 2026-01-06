# Cloudflare Workers React Template

[![Deploy to Cloudflare][![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/stevgon/nexusecho)]

A production-ready full-stack template combining Cloudflare Workers, Durable Objects for stateful persistence, React frontend with shadcn/ui, Tailwind CSS, and Hono for type-safe APIs. Built with TypeScript, Vite, and Bun for fast development and deployment.

## Features

- **Full-Stack Serverless**: React SPA served via Cloudflare Workers with API routes.
- **Durable Objects**: Built-in global state management (counter, demo items CRUD).
- **Modern UI**: shadcn/ui components, Tailwind CSS, dark mode support.
- **Type-Safe API**: Hono with end-to-end TypeScript types shared between frontend and backend.
- **Developer Experience**: Hot reload, error boundaries, React Query, React Router.
- **Production-Ready**: CORS, logging, health checks, client error reporting.
- **Zero Config Deployment**: One-command deploy to Cloudflare Workers.

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui, Lucide icons, React Router, TanStack Query, Sonner (toasts), Framer Motion.
- **Backend**: Cloudflare Workers, Hono, Durable Objects (SQLite-backed).
- **Tools**: Bun (package manager/runtime), Wrangler, ESLint, Prettier.
- **Utilities**: Zustand, Zod, Immer, UUID, Recharts, Vaul, Embla Carousel.

## Quick Start

### Prerequisites

- [Bun](https://bun.sh/) installed (`curl -fsSL https://bun.sh/install | bash`).
- [Cloudflare CLI (Wrangler)](https://developers.cloudflare.com/workers/wrangler/install-and-update/) (`bunx wrangler@latest`).
- Cloudflare account and API token for deployment.

### Installation

```bash
bun install
```

### Development

Start the development server (frontend + worker proxy):

```bash
bun dev
```

Open [http://localhost:3000](http://localhost:3000) (or `PORT=3000 bun dev`).

### Build for Production

```bash
bun build
```

Output in `dist/` for Workers/Pages.

## Usage

### Frontend Development

- Edit `src/pages/HomePage.tsx` for your app UI.
- Use `AppLayout` from `src/components/layout/AppLayout.tsx` for sidebar layouts.
- API calls via `fetch('/api/...')` – fully typed via shared types in `@shared/*`.
- Components in `@/components/ui/*` (shadcn), hooks in `@/hooks/*`.

### Backend API (Hono + Durable Objects)

Extend routes in `worker/userRoutes.ts` (do **not** edit `worker/index.ts`).

**Example Endpoints** (demo):

| Method | Endpoint              | Description                  |
|--------|-----------------------|------------------------------|
| GET    | `/api/health`         | Health check                 |
| GET    | `/api/demo`           | Fetch demo items             |
| POST   | `/api/demo`           | Add demo item                |
| PUT    | `/api/demo/:id`       | Update demo item             |
| DELETE | `/api/demo/:id`       | Delete demo item             |
| GET    | `/api/counter`        | Get counter value            |
| POST   | `/api/counter/increment` | Increment counter         |

Types: `@shared/types.ts` (`DemoItem`, `ApiResponse<T>`).

**Durable Object Storage** (global singleton):
- Counter: `getCounterValue()`, `increment()`, `decrement()`.
- Demo Items: `getDemoItems()`, `addDemoItem()`, `updateDemoItem()`, `deleteDemoItem()`.

### Type Generation

```bash
bun cf-typegen  # Updates `worker/types.ts` from `wrangler types`
```

## Deployment

Deploy to Cloudflare Workers (free tier supported):

```bash
bun deploy
```

This runs `bun build && wrangler deploy`.

**Manual Steps** (if needed):
1. `wrangler login`
2. `wrangler deploy` (auto-binds Durable Object).
3. Custom domain: `wrangler deploy --name my-app`.
4. Preview: `wrangler deploy --branch preview`.

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/stevgon/nexusecho)

**Assets Handling**: SPA fallback via `wrangler.jsonc` (`assets.not_found_handling: "single-page-application"`).

## Project Structure

```
├── src/              # React frontend
│   ├── components/   # UI components (shadcn/ui + custom)
│   ├── hooks/        # Custom React hooks
│   ├── lib/          # Utilities (utils.ts, errorReporter.ts)
│   ├── pages/        # React Router pages
│   └── main.tsx      # Entry point
├── worker/           # Cloudflare Worker backend
│   ├── index.ts      # Hono app (DO NOT EDIT)
│   ├── userRoutes.ts # Add your routes here
│   └── durableObject.ts # GlobalDurableObject class
├── shared/           # Shared types/mock data
├── public/           # Static assets
└── wrangler.jsonc    # Worker config (Durable Objects)
```

## Scripts

| Script     | Description                  |
|------------|------------------------------|
| `bun dev`  | Dev server (3000)            |
| `bun build`| Production build             |
| `bun lint` | Lint codebase                |
| `bun deploy`| Build + deploy to Workers   |
| `bun preview` | Preview production build  |

## Customization

- **UI Theme**: Edit `tailwind.config.js` / `src/index.css`.
- **Sidebar**: Customize `src/components/app-sidebar.tsx`.
- **Error Handling**: `src/lib/errorReporter.ts` auto-reports to `/api/client-errors`.
- **Routes**: Add pages to `src/main.tsx` (React Router).

## Contributing

1. Fork & clone.
2. `bun install`.
3. `bun dev`.
4. Submit PR.

## License

MIT. See [LICENSE](LICENSE) for details.