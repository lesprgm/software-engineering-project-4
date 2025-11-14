
# Campus Connect

A web application for college students to connect for friendships, relationships, and group hangouts. Features include social matching, campus events, location guides, and group scheduling.

---


## Features

- Profile creation with photos, interests, and personal info
- Individual and group matching system
- Campus event integration
- Location guide with reviews
- Group scheduling tools
- AI-powered match insights and event search

---


## Tech Stack

**Frontend:**
- React (TypeScript)
- Tailwind CSS, HeadlessUI
- React Router v6
- Zustand (state), React Query (API)
- Vite build tool
- React Hook Form + Zod

**Backend:**
- Python (FastAPI)
- SQLite (local) or PostgreSQL
- Pydantic, SQLAlchemy ORM
- JWT authentication
- Local file storage for images (`backend/app/uploads`)
- Gemini 2.5 Flash AI integration (optional)

---


## Project Structure

```
software-engineering-project-4/
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── config.py
│   │   ├── database.py
│   │   ├── models/
│   │   ├── routers/
│   │   ├── services/
│   │   ├── schemas/
│   │   ├── uploads/
│   │   └── tests/
│   ├── requirements.txt
│   └── app.db
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── ui/
│   │   ├── pages/
│   │   ├── hooks/
│   │   ├── store/
│   │   ├── lib/
│   │   └── index.css
│   ├── public/
│   ├── package.json
│   └── vite.config.ts
├── userimages/
├── README.md
└── app.db
```

---



---


## Environment Variables

**Backend (`backend/.env`):**
```
DATABASE_URL=sqlite:///./app.db
JWT_SECRET=dev_local_change_me
GEMINI_API_KEY=<optional>
GEMINI_MODEL=gemini-2.5-flash
AI_REQUIRE_MODERATION=true
CORS_ALLOW_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
```

**Frontend (`frontend/.env`):**
```
VITE_API_BASE_URL=/api
VITE_BYPASS_AUTH=1
```

---


## Local Setup

1. **Install backend dependencies**
   ```bash
   cd backend
   python -m venv ../venv
   source ../venv/bin/activate
   pip install -r requirements.txt
   ```
2. **Install frontend dependencies**
   ```bash
   cd ../frontend
   npm install
   ```
3. **Run the stack**
   - Backend: `cd backend && source ../venv/bin/activate && uvicorn app.main:app --reload`
   - Frontend: `cd frontend && npm run dev`
4. Open [http://localhost:5173](http://localhost:5173).

> On startup, the backend seeds a dev profile (`dev@example.edu`). With `VITE_BYPASS_AUTH=1`, the frontend auto-signs in as that user for instant access to all features.

---


## Notes

- Local image uploads are stored in `backend/app/uploads/`.
- AI features (match insights, ideas, event search) use Gemini 2.5 Flash via backend wrappers (mocked if no key is set).
- SQLite is recommended for local testing; PostgreSQL is supported for production.
- Only real user profiles seeded in the database appear in matches and swipes. No demo personas are shown.
