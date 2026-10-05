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
  database.exec("PRAGMA foreign_keys = ON;");
  database.exec(readFileSync(join(here, "schema.sql"), "utf8"));
  return database;
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
