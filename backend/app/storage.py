import json
import sqlite3
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[2]
DATA_DIR = ROOT_DIR / "data"
DB_PATH = DATA_DIR / "recruitment.db"


def get_conn() -> sqlite3.Connection:
    DATA_DIR.mkdir(exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    with get_conn() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS candidates (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                position TEXT NOT NULL,
                phone_masked TEXT,
                email_masked TEXT,
                education TEXT,
                school TEXT,
                work_years TEXT,
                status TEXT NOT NULL DEFAULT '待初筛',
                match_score INTEGER NOT NULL DEFAULT 0,
                tags TEXT NOT NULL DEFAULT '[]',
                risk_points TEXT NOT NULL DEFAULT '[]',
                summary TEXT,
                screening_suggestion TEXT,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS interviews (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                candidate_id INTEGER NOT NULL,
                interviewer TEXT,
                interview_time TEXT,
                transcript TEXT,
                ai_summary TEXT,
                strengths TEXT NOT NULL DEFAULT '[]',
                risks TEXT NOT NULL DEFAULT '[]',
                human_score INTEGER NOT NULL DEFAULT 0,
                ai_suggestion TEXT,
                final_result TEXT,
                reason_category TEXT,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(candidate_id) REFERENCES candidates(id)
            );
            """
        )


def row_to_dict(row: sqlite3.Row) -> dict:
    item = dict(row)
    for key in ("tags", "risk_points", "strengths", "risks"):
        if key in item:
            try:
                item[key] = json.loads(item[key] or "[]")
            except json.JSONDecodeError:
                item[key] = []
    return item


def to_json(value) -> str:
    return json.dumps(value or [], ensure_ascii=False)
