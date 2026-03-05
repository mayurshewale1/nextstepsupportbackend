# 🚀 Backend Setup Quick Start

## What I've Created for You

Your backend is now ready! Here's what's been set up:

### ✨ Project Structure
```
server/
├── src/
│   ├── config/
│   │   ├── database.ts      ← Neon connection
│   │   └── env.ts           ← Environment setup
│   ├── controllers/
│   │   └── UserController.ts    ← Example controller
│   ├── routes/
│   │   └── index.ts         ← API routes
│   ├── middleware/
│   │   └── errorHandler.ts  ← Error handling
│   ├── models/
│   │   └── User.ts          ← Example database model
│   └── index.ts             ← Main server
├── .env.example             ← Copy to .env
├── package.json             ← Dependencies
├── tsconfig.json            ← TypeScript config
├── SETUP_GUIDE.md           ← Detailed guide
└── README.md                ← Documentation
```

## 🎯 Next Steps (Follow in Order)

### Step 1: Set Up Neon Database (5 min)
1. Go to https://neon.tech
2. Create a free account
3. Create a new project
4. Copy your connection string

### Step 2: Install Dependencies (2 min)
```bash
cd server
npm install
```

### Step 3: Configure .env File (2 min)
```bash
cp .env.example .env
# Edit .env and paste your Neon connection string
```

Your `.env` should look like:
```env
DATABASE_URL=postgresql://user:password@host/database?sslmode=require
PORT=5000
NODE_ENV=development
JWT_SECRET=your_secret_key_here
CORS_ORIGIN=http://localhost:3000
```

### Step 4: Start the Server (1 min)
```bash
npm run dev
```

You should see:
```
✓ Connected to Neon PostgreSQL database
✓ Server running on http://localhost:5000
```

### Step 5: Create Database Tables (5 min)
Use Neon SQL Editor to run:
```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  role VARCHAR(50) DEFAULT 'user',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

See `SETUP_GUIDE.md` for more tables (complaints, tickets, etc.)

### Step 6: Test the API
```bash
curl http://localhost:5000/api/health
```

## 📚 What's Included

### Configuration
- ✅ TypeScript setup
- ✅ Neon PostgreSQL connection
- ✅ Environment variables management
- ✅ CORS configuration
- ✅ Error handling middleware

### Example Code
- ✅ User model with CRUD operations
- ✅ User controller with all endpoints
- ✅ Health check endpoint
- ✅ Database connection pool

### Documentation
- ✅ Setup guide
- ✅ README with all details
- ✅ Environment variables template

## 🔌 Available Dependencies

Already installed:
- **express** - Web framework
- **pg** - PostgreSQL client
- **typescript** - Type safety
- **cors** - Cross-origin requests
- **bcryptjs** - Password hashing
- **jsonwebtoken** - JWT auth
- **dotenv** - Environment variables
- **express-validator** - Input validation

## 🚀 Quick Commands

```bash
npm run dev        # Start development server
npm run build      # Compile TypeScript
npm start          # Run production build
npm test           # Run tests
npm install pkg    # Add new package
```

## 🔗 Connecting Your Frontend

In your React Native app, update the API URL:

```typescript
const API_BASE_URL = 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});
```

## 📋 Common Tasks

### Add a New Route
Edit `src/routes/index.ts`:
```typescript
router.get('/users', UserController.getAllUsers);
router.get('/users/:id', UserController.getUserById);
router.post('/users', UserController.createUser);
```

### Add a Model
Create file `src/models/YourModel.ts` similar to `User.ts`

### Add Middleware
Create file `src/middleware/yourMiddleware.ts` and use it in index.ts

## 📖 Learn More

- [Express.js Docs](https://expressjs.com/)
- [Neon Docs](https://neon.tech/docs)
- [TypeScript Docs](https://www.typescriptlang.org/docs/)
- [PostgreSQL Docs](https://www.postgresql.org/docs/)

## ❓ Need Help?

1. Check `SETUP_GUIDE.md` for detailed steps
2. Check `README.md` for API documentation
3. Review the example `User` model and controller
4. Check Neon console for database status

---

**You're ready to go!** Start with `npm run dev` and create your first API endpoint.
