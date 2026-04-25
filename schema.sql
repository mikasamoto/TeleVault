-- Drop existing tables if they exist
DROP TABLE IF EXISTS chunks;
DROP TABLE IF EXISTS files;
DROP TABLE IF EXISTS bots;
DROP TABLE IF EXISTS channels;
DROP TABLE IF EXISTS sessions;
DROP TABLE IF EXISTS users;

-- Create users table
CREATE TABLE users (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	email TEXT NOT NULL UNIQUE,
	username TEXT NOT NULL UNIQUE,
	password TEXT NOT NULL,
	is_admin INTEGER DEFAULT 0,
	created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create sessions table for token validation
CREATE TABLE sessions (
	id TEXT PRIMARY KEY,
	user_id INTEGER NOT NULL,
	token TEXT NOT NULL UNIQUE,
	created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
	expires_at DATETIME,
	FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create bots table
CREATE TABLE bots (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	token TEXT NOT NULL UNIQUE,
	name TEXT NOT NULL,
	created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
	updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create channels table
CREATE TABLE channels (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	name TEXT NOT NULL,
	channel_id TEXT NOT NULL UNIQUE,
	created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
	updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create folders table
CREATE TABLE folders (
	id TEXT PRIMARY KEY,
	name TEXT NOT NULL,
	parent_id TEXT,
	created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
	updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (parent_id) REFERENCES folders(id)
);

-- Create files table
CREATE TABLE files (
	id TEXT PRIMARY KEY,
	filename TEXT NOT NULL,
	folder_id TEXT,
	total_chunks INTEGER NOT NULL,
	file_size INTEGER NOT NULL,
	encryption_key TEXT NOT NULL,
	encryption_iv TEXT NOT NULL,
	created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
	updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (folder_id) REFERENCES folders(id)
);

-- Create chunks table
CREATE TABLE chunks (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	file_id TEXT NOT NULL,
	chunk_index INTEGER NOT NULL,
	message_id INTEGER NOT NULL,
	telegram_file_id TEXT NOT NULL,
	chunk_size INTEGER NOT NULL,
	bot_token TEXT NOT NULL,
	channel_id TEXT NOT NULL,
	created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (file_id) REFERENCES files(id),
	UNIQUE(file_id, chunk_index)
);

-- Create settings table for superadmin password
CREATE TABLE settings (
	key TEXT PRIMARY KEY,
	value TEXT NOT NULL,
	updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Insert default superadmin password hash
-- Default password: 'superadmin123'
-- Will be initialized on first use via getSuperadminPasswordHash function
INSERT INTO settings (key, value) VALUES ('superadmin_password_hash', 'NEEDS_INITIALIZATION');

-- Create password history table to prevent reuse and track changes
CREATE TABLE password_history (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	password_hash TEXT NOT NULL UNIQUE,
	changed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
	changed_by TEXT
);

-- Placeholder entry (will be replaced on first use)
INSERT INTO password_history (password_hash, changed_by) VALUES ('NEEDS_INITIALIZATION', 'system');

-- Create indexes for faster queries
CREATE INDEX idx_chunks_file_id ON chunks(file_id);
