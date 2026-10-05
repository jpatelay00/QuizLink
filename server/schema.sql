PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
    user_id INTEGER PRIMARY KEY,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    display_name TEXT NOT NULL,
    bio TEXT,
    role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'admin')),
    account_status TEXT NOT NULL DEFAULT 'active' CHECK (account_status IN ('active', 'suspended')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sessions (
    session_id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    csrf_token TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TEXT NOT NULL,
    revoked_at TEXT
);

CREATE TABLE IF NOT EXISTS study_sets (
    study_set_id INTEGER PRIMARY KEY,
    owner_id INTEGER NOT NULL REFERENCES users(user_id),
    title TEXT NOT NULL,
    description TEXT,
    topic TEXT,
    subject TEXT,
    visibility TEXT NOT NULL CHECK (visibility IN ('public', 'private')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS study_files (
    file_id INTEGER PRIMARY KEY,
    owner_id INTEGER NOT NULL REFERENCES users(user_id),
    study_set_id INTEGER REFERENCES study_sets(study_set_id),
    original_name TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    storage_key TEXT NOT NULL,
    extracted_text TEXT,
    uploaded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS quizzes (
    quiz_id INTEGER PRIMARY KEY,
    owner_id INTEGER NOT NULL REFERENCES users(user_id),
    study_set_id INTEGER REFERENCES study_sets(study_set_id),
    source_file_id INTEGER REFERENCES study_files(file_id),
    title TEXT NOT NULL,
    topic TEXT,
    source_text TEXT,
    difficulty TEXT NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard')),
    question_type TEXT NOT NULL CHECK (question_type IN ('multiple_choice', 'fill_blank', 'mixed')),
    requested_count INTEGER NOT NULL CHECK (requested_count BETWEEN 1 AND 20),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS questions (
    question_id INTEGER PRIMARY KEY,
    quiz_id INTEGER NOT NULL REFERENCES quizzes(quiz_id),
    position INTEGER NOT NULL CHECK (position > 0),
    question_type TEXT NOT NULL CHECK (question_type IN ('multiple_choice', 'fill_blank')),
    prompt TEXT NOT NULL,
    correct_text TEXT,
    hint TEXT,
    explanation TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (quiz_id, position)
);

CREATE TABLE IF NOT EXISTS question_options (
    option_id INTEGER PRIMARY KEY,
    question_id INTEGER NOT NULL REFERENCES questions(question_id),
    position INTEGER NOT NULL CHECK (position > 0),
    option_text TEXT NOT NULL,
    is_correct INTEGER NOT NULL CHECK (is_correct IN (0, 1)),
    UNIQUE (question_id, position)
);

CREATE UNIQUE INDEX IF NOT EXISTS one_correct_option_per_question
ON question_options(question_id) WHERE is_correct = 1;

CREATE TABLE IF NOT EXISTS quiz_attempts (
    attempt_id INTEGER PRIMARY KEY,
    quiz_id INTEGER NOT NULL REFERENCES quizzes(quiz_id),
    user_id INTEGER NOT NULL REFERENCES users(user_id),
    started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TEXT,
    score_percent REAL CHECK (score_percent BETWEEN 0 AND 100)
);

CREATE TABLE IF NOT EXISTS attempt_answers (
    attempt_id INTEGER NOT NULL REFERENCES quiz_attempts(attempt_id),
    question_id INTEGER NOT NULL REFERENCES questions(question_id),
    selected_option_id INTEGER REFERENCES question_options(option_id),
    answer_text TEXT,
    is_correct INTEGER CHECK (is_correct IN (0, 1)),
    answered_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (attempt_id, question_id)
);

CREATE TABLE IF NOT EXISTS flashcards (
    flashcard_id INTEGER PRIMARY KEY,
    study_set_id INTEGER NOT NULL REFERENCES study_sets(study_set_id) ON DELETE CASCADE,
    front_text TEXT NOT NULL,
    back_text TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS favorite_study_sets (
    user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    study_set_id INTEGER NOT NULL REFERENCES study_sets(study_set_id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, study_set_id)
);

CREATE TABLE IF NOT EXISTS question_bookmarks (
    user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    question_id INTEGER NOT NULL REFERENCES questions(question_id),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, question_id)
);

CREATE TABLE IF NOT EXISTS study_set_comments (
    comment_id INTEGER PRIMARY KEY,
    study_set_id INTEGER NOT NULL REFERENCES study_sets(study_set_id),
    author_id INTEGER NOT NULL REFERENCES users(user_id),
    body TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'visible' CHECK (status IN ('visible', 'hidden')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS study_sets_public_search
ON study_sets(visibility, title, topic, subject);
CREATE INDEX IF NOT EXISTS study_sets_owner ON study_sets(owner_id);
CREATE INDEX IF NOT EXISTS quiz_attempts_user ON quiz_attempts(user_id, completed_at);
