import csv
import json
import sys
from pathlib import Path
from typing import Any, Dict

from migrateResearchDataset import migrate_dataset


def generate_report(file_path: str) -> Dict[str, Any]:
    return migrate_dataset(file_path)


if __name__ == '__main__':
    print(json.dumps(generate_report(sys.argv[1])))
