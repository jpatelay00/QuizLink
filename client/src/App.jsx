import { useEffect, useRef, useState } from "react";
import { api } from "./api";
import "./App.css";

const formats = {
  multiple_choice: "Multiple choice",
  fill_blank: "Fill in the blank",
  mixed: "Mixed"
};

const navigation = [
  ["quiz", "Practice"], ["sets", "Library"], ["history", "Results"],
  ["bookmarks", "Saved"], ["profile", "Account"], ["admin", "Admin"]
];

const navPaths = {
  quiz: "M4 5h16v14H4z M8 9h8 M8 13h5",
  sets: "M4 5h6v14H4z M14 5h6v14h-6z M7 9h.1 M17 9h.1",
  history: "M5 19h14 M7 15v-4 M12 15V7 M17 15v-7",
  bookmarks: "M7 4h10v16l-5-3-5 3z",
  profile: "M12 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M6 19v-2a6 6 0 0 1 12 0v2",
  admin: "M12 3l7 3v5c0 4-3 7-7 10-4-3-7-6-7-10V6z M9 12l2 2 4-4"
};

function NavIcon({ name }) {
  return <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={navPaths[name]} />
  </svg>;
}

function SaveQuestionButton({ questionId, bookmarks, pending, onToggle }) {
  const saved = bookmarks.some((bookmark) => bookmark.questionId === questionId);
  return <button type="button" className="quiet" aria-pressed={saved} disabled={pending}
    onClick={() => onToggle(questionId, saved)}>{saved ? "Unsave question" : "Save question"}</button>;
}

function AnswerReview({ question, children }) {
  const written = question.questionType === "fill_blank";
  return <article className="review-question">
    <div className="review-heading">
      <h3>{question.questionText}</h3>
      <span className={question.isCorrect ? "grade grade-pass" : "grade grade-miss"}>
        {question.isCorrect ? "Correct" : "Review"}
      </span>
    </div>
    <dl className="answer-review">
      <div><dt>Your answer</dt><dd>{written ? question.selectedText : question.choices[question.selectedAnswerIndex]}</dd></div>
      <div><dt>Correct answer</dt><dd>{written ? question.correctText : question.choices[question.correctAnswerIndex]}</dd></div>
    </dl>
    {question.explanation && <p>{question.explanation}</p>}
    {children}
  </article>;
}

function App() {
  const [checkingSession, setCheckingSession] = useState(true);
  const [user, setUser] = useState(null);
  const [csrfToken, setCsrfToken] = useState("");
  const [authMode, setAuthMode] = useState("login");
  const [authForm, setAuthForm] = useState({ displayName: "", email: "", password: "" });
  const [view, setView] = useState("quiz");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const [notes, setNotes] = useState("");
  const [difficulty, setDifficulty] = useState("medium");
  const [questionType, setQuestionType] = useState("multiple_choice");
  const [questionCount, setQuestionCount] = useState("5");
  const [activeQuestion, setActiveQuestion] = useState(0);
  const [hints, setHints] = useState({});
  const [quiz, setQuiz] = useState(null);
  const [quizSetId, setQuizSetId] = useState("");
  const [selectedAnswers, setSelectedAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [flippedCards, setFlippedCards] = useState({});
  const [history, setHistory] = useState([]);
  const [bookmarks, setBookmarks] = useState([]);
  const [bookmarkPending, setBookmarkPending] = useState(false);
  const [review, setReview] = useState(null);
  const [profileForm, setProfileForm] = useState({ displayName: "", bio: "" });
  const [passwordForm, setPasswordForm] = useState({ currentPassword: "", newPassword: "" });
  const [adminUsers, setAdminUsers] = useState([]);
  const [studySets, setStudySets] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [searching, setSearching] = useState(false);
  const [selectedSet, setSelectedSet] = useState(null);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [postingComment, setPostingComment] = useState(false);
  const [setForm, setSetForm] = useState({ title: "", description: "", topic: "", subject: "", visibility: "private" });
  const [cardForm, setCardForm] = useState({ front: "", back: "" });
  const [flippedSetCards, setFlippedSetCards] = useState({});
  const [generationNotes, setGenerationNotes] = useState("");
  const [generateType, setGenerateType] = useState("flashcards");
  const [generationCount, setGenerationCount] = useState("5");
  const [generationDifficulty, setGenerationDifficulty] = useState("medium");
  const [generationFormat, setGenerationFormat] = useState("multiple_choice");
  const setDetailRef = useRef(null);
  const selectedSetId = selectedSet?.set.studySetId;

  useEffect(() => {
    if (selectedSetId) setDetailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [selectedSetId]);

  useEffect(() => {
    api("/api/auth/me")
      .then(({ user: currentUser, csrfToken: token }) => {
        setUser(currentUser);
        setCsrfToken(token);
        setProfileForm({ displayName: currentUser.displayName, bio: currentUser.bio || "" });
      })
      .catch(() => { })
      .finally(() => setCheckingSession(false));
  }, []);

  useEffect(() => {
    if (!user) return;
    api("/api/quiz-attempts").then((data) => setHistory(data.attempts)).catch(() => { });
    api("/api/study-sets").then((data) => setStudySets(data.sets)).catch(() => { });
  }, [user]);



  useEffect(() => {
    if (user) {
      api("/api/question-bookmarks")
        .then((data) => setBookmarks(data.bookmarks))
        .catch(() => {});
    }
  }, [user]);



  function showView(nextView) {
    setView(nextView);
    setError("");
    setMessage("");
    if (nextView === "admin") {
      api("/api/admin/users").then((data) => setAdminUsers(data.users)).catch((err) => setError(err.message));
    }
    if (nextView === "sets") refreshSets();
    if (nextView === "bookmarks") refreshBookmarks();
  }


  async function refreshBookmarks() {
    try {
      const data = await api("/api/question-bookmarks");
      setBookmarks(data.bookmarks);
    } catch (err) {
      setError(err.message);
    }
  }

  async function addBookmark(questionId) {
    setError("");

    try {
      await api(`/api/question-bookmarks/${questionId}`, {
        method: "PUT",
        csrfToken,
      });

      await refreshBookmarks();
      setMessage("Question bookmarked successfully.");
    } catch (err) {
      setError(err.message);
    }
  }

  async function toggleQuestionBookmark(questionId, saved) {
    setBookmarkPending(true);
    try {
      if (saved) await removeBookmark(questionId);
      else await addBookmark(questionId);
    } finally {
      setBookmarkPending(false);
    }
  }

  async function removeBookmark(questionId) {
    setError("");

    try {
      await api(`/api/question-bookmarks/${questionId}`, {
        method: "DELETE",
        csrfToken,
      });

      await refreshBookmarks();
      setMessage("Bookmark removed.");
    } catch (err) {
      setError(err.message);
    }
  }


  async function searchPublicSets(event) {
    event.preventDefault();
    setError("");

    const query = searchTerm.trim();

    if (!query) {
      setSearchResults([]);
      setHasSearched(false);
      return;
    }

    setSearching(true);

    try {
      const data = await api(
        `/api/study-sets/search?q=${encodeURIComponent(query)}`
      );

      setSearchResults(data.sets);
      setHasSearched(true);
    } catch (err) {
      setError(err.message);
      setSearchResults([]);
      setHasSearched(false);
    } finally {
      setSearching(false);
    }
  }

  async function refreshSets() {
    try {
      const data = await api("/api/study-sets");
      setStudySets(data.sets);
    } catch (err) { setError(err.message); }
  }


  async function openSet(studySetId) {
    setError("");
    setComments([]);
    setNewComment("");

    try {
      const data = await api(`/api/study-sets/${studySetId}`);
      setSelectedSet(data);
      setFlippedSetCards({});
      if (data.set.visibility === "public") {
        const result = await api(`/api/study-sets/${studySetId}/comments`);
        setComments(result.comments);
      }
    } catch (err) {
      setSelectedSet(null);
      setError(err.message);
    }
  }


  async function createSet(event) {
    event.preventDefault(); setError("");
    try {
      const { studySetId } = await api("/api/study-sets", { method: "POST", body: setForm, csrfToken });
      setSetForm({ title: "", description: "", topic: "", subject: "", visibility: "private" });
      await refreshSets(); await openSet(studySetId);
      setMessage("Study set created.");
    } catch (err) { setError(err.message); }
  }


  async function postComment(event) {
    event.preventDefault();
    setError("");

    if (!selectedSet || !newComment.trim()) return;

    setPostingComment(true);

    try {
      const studySetId = selectedSet.set.studySetId;

      await api(`/api/study-sets/${studySetId}/comments`, {
        method: "POST",
        body: { body: newComment.trim() },
        csrfToken,
      });

      setNewComment("");

      const data = await api(
        `/api/study-sets/${studySetId}/comments`
      );

      setComments(data.comments);
      setMessage("Comment posted successfully.");
    } catch (err) {
      setError(err.message);
    } finally {
      setPostingComment(false);
    }
  }



  async function addCard(event) {
    event.preventDefault(); setError("");
    try {
      await api(`/api/study-sets/${selectedSet.set.studySetId}/flashcards`, { method: "POST", body: cardForm, csrfToken });
      setCardForm({ front: "", back: "" });
      await openSet(selectedSet.set.studySetId); await refreshSets();
      setMessage("Flashcard saved.");
    } catch (err) { setError(err.message); }
  }

  async function changeVisibility(visibility) {
    setError("");
    try {
      await api(`/api/study-sets/${selectedSet.set.studySetId}`, { method: "PATCH", body: { visibility }, csrfToken });
      await openSet(selectedSet.set.studySetId); await refreshSets();
      setMessage("Visibility updated.");
    } catch (err) { setError(err.message); }
  }

  async function generateSetContent(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    setBusy(true);
    const studySetId = selectedSet.set.studySetId;
    try {
      if (generateType === "flashcards") {
        const { count } = await api(`/api/study-sets/${studySetId}/generate-flashcards`, {
          method: "POST", body: { notes: generationNotes, count: Number(generationCount) }, csrfToken
        });
        await openSet(studySetId);
        setMessage(`${count} flashcards generated and saved to this study set.`);
      } else {
        const data = await api("/api/generate-quiz", {
          method: "POST", body: {
            notes: generationNotes, questionCount: Number(generationCount), difficulty: generationDifficulty,
            questionType: generationFormat, studySetId
          }, csrfToken
        });
        startQuiz(data);
        setMessage("Quiz generated and saved to the study set.");
      }
      await refreshSets();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function toggleFavorite(set) {
    setError("");
    try {
      await api(`/api/study-sets/${set.studySetId}/favorite`, { method: set.isFavorite ? "DELETE" : "PUT", csrfToken });
      await refreshSets();
    } catch (err) { setError(err.message); }
  }

  async function handleAuth(event) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const path = authMode === "register" ? "/api/auth/register" : "/api/auth/login";
      const data = await api(path, { method: "POST", body: authForm });
      setUser(data.user);
      setCsrfToken(data.csrfToken);
      setProfileForm({ displayName: data.user.displayName, bio: data.user.bio || "" });
      setAuthForm({ displayName: "", email: "", password: "" });
      setView("quiz");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    setError("");
    try {
      await api("/api/auth/logout", { method: "POST", csrfToken });
      setUser(null);
      setCsrfToken("");
      setQuiz(null);
      setNotes("");
      setGenerationNotes("");
      setSelectedAnswers({});
      setHints({});
      setSearchTerm("");
      setSearchResults([]);
      setHasSearched(false);
      setComments([]);
      setNewComment("");
      setSetForm({ title: "", description: "", topic: "", subject: "", visibility: "private" });
      setCardForm({ front: "", back: "" });
      setResult(null);
      setHistory([]);
      setReview(null);
      setStudySets([]);
      setSelectedSet(null);
      setBookmarks([]);
      setView("quiz");
      setMessage("You have logged out.");
    } catch (err) {
      setError(err.message);
    }
  }


  async function uploadStudyFile(event, onImport = setNotes) {
    const file = event.target.files?.[0];

    if (!file) return;

    setError("");
    setMessage("");

    if (!file.name.toLowerCase().endsWith(".txt")) {
      setError("Please select a .txt file.");
      event.target.value = "";
      return;
    }

    if (file.size > 60000) {
      setError("The selected file is too large.");
      event.target.value = "";
      return;
    }

    setBusy(true);

    try {
      const content = await file.text();

      if (content.trim().length < 20 ||
          content.trim().length > 20000) {
        throw new Error(
          "The file must contain 20 to 20,000 characters."
        );
      }

      const data = await api("/api/study-files", {
        method: "POST",
        body: {
          filename: file.name,
          content
        },
        csrfToken
      });

      onImport(data.content);
      setMessage(`Uploaded ${data.filename} successfully.`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
      event.target.value = "";
    }
  }


  function startQuiz(data) {
    setQuiz(data);
    setQuizSetId(data.studySetId ? String(data.studySetId) : "");
    setResult(null);
    setSelectedAnswers({});
    setActiveQuestion(0);
    setHints({});
    setFlippedCards({});
    setView("quiz");
  }

  async function openQuiz(quizId, questionId) {
    setError("");
    setMessage("");
    setBusy(true);
    try {
      const data = await api(`/api/quizzes/${quizId}`);
      startQuiz(data);
      const index = data.questions.findIndex((item) => item.questionId === questionId);
      if (index >= 0) setActiveQuestion(index);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function saveQuizToSet(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    setBusy(true);
    try {
      const { studySetId } = await api(`/api/quizzes/${quiz.quizId}/study-set`, {
        method: "PUT", body: { studySetId: Number(quizSetId) }, csrfToken
      });
      setQuiz({ ...quiz, studySetId });
      setMessage("Quiz saved to the study set.");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function generateQuiz(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    setBusy(true);
    try {
      const data = await api("/api/generate-quiz", {
        method: "POST", body: { notes, difficulty, questionType, questionCount: Number(questionCount) }, csrfToken,
      });
      startQuiz(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function submitQuiz() {
    if (!quiz) return;
    const answers = quiz.questions.map((_, index) => selectedAnswers[index]);
    if (answers.some((answer) => answer === undefined || (typeof answer === "string" && !answer.trim()))) {
      setError("Please answer every question before submitting.");
      return;
    }
    setError("");
    setBusy(true);
    try {
      const data = await api("/api/quiz-attempts", {
        method: "POST", body: { quizId: quiz.quizId, answers }, csrfToken,
      });
      setResult(data);
      const historyData = await api("/api/quiz-attempts");
      setHistory(historyData.attempts);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function requestHint(questionId) {
    setHints((current) => ({ ...current, [questionId]: { pending: true } }));
    try {
      const { hint } = await api(`/api/questions/${questionId}/hint`, { method: "POST", csrfToken });
      setHints((current) => ({ ...current, [questionId]: { text: hint } }));
    } catch (err) {
      setHints((current) => ({ ...current, [questionId]: { error: err.message } }));
    }
  }

  async function moderateComment(comment) {
    const studySetId = selectedSet.set.studySetId;
    const status = comment.status === "hidden" ? "visible" : "hidden";
    setError("");
    try {
      await api(`/api/study-sets/${studySetId}/comments/${comment.commentId}`, {
        method: "PATCH", body: { status }, csrfToken
      });
      setComments((current) => current.map((item) =>
        item.commentId === comment.commentId ? { ...item, status } : item));
    } catch (err) {
      setError(err.message);
    }
  }

  async function reviewAttempt(attemptId) {
    setError("");
    try {
      setReview(await api(`/api/quiz-attempts/${attemptId}`));
    } catch (err) {
      setError(err.message);
    }
  }

  async function saveProfile(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    try {
      const data = await api("/api/auth/profile", {
        method: "PATCH", body: profileForm, csrfToken,
      });
      setUser(data.user);
      setMessage("Profile saved.");
    } catch (err) {
      setError(err.message);
    }
  }


  async function changePassword(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    try {
      await api("/api/auth/password", { method: "POST", body: passwordForm, csrfToken });
      setPasswordForm({ currentPassword: "", newPassword: "" });
      setMessage("Password changed.");
    } catch (err) {
      setError(err.message);
    }
  }

  async function updateAdminUser(changedUser) {
    setError("");
    try {
      await api(`/api/admin/users/${changedUser.userId}`, {
        method: "PATCH",
        body: { role: changedUser.role, accountStatus: changedUser.accountStatus },
        csrfToken,
      });
      const data = await api("/api/admin/users");
      setAdminUsers(data.users);
      setMessage("User updated.");
    } catch (err) {
      setError(err.message);
    }
  }

  if (checkingSession) return <main className="loading-screen"><span className="brand-mark">Q</span><p>Opening your workspace…</p></main>;

  const question = quiz?.questions[activeQuestion];
  const ownedSets = studySets.filter((set) => set.ownerId === user?.userId);
  const hint = question && hints[question.questionId];
  const isAnswered = (index) => {
    const answer = selectedAnswers[index];
    return typeof answer === "number" || Boolean(answer?.trim());
  };
  const answered = quiz ? quiz.questions.filter((_, index) => isAnswered(index)).length : 0;

  return (
    <div className={`app ${user ? "app-authenticated" : "app-guest"}`}>
      <header className="masthead">
        <div className="masthead-inner">
          <div className="brand-lockup"><span className="brand-mark" aria-hidden="true"><NavIcon name="quiz" /></span><strong>QuizLink</strong></div>
          {user && <>
            <span className="rail-label">Workspace</span>
            <nav aria-label="Main navigation">
              {navigation.filter(([key]) => key !== "admin" || user.role === "admin").map(([key, name]) =>
                <button key={key} aria-current={view === key ? "page" : undefined} onClick={() => showView(key)}>
                  <NavIcon name={key} /><span>{name}</span>
                </button>
              )}
            </nav>
            <div className="account-control">
              <span className="avatar" aria-hidden="true">{user.displayName.charAt(0).toUpperCase()}</span>
              <div className="account-name">{user.displayName}</div>
              <button className="quiet" disabled={busy} onClick={logout}>Sign out</button>
            </div>
          </>}
        </div>
      </header>
      <div className="main-column">
        {user && <div className="workspace-bar">
          <span>Workspace <b aria-hidden="true">/</b> <strong>{navigation.find(([key]) => key === view)?.[1]}</strong></span>
          {view === "quiz" && <ol className="flow-steps" aria-label="Quiz workflow">
            <li aria-current={!quiz ? "step" : undefined}><span>1</span> Build</li>
            <li aria-current={quiz && !result ? "step" : undefined}><span>2</span> Practice</li>
            <li aria-current={result ? "step" : undefined}><span>3</span> Review</li>
          </ol>}
        </div>}
        <main className="content">

          {error && <p role="alert" className="alert error">{error}</p>}
          {message && <p role="status" className="alert success">{message}</p>}

          {!user ? (
            <div className="welcome-grid">
              <section className="card auth-card">
                <h1>{authMode === "register" ? "Create an account" : "Sign in to QuizLink"}</h1>
                <p>Open your study sets, quizzes, and saved questions.</p>
                <div className="auth-tabs">
                  <button aria-pressed={authMode === "login"} onClick={() => { setAuthMode("login"); setError(""); }}>Sign in</button>
                  <button aria-pressed={authMode === "register"} onClick={() => { setAuthMode("register"); setError(""); }}>Create account</button>
                </div>
                <form onSubmit={handleAuth}>
                  {authMode === "register" && <label>Display name<input value={authForm.displayName} onChange={(event) => setAuthForm({ ...authForm, displayName: event.target.value })} maxLength="100" required /></label>}
                  <label>Email<input type="email" autoComplete="username" value={authForm.email} onChange={(event) => setAuthForm({ ...authForm, email: event.target.value })} required /></label>
                  <label>Password<input type="password" autoComplete={authMode === "register" ? "new-password" : "current-password"} value={authForm.password} onChange={(event) => setAuthForm({ ...authForm, password: event.target.value })} minLength="8" required /></label>
                  <button type="submit" className="primary" disabled={busy}>{busy ? "Please wait…" : authMode === "register" ? "Create account" : "Log in"}</button>
                </form>
              </section>
              <aside className="sample-sheet" aria-label="Example quiz from study notes">
                <div className="sample-top"><NavIcon name="quiz" /><span>Sample worksheet</span></div>
                <div className="sample-body">
                  <p className="sample-label">SOURCE NOTES</p>
                  <h2>Cell biology</h2>
                  <p>Eukaryotic cells keep their chromosomes in the nucleus. Ribosomes build proteins.</p>
                  <div className="sample-divider"><span>↓</span> From notes to a question</div>
                  <p className="sample-label">QUESTION 01</p>
                  <h3>Which structure stores chromosomes?</h3>
                  <div className="sample-choice sample-correct"><b>A</b> Nucleus <span>✓</span></div>
                  <div className="sample-choice"><b>B</b> Ribosome</div>
                </div>
              </aside>
            </div>
          ) : (

            <>
              {view === "quiz" && <>
                <section className="page-heading practice-heading">
                  <div><h1>{quiz ? (result ? "Quiz review" : "Practice session") : "Quiz workshop"}</h1><p>{quiz ? (result ? "Check your answers and see what to revisit." : "Answer each question, then submit to see your score.") : "Paste or import notes, then set up a quiz."}</p></div>
                  <button className="quiet history-link" onClick={() => showView("history")}>Results <span>{history.length}</span> ↗</button>
                </section>

                {!quiz && <form className="work-grid" onSubmit={generateQuiz}>
                  <section className="card notes-panel">
                    <div className="panel-bar"><span><NavIcon name="sets" /> Study notes</span>
                      <label className="upload-button">Import .txt
                        <input type="file" accept=".txt,text/plain" onChange={uploadStudyFile} disabled={busy} aria-label="Import text file" />
                      </label>
                    </div>
                    <label className="sr-only" htmlFor="study-notes">Study notes</label>
                    <textarea id="study-notes" value={notes} onChange={(event) => setNotes(event.target.value)}
                      maxLength={20000} placeholder="Paste a lecture excerpt, vocabulary list, or your own notes…" />
                    <div className="editor-footer"><span>20 characters minimum</span><span>{notes.length.toLocaleString()} / 20,000</span></div>
                  </section>
                  <section className="card setup-panel">
                    <div className="panel-bar"><span><NavIcon name="quiz" /> Quiz settings</span></div>
                    <div className="setup-body">
                      <label htmlFor="quiz-format">Question format</label>
                      <select id="quiz-format" value={questionType} onChange={(event) => {
                        setQuestionType(event.target.value);
                        if (event.target.value === "mixed" && Number(questionCount) < 2) setQuestionCount("2");
                      }}>
                        {Object.entries(formats).map(([value, name]) => <option key={value} value={value}>{name}</option>)}
                      </select>
                      <div className="field-grid setup-fields">
                        <div><label htmlFor="difficulty">Difficulty</label>
                          <select id="difficulty" value={difficulty} onChange={(event) => setDifficulty(event.target.value)}>
                            <option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option>
                          </select></div>
                        <div><label htmlFor="question-count">Questions</label>
                          <input id="question-count" type="number" required min={questionType === "mixed" ? 2 : 1} max={20}
                            value={questionCount} onChange={(event) => setQuestionCount(event.target.value)} /></div>
                      </div>
                      {questionType === "mixed" && <p className="field-note">Mixed quizzes need at least two questions.</p>}
                      <button className="primary build-button" type="submit" disabled={busy || notes.trim().length < 20}>
                        {busy ? "Working…" : "Build quiz"} <span aria-hidden="true">→</span>
                      </button>
                    </div>
                  </section>
                </form>}

                {quiz && <section className="card practice-sheet">
                  <div className="sheet-header"><div><p className="eyebrow">{formats[quiz.questionType]} / {quiz.difficulty}</p><h2>{quiz.title}</h2></div>
                    <button className="quiet" disabled={busy} onClick={() => { setQuiz(null); setResult(null); }}>New quiz</button></div>
                  {quiz.canEdit && (ownedSets.length ? (
                    <form onSubmit={saveQuizToSet}>
                      <label>Study set<select value={quizSetId} onChange={(event) => setQuizSetId(event.target.value)}>
                        <option value="">Choose a study set</option>
                        {ownedSets.map((set) => <option key={set.studySetId} value={set.studySetId}>{set.title} ({set.visibility})</option>)}
                      </select></label>
                      {ownedSets.some((set) => String(set.studySetId) === quizSetId && set.visibility === "public") &&
                        <p className="field-note">Other learners can take quizzes in public study sets.</p>}
                      <button type="submit" disabled={busy || !quizSetId || Number(quizSetId) === quiz.studySetId}>
                        {quiz.studySetId && Number(quizSetId) === quiz.studySetId ? "Saved to study set" : "Save to study set"}
                      </button>
                    </form>
                  ) : <p>Create a study set in Library, then return here to save this quiz.</p>)}
                  {result ? <>
                    <div className="score-banner"><span>QUIZ COMPLETE</span><strong>{result.score} / {result.total}</strong><span>correct</span></div>
                    {result.questions.map((item) => <AnswerReview key={item.questionId} question={item}>
                      <SaveQuestionButton questionId={item.questionId} bookmarks={bookmarks} pending={bookmarkPending} onToggle={toggleQuestionBookmark} />
                    </AnswerReview>)}
                  </> : <>
                    <div className="progress-row"><span>{answered} of {quiz.questions.length} answered</span>
                      <progress value={answered} max={quiz.questions.length} aria-label="Questions answered" /></div>
                    <div className="question-index" aria-label="Jump to question">
                      {quiz.questions.map((item, index) => <button key={item.questionId}
                        className={isAnswered(index) ? "answered" : ""}
                        aria-label={`Question ${index + 1}${isAnswered(index) ? ", answered" : ""}`}
                        aria-current={index === activeQuestion ? "step" : undefined}
                        onClick={() => setActiveQuestion(index)}>{index + 1}</button>)}
                    </div>
                    <article className="practice-question">
                      <div className="question-heading"><p className="eyebrow">QUESTION {activeQuestion + 1} / {quiz.questions.length}</p>
                        <SaveQuestionButton questionId={question.questionId} bookmarks={bookmarks} pending={bookmarkPending} onToggle={toggleQuestionBookmark} /></div>
                      <h3>{question.questionText}</h3>
                      {question.questionType === "fill_blank" ? (
                        <label>Your answer<input maxLength={500} value={selectedAnswers[activeQuestion] ?? ""}
                          onChange={(event) => setSelectedAnswers({ ...selectedAnswers, [activeQuestion]: event.target.value })} /></label>
                      ) : question.choices.map((choice, index) => (
                        <button key={index} className="choice" aria-pressed={selectedAnswers[activeQuestion] === index}
                          onClick={() => setSelectedAnswers({ ...selectedAnswers, [activeQuestion]: index })}>
                          <span>{String.fromCharCode(65 + index)}</span>{choice}
                        </button>
                      ))}
                      {!hint?.text && <button className="quiet hint-button" disabled={hint?.pending}
                        onClick={() => requestHint(question.questionId)}>{hint?.pending ? "Getting hint…" : "Request a hint"}</button>}
                      {hint?.text && <p className="hint-note" role="status"><strong>Hint</strong> {hint.text}</p>}
                      {hint?.error && <p className="hint-note" role="alert">{hint.error}</p>}
                    </article>
                    <div className="practice-actions">
                      <button className="quiet" disabled={activeQuestion === 0} onClick={() => setActiveQuestion(activeQuestion - 1)}>← Previous</button>
                      {activeQuestion < quiz.questions.length - 1 &&
                        <button className="quiet" onClick={() => setActiveQuestion(activeQuestion + 1)}>Next →</button>}
                      <button className="primary" onClick={submitQuiz} disabled={busy || answered !== quiz.questions.length}>Submit quiz</button>
                    </div>
                  </>}
                </section>}

                {result && quiz?.flashcards?.length > 0 && <section className="card"><h2>Flashcards</h2><p>Select a card to flip it.</p>
                  <div className="flashcard-grid">{quiz.flashcards.map((card, index) => <button className="flashcard" key={index}
                    onClick={() => setFlippedCards({ ...flippedCards, [index]: !flippedCards[index] })}>
                    {flippedCards[index] ? card.back : card.front}</button>)}</div></section>}
              </>}

              {view === "sets" && <>
                <section className="page-heading"><div><h1>Study library</h1><p>Organize quizzes and flashcards or find material shared by classmates.</p></div><div className="heading-stat"><strong>{ownedSets.length}</strong><span>your {ownedSets.length === 1 ? "set" : "sets"}</span></div></section>

                <section className="card">
                  <h2>Search Public Study Sets</h2>
                  <p>Find study materials shared by other students.</p>

                  <form onSubmit={searchPublicSets}>
                    <label>
                      Search by title, topic, subject, or keyword

                      <input
                        type="text"
                        placeholder="Example: Biology, Math, Algorithms"
                        value={searchTerm}
                        maxLength={100}
                        onChange={(event) => setSearchTerm(event.target.value)}
                      />
                    </label>

                    <button
                      className="primary"
                      type="submit"
                      disabled={searching}
                    >
                      {searching ? "Searching..." : "Search"}
                    </button>
                  </form>

                  {hasSearched && (
                    <div>
                      <h3>Search Results</h3>

                      {searchResults.length === 0 ? (
                        <p>No matching public study sets found.</p>
                      ) : (
                        searchResults.map((set) => (
                          <div className="set-row" key={set.studySetId}>
                            <div>
                              <strong>{set.title}</strong>

                              <p>
                                {set.subject || set.topic || "General"}
                                {" · "}
                                {set.ownerName}
                              </p>


                              {set.description && (
                                <p>{set.description}</p>
                              )}
                            </div>

                            <div className="set-actions">
                              <button
                                type="button"
                                onClick={() => openSet(set.studySetId)}
                              >
                                Open
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </section>

                <section className="card"><h2>Create a study set</h2><form onSubmit={createSet}>
                  <label>Title<input value={setForm.title} maxLength="150" required onChange={(event) => setSetForm({ ...setForm, title: event.target.value })} /></label>
                  <label>Description<textarea value={setForm.description} maxLength="1000" onChange={(event) => setSetForm({ ...setForm, description: event.target.value })} /></label>
                  <div className="field-grid"><label>Topic<input value={setForm.topic} maxLength="100" onChange={(event) => setSetForm({ ...setForm, topic: event.target.value })} /></label>
                    <label>Subject<input value={setForm.subject} maxLength="100" onChange={(event) => setSetForm({ ...setForm, subject: event.target.value })} /></label></div>
                  <label>Visibility<select value={setForm.visibility} onChange={(event) => setSetForm({ ...setForm, visibility: event.target.value })}><option value="private">Private</option><option value="public">Public</option></select></label>
                  <p><button className="primary" type="submit">Create set</button></p>
                </form></section>
                <section className="card"><h2>Available study sets</h2>
                  {studySets.length === 0 ? <p>No study sets yet. Create the first one above.</p> : studySets.map((set) =>
                    <div className="set-row" key={set.studySetId}>
                      <div><button className="set-title" onClick={() => openSet(set.studySetId)}>{set.title}</button><p>{set.visibility} · {set.ownerName} · {set.cardCount} flashcards · {set.quizCount} quizzes</p>{set.description && <p>{set.description}</p>}</div>
                      <div className="set-actions"><button disabled={busy} onClick={() => openSet(set.studySetId)}>Open</button>
                        <button onClick={() => toggleFavorite(set)}>{set.isFavorite ? "Unfavorite" : "Favorite"}</button></div>
                    </div>)}
                </section>
                {selectedSet && <section className="card set-detail" ref={setDetailRef}><h2>{selectedSet.set.title}</h2>
                  <p>{selectedSet.set.visibility} · {selectedSet.set.ownerName}</p>
                  <p>{selectedSet.set.visibility === "public"
                    ? "Signed-in learners can take these quizzes, practice flashcards, and comment. Each learner's results stay private."
                    : "Only you can open this study set. Make it public to share its quizzes and flashcards."}</p>
                  {selectedSet.set.ownerId === user.userId && <div className="form-row"><label htmlFor="set-visibility">Visibility</label>
                    <select id="set-visibility" value={selectedSet.set.visibility} onChange={(event) => changeVisibility(event.target.value)}><option value="private">Private</option><option value="public">Public</option></select></div>}
                  {selectedSet.set.ownerId === user.userId && <form className="set-generator" onSubmit={generateSetContent}>
                    <h3>Generate from your notes</h3>
                    <label>Study notes<textarea value={generationNotes} onChange={(event) => setGenerationNotes(event.target.value)}
                      minLength={20} maxLength={20000} required disabled={busy} /></label>
                    <label className="upload-button">Import .txt
                      <input type="file" accept=".txt,text/plain" aria-label="Import study set notes" disabled={busy}
                        onChange={(event) => uploadStudyFile(event, setGenerationNotes)} />
                    </label>
                    <div className="field-grid">
                      <label>Generate<select value={generateType} disabled={busy} onChange={(event) => {
                        setGenerateType(event.target.value);
                        if (event.target.value === "quiz" && generationFormat === "mixed" && Number(generationCount) < 2) setGenerationCount("2");
                      }}><option value="flashcards">Flashcards</option><option value="quiz">Quiz</option></select></label>
                      <label>{generateType === "flashcards" ? "Flashcard count" : "Question count"}<input type="number"
                        min={generateType === "quiz" && generationFormat === "mixed" ? 2 : 1} max={20} required disabled={busy}
                        value={generationCount} onChange={(event) => setGenerationCount(event.target.value)} /></label>
                    </div>
                    {generateType === "quiz" && <div className="field-grid">
                      <label>Question format<select value={generationFormat} disabled={busy} onChange={(event) => {
                        setGenerationFormat(event.target.value);
                        if (event.target.value === "mixed" && Number(generationCount) < 2) setGenerationCount("2");
                      }}>{Object.entries(formats).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                      <label>Difficulty<select value={generationDifficulty} disabled={busy} onChange={(event) => setGenerationDifficulty(event.target.value)}>
                        <option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option>
                      </select></label>
                    </div>}
                    <p className="field-note">Generated content saves directly to this {selectedSet.set.visibility} study set.</p>
                    <button className="primary" type="submit" disabled={busy}>{busy ? "Generating…" : generateType === "flashcards" ? "Generate flashcards" : "Generate quiz"}</button>
                  </form>}
                  <h3>Quizzes</h3>
                  {selectedSet.quizzes.length === 0 ? <p>No quizzes yet.</p> : selectedSet.quizzes.map((savedQuiz) =>
                    <div className="set-row" key={savedQuiz.quizId}>
                      <div><strong>{savedQuiz.title}</strong><p>{formats[savedQuiz.questionType]} · {savedQuiz.difficulty} · {savedQuiz.questionCount} {savedQuiz.questionCount === 1 ? "question" : "questions"}</p></div>
                      <button disabled={busy} onClick={() => openQuiz(savedQuiz.quizId)}>Take quiz</button>
                    </div>)}
                  <h3>Flashcards</h3>
                  {selectedSet.cards.length === 0 ? <p>No flashcards yet.</p> : <div className="flashcard-grid">{selectedSet.cards.map((card) =>
                    <button className="flashcard" key={card.flashcardId} onClick={() => setFlippedSetCards({ ...flippedSetCards, [card.flashcardId]: !flippedSetCards[card.flashcardId] })}>{flippedSetCards[card.flashcardId] ? card.back : card.front}</button>)}</div>}
                  {selectedSet.set.ownerId === user.userId && <form onSubmit={addCard}><h3>Add a flashcard</h3>
                    <label>Front<input value={cardForm.front} maxLength="500" required onChange={(event) => setCardForm({ ...cardForm, front: event.target.value })} /></label>
                    <label>Back<textarea value={cardForm.back} maxLength="2000" required onChange={(event) => setCardForm({ ...cardForm, back: event.target.value })} /></label>
                    <button className="primary" type="submit">Save flashcard</button></form>}

              {selectedSet.set.visibility === "public" && (
                <div className="comments-section">
                  <h3>Comments</h3>

                  {comments.length === 0 ? (
                    <p>No comments yet. Be the first to comment!</p>
                  ) : (
                    comments.map((comment) => (
                      <div
                        className="set-row"
                        key={comment.commentId}
                      >
                        <div>
                          <strong>{comment.authorName}{comment.status === "hidden" ? " · Hidden" : ""}</strong>
                          <p>{comment.body}</p>
                        </div>
                        {user.role === "admin" && <div className="set-actions">
                          <button onClick={() => moderateComment(comment)}>{comment.status === "hidden" ? "Restore" : "Hide"}</button>
                        </div>}
                      </div>
                    ))
                  )}



<form onSubmit={postComment}>
                    <label>
                      Add a comment
                      <textarea
                        value={newComment}
                        onChange={(event) =>
                          setNewComment(event.target.value)
                        }
                        maxLength={2000}
                        required
                        placeholder="Share your thoughts..."
                      />
                    </label>

                    <button
                      className="primary"
                      type="submit"
                      disabled={postingComment || !newComment.trim()}
                    >
                      {postingComment
                        ? "Posting..."
                        : "Post Comment"}
                    </button>
                  </form>
                </div>
              )}
            </section>}
          </>}

          {view === "bookmarks" && (
            <section className="card">
              <h1>Saved Questions</h1>
              <p>Review questions you have bookmarked.</p>

              {bookmarks.length === 0 ? (
                <p>You haven't bookmarked any questions yet.</p>
              ) : (
                bookmarks.map((bookmark) => (
                  <div
                    className="question"
                    key={bookmark.questionId}
                  >
                    <p className="eyebrow">
                      {bookmark.quizTitle}
                    </p>

                    <h3><button className="set-title" disabled={busy}
                      onClick={() => openQuiz(bookmark.quizId, bookmark.questionId)}>{bookmark.questionText}</button></h3>
                    <button disabled={busy} onClick={() => openQuiz(bookmark.quizId, bookmark.questionId)}>Practice this question</button>

                    {bookmark.explanation && (
                      <p>{bookmark.explanation}</p>
                    )}


<button
                      className="quiet"
                      type="button"
                      onClick={() =>
                        removeBookmark(bookmark.questionId)
                      }
                    >
                      Remove Bookmark
                    </button>
                  </div>
                ))
              )}
            </section>
          )}


          {view === "history" && <section className="card"><h1>Quiz history</h1>
                {history.length === 0 ? <p>No completed quizzes yet.</p> : history.map((attempt) => <div className="history-item" key={attempt.attemptId}>
                  <div><strong>{attempt.title}</strong><p>{attempt.difficulty} · {attempt.score}/{attempt.total} · {attempt.date}</p></div>
                  <div className="set-actions">
                    <button onClick={() => reviewAttempt(attempt.attemptId)}>Review answers</button>
                    {Boolean(attempt.canRetake) &&
                      <button disabled={busy} onClick={() => openQuiz(attempt.quizId)}>Take again</button>}
                  </div>
                </div>)}
                {review && <div className="review"><h2>{review.attempt.title} · {review.score}/{review.total}</h2>
                  {review.questions.map((item) => <AnswerReview key={item.questionId} question={item}>
                    <SaveQuestionButton questionId={item.questionId} bookmarks={bookmarks} pending={bookmarkPending} onToggle={toggleQuestionBookmark} />
                  </AnswerReview>)}</div>}
              </section>}

              {view === "profile" && <div className="profile-grid"><section className="card"><h1>Your profile</h1>
                <p><strong>Email:</strong> {user.email}<br /><strong>Role:</strong> {user.role}</p>
                <form onSubmit={saveProfile}><label>Display name<input value={profileForm.displayName} onChange={(event) => setProfileForm({ ...profileForm, displayName: event.target.value })} required /></label>
                  <label>Bio<textarea value={profileForm.bio} onChange={(event) => setProfileForm({ ...profileForm, bio: event.target.value })} maxLength="1000" /></label>
                  <button className="primary">Save profile</button></form></section>
                <section className="card"><h2>Change password</h2><form onSubmit={changePassword}>
                  <label>Current password<input type="password" value={passwordForm.currentPassword} onChange={(event) => setPasswordForm({ ...passwordForm, currentPassword: event.target.value })} required /></label>
                  <label>New password<input type="password" value={passwordForm.newPassword} onChange={(event) => setPasswordForm({ ...passwordForm, newPassword: event.target.value })} minLength="8" required /></label>
                  <button>Change password</button></form></section></div>}

              {view === "admin" && user.role === "admin" && <section className="card"><h1>User management</h1>
                {adminUsers.map((account) => <div className="admin-row" key={account.userId}>
                  <div><strong>{account.displayName}</strong><p>{account.email}</p></div>
                  <select aria-label={`Role for ${account.email}`} value={account.role} onChange={(event) => setAdminUsers(adminUsers.map((item) => item.userId === account.userId ? { ...item, role: event.target.value } : item))}>
                    <option value="student">Student</option><option value="admin">Admin</option></select>
                  <select aria-label={`Status for ${account.email}`} value={account.accountStatus} onChange={(event) => setAdminUsers(adminUsers.map((item) => item.userId === account.userId ? { ...item, accountStatus: event.target.value } : item))}>
                    <option value="active">Active</option><option value="suspended">Suspended</option></select>
                  <button onClick={() => updateAdminUser(account)}>Save</button>
                </div>)}</section>}
            </>
          )}
        </main>
        <footer>QuizLink <span>·</span> CSC 4350 Group 6</footer>
      </div>
    </div>
  );
}

export default App;
