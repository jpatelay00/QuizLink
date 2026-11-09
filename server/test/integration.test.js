import { test } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { createApp } from "../api.js";
import { openDatabase } from "../db.js";
import { GeminiConfigurationError } from "../quiz.js";

const testQuiz = {
  title: "Cell Biology", summary: "Questions about cell structures.",
  questions: [
    { questionText: "What stores DNA in a cell?", choices: ["Nucleus", "Membrane", "Cytoplasm", "Wall"], correctAnswerIndex: 0, explanation: "The nucleus stores DNA." },
    { questionText: "What encloses a cell?", choices: ["Nucleus", "Membrane", "DNA", "Ribosome"], correctAnswerIndex: 1, explanation: "The membrane encloses a cell." },
    { questionText: "What fills much of the cell?", choices: ["DNA", "Wall", "Cytoplasm", "Nucleus"], correctAnswerIndex: 2, explanation: "Cytoplasm fills much of the cell." }
  ], flashcards: []
};

test("registration, quiz persistence, history, sessions, and roles", async () => {
  const database = openDatabase(":memory:");
  let hintCalls = 0;
  let hintFailure = false;
  const writtenQuestion = {
    questionType: "fill_blank", questionText: "DNA means ___.", explanation: "DNA is the genetic material.",
    correctText: "Deoxyribonucleic acid"
  };
  const app = createApp(database, async (notes, _difficulty, settings) => {
    if (notes.startsWith("Configuration failure")) throw new GeminiConfigurationError("No key");
    if (notes.startsWith("Wrong format")) {
      return { data: { ...testQuiz, questions: testQuiz.questions.slice(0, settings.questionCount) } };
    }
    const questions = {
      mixed: [testQuiz.questions[0], writtenQuestion],
      fill_blank: [writtenQuestion],
      multiple_choice: testQuiz.questions
    }[settings.questionType];
    return { data: { ...testQuiz, questions } };
  }, async () => {
    hintCalls++;
    if (hintFailure) throw new Error("Provider unavailable");
    return "Think about where the genetic material is kept.";
  });
  const server = app.listen(0, "127.0.0.1");
  if (!server.listening) await once(server, "listening");
  const base = `http://127.0.0.1:${server.address().port}`;

  async function request(path, { method = "GET", body, cookie, csrfToken } = {}) {
    const response = await fetch(base + path, {
      method,
      headers: {
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...(cookie ? { Cookie: cookie } : {}),
        ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {})
      },
      ...(body ? { body: JSON.stringify(body) } : {})
    });
    return {
      status: response.status,
      data: await response.json(),
      cookie: response.headers.get("set-cookie")?.split(";")[0]
    };
  }

  try {
    const registered = await request("/api/auth/register", {
      method: "POST", body: { displayName: "Alex", email: "alex@example.test", password: "secret123" }
    });
    assert.equal(registered.status, 201);
    assert.ok(registered.cookie?.startsWith("quizlink_session="));
    let ownerCookie = registered.cookie;
    let ownerCsrf = registered.data.csrfToken;
    assert.equal(registered.data.user.role, "student");
    assert.ok(database.prepare("SELECT password_hash FROM users WHERE email=?").get("alex@example.test")
      .password_hash.startsWith("scrypt$"));

    const duplicate = await request("/api/auth/register", {
      method: "POST", body: { displayName: "Other", email: "alex@example.test", password: "secret123" }
    });
    assert.equal(duplicate.status, 409);
    assert.equal((await request("/api/auth/me", { cookie: ownerCookie })).status, 200);

    const notes = "Cells have membranes, cytoplasm, and a nucleus that stores DNA.";
    assert.equal((await request("/api/generate-quiz", {
      method: "POST", cookie: ownerCookie, body: { notes, difficulty: "medium" }
    })).status, 403);
    const generated = await request("/api/generate-quiz", {
      method: "POST", cookie: ownerCookie, csrfToken: ownerCsrf,
      body: { notes, difficulty: "medium", questionCount: 3 }
    });
    assert.equal(generated.status, 201);
    assert.equal(generated.data.questions.length, 3);
    const quizId = generated.data.quizId;
    assert.equal(database.prepare("SELECT count(*) AS count FROM questions WHERE quiz_id=?").get(quizId).count, 3);


    // UC14: Bookmark Questions integration tests

    const questionId = generated.data.questions[0].questionId;

    // Save a bookmark
    const savedBookmark = await request(
      `/api/question-bookmarks/${questionId}`,
      {
        method: "PUT",
        cookie: ownerCookie,
        csrfToken: ownerCsrf
      }
    );

    assert.equal(savedBookmark.status, 200);
    assert.equal(savedBookmark.data.bookmarked, true);

    // Verify the bookmark is stored in SQLite
    const storedBookmark = database.prepare(`
      SELECT *
      FROM question_bookmarks
      WHERE user_id = ? AND question_id = ?
    `).get(registered.data.user.userId, questionId);

    assert.ok(storedBookmark);

    // Retrieve saved questions
    const savedQuestions = await request(
      "/api/question-bookmarks",
      { cookie: ownerCookie }
    );

    assert.equal(savedQuestions.status, 200);
    assert.equal(savedQuestions.data.bookmarks.length, 1);
    assert.equal(
      savedQuestions.data.bookmarks[0].questionId,
      questionId
    );

    // Verify duplicate bookmarks are prevented
    const duplicateBookmark = await request(
      `/api/question-bookmarks/${questionId}`,
      {
        method: "PUT",
        cookie: ownerCookie,
        csrfToken: ownerCsrf
      }
    );

    assert.equal(duplicateBookmark.status, 200);

    const bookmarkCount = database.prepare(`
      SELECT COUNT(*) AS count
      FROM question_bookmarks
      WHERE user_id = ? AND question_id = ?
    `).get(registered.data.user.userId, questionId);

    assert.equal(bookmarkCount.count, 1);

    // Remove the bookmark
    const removedBookmark = await request(
      `/api/question-bookmarks/${questionId}`,
      {
        method: "DELETE",
        cookie: ownerCookie,
        csrfToken: ownerCsrf
      }
    );

    assert.equal(removedBookmark.status, 200);
    assert.equal(removedBookmark.data.bookmarked, false);

    // Verify removal
    const remainingBookmarks = await request(
      "/api/question-bookmarks",
      { cookie: ownerCookie }
    );

    assert.equal(remainingBookmarks.data.bookmarks.length, 0);


    const submitted = await request("/api/quiz-attempts", {
      method: "POST", cookie: ownerCookie, csrfToken: ownerCsrf,
      body: { quizId, answers: [0, 0, 0] }
    });
    assert.equal(submitted.status, 201);
    assert.equal(submitted.data.score, 1);
    const history = await request("/api/quiz-attempts", { cookie: ownerCookie });
    assert.equal(history.data.attempts.length, 1);
    assert.equal(history.data.attempts[0].score, 1);
    const detail = await request(`/api/quiz-attempts/${submitted.data.attemptId}`, { cookie: ownerCookie });
    assert.equal(detail.status, 200);
    assert.equal(detail.data.questions[1].selectedAnswerIndex, 0);
    assert.equal(detail.data.questions[1].correctAnswerIndex, 1);

    const changed = await request("/api/auth/password", {
      method: "POST", cookie: ownerCookie, csrfToken: ownerCsrf,
      body: { currentPassword: "secret123", newPassword: "new-secret123" }
    });
    assert.equal(changed.status, 200);
    assert.equal((await request("/api/auth/logout", {
      method: "POST", cookie: ownerCookie, csrfToken: ownerCsrf
    })).status, 200);
    assert.equal((await request("/api/auth/me", { cookie: ownerCookie })).status, 401);
    assert.equal((await request("/api/auth/login", {
      method: "POST", body: { email: "alex@example.test", password: "secret123" }
    })).status, 401);
    const relogged = await request("/api/auth/login", {
      method: "POST", body: { email: "alex@example.test", password: "new-secret123" }
    });
    assert.equal(relogged.status, 200);
    ownerCookie = relogged.cookie;
    ownerCsrf = relogged.data.csrfToken;
    assert.equal((await request("/api/quiz-attempts", { cookie: ownerCookie })).data.attempts.length, 1);

    const second = await request("/api/auth/register", {
      method: "POST", body: { displayName: "Sam", email: "sam@example.test", password: "secret456" }
    });
    assert.equal(second.status, 201);
    assert.equal((await request("/api/quiz-attempts", { cookie: second.cookie })).data.attempts.length, 0);
    assert.equal((await request(`/api/quiz-attempts/${submitted.data.attemptId}`, { cookie: second.cookie })).status, 404);
    assert.equal((await request("/api/admin/users", { cookie: ownerCookie })).status, 403);

    const owner = { cookie: ownerCookie, csrfToken: ownerCsrf };
    const other = { cookie: second.cookie, csrfToken: second.data.csrfToken };
    const hintPath = `/api/questions/${questionId}/hint`;
    assert.equal((await request(hintPath, { ...other, method: "POST" })).status, 404);
    for (let call = 0; call < 2; call++) {
      const hint = await request(hintPath, { ...owner, method: "POST" });
      assert.equal(hint.status, 200);
      assert.match(hint.data.hint, /genetic material/);
    }
    assert.equal(hintCalls, 1);

    const generate = (options) => request("/api/generate-quiz", {
      ...owner, method: "POST", body: { notes, difficulty: "medium", ...options }
    });
    for (const questionCount of [0, 1.5, "2", 21]) {
      assert.equal((await generate({ questionCount })).status, 400);
    }
    assert.equal((await generate({ questionType: "short_answer", questionCount: 2 })).status, 400);
    const unavailable = await generate({ notes: "Configuration failure in test fixture" });
    assert.equal(unavailable.status, 503);
    assert.match(unavailable.data.error, /needs a Gemini API key/);
    assert.equal((await generate({ questionType: "mixed", questionCount: 1 })).status, 400);
    const quizRows = database.prepare(`
      SELECT (SELECT count(*) FROM quizzes) AS quizzes,
             (SELECT count(*) FROM questions) AS questions,
             (SELECT count(*) FROM question_options) AS options
    `);
    const beforeRejectedResponses = quizRows.get();
    assert.equal((await generate({ questionCount: 2 })).status, 503);
    assert.equal((await generate({
      notes: "Wrong format returned by the quiz generator.", questionType: "mixed", questionCount: 2
    })).status, 503);
    assert.deepEqual(quizRows.get(), beforeRejectedResponses);
    const mixed = await generate({ questionType: "mixed", questionCount: 2 });
    assert.equal(mixed.status, 201);
    assert.equal(mixed.data.questions[1].questionType, "fill_blank");
    assert.equal(mixed.data.questions[1].correctText, undefined);
    assert.equal(mixed.data.questions[0].correctAnswerIndex, undefined);
    const submit = (answers) => request("/api/quiz-attempts", {
      ...owner, method: "POST", body: { quizId: mixed.data.quizId, answers }
    });
    assert.equal((await submit([0, "   "])).status, 400);
    const mixedResult = await submit([0, " DEOXYRIBONUCLEIC   ACID "]);
    assert.equal(mixedResult.status, 201);
    assert.equal(mixedResult.data.score, 2);
    assert.equal(mixedResult.data.questions[1].correctText, "Deoxyribonucleic acid");
    const mixedReview = await request(`/api/quiz-attempts/${mixedResult.data.attemptId}`, owner);
    assert.equal(mixedReview.data.score, 2);
    assert.equal(mixedReview.data.questions[1].selectedText, "DEOXYRIBONUCLEIC   ACID");
    const mixedQuestionId = mixed.data.questions[0].questionId;
    const foreignOption = database.prepare(`
      SELECT o.option_id, o.question_id FROM question_options o
      JOIN questions q ON q.question_id = o.question_id WHERE q.quiz_id <> ? LIMIT 1
    `).get(mixed.data.quizId);
    assert.throws(() => database.prepare(`
      INSERT INTO attempt_answers (attempt_id, question_id, quiz_id)
      VALUES (?, ?, ?)
    `).run(mixedResult.data.attemptId, foreignOption.question_id, mixed.data.quizId), /FOREIGN KEY constraint failed/);
    assert.throws(() => database.prepare(`
      UPDATE attempt_answers SET selected_option_id = ? WHERE attempt_id = ? AND question_id = ?
    `).run(foreignOption.option_id, mixedResult.data.attemptId, mixedQuestionId), /FOREIGN KEY constraint failed/);

    const written = await generate({ questionType: "fill_blank", questionCount: 1 });
    assert.equal(written.status, 201);
    assert.equal(written.data.questions.length, 1);
    assert.deepEqual(written.data.questions[0].choices, []);
    const writtenHint = `/api/questions/${written.data.questions[0].questionId}/hint`;
    hintFailure = true;
    assert.equal((await request(writtenHint, { ...owner, method: "POST" })).status, 503);
    hintFailure = false;
    assert.equal((await request(writtenHint, { ...owner, method: "POST" })).status, 200);
    const wrongAnswer = await request("/api/quiz-attempts", {
      ...owner, method: "POST", body: { quizId: written.data.quizId, answers: ["An incorrect expansion"] }
    });
    assert.equal(wrongAnswer.status, 201);
    assert.equal(wrongAnswer.data.score, 0);

    const uploadContent = `  ${notes} Café.\n`;
    const upload = await request("/api/study-files", {
      ...owner, method: "POST", body: { filename: "biology.txt", content: uploadContent }
    });
    assert.equal(upload.status, 201);
    assert.equal(upload.data.content, uploadContent.trim());
    assert.equal(upload.data.fileSize, Buffer.byteLength(uploadContent, "utf8"));
    assert.equal(upload.data.processingStatus, "completed");
    const retrieved = await request(`/api/study-files/${upload.data.fileId}`, owner);
    assert.equal(retrieved.data.file.fileSize, upload.data.fileSize);
    assert.equal(retrieved.data.file.processingStatus, "completed");
    assert.equal((await request(`/api/study-files/${upload.data.fileId}`, { cookie: second.cookie })).status, 404);
    assert.equal((await request("/api/study-files", {
      ...owner, method: "POST", body: { filename: "biology.txt", content: notes.padEnd(60001) }
    })).status, 400);
    assert.equal((await request("/api/study-files", {
      ...owner, method: "POST", body: { filename: "biology.pdf", content: notes }
    })).status, 400);

    const privateSet = await request("/api/study-sets", {
      method: "POST", cookie: ownerCookie, csrfToken: ownerCsrf,
      body: { title: "Cell structures", description: "Biology review", topic: "Cells", subject: "Biology" }
    });
    assert.equal(privateSet.status, 201);
    const setId = privateSet.data.studySetId;
    assert.equal((await request(`/api/study-sets/${setId}`, { cookie: second.cookie })).status, 404);
    assert.equal((await request(`/api/study-sets/${setId}/flashcards`, {
      method: "POST", cookie: second.cookie, csrfToken: second.data.csrfToken,
      body: { front: "Nucleus", back: "Stores DNA" }
    })).status, 404);
    assert.equal((await request(`/api/study-sets/${setId}/flashcards`, {
      method: "POST", cookie: ownerCookie, csrfToken: ownerCsrf,
      body: { front: "Nucleus", back: "Stores DNA" }
    })).status, 201);
    assert.equal((await request(`/api/study-sets/${setId}`, { cookie: ownerCookie })).data.cards.length, 1);
    assert.equal((await request(`/api/study-sets/${setId}`, { cookie: second.cookie })).status, 404);
    assert.equal((await request(`/api/study-sets/${setId}`, { cookie: ownerCookie })).data.set.visibility, "private");
    assert.equal((await request(`/api/study-sets/${setId}`, { cookie: second.cookie })).status, 404);
    const quizPath = `/api/quizzes/${quizId}`;
    const attach = (session, studySetId) => request(`${quizPath}/study-set`, {
      ...session, method: "PUT", body: { studySetId }
    });
    const otherSet = await request("/api/study-sets", {
      ...other, method: "POST", body: { title: "Someone else's set", visibility: "public" }
    });
    assert.equal(otherSet.status, 201);
    assert.equal((await attach(owner, otherSet.data.studySetId)).status, 404);
    assert.equal((await attach({ cookie: ownerCookie }, setId)).status, 403);
    assert.equal((await attach(owner, setId)).status, 200);
    assert.equal((await attach(owner, setId)).status, 200);
    assert.equal((await request(`/api/study-sets/${setId}`, owner)).data.quizzes[0].quizId, quizId);
    assert.equal((await request(quizPath, owner)).data.studySetId, setId);
    assert.equal((await request(quizPath, other)).status, 404);
    assert.equal((await request(`/api/study-sets/${setId}`, {
      method: "PATCH", cookie: ownerCookie, csrfToken: ownerCsrf, body: { visibility: "public" }
    })).status, 200);
    assert.equal((await request(`/api/study-sets/${setId}`, { cookie: second.cookie })).status, 200);
    const shared = await request(quizPath, other);
    assert.equal(shared.status, 200);
    assert.equal(shared.data.canEdit, false);
    assert.equal(shared.data.source_text, undefined);
    assert.deepEqual(shared.data.questions[0], generated.data.questions[0]);
    assert.equal((await attach(other, otherSet.data.studySetId)).status, 404);
    assert.equal((await request(hintPath, { ...other, method: "POST" })).status, 200);
    assert.equal((await request(`/api/question-bookmarks/${questionId}`, {
      ...other, method: "PUT"
    })).status, 200);
    assert.equal((await request("/api/question-bookmarks", other)).data.bookmarks[0].explanation, null);
    const takeSharedQuiz = () => request("/api/quiz-attempts", {
      ...other, method: "POST", body: { quizId, answers: [0, 1, 2] }
    });
    const sharedAttempt = await takeSharedQuiz();
    assert.equal(sharedAttempt.status, 201);
    assert.equal(sharedAttempt.data.score, 3);
    const sharedReview = `/api/quiz-attempts/${sharedAttempt.data.attemptId}`;
    assert.equal((await request(sharedReview, owner)).status, 404);
    assert.equal((await request("/api/question-bookmarks", other)).data.bookmarks[0].explanation, testQuiz.questions[0].explanation);
    assert.equal((await request(`/api/study-sets/${setId}/favorite`, {
      method: "PUT", cookie: second.cookie, csrfToken: second.data.csrfToken
    })).status, 200);
    assert.equal(database.prepare("SELECT COUNT(*) AS count FROM favorite_study_sets WHERE study_set_id=?").get(setId).count, 1);
    assert.equal((await request(`/api/study-sets/${setId}/favorite`, {
      method: "DELETE", cookie: second.cookie, csrfToken: second.data.csrfToken
    })).status, 200);

    database.prepare("UPDATE users SET role='admin' WHERE email=?").run("alex@example.test");
    const commentsPath = `/api/study-sets/${setId}/comments`;
    const comment = await request(commentsPath, {
      ...other, method: "POST", body: { body: "Helpful review notes." }
    });
    assert.equal(comment.status, 201);
    const commentPath = `${commentsPath}/${comment.data.commentId}`;
    const moderate = (session, status) => request(commentPath, {
      ...session, method: "PATCH", body: { status }
    });
    assert.equal((await moderate(other, "hidden")).status, 403);
    assert.equal((await moderate({ cookie: ownerCookie }, "hidden")).status, 403);
    assert.equal((await moderate(owner, "hidden")).status, 200);
    assert.equal((await request(commentsPath, other)).data.comments.length, 0);
    assert.equal((await request(commentsPath, owner)).data.comments[0].status, "hidden");
    assert.equal((await moderate(owner, "visible")).status, 200);
    assert.equal((await request(commentsPath, other)).data.comments.length, 1);
    assert.equal((await request(`/api/study-sets/${setId}`, {
      ...owner, method: "PATCH", body: { visibility: "private" }
    })).status, 200);
    assert.equal((await moderate(owner, "hidden")).status, 404);
    assert.equal((await request(quizPath, other)).status, 404);
    assert.equal((await takeSharedQuiz()).status, 404);
    assert.equal((await request(hintPath, { ...other, method: "POST" })).status, 404);
    assert.deepEqual((await request("/api/question-bookmarks", other)).data.bookmarks, []);
    assert.equal((await request(sharedReview, other)).status, 200);
    assert.equal((await request("/api/quiz-attempts", other)).data.attempts[0].canRetake, 0);

    const adminList = await request("/api/admin/users", { cookie: ownerCookie });
    assert.equal(adminList.status, 200);
    const sam = adminList.data.users.find((user) => user.email === "sam@example.test");
    const suspended = await request(`/api/admin/users/${sam.userId}`, {
      method: "PATCH", cookie: ownerCookie, csrfToken: ownerCsrf,
      body: { role: "student", accountStatus: "suspended" }
    });
    assert.equal(suspended.status, 200);
    assert.equal((await request("/api/auth/me", { cookie: second.cookie })).status, 401);

    const tables = database.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    assert.equal(tables.length, 13);
    assert.deepEqual(database.prepare("PRAGMA foreign_key_check").all(), []);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    database.close();
  }
});
