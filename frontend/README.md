Campus Connect Frontend (React + Vite)

Tech stack
- React 18 + TypeScript, Vite
- Tailwind CSS + HeadlessUI
- React Router v6
- Zustand for state, React Query + Axios for data
- React Hook Form + Zod for forms/validation
- Jest + React Testing Library for tests

Getting started
1) Optional: Copy `.env.example` to `.env`.
   - `VITE_USE_MOCKS=1` lets you run the app with a built‑in mock API (no backend required).
   - `VITE_BYPASS_AUTH=1` auto-logs a dev user so you can access protected pages without the login flow.
   - If you have a backend, set `VITE_API_BASE_URL` to its URL; otherwise the app uses `/api` + Vite proxy to `http://localhost:8000`.
2) Install deps: `npm install`
3) Run dev server: `npm run dev` (opens on http://localhost:5173)
4) Run tests: `npm test`

App structure
- `src/App.tsx`: routes + layout with protected routes; home (`/`) asks 1:1 or Group before swiping
- `src/pages/`: Login, Signup, Profile, Choose (1:1 or Group), Matches (swipe), Dates (availability + upcoming), Events, Messages
- `src/store/auth.ts`: auth state (token + user)
- `src/lib/api.ts`: Axios with auth header via interceptor (base URL is `/api` in dev via proxy; set `VITE_API_BASE_URL` to a full http(s) URL to override)
- `src/lib/queryClient.ts`: React Query client
- `src/components/`: Navbar, UI primitives, Toast notifications

API expectations (align with backend)
- POST `/auth/login` -> `{ access_token, user }`
- POST `/auth/signup` -> `{ access_token, user }`
- GET `/matches/suggestions` -> list of suggestions with optional `insight`
- POST `/matches/:id/accept|skip`
- GET `/events?q=` -> list of events; POST `/events/:id/rsvp`
- Dates: GET `/dates/availability` -> AvailabilitySlot[]; PUT `/dates/availability` body `{ slots: AvailabilitySlot[] }`
- Dates: GET `/dates/upcoming` -> list of upcoming date events
- (Places and Groups endpoints removed in this build)
- GET `/users/me`; PUT `/users/me`; POST `/users/me/avatar` (multipart) -> `{ url }`

Notes
- Pages include loading, error, and empty states where applicable.
- Basic accessibility included (labels, aria attributes, keyboard-friendly controls).
- Swap or extend global state with more slices as backend solidifies.
