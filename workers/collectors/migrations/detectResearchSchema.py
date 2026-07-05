import csv
import json
import os
import sqlite3
import sys
from pathlib import Path
from typing import Any, Dict, List


def detect_schema(file_path: str) -> Dict[str, Any]:
    path = Path(file_path)
    if path.suffix.lower() == '.csv':
        with path.open('r', encoding='utf-8-sig', newline='') as handle:
            rows = list(csv.DictReader(handle))
        return {
            'file_name': path.name,
            'kind': 'csv',
            'tables': [{'name': path.stem, 'rows': len(rows), 'columns': list(rows[0].keys()) if rows else []}],
        }
    if path.suffix.lower() == '.sqlite' or path.suffix.lower() == '.db':
        conn = sqlite3.connect(path)
        tables = [row[0] for row in conn.execute("SELECT name FROM sqlite_master WHERE type='table'")]
        details = []
        for table in tables:
            columns = [row[1] for row in conn.execute(f'PRAGMA table_info({table})')]
            row_count = conn.execute(f'SELECT COUNT(*) FROM {table}').fetchone()[0]
            details.append({'name': table, 'rows': row_count, 'columns': columns})
        conn.close()
        return {'file_name': path.name, 'kind': 'sqlite', 'tables': details}
    return {'file_name': path.name, 'kind': 'unknown', 'tables': []}


if __name__ == '__main__':
    print(json.dumps(detect_schema(sys.argv[1])))
