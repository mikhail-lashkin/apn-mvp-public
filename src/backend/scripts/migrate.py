"""
@file: migrate.py
@description: Скрипт для применения миграций Alembic
@dependencies: alembic
@created: 2025-01-30
"""

import subprocess
import sys
import os

# Переходим в директорию backend
backend_dir = os.path.dirname(os.path.dirname(__file__))
os.chdir(backend_dir)

def run_migration(command: str = "upgrade head"):
    """Запуск миграций Alembic"""
    try:
        result = subprocess.run(
            ["alembic", command],
            check=True,
            capture_output=True,
            text=True
        )
        print(result.stdout)
        return True
    except subprocess.CalledProcessError as e:
        print(f"Ошибка при выполнении миграции: {e.stderr}", file=sys.stderr)
        return False

if __name__ == "__main__":
    command = sys.argv[1] if len(sys.argv) > 1 else "upgrade head"
    success = run_migration(command)
    sys.exit(0 if success else 1)
