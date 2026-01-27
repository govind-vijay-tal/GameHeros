# GameHeros Frontend

A polished React + TypeScript frontend for the GameHeros multi-sport scoring platform.

## Features

- 🎨 Modern, responsive UI with Tailwind CSS
- ⚡ Fast development with Vite
- 🔄 Real-time score updates with React Query
- 📱 Mobile-friendly design
- 🎯 Type-safe with TypeScript

## Setup

1. **Install dependencies:**
```bash
cd frontend
npm install
```

2. **Start development server:**
```bash
npm run dev
```

The frontend will run on `http://localhost:3000` and proxy API requests to `http://localhost:8080`.

## Build

```bash
npm run build
```

## Project Structure

```
frontend/
├── src/
│   ├── api/              # API client and endpoints
│   ├── components/       # Reusable components
│   ├── pages/            # Page components
│   ├── App.tsx           # Main app component
│   └── main.tsx          # Entry point
├── index.html
└── package.json
```

## Pages

- **Dashboard** (`/`) - Overview of tournaments, matches, and teams
- **Tournaments** (`/tournaments`) - List and create tournaments
- **Tournament Detail** (`/tournaments/:id`) - Tournament details and matches
- **Teams** (`/teams`) - List and create teams
- **Matches** (`/matches`) - List all matches
- **Match Detail** (`/matches/:id`) - Match details and live score
- **Live Scoring** (`/matches/:id/scoring`) - Real-time scoring interface

## Tech Stack

- **React 18** - UI library
- **TypeScript** - Type safety
- **Vite** - Build tool
- **Tailwind CSS** - Styling
- **React Query** - Data fetching and caching
- **React Router** - Routing
- **Axios** - HTTP client
- **Lucide React** - Icons
