import { useState } from "react";
import "./App.css";

function App() {
  const [notes, setNotes] = useState("");
  const [quiz, setQuiz] = useState(null);
  const [selectedAnswers, setSelectedAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [flippedCards, setFlippedCards] = useState({});
  const [difficulty, setDifficulty] = useState("medium");

  const [quizHistory, setQuizHistory] = useState(() => {
    const savedHistory = localStorage.getItem("quizHistory");
    return savedHistory ? JSON.parse(savedHistory) : [];
  });

  async function generateQuiz() {
    setLoading(true);
    setQuiz(null);
    setSelectedAnswers({});
    setSubmitted(false);
    setFlippedCards({});

    try {
      const response = await fetch("http://localhost:5001/api/generate-quiz", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          notes: notes,
          difficulty: difficulty
        })
      });

      const data = await response.json();
      console.log("Quiz data:", data);

      if (!response.ok) {
        alert(data.error || "Something went wrong.");
        return;
      }

      setQuiz(data);
    } catch (error) {
      console.error(error);
      alert(
        "Could not connect to the backend. Make sure your server is running on port 5001."
      );
    } finally {
      setLoading(false);
    }
  }

  function chooseAnswer(questionIndex, choiceIndex) {
    setSelectedAnswers({
      ...selectedAnswers,
      [questionIndex]: choiceIndex
    });
  }

  function toggleFlashcard(index) {
    setFlippedCards({
      ...flippedCards,
      [index]: !flippedCards[index]
    });
  }

  function calculateScore() {
    let score = 0;

    quiz.questions.forEach((question, index) => {
      if (selectedAnswers[index] === question.correctAnswerIndex) {
        score++;
      }
    });

    return score;
  }

  function submitQuiz() {
    const unansweredQuestion = quiz.questions.some((question, index) => {
      return selectedAnswers[index] === undefined;
    });

    if (unansweredQuestion) {
      alert("Please answer every question before submitting.");
      return;
    }

    const score = calculateScore();

    const attempt = {
      title: quiz.title,
      difficulty: difficulty,
      score: score,
      total: quiz.questions.length,
      date: new Date().toLocaleString()
    };

    const updatedHistory = [attempt, ...quizHistory];

    setQuizHistory(updatedHistory);
    localStorage.setItem("quizHistory", JSON.stringify(updatedHistory));

    setSubmitted(true);
  }

  function clearHistory() {
    setQuizHistory([]);
    localStorage.removeItem("quizHistory");
  }

  return (
    <div className="app">
      <h1>AI Study Quiz Builder</h1>

      <p className="subtitle">
        Paste study notes, generate a quiz, answer questions, and review
        explanations.
      </p>

      <div className="card">
        <h2>Paste Your Study Notes</h2>

        <textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Paste your study notes here..."
        />

        <div className="form-row">
          <label>
            Difficulty:
            <select
              value={difficulty}
              onChange={(event) => setDifficulty(event.target.value)}
            >
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </label>
        </div>

        <button onClick={generateQuiz} disabled={loading}>
          {loading ? "Generating..." : "Generate Quiz"}
        </button>
      </div>

      {quiz && (
        <div className="card">
          <h2>{quiz.title}</h2>
          <p>{quiz.summary}</p>

          {quiz.questions.map((question, questionIndex) => (
            <div className="question" key={questionIndex}>
              <h3>
                {questionIndex + 1}. {question.questionText}
              </h3>

              {question.choices.map((choice, choiceIndex) => {
                let buttonClass = "choice";

                if (selectedAnswers[questionIndex] === choiceIndex) {
                  buttonClass += " selected";
                }

                if (submitted && choiceIndex === question.correctAnswerIndex) {
                  buttonClass += " correct";
                }

                if (
                  submitted &&
                  selectedAnswers[questionIndex] === choiceIndex &&
                  choiceIndex !== question.correctAnswerIndex
                ) {
                  buttonClass += " wrong";
                }

                return (
                  <button
                    key={choiceIndex}
                    className={buttonClass}
                    onClick={() => chooseAnswer(questionIndex, choiceIndex)}
                    disabled={submitted}
                  >
                    {choice}
                  </button>
                );
              })}

              {submitted && (
                <div className="explanation">
                  <p>
                    <strong>Correct Answer:</strong>{" "}
                    {question.choices[question.correctAnswerIndex]}
                  </p>
                  <p>{question.explanation}</p>
                </div>
              )}
            </div>
          ))}

          {!submitted ? (
            <button className="submit-button" onClick={submitQuiz}>
              Submit Quiz
            </button>
          ) : (
            <h2 className="score">
              Score: {calculateScore()} / {quiz.questions.length}
            </h2>
          )}
        </div>
      )}

      {quiz && (
        <div className="card">
          <h2>Flashcards</h2>
          <p className="small-text">Click a card to flip it.</p>

          {quiz.flashcards && quiz.flashcards.length > 0 ? (
            <div className="flashcard-grid">
              {quiz.flashcards.map((card, index) => (
                <div
                  className="flashcard"
                  key={index}
                  onClick={() => toggleFlashcard(index)}
                >
                  <h3>{flippedCards[index] ? card.back : card.front}</h3>
                </div>
              ))}
            </div>
          ) : (
            <p>No flashcards were received from the backend.</p>
          )}
        </div>
      )}

      {quizHistory.length > 0 && (
        <div className="card">
          <h2>Quiz History</h2>

          {quizHistory.map((attempt, index) => (
            <div className="history-item" key={index}>
              <p>
                <strong>{attempt.title}</strong>
              </p>
              <p>Difficulty: {attempt.difficulty}</p>
              <p>
                Score: {attempt.score} / {attempt.total}
              </p>
              <p className="history-date">{attempt.date}</p>
            </div>
          ))}

          <button className="danger-button" onClick={clearHistory}>
            Clear History
          </button>
        </div>
      )}
    </div>
  );
}

export default App;