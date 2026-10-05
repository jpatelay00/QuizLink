import { useEffect, useState } from "react";
import { api } from "./api";
import "./App.css";

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
  const [quiz, setQuiz] = useState(null);
  const [selectedAnswers, setSelectedAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [flippedCards, setFlippedCards] = useState({});
  const [history, setHistory] = useState([]);
  const [review, setReview] = useState(null);
  const [profileForm, setProfileForm] = useState({ displayName: "", bio: "" });
  const [passwordForm, setPasswordForm] = useState({ currentPassword: "", newPassword: "" });
  const [adminUsers, setAdminUsers] = useState([]);
  const [studySets, setStudySets] = useState([]);
  const [selectedSet, setSelectedSet] = useState(null);
  const [setForm, setSetForm] = useState({ title: "", description: "", topic: "", subject: "", visibility: "private" });
  const [cardForm, setCardForm] = useState({ front: "", back: "" });
  const [flippedSetCards, setFlippedSetCards] = useState({});

  useEffect(() => {
    api("/api/auth/me")
      .then(({ user: currentUser, csrfToken: token }) => {
        setUser(currentUser);
        setCsrfToken(token);
        setProfileForm({ displayName: currentUser.displayName, bio: currentUser.bio || "" });
      })
      .catch(() => {})
      .finally(() => setCheckingSession(false));
  }, []);

  useEffect(() => {
    if (user) api("/api/quiz-attempts").then((data) => setHistory(data.attempts)).catch(() => {});
  }, [user]);

  function showView(nextView) {
    setView(nextView);
    setError("");
    setMessage("");
    if (nextView === "admin") {
      api("/api/admin/users").then((data) => setAdminUsers(data.users)).catch((err) => setError(err.message));
    }
    if (nextView === "sets") refreshSets();
  }

  async function refreshSets() {
    try {
      const data = await api("/api/study-sets");
      setStudySets(data.sets);
    } catch (err) { setError(err.message); }
  }

  async function openSet(studySetId) {
    setError("");
    try { setSelectedSet(await api(`/api/study-sets/${studySetId}`)); setFlippedSetCards({}); }
    catch (err) { setError(err.message); }
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
      setResult(null);
      setHistory([]);
      setReview(null);
      setStudySets([]);
      setSelectedSet(null);
      setView("quiz");
      setMessage("You have logged out.");
    } catch (err) {
      setError(err.message);
    }
  }

  async function generateQuiz() {
    setError("");
    setMessage("");
    setBusy(true);
    setQuiz(null);
    setResult(null);
    setSelectedAnswers({});
    setFlippedCards({});
    try {
      const data = await api("/api/generate-quiz", {
        method: "POST", body: { notes, difficulty }, csrfToken,
      });
      setQuiz(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function submitQuiz() {
    if (!quiz) return;
    const answers = quiz.questions.map((_, index) => selectedAnswers[index]);
    if (answers.some((answer) => answer === undefined)) {
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

  return (
    <div className={`app ${user ? "app-authenticated" : "app-guest"}`}>
      {user && <aside className="sidebar">
        <div className="brand-lockup"><span className="brand-mark">Q</span><div><strong>QuizLink</strong><small>STUDY WORKSPACE</small></div></div>
        <p className="nav-caption">WORKSPACE</p>
        <nav aria-label="Main navigation">
          <button className={view === "quiz" ? "nav-active" : "nav-button"} onClick={() => showView("quiz")}><span className="nav-icon">◫</span>Practice lab</button>
          <button className={view === "sets" ? "nav-active" : "nav-button"} onClick={() => showView("sets")}><span className="nav-icon">▦</span>Study sets</button>
          <button className={view === "history" ? "nav-active" : "nav-button"} onClick={() => showView("history")}><span className="nav-icon">◷</span>Quiz history</button>
          <button className={view === "profile" ? "nav-active" : "nav-button"} onClick={() => showView("profile")}><span className="nav-icon">◉</span>Profile</button>
          {user.role === "admin" && <button className={view === "admin" ? "nav-active" : "nav-button"} onClick={() => showView("admin")}><span className="nav-icon">⚙</span>Admin</button>}
        </nav>
        <div className="sidebar-bottom"><div className="sidebar-user"><span className="avatar">{user.displayName.charAt(0).toUpperCase()}</span><div><strong>{user.displayName}</strong><small>{user.role}</small></div></div><button className="logout-button" onClick={logout}>Log out <span>↗</span></button></div>
      </aside>}
      <div className="main-column">
        {user ? <header className="topbar"><span>YOUR LEARNING SPACE</span><span className="topbar-name">{user.displayName}</span></header>
          : <header className="guest-topbar"><div className="brand-lockup"><span className="brand-mark">Q</span><div><strong>QuizLink</strong><small>STUDY WORKSPACE</small></div></div><span>CSC 4350 · GROUP 6</span></header>}
        <main className="content">

      {error && <p role="alert" className="alert error">{error}</p>}
      {message && <p role="status" className="alert success">{message}</p>}

      {!user ? (
        <div className="welcome-grid">
          <section className="welcome-panel">
            <p className="eyebrow">YOUR MATERIAL. YOUR MOMENTUM.</p>
            <h1>Make the most of what you study.</h1>
            <p>Keep your notes, flashcards, and quiz results in one place. Come back tomorrow and pick up where you left off.</p>
            <div className="welcome-feature"><span>01</span><div><strong>Collect</strong><p>Organize topics into public or private study sets.</p></div></div>
            <div className="welcome-feature"><span>02</span><div><strong>Practice</strong><p>Make flashcards or build a quiz from your notes.</p></div></div>
            <div className="welcome-feature"><span>03</span><div><strong>Review</strong><p>See your answers and return to past attempts.</p></div></div>
          </section>
          <section className="card auth-card">
            <p className="eyebrow">GET STARTED</p>
            <div className="auth-tabs">
              <button className={authMode === "login" ? "tab-active" : "tab"} onClick={() => { setAuthMode("login"); setError(""); }}>Log in</button>
              <button className={authMode === "register" ? "tab-active" : "tab"} onClick={() => { setAuthMode("register"); setError(""); }}>Sign up</button>
            </div>
            <h2>{authMode === "register" ? "Create your account" : "Welcome back"}</h2>
            <form onSubmit={handleAuth}>
              {authMode === "register" && <label>Display name<input value={authForm.displayName} onChange={(event) => setAuthForm({ ...authForm, displayName: event.target.value })} maxLength="100" required /></label>}
              <label>Email<input type="email" value={authForm.email} onChange={(event) => setAuthForm({ ...authForm, email: event.target.value })} required /></label>
              <label>Password<input type="password" value={authForm.password} onChange={(event) => setAuthForm({ ...authForm, password: event.target.value })} minLength="8" required /></label>
              <button type="submit" className="primary" disabled={busy}>{busy ? "Please wait…" : authMode === "register" ? "Create account" : "Log in"}</button>
            </form>
          </section>
        </div>
      ) : (
        <>
          {view === "quiz" && <>
            <section className="page-heading"><div><p className="eyebrow">PRACTICE LAB / 01</p><h1>Practice starts with your notes.</h1><p>Build questions from material you are studying, then review every answer.</p></div><div className="heading-stat"><strong>{history.length}</strong><span>completed {history.length === 1 ? "quiz" : "quizzes"}</span></div></section>
            <div className="work-grid"><section className="card builder-card">
              <div className="section-kicker"><span>01</span><span>CREATE A QUIZ</span></div>
              <h2>Add your study material</h2>
              <label htmlFor="study-notes">Study material</label>
              <textarea id="study-notes" value={notes} onChange={(event) => setNotes(event.target.value)} maxLength="20000" />
              <p>Enter at least 20 characters from the material you want to study.</p>
              <div className="form-row"><label htmlFor="difficulty">Difficulty</label>
                <select id="difficulty" value={difficulty} onChange={(event) => setDifficulty(event.target.value)}>
                  <option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option>
                </select></div>
              <button className="primary" onClick={generateQuiz} disabled={busy}>{busy ? "Working…" : "Generate quiz"}<span aria-hidden="true">↗</span></button>
            </section><aside className="guide-panel"><span className="guide-symbol">✳</span><h2>How it works</h2><p>Use material you are currently learning. The questions and explanations will be saved to your account after generation.</p><ol><li>Paste your notes</li><li>Choose a difficulty</li><li>Answer and review</li></ol><p className="guide-footnote">Quiz generation requires a server API key. Study sets and flashcards work without one.</p></aside></div>

            {quiz && <section className="card">
              <p className="eyebrow">Saved quiz #{quiz.quizId}</p><h2>{quiz.title}</h2><p>{quiz.summary}</p>
              {quiz.questions.map((question, questionIndex) => <div className="question" key={question.questionId}>
                <h3>{questionIndex + 1}. {question.questionText}</h3>
                {question.choices.map((choice, choiceIndex) => {
                  let className = "choice";
                  if (selectedAnswers[questionIndex] === choiceIndex) className += " selected";
                  if (result && choiceIndex === question.correctAnswerIndex) className += " correct";
                  if (result && selectedAnswers[questionIndex] === choiceIndex && choiceIndex !== question.correctAnswerIndex) className += " wrong";
                  return <button key={choiceIndex} className={className} disabled={Boolean(result)}
                    onClick={() => setSelectedAnswers({ ...selectedAnswers, [questionIndex]: choiceIndex })}>{choice}</button>;
                })}
                {result && <div className="explanation"><strong>Correct answer:</strong> {question.choices[question.correctAnswerIndex]}<p>{question.explanation}</p></div>}
              </div>)}
              {!result ? <button className="primary" onClick={submitQuiz} disabled={busy}>Submit quiz</button>
                : <p className="score">Score: {result.score} / {result.total}</p>}
            </section>}

            {quiz?.flashcards?.length > 0 && <section className="card"><h2>Flashcards</h2><p>Click a card to flip it.</p>
              <div className="flashcard-grid">{quiz.flashcards.map((card, index) => <button className="flashcard" key={index}
                onClick={() => setFlippedCards({ ...flippedCards, [index]: !flippedCards[index] })}>
                {flippedCards[index] ? card.back : card.front}</button>)}</div></section>}
          </>}

          {view === "sets" && <>
            <section className="page-heading"><div><p className="eyebrow">YOUR LIBRARY / 02</p><h1>Keep ideas together.</h1><p>Create a private set or share it publicly. Add flashcards to practice key terms.</p></div><div className="heading-stat"><strong>{studySets.filter((set) => set.ownerId === user.userId).length}</strong><span>your {studySets.filter((set) => set.ownerId === user.userId).length === 1 ? "set" : "sets"}</span></div></section>
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
                  <div><strong>{set.title}</strong><p>{set.visibility} · {set.ownerName} · {set.cardCount} flashcards</p>{set.description && <p>{set.description}</p>}</div>
                  <div className="set-actions"><button onClick={() => openSet(set.studySetId)}>Open</button>
                    <button onClick={() => toggleFavorite(set)}>{set.isFavorite ? "Unfavorite" : "Favorite"}</button></div>
                </div>)}
            </section>
            {selectedSet && <section className="card"><h2>{selectedSet.set.title}</h2>
              <p>{selectedSet.set.visibility} · {selectedSet.set.ownerName}</p>
              {selectedSet.set.ownerId === user.userId && <div className="form-row"><label htmlFor="set-visibility">Visibility</label>
                <select id="set-visibility" value={selectedSet.set.visibility} onChange={(event) => changeVisibility(event.target.value)}><option value="private">Private</option><option value="public">Public</option></select></div>}
              <h3>Flashcards</h3>
              {selectedSet.cards.length === 0 ? <p>No flashcards yet.</p> : <div className="flashcard-grid">{selectedSet.cards.map((card) =>
                <button className="flashcard" key={card.flashcardId} onClick={() => setFlippedSetCards({ ...flippedSetCards, [card.flashcardId]: !flippedSetCards[card.flashcardId] })}>{flippedSetCards[card.flashcardId] ? card.back : card.front}</button>)}</div>}
              {selectedSet.set.ownerId === user.userId && <form onSubmit={addCard}><h3>Add a flashcard</h3>
                <label>Front<input value={cardForm.front} maxLength="500" required onChange={(event) => setCardForm({ ...cardForm, front: event.target.value })} /></label>
                <label>Back<textarea value={cardForm.back} maxLength="2000" required onChange={(event) => setCardForm({ ...cardForm, back: event.target.value })} /></label>
                <button className="primary" type="submit">Save flashcard</button></form>}
            </section>}
          </>}

          {view === "history" && <section className="card"><p className="eyebrow">YOUR PROGRESS / 03</p><h1>Quiz history</h1>
            {history.length === 0 ? <p>No completed quizzes yet.</p> : history.map((attempt) => <div className="history-item" key={attempt.attemptId}>
              <div><strong>{attempt.title}</strong><p>{attempt.difficulty} · {attempt.score}/{attempt.total} · {attempt.date}</p></div>
              <button onClick={() => reviewAttempt(attempt.attemptId)}>Review answers</button>
            </div>)}
            {review && <div className="review"><h2>{review.attempt.title} · {review.score}/{review.total}</h2>
              {review.questions.map((question, index) => <div className="question" key={index}>
                <h3>{index + 1}. {question.questionText}</h3>
                <p><strong>Your answer:</strong> {question.choices[question.selectedAnswerIndex]}</p>
                <p><strong>Correct answer:</strong> {question.choices[question.correctAnswerIndex]}</p>
                <p>{question.explanation}</p>
              </div>)}</div>}
          </section>}

          {view === "profile" && <div className="profile-grid"><section className="card"><p className="eyebrow">YOUR ACCOUNT / 04</p><h1>Your profile</h1>
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
