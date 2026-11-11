import { test } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { createApp } from "../api.js";
import { openDatabase } from "../db.js";
import { validateFlashcards } from "../quiz.js";

test("study set generation validates ownership and saves content atomically", async () => {
  const database = openDatabase(":memory:");
  let flashcardCalls = 0;
  let invalidCards = false;
  let providerFailure = false;
  const app = createApp(database, async (_notes, _difficulty, settings) => ({
    data: { title: "SWE practice", questions: Array.from({ length: settings.questionCount }, () => ({
      questionType: "multiple_choice", questionText: "Which diagram shows messages?",
      choices: ["Sequence", "Class", "Context", "State"], correctAnswerIndex: 0,
      explanation: "A sequence diagram shows messages over time."
    })) }
  }), async () => "Think about time order.", async (_notes, count) => {
    flashcardCalls++;
    if (providerFailure) throw Object.assign(new Error("Quota"), { status: 429 });
    return Array.from({ length: count }, () => ({
      front: " What does a sequence diagram show? ", back: invalidCards ? "" : " Messages in time order. "
    }));
  });
  const server = app.listen(0, "127.0.0.1");
  if (!server.listening) await once(server, "listening");
  const base = "http://127.0.0.1:" + server.address().port;
  function client() {
    let cookie;
    let token;
    return async (path, status = 200, method = "GET", body) => {
      const response = await fetch(base + "/api" + path, {
        method, headers: {
          ...(cookie && { cookie }), ...(token && { "x-csrf-token": token }),
          ...(body && { "content-type": "application/json" })
        }, body: body ? JSON.stringify(body) : undefined
      });
      const data = await response.json();
      assert.equal(response.status, status, path + ": " + (data.error ?? ""));
      if (data.csrfToken) token = data.csrfToken;
      if (response.headers.get("set-cookie")) cookie = response.headers.get("set-cookie").split(";")[0];
      return data;
    };
  }
  try {
    const owner = client();
    const visitor = client();
    for (const [request, name] of [[owner, "Owner"], [visitor, "Visitor"]]) {
      await request("/auth/register", 201, "POST", {
        displayName: name, email: name + "@example.test", password: "test-password"
      });
    }
    const { studySetId } = await owner("/study-sets", 201, "POST", { title: "SWE notes" });
    const path = "/study-sets/" + studySetId;
    const notes = "A sequence diagram shows messages in time order between participants.";
    const generateCards = (request, count, status) =>
      request(path + "/generate-flashcards", status, "POST", { notes, count });
    await generateCards(visitor, 2, 404);
    assert.equal(flashcardCalls, 0);
    for (const count of [0, 21, 1.5, "2"]) await generateCards(owner, count, 400);
    await owner(path + "/generate-flashcards", 400, "POST", { notes: "short", count: 2 });
    for (const count of [1, 20]) assert.equal((await generateCards(owner, count, 201)).count, count);
    assert.equal((await owner(path)).cards.length, 21);
    assert.equal((await owner(path)).cards[0].front, "What does a sequence diagram show?");
    invalidCards = true;
    await generateCards(owner, 2, 503);
    providerFailure = true;
    await generateCards(owner, 2, 503);
    assert.equal((await owner(path)).cards.length, 21);
    assert.equal(validateFlashcards([{ front: "x".repeat(501), back: "Answer" }], 1), false);
    const settings = { notes, difficulty: "easy", questionType: "multiple_choice", questionCount: 1, studySetId };
    await visitor("/generate-quiz", 404, "POST", settings);
    const quiz = await owner("/generate-quiz", 201, "POST", settings);
    assert.equal(quiz.studySetId, studySetId);
    assert.equal((await owner(path)).quizzes[0].quizId, quiz.quizId);
    await owner("/question-bookmarks/" + quiz.questions[0].questionId, 200, "PUT");
    assert.equal((await owner("/question-bookmarks")).bookmarks[0].quizId, quiz.quizId);
    assert.equal((await owner("/study-sets")).sets[0].quizCount, 1);
    await owner(path, 200, "PATCH", { visibility: "public" });
    assert.equal((await visitor(path)).cards.length, 21);
    const { commentId } = await visitor(path + "/comments", 201, "POST", { body: "Useful practice questions." });
    assert.equal((await owner(path + "/comments")).comments[0].commentId, commentId);
    assert.equal((await visitor("/quizzes/" + quiz.quizId)).questions.length, 1);
    assert.deepEqual(database.prepare("PRAGMA foreign_key_check").all(), []);
  } finally {
    await new Promise(resolve => server.close(resolve));
    database.close();
  }
});
