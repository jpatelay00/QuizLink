import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY
});

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("AI Study Quiz Builder backend is running.");
});

function getFallbackQuiz(difficulty) {
  return {
    title: `${difficulty} General Study Quiz`,
    summary:
      "This is a backup quiz. The AI could not generate a quiz, so the app returned a safe fallback quiz.",
    questions: [
      {
        questionText: "What is the main purpose of study notes?",
        choices: [
          "To review and understand key ideas",
          "To hide important information",
          "To make learning harder",
          "To avoid practicing"
        ],
        correctAnswerIndex: 0,
        explanation:
          "Study notes help you review, organize, and understand important information."
      },
      {
        questionText: "What should a good quiz question test?",
        choices: [
          "Understanding of the material",
          "Typing speed only",
          "Random unrelated facts",
          "How fast someone scrolls"
        ],
        correctAnswerIndex: 0,
        explanation:
          "A good quiz question checks whether the learner understands the material."
      },
      {
        questionText: "Why are explanations useful after a quiz?",
        choices: [
          "They explain why an answer is correct",
          "They remove the score",
          "They hide the answer",
          "They make studying harder"
        ],
        correctAnswerIndex: 0,
        explanation:
          "Explanations help students understand the reasoning behind the correct answer."
      }
    ],
    flashcards: [
      {
        front: "Study Notes",
        back: "Information used to review and learn a topic."
      },
      {
        front: "Quiz",
        back: "A set of questions used to test understanding."
      },
      {
        front: "Explanation",
        back: "A reason that helps explain why an answer is correct."
      }
    ]
  };
}

app.post("/api/generate-quiz", async (req, res) => {
  try {
    const { notes, difficulty } = req.body || {};
    const quizDifficulty = difficulty || "medium";

    if (!notes || notes.trim().length < 20) {
      return res.status(400).json({
        error: "Not enough material. Please provide more study notes."
      });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.json(getFallbackQuiz(quizDifficulty));
    }

    const prompt = `
You are an AI study assistant.

Create a study quiz from the notes below.

Difficulty: ${quizDifficulty}

Study notes:
${notes}

Return ONLY valid JSON. Do not include markdown. Do not include backticks.

The JSON must follow this exact structure:

{
  "title": "string",
  "summary": "string",
  "questions": [
    {
      "questionText": "string",
      "choices": ["string", "string", "string", "string"],
      "correctAnswerIndex": 0,
      "explanation": "string"
    }
  ],
  "flashcards": [
    {
      "front": "string",
      "back": "string"
    }
  ]
}

Rules:
- Create exactly 5 multiple-choice questions.
- Each question must have exactly 4 choices.
- correctAnswerIndex must be 0, 1, 2, or 3.
- Create exactly 5 flashcards.
- Keep explanations clear and beginner-friendly.
- Base the quiz only on the study notes.
`;

    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });

    const quizText = response.text;
    const quizData = JSON.parse(quizText);

    res.json(quizData);
  } catch (error) {
    console.error("AI quiz generation error:", error);

    res.json(getFallbackQuiz(req.body?.difficulty || "medium"));
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});