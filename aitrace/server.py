"""FastAPI application for viewing structured logs as collapsible trace trees."""
import json
import sqlite3
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from .config import get_config_dir, path_to_display

# Global database path (set by main() or init_app())
DB_PATH = None

# Initialize FastAPI
app = FastAPI(title="AI Trace Viewer", description="View structured logs as execution trees")

# Mount static files
static_dir = Path(__file__).parent / "static"
static_dir.mkdir(exist_ok=True)
app.mount("/static", StaticFiles(directory=str(static_dir)), name="static")


# Database setup
def get_db() -> sqlite3.Connection:
    """Get a database connection."""
    if DB_PATH is None:
        raise RuntimeError("Database path not set. Call init_app() first.")
    
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA foreign_keys=ON;")
    return conn


def init_db(conn: sqlite3.Connection):
    """Initialize database schema."""
    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ts TEXT,
            level TEXT,
            logger TEXT,
            event TEXT,
            attrs TEXT,
            trace_id TEXT NOT NULL,
            span_id TEXT NOT NULL,
            parent_span_id TEXT
        );

        CREATE INDEX IF NOT EXISTS idx_logs_trace ON logs(trace_id);
        CREATE INDEX IF NOT EXISTS idx_logs_span ON logs(span_id);
        CREATE INDEX IF NOT EXISTS idx_logs_parent ON logs(parent_span_id);
        CREATE INDEX IF NOT EXISTS idx_logs_ts ON logs(ts);
        """
    )
    conn.commit()


def init_app(db_path: str):
    """Initialize the application with database path."""
    global DB_PATH, db
    DB_PATH = db_path
    
    # Ensure parent directory exists
    Path(db_path).parent.mkdir(parents=True, exist_ok=True)
    
    # Initialize database
    db = get_db()
    init_db(db)
    print(f"Database initialized at: {path_to_display(db_path)}")


# Global database connection (initialized by init_app)
db = None


def normalize_record(d: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Normalize a log record for storage."""
    # Extract standard fields
    ts = d.get("timestamp") or d.get("ts") or d.get("@timestamp")
    level = d.get("level") or d.get("lvl")
    logger = d.get("logger") or d.get("name")
    event = d.get("event") or d.get("message") or d.get("msg")
    
    trace_id = d.get("trace_id")
    span_id = d.get("span_id")
    parent_span_id = d.get("parent_span_id") or d.get("parent_id")
    
    # Must have trace and span IDs
    if not (trace_id and span_id):
        return None
    
    # Copy dict to avoid modifying original
    attrs = dict(d)
    
    # Remove known fields from attrs
    for key in ("timestamp", "ts", "@timestamp", "level", "lvl", "logger", "name",
                "event", "message", "msg", "trace_id", "span_id", "parent_span_id", "parent_id"):
        attrs.pop(key, None)
    
    return {
        "ts": ts,
        "level": level,
        "logger": logger,
        "event": event,
        "trace_id": trace_id,
        "span_id": span_id,
        "parent_span_id": parent_span_id,
        "attrs": json.dumps(attrs, ensure_ascii=False),
    }


def ingest_records(conn: sqlite3.Connection, records: List[Dict[str, Any]]) -> int:
    """Ingest log records into the database."""
    rows = []
    for rec in records:
        norm = normalize_record(rec)
        if norm:
            rows.append(norm)
    
    if rows:
        with conn:
            conn.executemany(
                """
                INSERT INTO logs (ts, level, logger, event, attrs, trace_id, span_id, parent_span_id)
                VALUES (:ts, :level, :logger, :event, :attrs, :trace_id, :span_id, :parent_span_id)
                """,
                rows,
            )
    
    return len(rows)


def fetch_trace(conn: sqlite3.Connection, trace_id: str) -> Optional[Dict]:
    """Fetch all logs for a trace and build tree structure."""
    cur = conn.execute(
        """
        SELECT ts, level, logger, event, attrs, trace_id, span_id, parent_span_id
        FROM logs
        WHERE trace_id = ?
        ORDER BY COALESCE(ts, ''), id
        """,
        (trace_id,),
    )
    rows = [dict(r) for r in cur.fetchall()]
    
    if not rows:
        return None
    
    # Group logs by span
    logs_by_span: Dict[str, List[Dict]] = {}
    parent_for_span: Dict[str, Optional[str]] = {}
    
    for r in rows:
        sid = r["span_id"]
        logs_by_span.setdefault(sid, []).append(r)
        if sid not in parent_for_span:
            parent_for_span[sid] = r.get("parent_span_id")
    
    # Build children map and find roots
    children: Dict[str, List[str]] = {sid: [] for sid in logs_by_span}
    roots: List[str] = []
    
    for sid, parent in parent_for_span.items():
        if parent and parent in children:
            children[parent].append(sid)
        else:
            roots.append(sid)
    
    # Sort children by timestamp
    def first_ts(span_id: str) -> str:
        recs = logs_by_span.get(span_id, [])
        return recs[0]["ts"] or "" if recs else ""
    
    for cid_list in children.values():
        cid_list.sort(key=first_ts)
    
    # Get span titles
    def node_title(span_id: str) -> str:
        first = logs_by_span[span_id][0]
        try:
            attrs = json.loads(first["attrs"] or "{}")
        except Exception:
            attrs = {}
        fn = attrs.get("code.function") or attrs.get("function") or ""
        ev = first.get("event") or ""
        return fn or ev or span_id
    
    return {
        "trace_id": trace_id,
        "roots": roots,
        "children": children,
        "logs_by_span": logs_by_span,
        "parent_for_span": parent_for_span,
        "title_for_span": {sid: node_title(sid) for sid in logs_by_span},
    }


# API Routes
@app.get("/")
async def root():
    """Redirect to static index page."""
    return HTMLResponse("""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta http-equiv="refresh" content="0; url=/static/index.html">
    </head>
    <body>
        <p>Redirecting to <a href="/static/index.html">trace viewer</a>...</p>
    </body>
    </html>
    """)


@app.post("/api/ingest")
async def ingest(records: List[Dict[str, Any]]):
    """
    Ingest a list of log records.
    Each record should contain at least: trace_id, span_id.
    """
    count = ingest_records(db, records)
    return {"ingested": count}


@app.get("/api/traces")
async def list_traces(limit: int = Query(100, ge=1, le=1000)):
    """List recent traces."""
    cur = db.execute(
        """
        SELECT trace_id, MIN(ts) AS start_ts, MAX(ts) AS end_ts, COUNT(*) AS events
        FROM logs
        GROUP BY trace_id
        ORDER BY MAX(ts) DESC
        LIMIT ?
        """,
        (limit,),
    )
    rows = [dict(r) for r in cur.fetchall()]
    return {"traces": rows}


@app.get("/api/trace/{trace_id}")
async def get_trace(trace_id: str):
    """Get a specific trace with all its spans and logs."""
    tree = fetch_trace(db, trace_id)
    if not tree:
        raise HTTPException(status_code=404, detail="Trace not found")
    
    # Format for JSON response
    payload = {
        "trace_id": tree["trace_id"],
        "roots": tree["roots"],
        "children": tree["children"],
        "parent_for_span": tree["parent_for_span"],
        "title_for_span": tree["title_for_span"],
        "logs_by_span": {
            sid: [
                {
                    "ts": r["ts"],
                    "level": r["level"],
                    "logger": r["logger"],
                    "event": r["event"],
                    "attrs": json.loads(r["attrs"] or "{}"),
                }
                for r in recs
            ]
            for sid, recs in tree["logs_by_span"].items()
        },
    }
    return JSONResponse(payload)


@app.get("/api/search")
async def search_logs(
    level: Optional[str] = Query(None, description="Filter by log level"),
    event: Optional[str] = Query(None, description="Substring match in event name"),
    since: Optional[str] = Query(None, description="ISO timestamp lower bound"),
    until: Optional[str] = Query(None, description="ISO timestamp upper bound"),
    limit: int = Query(100, ge=1, le=1000),
):
    """Search logs with filters."""
    sql = "SELECT * FROM logs WHERE 1=1"
    args = []
    
    if level:
        sql += " AND level = ?"
        args.append(level)
    
    if event:
        sql += " AND event LIKE ?"
        args.append(f"%{event}%")
    
    if since:
        sql += " AND ts >= ?"
        args.append(since)
    
    if until:
        sql += " AND ts <= ?"
        args.append(until)
    
    sql += " ORDER BY ts DESC LIMIT ?"
    args.append(limit)
    
    rows = [dict(r) for r in db.execute(sql, args).fetchall()]
    
    # Parse attrs back to JSON
    for row in rows:
        try:
            row["attrs"] = json.loads(row["attrs"] or "{}")
        except Exception:
            row["attrs"] = {}
    
    return {"count": len(rows), "results": rows}


def main():
    """Entry point for running the server."""
    import uvicorn
    from .config import load_config, init_config_files, path_to_display
    
    # Initialize config files if needed
    init_config_files()
    
    # Load configuration
    config = load_config()
    
    # Initialize the application
    init_app(config.db_path)
    
    print(f"\n{'='*60}")
    print(f"AI Trace Viewer")
    print(f"{'='*60}")
    print(f"Server: http://{config.host}:{config.port}")
    print(f"Database: {path_to_display(config.db_path)}")
    print(f"Config dir: {path_to_display(get_config_dir())}")
    print(f"{'='*60}\n")
    
    # Run the server
    uvicorn.run(
        "aitrace.server:app",
        host=config.host,
        port=config.port,
        reload=config.reload,
        log_level=config.log_level,
        access_log=config.access_log,
        workers=config.workers,
    )


if __name__ == "__main__":
    main()

