import { GoogleGenAI } from "@google/genai";

function isValidQuiz(data) {
  return data && typeof data.title === "string" && Array.isArray(data.questions) &&
    data.questions.length >= 1 && data.questions.length <= 20 &&
    data.questions.every((question) =>
      typeof question.questionText === "string" && question.questionText.trim() &&
      Array.isArray(question.choices) && question.choices.length === 4 &&
      question.choices.every((choice) => typeof choice === "string" && choice.trim()) &&
      Number.isInteger(question.correctAnswerIndex) &&
      question.correctAnswerIndex >= 0 && question.correctAnswerIndex < 4 &&
      typeof question.explanation === "string"
    );
}

export async function generateQuizData(notes, difficulty, apiKey = process.env.GEMINI_API_KEY) {
  if (!apiKey) throw new Error("Quiz generation requires a Gemini API key on the server.");
  const prompt = `You are an AI study assistant. Create a study quiz from these notes.
Difficulty: ${difficulty}
Study notes: ${notes}

Return only valid JSON with this structure:
{"title":"string","summary":"string","questions":[{"questionText":"string","choices":["string","string","string","string"],"correctAnswerIndex":0,"explanation":"string"}],"flashcards":[{"front":"string","back":"string"}]}

Create exactly 5 multiple-choice questions, each with four choices and one correct answer.
Create 5 flashcards. Base the quiz only on the notes. Keep explanations clear.`;
  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash", contents: prompt,
      config: { responseMimeType: "application/json" }
    });
    const data = JSON.parse(response.text);
    if (!isValidQuiz(data)) throw new Error("Invalid AI response shape");
    data.flashcards = Array.isArray(data.flashcards)
      ? data.flashcards.filter((card) => typeof card.front === "string" && typeof card.back === "string")
      : [];
    return { data };
  } catch (error) {
    console.error("AI quiz generation failed:", error);
    throw new Error("Quiz generation is unavailable. Please try again later.");
  }
}
