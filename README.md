# Rapid Crisis Response System for Hospitality

A real-time, fault-tolerant crisis detection and coordination platform designed for hospitality venues.

## Features
- **One-tap SOS Trigger**: Guests and staff can trigger critical alerts instantly.
- **Real-Time Dashboard**: Live monitoring and status tracking of all active incidents via WebSockets.
- **Role-Based Access**: Specialized views and actions for Guests, Staff, and Emergency Responders.
- **Robust Backend**: Built with Rust (Axum), providing extreme performance and safety.
- **Scalable Architecture**: Uses PostgreSQL for persistent storage and Redis for high-speed pub/sub messaging across distributed nodes.

## Tech Stack
- **Frontend**: React, Vite, TypeScript, Zustand, Tailwind CSS v4
- **Backend**: Rust, Axum, Tokio, SQLx, Redis
- **Database**: PostgreSQL
- **Infrastructure**: Docker, Docker Compose

## Getting Started

### Prerequisites
- Docker and Docker Compose
- Rust (Cargo)
- Node.js (v18+)

### Local Development Setup

1. **Start Infrastructure (Postgres & Redis)**
   ```bash
   docker-compose up -d
   ```

2. **Start Backend**
   ```bash
   cd backend
   cargo run
   ```
   *Note: SQLx migrations run automatically on startup.*

3. **Start Frontend**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

## API Endpoints
- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Authenticate
- `GET /api/incidents` - List all active incidents
- `POST /api/incidents` - Trigger an SOS incident
- `PUT /api/incidents/:id/status` - Update incident status
- `GET /api/ws` - WebSocket connection endpoint

## Deployment
- **Backend**: The provided `Dockerfile` builds a lightweight container ready for Fly.io, Railway, or AWS ECS. Ensure `DATABASE_URL`, `REDIS_URL`, and `JWT_SECRET` are set in the production environment.
- **Frontend**: Deploy easily to Vercel. Set the `VITE_API_URL` and `VITE_WS_URL` build environment variables to point to your deployed backend.
