"""
@file: create_migration.py
@description: Скрипт для создания новой миграции Alembic
@dependencies: alembic
@created: 2025-01-30
"""

import subprocess
import sys
import os

# Переходим в директорию backend
backend_dir = os.path.dirname(os.path.dirname(__file__))
os.chdir(backend_dir)

def create_migration(message: str, autogenerate: bool = True):
    """Создание новой миграции"""
    try:
        cmd = ["alembic", "revision"]
        if autogenerate:
            cmd.append("--autogenerate")
        cmd.extend(["-m", message])
        
        result = subprocess.run(
            cmd,
            check=True,
            capture_output=True,
            text=True
        )
        print(result.stdout)
        return True
    except subprocess.CalledProcessError as e:
        print(f"Ошибка при создании миграции: {e.stderr}", file=sys.stderr)
        return False

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Использование: python create_migration.py <message> [--no-autogenerate]")
        sys.exit(1)
    
    message = sys.argv[1]
    autogenerate = "--no-autogenerate" not in sys.argv
    success = create_migration(message, autogenerate)
    sys.exit(0 if success else 1)
