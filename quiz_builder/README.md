# AI Study Quiz Builder

AI Study Quiz Builder is a full-stack web application that helps students turn study notes into practice quizzes and flashcards. Users can paste notes, choose a difficulty level, generate a quiz, answer multiple-choice questions, review explanations, flip flashcards, and save quiz attempt history.

## Features

- Paste study notes into a text box
- Generate a practice quiz from study notes
- Choose difficulty level: Easy, Medium, or Hard
- Answer multiple-choice questions
- Submit quiz and receive a score
- Highlight correct and incorrect answers
- Review explanations for each question
- Study using flashcards
- Save quiz attempt history with localStorage
- Clear quiz history
- Backend fallback quiz if AI generation fails

## Tech Stack

### Frontend

- React
- JavaScript
- Vite
- CSS

### Backend

- Node.js
- Express
- Gemini API
- dotenv
- CORS

## How It Works

The React frontend allows users to enter study notes and choose a difficulty level. When the user clicks **Generate Quiz**, the frontend sends the notes and difficulty to the backend.

The Node.js/Express backend receives the request and uses the Gemini API to generate a quiz and flashcards. If the AI request fails, the backend returns a fallback quiz so the app still works.

The user can then answer the quiz questions, submit their answers, see their score, review explanations, flip flashcards, and view past quiz attempts.

## Project Structure

```text
quiz_builder/
├── client/
│   ├── src/
│   │   ├── App.jsx
│   │   └── App.css
│   └── package.json
├── server/
│   ├── server.js
│   ├── .env
│   └── package.json
└── README.md
```

## Getting Started

### 1. Clone the repository

```bash
git clone your-repository-link-here
cd quiz_builder
```

### 2. Install backend dependencies

```bash
cd server
npm install
```

### 3. Create a `.env` file in the `server` folder

Inside `server/.env`, add:

```env
GEMINI_API_KEY=your_gemini_api_key_here
PORT=5001
```

Do not upload your real API key to GitHub.

### 4. Start the backend

```bash
npm run dev
```

The backend should run on:

```text
http://localhost:5001
```

### 5. Install frontend dependencies

Open a second terminal:

```bash
cd client
npm install
```

### 6. Start the frontend

```bash
npm run dev
```

The frontend should run on:

```text
http://localhost:5173
```

## Example Notes to Test

You can paste notes like this:

```text
JavaScript uses variables, functions, arrays, objects, and React state to build interactive web applications. React components use state to update the page when users interact with the app.
```

Then choose a difficulty and click **Generate Quiz**.

## Resume Description

AI Study Quiz Builder — Built a full-stack study application using React, JavaScript, Node.js, Express, and Gemini API that allows users to generate quizzes from study notes, select difficulty levels, answer multiple-choice questions, review explanations, flip flashcards, and save quiz attempt history using browser localStorage.
