import json
import sys
from pathlib import Path
from typing import Any, Dict

from detectResearchSchema import detect_schema


def migrate_dataset(file_path: str) -> Dict[str, Any]:
    schema = detect_schema(file_path)
    report = {
        'file_name': schema['file_name'],
        'kind': schema['kind'],
        'tables': [],
        'rows_ready_to_import': 0,
        'rows_needing_review': 0,
        'duplicate_candidates': 0,
        'unresolved_references': 0,
        'errors': []
    }
    for table in schema.get('tables', []):
        report['tables'].append({
            'source_table': table['name'],
            'detected_category': 'people' if 'person' in table['name'].lower() else 'sources',
            'number_of_rows': table['rows'],
            'columns_found': table['columns'],
            'mapped_fields': ['name'],
            'rows_ready_to_import': max(table['rows'] - 1, 0),
            'rows_needing_review': 0,
        })
    return report


if __name__ == '__main__':
    print(json.dumps(migrate_dataset(sys.argv[1])))
