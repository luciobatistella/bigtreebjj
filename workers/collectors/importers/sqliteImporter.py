import json
import sqlite3
import sys
from typing import Any, Dict


def import_sqlite(file_path: str, options: Dict[str, Any] | None = None) -> Dict[str, Any]:
    options = options or {}
    table_name = options.get("table") or None
    conn = sqlite3.connect(file_path)
    try:
        tables = [row[0] for row in conn.execute("SELECT name FROM sqlite_master WHERE type='table'")]
        selected_table = table_name if table_name in tables else (tables[0] if tables else None)
        rows = []
        if selected_table:
            for index, row in enumerate(conn.execute(f'SELECT * FROM {selected_table}'), start=2):
                rows.append({"row_number": index, "raw": row})
        return {
            "format": "sqlite",
            "file_name": file_path.split('/')[-1],
            "rows": rows,
            "summary": {"total_rows": len(rows), "valid_rows": len(rows), "invalid_rows": 0},
            "preview": json.dumps(rows[:3], ensure_ascii=False),
            "metadata": {"table": selected_table, "tables": tables},
        }
    finally:
        conn.close()


if __name__ == "__main__":
    options = json.loads(sys.argv[2]) if len(sys.argv) > 2 else {}
    print(json.dumps(import_sqlite(sys.argv[1], options)))
