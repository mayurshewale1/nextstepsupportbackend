# Backend Setup Guide

Follow these steps to get your backend running with Neon PostgreSQL.

## ✅ Step 1: Set Up Neon Database (5 minutes)

### Create a Free Neon Account
1. Visit [https://neon.tech](https://neon.tech)
2. Sign up with GitHub, Google, or email
3. Create a new project (e.g., "NextStep")
4. Wait for the database to initialize

### Get Your Connection String
1. In Neon Console, go to your project
2. Copy the connection string from the "Connection string" section
3. It looks like: `postgresql://user:password@host/database?sslmode=require`

## ✅ Step 2: Install Dependencies (5 minutes)

Open terminal in the `server` folder:

```bash
cd server
npm install
```

This will install:
- **express** - Web framework
- **pg** - PostgreSQL client
- **typescript** - Type safety
- **dotenv** - Environment variables
- **cors** - Cross-origin requests
- **jsonwebtoken** - Authentication
- **bcryptjs** - Password hashing

## ✅ Step 3: Configure Environment Variables (2 minutes)

```bash
# Copy the example file
cp .env.example .env
```

Edit `.env` and fill in:

```env
DATABASE_URL=postgresql://your_user:your_password@your_host/your_db?sslmode=require
PORT=5000
NODE_ENV=development
JWT_SECRET=your_super_secret_key_here_change_this
CORS_ORIGIN=http://localhost:3000
API_VERSION=v1
```

## ✅ Step 4: Test the Connection (2 minutes)

```bash
npm run dev
```

You should see:
```
✓ Connected to Neon PostgreSQL database
✓ Server running on http://localhost:5000
✓ Environment: development
✓ API Version: v1
```

## ✅ Step 5: Test the API (1 minute)

In a new terminal (or browser):

```bash
# Health check
curl http://localhost:5000/api/health

# Should return:
# {"status":"ok","message":"Server is running","timestamp":"..."}
```

## 📋 Next: Create Database Schema

Use Neon SQL Editor to create tables:

```sql
-- Users table
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  role VARCHAR(50) DEFAULT 'user',
  avatar_url VARCHAR(255),
  phone VARCHAR(20),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Complaints table
CREATE TABLE complaints (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  status VARCHAR(50) DEFAULT 'open',
  priority VARCHAR(50) DEFAULT 'medium',
  category VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tickets table
CREATE TABLE tickets (
  id SERIAL PRIMARY KEY,
  complaint_id INTEGER REFERENCES complaints(id) ON DELETE CASCADE,
  assigned_to INTEGER REFERENCES users(id),
  status VARCHAR(50) DEFAULT 'pending',
  priority VARCHAR(50) DEFAULT 'medium',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX idx_complaints_user_id ON complaints(user_id);
CREATE INDEX idx_complaints_status ON complaints(status);
CREATE INDEX idx_tickets_assigned_to ON tickets(assigned_to);
CREATE INDEX idx_users_email ON users(email);
```

## 🚀 Build for Production

```bash
npm run build
npm start
```

This compiles TypeScript to JavaScript and runs the production build.

## 📁 Project Structure Explained

```
server/
├── src/
│   ├── config/
│   │   ├── database.ts      # Neon connection pool
│   │   └── env.ts           # Environment configuration
│   ├── controllers/         # Business logic (to be added)
│   ├── routes/              # API endpoints
│   ├── middleware/          # Error handling, auth, etc.
│   ├── models/              # Database queries (to be added)
│   └── index.ts             # Main entry point
├── dist/                    # Compiled JavaScript (generated)
├── .env                     # Environment variables (don't commit)
├── .env.example             # Template for .env
└── package.json             # Dependencies
```

## 🔗 Connecting Frontend to Backend

In your React Native app, update your API base URL:

```typescript
// In your API service
const API_URL = 'http://localhost:5000/api';  // For development

export const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});
```

## 🐛 Troubleshooting

### Error: "Failed to connect to database"
- Check DATABASE_URL is correct
- Verify Neon database is active
- Check internet connection

### Error: "Port 5000 already in use"
- Change PORT in .env to 5001, 5002, etc.
- Or stop other services using port 5000

### Error: "Cannot find module"
- Run `npm install` again
- Delete `node_modules` and `.npm` cache: `npm cache clean --force`

## 📚 What's Next?

1. **Create API Routes** - Add authentication, complaints, tickets endpoints
2. **Add Controllers** - Implement business logic
3. **Set Up Database Models** - Query helpers and types
4. **Authentication** - JWT-based login/signup
5. **Validation** - Input validation middleware
6. **Testing** - Unit and integration tests
7. **Deployment** - Deploy to Railway, Render, or Heroku

## 🎯 Quick Commands Reference

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Run production build
npm start

# Run tests
npm test

# Install new package
npm install package-name
```

---

Need help? Check [Neon Docs](https://neon.tech/docs) or [Express Docs](https://expressjs.com/docs)
