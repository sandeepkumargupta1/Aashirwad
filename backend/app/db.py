import json
import sqlite3
import time
import uuid
from .config import DATA_DIR

SCHEMA = '''
CREATE TABLE IF NOT EXISTS farms (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, latitude REAL NOT NULL, longitude REAL NOT NULL,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, farm_json TEXT NOT NULL, analysis_json TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS cache (
 key TEXT PRIMARY KEY, fetched_at REAL NOT NULL, payload TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS source_imports (
 id TEXT PRIMARY KEY, source TEXT NOT NULL, metadata_json TEXT NOT NULL,
 imported_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
'''
def connect():
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    conn=sqlite3.connect(DATA_DIR/'aashirwad.sqlite', timeout=15)
    conn.executescript(SCHEMA)
    return conn

def cache_get(key, ttl=86400):
    with connect() as c:
        row=c.execute('SELECT fetched_at,payload FROM cache WHERE key=?',(key,)).fetchone()
    return (json.loads(row[1]),row[0]) if row and time.time()-row[0]<ttl else None

def cache_put(key,payload):
    with connect() as c:
        c.execute('INSERT OR REPLACE INTO cache VALUES (?,?,?)',(key,time.time(),json.dumps(payload,allow_nan=False)))
        c.execute('DELETE FROM cache WHERE fetched_at < ?',(time.time()-7*86400,))

def save_farm(farm,analysis):
    record_id=str(uuid.uuid4())
    with connect() as c:
        c.execute('INSERT INTO farms(id,name,latitude,longitude,farm_json,analysis_json) VALUES (?,?,?,?,?,?)',(record_id,farm['name'],farm['latitude'],farm['longitude'],json.dumps(farm),json.dumps(analysis,allow_nan=False)))
    return record_id
