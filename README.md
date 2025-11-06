# software-engineering-project-4

A web application that connects college students looking for friends, relationships, or group hangouts. The app integrates social matching with local campus resources to make connecting easier, more natural, and more fun.

---

## Overview

**Core Features:**

* Profile creation with photos, interests, and personal info
* Matching system for individuals or groups
* Event integration for upcoming campus activities
* Location guide with reviews and recommendations
* Group hangout and scheduling tools
* AI-powered match insights, date ideas, and natural-language event search

---

## Tech Stack

**Frontend:**

* React (TypeScript)
* Tailwind CSS + HeadlessUI
* React Router v6
* Zustand or Redux Toolkit
* React Query or Axios for API handling
* Vite build tool
* React Hook Form + Zod for validation

**Backend:**

* **Python (FastAPI)**
* PostgreSQL or SQLite (for local setup)
* Pydantic for data models and validation
* SQLAlchemy ORM
* JWT-based authentication
* Local file storage for images (`/uploads` directory)
* Optional AI API integration (OpenAI or Gemini)

---

## Project Structure

### Root Directory

```
campus-connect/
├── backend/
├── frontend/
├── docs/
├── .env.example
├── README.md
└── package.json
```

---

### Frontend Structure

```
frontend/
├── src/
│   ├── components/
│   │   ├── ui/              # Buttons, modals, inputs, shared UI
│   │   ├── profile/         # Profile creation & editing components
│   │   ├── matches/         # Match cards, swipe UI
│   │   ├── events/          # Event list, filters, search bar
│   │   ├── groups/          # Group management & scheduling UI
│   │   └── places/          # Location guide & idea cards
│   │
│   ├── pages/
│   │   ├── Login.tsx
│   │   ├── Signup.tsx
│   │   ├── Profile.tsx
│   │   ├── Matches.tsx
│   │   ├── Events.tsx
│   │   ├── Groups.tsx
│   │   └── Places.tsx
│   │
│   ├── hooks/               # Custom React hooks (e.g., useAuth, useAPI)
│   ├── store/               # Zustand or Redux slices for global state
│   ├── lib/                 # API client and helper utilities
│   ├── routes/              # Route definitions
│   ├── assets/              # Logos, icons, static images
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
│
├── public/
│   └── favicon.ico
│
├── vite.config.ts
└── package.json
```

---

### Backend Structure (Python + FastAPI)

```
backend/
├── app/
│   ├── main.py               # FastAPI app entry point
│   ├── config.py             # Environment config
│   ├── database.py           # DB connection and models setup
│   ├── models/               # SQLAlchemy models (User, Match, Event, Group, Place)
│   ├── routers/
│   │   ├── auth.py           # Login, signup, JWT routes
│   │   ├── users.py          # Profile CRUD
│   │   ├── matches.py        # Matching logic endpoints
│   │   ├── events.py         # Events feed
│   │   ├── groups.py         # Group management & scheduling
│   │   ├── places.py         # Location guide & reviews
│   │   └── ai.py             # AI-powered endpoints
│   ├── services/
│   │   ├── matching.py       # Matching algorithm logic
│   │   ├── scheduling.py     # Availability and group scheduling
│   │   ├── ai_service.py     # AI API integration
│   │   └── file_service.py   # Local file storage handling
│   ├── schemas/              # Pydantic models for validation
│   ├── utils/                # Helper functions, constants
│   ├── uploads/              # Local directory for user photos
│   ├── middleware/           # Auth, logging, CORS
│   └── tests/                # Unit and integration tests
│
├── requirements.txt
└── .env.example
```

---

## Environment Variables

Create a `.env` file in the backend root based on `.env.example`.

Example:

```
DATABASE_URL=sqlite:///./app.db
JWT_SECRET=your_jwt_secret
AI_API_KEY=your_ai_api_key
```

No cloud keys needed since images are stored locally under `/uploads`.

---

## Local Setup

**Backend**

```
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

**Frontend**

```
cd frontend
npm install
npm run dev
```

Access the app at:

* Frontend → [http://localhost:5173](http://localhost:5173)
* Backend → [http://localhost:8000](http://localhost:8000)

---

## Notes for Class Project

* Local image uploads will be saved under `backend/app/uploads/`.
* AI features (match insights, ideas, event search) can call OpenAI or Gemini APIs through backend wrappers.
* SQLite is fine for local testing; you can switch to PostgreSQL if desired.
* Prioritize completing core features over scaling or deployment.
