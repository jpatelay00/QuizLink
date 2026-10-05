import express from "express";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { openDatabase, transaction, utcTimestamp } from "./db.js";
import { createAuth, hashPassword, verifyPassword } from "./auth.js";
import { generateQuizData } from "./quiz.js";

const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const clientDist = join(dirname(fileURLToPath(import.meta.url)), "..", "client", "dist");

export function createApp(database = openDatabase(), quizGenerator = generateQuizData) {
  const app = express();
  const auth = createAuth(database);
  app.disable("x-powered-by");
  app.use(express.json({ limit: "100kb" }));
  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Cache-Control", "no-store");
    next();
  });
  app.use(auth.attach);

  app.get("/api/health", (_req, res) => res.json({ status: "ok" }));

  app.post("/api/auth/register", (req, res) => {
    const displayName = typeof req.body?.displayName === "string" ? req.body.displayName.trim() : "";
    const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
    const password = req.body?.password;
    if (!displayName || displayName.length > 100 || email.length > 255 || !validEmail.test(email) ||
        typeof password !== "string" || password.length < 8 || password.length > 256) {
      return res.status(400).json({ error: "Enter a name, valid email, and password of at least 8 characters." });
    }
    if (database.prepare("SELECT 1 FROM users WHERE email=?").get(email)) {
      return res.status(409).json({ error: "That email is already registered." });
    }
    const result = database.prepare("INSERT INTO users(email,password_hash,display_name) VALUES (?,?,?)")
      .run(email, hashPassword(password), displayName);
    const userId = Number(result.lastInsertRowid);
    const csrfToken = auth.startSession(userId, res);
    return res.status(201).json({
      user: { userId, email, displayName, bio: null, role: "student", accountStatus: "active" },
      csrfToken
    });
  });

  app.post("/api/auth/login", (req, res) => {
    const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
    const password = req.body?.password;
    const user = database.prepare("SELECT * FROM users WHERE email=?").get(email);
    if (!user || user.account_status !== "active" || typeof password !== "string" ||
        !verifyPassword(password, user.password_hash)) {
      return res.status(401).json({ error: "Email or password is incorrect, or the account is unavailable." });
    }
    const csrfToken = auth.startSession(user.user_id, res);
    return res.json({
      user: { userId: user.user_id, email: user.email, displayName: user.display_name,
        bio: user.bio, role: user.role, accountStatus: user.account_status },
      csrfToken
    });
  });

  app.get("/api/auth/me", auth.requireAuth, (req, res) => {
    res.json({ user: req.user, csrfToken: req.session.csrf_token });
  });

  app.post("/api/auth/logout", auth.requireCsrf, (req, res) => {
    auth.endSession(req, res);
    res.json({ ok: true });
  });

  app.patch("/api/auth/profile", auth.requireCsrf, (req, res) => {
    const displayName = typeof req.body?.displayName === "string" ? req.body.displayName.trim() : "";
    const bio = typeof req.body?.bio === "string" ? req.body.bio.trim() : "";
    if (!displayName || displayName.length > 100 || bio.length > 1000) {
      return res.status(400).json({ error: "Invalid profile information." });
    }
    database.prepare("UPDATE users SET display_name=?,bio=? WHERE user_id=?")
      .run(displayName, bio, req.user.userId);
    res.json({ user: { ...req.user, displayName, bio } });
  });

  app.post("/api/auth/password", auth.requireCsrf, (req, res) => {
    const currentPassword = req.body?.currentPassword;
    const newPassword = req.body?.newPassword;
    const user = database.prepare("SELECT password_hash FROM users WHERE user_id=?").get(req.user.userId);
    if (typeof currentPassword !== "string" || !verifyPassword(currentPassword, user.password_hash) ||
        typeof newPassword !== "string" || newPassword.length < 8 || newPassword.length > 256) {
      return res.status(400).json({ error: "Current password or new password is invalid." });
    }
    transaction(database, () => {
      database.prepare("UPDATE users SET password_hash=? WHERE user_id=?")
        .run(hashPassword(newPassword), req.user.userId);
      database.prepare("UPDATE sessions SET revoked_at=? WHERE user_id=? AND session_id<>? AND revoked_at IS NULL")
        .run(utcTimestamp(), req.user.userId, req.session.session_id);
    });
    res.json({ ok: true });
  });

  app.post("/api/generate-quiz", auth.requireCsrf, async (req, res) => {
    const notes = typeof req.body?.notes === "string" ? req.body.notes.trim() : "";
    const difficulty = req.body?.difficulty;
    if (notes.length < 20 || notes.length > 20_000) {
      return res.status(400).json({ error: "Please provide 20 to 20,000 characters of study notes." });
    }
    if (!["easy", "medium", "hard"].includes(difficulty)) {
      return res.status(400).json({ error: "Choose easy, medium, or hard difficulty." });
    }
    let data;
    try {
      ({ data } = await quizGenerator(notes, difficulty));
    } catch (error) {
      return res.status(503).json({ error: error.message });
    }
    const saved = transaction(database, () => {
      const quizId = Number(database.prepare(`
        INSERT INTO quizzes(owner_id,title,source_text,difficulty,question_type,requested_count)
        VALUES (?,?,?,?,?,?)
      `).run(req.user.userId, data.title, notes, difficulty, "multiple_choice", data.questions.length).lastInsertRowid);
      const questions = data.questions.map((question, index) => {
        const questionId = Number(database.prepare(`
          INSERT INTO questions(quiz_id,position,question_type,prompt,explanation)
          VALUES (?,?,?,?,?)
        `).run(quizId, index + 1, "multiple_choice", question.questionText, question.explanation).lastInsertRowid);
        question.choices.forEach((choice, optionIndex) => {
          database.prepare(`
            INSERT INTO question_options(question_id,position,option_text,is_correct)
            VALUES (?,?,?,?)
          `).run(questionId, optionIndex + 1, choice, optionIndex === question.correctAnswerIndex ? 1 : 0);
        });
        return { ...question, questionId };
      });
      return { ...data, quizId, questions, difficulty };
    });
    res.status(201).json(saved);
  });

  app.get("/api/study-sets", auth.requireAuth, (req, res) => {
    const sets = database.prepare(`
      SELECT s.study_set_id AS studySetId, s.owner_id AS ownerId, s.title, s.description,
             s.topic, s.subject, s.visibility, s.created_at AS createdAt,
             u.display_name AS ownerName,
             EXISTS(SELECT 1 FROM favorite_study_sets f WHERE f.study_set_id=s.study_set_id AND f.user_id=?) AS isFavorite,
             (SELECT COUNT(*) FROM flashcards c WHERE c.study_set_id=s.study_set_id) AS cardCount
      FROM study_sets s JOIN users u ON u.user_id=s.owner_id
      WHERE s.owner_id=? OR s.visibility='public'
      ORDER BY s.created_at DESC, s.study_set_id DESC
    `).all(req.user.userId, req.user.userId);
    res.json({ sets });
  });

  app.post("/api/study-sets", auth.requireCsrf, (req, res) => {
    const title = typeof req.body?.title === "string" ? req.body.title.trim() : "";
    const description = typeof req.body?.description === "string" ? req.body.description.trim() : "";
    const topic = typeof req.body?.topic === "string" ? req.body.topic.trim() : "";
    const subject = typeof req.body?.subject === "string" ? req.body.subject.trim() : "";
    const visibility = req.body?.visibility;
    if (!title || title.length > 150 || description.length > 1000 || topic.length > 100 ||
        subject.length > 100 || !["public", "private"].includes(visibility)) {
      return res.status(400).json({ error: "Enter a title and choose public or private visibility." });
    }
    const result = database.prepare(`
      INSERT INTO study_sets(owner_id,title,description,topic,subject,visibility)
      VALUES (?,?,?,?,?,?)
    `).run(req.user.userId, title, description, topic, subject, visibility);
    res.status(201).json({ studySetId: Number(result.lastInsertRowid) });
  });

  app.get("/api/study-sets/:id", auth.requireAuth, (req, res) => {
    const studySetId = Number(req.params.id);
    if (!Number.isSafeInteger(studySetId) || studySetId <= 0) return res.status(400).json({ error: "Invalid study set." });
    const set = database.prepare(`
      SELECT s.study_set_id AS studySetId, s.owner_id AS ownerId, s.title, s.description,
             s.topic, s.subject, s.visibility, u.display_name AS ownerName
      FROM study_sets s JOIN users u ON u.user_id=s.owner_id
      WHERE s.study_set_id=? AND (s.owner_id=? OR s.visibility='public')
    `).get(studySetId, req.user.userId);
    if (!set) return res.status(404).json({ error: "Study set not found." });
    const cards = database.prepare(`
      SELECT flashcard_id AS flashcardId, front_text AS front, back_text AS back
      FROM flashcards WHERE study_set_id=? ORDER BY flashcard_id
    `).all(studySetId);
    res.json({ set, cards });
  });

  app.patch("/api/study-sets/:id", auth.requireCsrf, (req, res) => {
    const studySetId = Number(req.params.id);
    const visibility = req.body?.visibility;
    if (!Number.isSafeInteger(studySetId) || studySetId <= 0 || !["public", "private"].includes(visibility)) {
      return res.status(400).json({ error: "Invalid visibility." });
    }
    const result = database.prepare("UPDATE study_sets SET visibility=?,updated_at=CURRENT_TIMESTAMP WHERE study_set_id=? AND owner_id=?")
      .run(visibility, studySetId, req.user.userId);
    if (!result.changes) return res.status(404).json({ error: "Study set not found." });
    res.json({ ok: true });
  });

  app.post("/api/study-sets/:id/flashcards", auth.requireCsrf, (req, res) => {
    const studySetId = Number(req.params.id);
    const front = typeof req.body?.front === "string" ? req.body.front.trim() : "";
    const back = typeof req.body?.back === "string" ? req.body.back.trim() : "";
    if (!Number.isSafeInteger(studySetId) || studySetId <= 0 || !front || !back ||
        front.length > 500 || back.length > 2000) {
      return res.status(400).json({ error: "Enter a flashcard front and back." });
    }
    const set = database.prepare("SELECT 1 FROM study_sets WHERE study_set_id=? AND owner_id=?")
      .get(studySetId, req.user.userId);
    if (!set) return res.status(404).json({ error: "Study set not found." });
    const result = database.prepare("INSERT INTO flashcards(study_set_id,front_text,back_text) VALUES (?,?,?)")
      .run(studySetId, front, back);
    res.status(201).json({ flashcardId: Number(result.lastInsertRowid) });
  });

  app.put("/api/study-sets/:id/favorite", auth.requireCsrf, (req, res) => {
    const studySetId = Number(req.params.id);
    if (!Number.isSafeInteger(studySetId) || studySetId <= 0) return res.status(400).json({ error: "Invalid study set." });
    const set = database.prepare("SELECT 1 FROM study_sets WHERE study_set_id=? AND (owner_id=? OR visibility='public')")
      .get(studySetId, req.user.userId);
    if (!set) return res.status(404).json({ error: "Study set not found." });
    database.prepare("INSERT OR IGNORE INTO favorite_study_sets(user_id,study_set_id) VALUES (?,?)")
      .run(req.user.userId, studySetId);
    res.json({ ok: true });
  });

  app.delete("/api/study-sets/:id/favorite", auth.requireCsrf, (req, res) => {
    const studySetId = Number(req.params.id);
    if (!Number.isSafeInteger(studySetId) || studySetId <= 0) return res.status(400).json({ error: "Invalid study set." });
    database.prepare("DELETE FROM favorite_study_sets WHERE user_id=? AND study_set_id=?")
      .run(req.user.userId, studySetId);
    res.json({ ok: true });
  });

  app.post("/api/quiz-attempts", auth.requireCsrf, (req, res) => {
    const quizId = Number(req.body?.quizId);
    const selectedAnswers = req.body?.answers;
    if (!Number.isSafeInteger(quizId) || quizId <= 0 || !Array.isArray(selectedAnswers)) {
      return res.status(400).json({ error: "Invalid quiz submission." });
    }
    const quiz = database.prepare("SELECT * FROM quizzes WHERE quiz_id=? AND owner_id=?")
      .get(quizId, req.user.userId);
    if (!quiz) return res.status(404).json({ error: "Quiz not found." });
    const questions = database.prepare("SELECT * FROM questions WHERE quiz_id=? ORDER BY position")
      .all(quizId);
    if (selectedAnswers.length !== questions.length || questions.length === 0) {
      return res.status(400).json({ error: "Answer every question before submitting." });
    }
    const answers = [];
    for (let index = 0; index < questions.length; index++) {
      const options = database.prepare("SELECT * FROM question_options WHERE question_id=? ORDER BY position")
        .all(questions[index].question_id);
      const selectedIndex = selectedAnswers[index];
      if (!Number.isInteger(selectedIndex) || selectedIndex < 0 || selectedIndex >= options.length) {
        return res.status(400).json({ error: "Choose one valid answer for each question." });
      }
      answers.push({ questionId: questions[index].question_id,
        optionId: options[selectedIndex].option_id, correct: options[selectedIndex].is_correct });
    }
    const score = answers.reduce((sum, answer) => sum + answer.correct, 0);
    const attemptId = transaction(database, () => {
      const result = database.prepare(`
        INSERT INTO quiz_attempts(quiz_id,user_id,completed_at,score_percent) VALUES (?,?,?,?)
      `).run(quizId, req.user.userId, utcTimestamp(), score * 100 / answers.length);
      const newId = Number(result.lastInsertRowid);
      for (const answer of answers) {
        database.prepare(`
          INSERT INTO attempt_answers(attempt_id,question_id,selected_option_id,is_correct)
          VALUES (?,?,?,?)
        `).run(newId, answer.questionId, answer.optionId, answer.correct);
      }
      return newId;
    });
    res.status(201).json({ attemptId, score, total: answers.length });
  });

  app.get("/api/quiz-attempts", auth.requireAuth, (req, res) => {
    const attempts = database.prepare(`
      SELECT a.attempt_id AS attemptId, q.title, q.difficulty, a.completed_at AS date,
             SUM(aa.is_correct) AS score, COUNT(aa.question_id) AS total
      FROM quiz_attempts a JOIN quizzes q ON q.quiz_id=a.quiz_id
      JOIN attempt_answers aa ON aa.attempt_id=a.attempt_id
      WHERE a.user_id=? AND a.completed_at IS NOT NULL
      GROUP BY a.attempt_id ORDER BY a.completed_at DESC, a.attempt_id DESC
    `).all(req.user.userId);
    res.json({ attempts });
  });

  app.get("/api/quiz-attempts/:id", auth.requireAuth, (req, res) => {
    const attemptId = Number(req.params.id);
    if (!Number.isSafeInteger(attemptId) || attemptId <= 0) {
      return res.status(400).json({ error: "Invalid attempt." });
    }
    const attempt = database.prepare(`
      SELECT a.attempt_id AS attemptId, q.title, q.difficulty, a.completed_at AS date,
             a.quiz_id AS quizId FROM quiz_attempts a JOIN quizzes q ON q.quiz_id=a.quiz_id
      WHERE a.attempt_id=? AND a.user_id=? AND a.completed_at IS NOT NULL
    `).get(attemptId, req.user.userId);
    if (!attempt) return res.status(404).json({ error: "Attempt not found." });
    const rows = database.prepare(`
      SELECT q.question_id, q.prompt, q.explanation, q.position, aa.selected_option_id
      FROM attempt_answers aa JOIN questions q ON q.question_id=aa.question_id
      WHERE aa.attempt_id=? ORDER BY q.position
    `).all(attemptId);
    const questions = rows.map((row) => {
      const options = database.prepare("SELECT option_id,option_text,is_correct FROM question_options WHERE question_id=? ORDER BY position")
        .all(row.question_id);
      return {
        questionText: row.prompt, explanation: row.explanation,
        choices: options.map((option) => option.option_text),
        correctAnswerIndex: options.findIndex((option) => option.is_correct === 1),
        selectedAnswerIndex: options.findIndex((option) => option.option_id === row.selected_option_id)
      };
    });
    res.json({ attempt, questions, score: questions.reduce((sum, question) =>
      sum + (question.correctAnswerIndex === question.selectedAnswerIndex ? 1 : 0), 0),
    total: questions.length });
  });

  app.get("/api/admin/users", auth.requireAdmin, (_req, res) => {
    const users = database.prepare(`
      SELECT user_id AS userId,email,display_name AS displayName,role,
             account_status AS accountStatus FROM users ORDER BY user_id
    `).all();
    res.json({ users });
  });

  app.patch("/api/admin/users/:id", auth.requireAdmin, auth.requireCsrf, (req, res) => {
    const userId = Number(req.params.id);
    const { role, accountStatus } = req.body || {};
    if (!Number.isSafeInteger(userId) || userId <= 0 ||
        !["student", "admin"].includes(role) || !["active", "suspended"].includes(accountStatus)) {
      return res.status(400).json({ error: "Invalid role or status." });
    }
    if (userId === req.user.userId && (role !== "admin" || accountStatus !== "active")) {
      return res.status(400).json({ error: "You cannot remove your own admin access." });
    }
    const result = database.prepare("UPDATE users SET role=?,account_status=? WHERE user_id=?")
      .run(role, accountStatus, userId);
    if (!result.changes) return res.status(404).json({ error: "User not found." });
    if (accountStatus === "suspended") {
      database.prepare("UPDATE sessions SET revoked_at=? WHERE user_id=? AND revoked_at IS NULL")
        .run(utcTimestamp(), userId);
    }
    res.json({ ok: true });
  });

  if (existsSync(join(clientDist, "index.html"))) {
    app.use(express.static(clientDist));
  }
  app.use((_req, res) => res.status(404).json({ error: "Not found." }));

  app.use((error, _req, res, _next) => {
    console.error(error);
    if (res.headersSent) return;
    res.status(500).json({ error: "Server error. Please try again." });
  });
  return app;
}
