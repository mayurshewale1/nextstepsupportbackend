# NextStep Backend API

Production-ready Express.js backend for the NextStep Support App with PostgreSQL.

## Features

- **PostgreSQL** with connection pooling (Neon-compatible)
- **JWT authentication** with role-based access (Admin, Engineer, User)
- **Input validation** via express-validator
- **Security**: Helmet, rate limiting, CORS
- **Migrations**: SQL migrations for schema management
- **Password hashing** with bcrypt

## Quick Start

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env
# Edit .env with your DATABASE_URL and JWT_SECRET

# Run migrations (creates tables)
npm run migrate

# Start development server
npm run dev
```

## API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | /api/health | - | Health check |
| GET | /api/info | - | API info |
| POST | /api/auth/login | - | Login (userId, password) |
| POST | /api/users | - | Create user |
| GET | /api/users | Admin | List users |
| GET | /api/users/:id | Auth | Get user |
| PUT | /api/users/:id | Admin | Update user |
| DELETE | /api/users/:id | Admin | Delete user |
| GET | /api/tickets | Auth | List tickets (filtered by role) |
| GET | /api/tickets/:id | Auth | Get ticket |
| POST | /api/tickets | User/Admin | Create ticket |
| PUT | /api/tickets/:id | Admin/Engineer | Update ticket |
| PUT | /api/tickets/:id/assign | Admin | Assign ticket |
| DELETE | /api/tickets/:id | Admin | Delete ticket |

## Database Schema

Run `npm run migrate` to create:

- **users**: id, user_id, email, password, name, role, phone, ...
- **tickets**: id, title, description, status, priority, category, created_by, assigned_to, ...

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| DATABASE_URL | Yes | PostgreSQL connection string |
| JWT_SECRET | Yes | Secret for JWT signing |
| PORT | No | Server port (default: 5000) |
| NODE_ENV | No | development \| production |
| CORS_ORIGIN | No | Allowed origin |
| JWT_EXPIRE | No | Token expiry (default: 7d) |

## Production

1. Set `NODE_ENV=production`
2. Use a strong `JWT_SECRET`
3. Configure `CORS_ORIGIN` for your frontend
4. Run migrations: `npm run migrate`
5. Start: `npm start`
