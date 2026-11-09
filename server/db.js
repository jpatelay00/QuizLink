import { DatabaseSync } from "node:sqlite";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const volumePath = process.env.RAILWAY_VOLUME_MOUNT_PATH;
const defaultPath = join(volumePath || join(here, "data"), "quizlink.db");

export function openDatabase(path = process.env.QUIZLINK_DB || defaultPath) {
  if (process.env.RAILWAY_ENVIRONMENT_NAME && !volumePath) {
    throw new Error("Attach a persistent volume before starting QuizLink on Railway.");
  }
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const database = new DatabaseSync(path);
  try {
    database.exec("PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000; BEGIN IMMEDIATE;");
    const answerColumns = database.prepare("PRAGMA table_info(attempt_answers)").all();
    const migrateAnswers = answerColumns.length > 0 && !answerColumns.some(({ name }) => name === "quiz_id");
    if (migrateAnswers) database.exec("ALTER TABLE attempt_answers RENAME TO legacy_attempt_answers;");
    database.exec(readFileSync(join(here, "schema.sql"), "utf8"));
    const fileColumns = database.prepare("PRAGMA table_info(study_files)").all();
    if (!fileColumns.some(({ name }) => name === "file_size")) {
      database.exec(`ALTER TABLE study_files ADD COLUMN file_size INTEGER
        CHECK (file_size IS NULL OR (typeof(file_size) = 'integer' AND file_size BETWEEN 0 AND 60000))`);
    }
    if (!fileColumns.some(({ name }) => name === "processing_status")) {
      database.exec(`
        ALTER TABLE study_files ADD COLUMN processing_status TEXT NOT NULL DEFAULT 'pending'
          CHECK (processing_status IN ('pending', 'completed', 'failed'));
        UPDATE study_files SET processing_status = 'completed' WHERE extracted_text IS NOT NULL;
      `);
    }
    if (migrateAnswers) {
      database.exec(`
        INSERT INTO attempt_answers (
          attempt_id, question_id, quiz_id, selected_option_id, answer_text, is_correct, answered_at
        )
        SELECT old.attempt_id, old.question_id, a.quiz_id, old.selected_option_id,
               old.answer_text, old.is_correct, old.answered_at
        FROM legacy_attempt_answers old
        LEFT JOIN quiz_attempts a ON a.attempt_id = old.attempt_id;
        DROP TABLE legacy_attempt_answers;
      `);
    }
    database.exec("COMMIT;");
    return database;
  } catch (error) {
    database.close();
    throw error;
  }
}

export function utcTimestamp(date = new Date()) {
  return date.toISOString().slice(0, 19).replace("T", " ");
}

export function transaction(database, action) {
  database.exec("BEGIN");
  try {
    const result = action();
    database.exec("COMMIT");
    return result;
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}
