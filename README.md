# Wipronix Backend

The Wipronix backend API built with Node.js and Express. This server handles business logic, database operations, caching, real-time communications, and integrations with third-party services like Firebase.

## Tech Stack
- **Core:** Node.js, Express
- **Database:** MongoDB (via Mongoose)
- **Caching:** Redis (via `ioredis`)
- **Real-time:** Socket.io
- **Cloud/Services:** Firebase Admin SDK, Nodemailer (for emails)
- **Utilities:** `jspdf` & `pdf-lib` (PDF generation/manipulation), `multer` (file uploads)
- **Security:** `helmet`, `express-rate-limit`, `jsonwebtoken` (JWT auth), `bcryptjs`

## Prerequisites
- Node.js (v18+ recommended)
- MongoDB instance running
- Redis server running
- Firebase service account credentials

## Getting Started

1. Navigate to the project directory:
   ```bash
   cd wipronix-backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure Environment Variables:
   Copy `.env.example` to `.env` (if applicable) or create a `.env` file and provide the necessary keys (MongoDB URI, Redis URI, JWT Secret, Firebase config, etc.).

4. Start the development server (auto-reloads via nodemon):
   ```bash
   npm run dev
   ```

5. Start the production server:
   ```bash
   npm start
   ```

## Key Directories
- `src/` / `api/`: Main application source code.
- `controllers/`: Request handlers and business logic.
- `models/`: Mongoose database schemas.
- `routes/`: Express route definitions.
- `utils/`: Helper functions and shared utilities.
