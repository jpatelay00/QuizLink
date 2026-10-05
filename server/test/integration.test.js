import { test } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { createApp } from "../api.js";
import { openDatabase } from "../db.js";

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
  const app = createApp(database, async () => ({ data: testQuiz }));
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
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
      body: { notes, difficulty: "medium" }
    });
    assert.equal(generated.status, 201);
    assert.equal(generated.data.questions.length, 3);
    const quizId = generated.data.quizId;
    assert.equal(database.prepare("SELECT count(*) AS count FROM questions WHERE quiz_id=?").get(quizId).count, 3);

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

    const privateSet = await request("/api/study-sets", {
      method: "POST", cookie: ownerCookie, csrfToken: ownerCsrf,
      body: { title: "Cell structures", description: "Biology review", topic: "Cells", subject: "Biology", visibility: "private" }
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
    assert.equal((await request(`/api/study-sets/${setId}`, {
      method: "PATCH", cookie: ownerCookie, csrfToken: ownerCsrf, body: { visibility: "public" }
    })).status, 200);
    assert.equal((await request(`/api/study-sets/${setId}`, { cookie: second.cookie })).status, 200);
    assert.equal((await request(`/api/study-sets/${setId}/favorite`, {
      method: "PUT", cookie: second.cookie, csrfToken: second.data.csrfToken
    })).status, 200);
    assert.equal(database.prepare("SELECT COUNT(*) AS count FROM favorite_study_sets WHERE study_set_id=?").get(setId).count, 1);
    assert.equal((await request(`/api/study-sets/${setId}/favorite`, {
      method: "DELETE", cookie: second.cookie, csrfToken: second.data.csrfToken
    })).status, 200);

    database.prepare("UPDATE users SET role='admin' WHERE email=?").run("alex@example.test");
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
