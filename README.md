# AI-Powered Lesson Creation Tool

A modular, full-stack application designed to generate and manage educational lesson plans. Built with a Node.js and Express backend, MongoDB with Mongoose for data persistence, and a responsive vanilla JavaScript frontend.

This codebase represents **Stage 1 (Project Setup and Basic UI)** of a multi-stage architecture prepared for AI agent orchestration using **LangGraph.js** and a centralized LLM Gateway.

---

## 🛠️ Technology Stack

- **Backend:** Node.js, Express.js
- **Database:** MongoDB with Mongoose ODM
- **Frontend:** HTML5, CSS3, Vanilla JavaScript (zero frontend frameworks)
- **AI Agent Orchestration (Upcoming Stages):** LangGraph.js & Centralized LLM Gateway
- **Strict Architecture Constraints:** Zero Redis, Zero vector databases, Zero React, Zero unnecessary infrastructure.

---

## 📁 Project Structure

```text
AILessonGenerator/
├── package.json               # Node.js project manifest & scripts
├── .env.example               # Template for environment variables
├── .env                       # Local environment configuration (git-ignored)
├── .gitignore                 # Files excluded from git
├── README.md                  # Comprehensive setup & API documentation
├── src/
│   ├── app.js                 # Express application setup & middleware configuration
│   ├── server.js              # Server entry point, DB startup & graceful shutdown
│   ├── config/
│   │   └── db.js              # Mongoose MongoDB connection & event handling
│   ├── models/
│   │   └── Lesson.js          # Mongoose Lesson model (schema, validation, indexes)
│   ├── controllers/
│   │   └── lessonController.js# Handlers (createLesson, getLessons, getLessonById)
│   ├── routes/
│   │   └── lessonRoutes.js    # Express REST API routes for /api/lessons
│   └── middlewares/
│       ├── validateLesson.js  # Request validation middleware for title & objective
│       └── errorHandler.js    # Centralized global error handling & 404 handler
└── public/                    # Frontend assets served statically by Express
    ├── index.html             # Responsive UI with form and saved lessons list
    ├── css/
    │   └── style.css          # Modern styling, CSS custom properties & animations
    └── js/
        └── app.js             # Vanilla JS client logic (API calls, DOM updates, validation)
```

---

## 🚀 Getting Started

### 1. Prerequisites
- **Node.js** (v18.x or higher)
- **npm** (v9.x or higher)
- **MongoDB** instance (Local MongoDB Community Server running on `127.0.0.1:27017` OR a MongoDB Atlas connection URI)

### 2. Installation
Install project dependencies:

```bash
npm install
```

### 3. Environment Configuration
Create or configure your `.env` file in the root directory:

```bash
cp .env.example .env
```

Set your configuration in `.env`:

```env
# Server Configuration
PORT=5000
NODE_ENV=development

# MongoDB Connection String
# Local MongoDB:
MONGODB_URI=mongodb://127.0.0.1:27017/ai_lesson_generator

# Or MongoDB Atlas:
# MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.mongodb.net/ai_lesson_generator?retryWrites=true&w=majority

# Centralized LLM Gateway (prepared for upcoming AI stages)
LLM_GATEWAY_URL=https://api.openai.com/v1
LLM_API_KEY=your_llm_api_key_here
LLM_MODEL=gpt-4o-mini
```

> **Security Note:** Never commit `.env` or sensitive credentials to version control. `.env` is ignored by `.gitignore`.

---

## 🖥️ Running the Application

### Start Development Server (with auto-reload):
```bash
npm run dev
```

### Start Production Server:
```bash
npm start
```

Once started, open your web browser to:
```
http://localhost:5000
```

---

## 📡 REST API Reference

### 1. Health Check
- **Endpoint:** `GET /api/health`
- **Description:** Verifies server responsiveness.
- **Response (`200 OK`):**
  ```json
  {
    "status": "ok",
    "timestamp": "2026-11-06T17:30:00.000Z",
    "service": "AI Lesson Creation Tool API"
  }
  ```

---

### 2. Create Lesson
- **Endpoint:** `POST /api/lessons`
- **Description:** Validates and saves a lesson with its title and learning objective.
- **Headers:** `Content-Type: application/json`
- **Body:**
  ```json
  {
    "title": "Introduction to Photosynthesis",
    "learningObjective": "Explain the light-dependent reactions and the Calvin cycle in plant chloroplasts."
  }
  ```
- **Validation Rules:**
  - `title`: String, required, 3 to 150 characters
  - `learningObjective`: String, required, 5 to 2000 characters
- **Success Response (`201 Created`):**
  ```json
  {
    "success": true,
    "message": "Lesson created successfully",
    "data": {
      "_id": "672bb1978283a001859f8123",
      "title": "Introduction to Photosynthesis",
      "learningObjective": "Explain the light-dependent reactions and the Calvin cycle in plant chloroplasts.",
      "status": "draft",
      "content": "",
      "metadata": {},
      "createdAt": "2026-11-06T17:30:00.000Z",
      "updatedAt": "2026-11-06T17:30:00.000Z"
    }
  }
  ```
- **Error Response (`400 Bad Request`):**
  ```json
  {
    "success": false,
    "message": "Validation failed",
    "errors": [
      "Lesson title must be at least 3 characters long."
    ]
  }
  ```

---

### 3. Get All Lessons
- **Endpoint:** `GET /api/lessons`
- **Description:** Retrieves all saved lessons, sorted by newest first (`createdAt: -1`).
- **Response (`200 OK`):**
  ```json
  {
    "success": true,
    "count": 1,
    "data": [
      {
        "_id": "672bb1978283a001859f8123",
        "title": "Introduction to Photosynthesis",
        "learningObjective": "Explain the light-dependent reactions and the Calvin cycle in plant chloroplasts.",
        "status": "draft",
        "createdAt": "2026-11-06T17:30:00.000Z",
        "updatedAt": "2026-11-06T17:30:00.000Z"
      }
    ]
  }
  ```

---

### 4. Get Lesson by ID
- **Endpoint:** `GET /api/lessons/:id`
- **Description:** Retrieves a single lesson document by its MongoDB ObjectId.
- **Success Response (`200 OK`):**
  ```json
  {
    "success": true,
    "data": { ... }
  }
  ```
- **Not Found (`404 Not Found`):**
  ```json
  {
    "success": false,
    "message": "Lesson not found"
  }
  ```

---

## 🎨 Frontend User Interface

The frontend is served directly by Express from `public/`:
- **Lesson Creation Form**:
  - Accessible input for Lesson Title with live character counter (150 chars max).
  - Accessible textarea for Learning Objective with live character counter (2000 chars max).
  - **Generate Lesson** button with loading spinner state and submission handling.
  - Clear button to quickly reset fields.
  - Toast/alert banner providing instant feedback for successes and validation errors.
- **Saved Lessons List**:
  - Dynamic count badge displaying the total number of saved lessons.
  - Refresh button for quick manual synchronization.
  - Visual empty state when no lessons have been created yet.
  - Lesson cards rendering title, formatted objective, status badge (`DRAFT`), ID, and formatted date/time.
- **System Status Bar**:
  - Real-time indicator displaying backend connectivity status.
- **Responsive Layout**:
  - Clean two-column desktop grid that dynamically stacks on mobile and tablet screens.

---

## 🛡️ Validation & Error Handling

- **Middleware-level Validation**: `validateLesson.js` sanitizes whitespace and verifies character length rules before requests reach controllers.
- **Mongoose Schema Constraints**: Schema-level required fields, string trimming, min/max lengths, and enum values.
- **Centralized Error Handling**: `errorHandler.js` catches CastErrors (invalid ObjectIds), validation errors, duplicate keys, and 500 runtime exceptions with uniform JSON output.
- **Client-side Sanitization**: Vanilla JS HTML escaping prevents Cross-Site Scripting (XSS) when rendering user-submitted text.

---

## 📍 Stage 1 Completion Status

- [x] Node.js and Express backend architecture
- [x] MongoDB connection via Mongoose
- [x] Responsive Vanilla HTML/CSS/JavaScript frontend
- [x] Lesson creation form (Lesson Title, Learning Objective, Generate Lesson button)
- [x] Lesson MongoDB model (with draft/generating/completed status and metadata map)
- [x] Lesson creation API (`POST /api/lessons`)
- [x] Lesson retrieval APIs (`GET /api/lessons`, `GET /api/lessons/:id`)
- [x] Real-time rendering of saved lessons on the frontend
- [x] Input validation and centralized error handling
- [x] Complete README documentation

> **Next Stage:** Stage 2 will introduce LangGraph.js agent orchestration and the Centralized LLM Gateway to generate rich multi-step lesson content upon clicking "Generate Lesson". (*Awaiting user approval before proceeding*).
