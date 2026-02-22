import os
import platform
import subprocess

if not os.path.isdir('.venv'):
    subprocess.run(['py', '-3', '-m', 'venv', '.venv'], check=True)

if platform.system() == 'Windows':
    venv_python = os.path.join('.venv', 'Scripts', 'python.exe')
else:
    venv_python = os.path.join('.venv', 'bin', 'python')

packages = [
    'flask',
    'sqlalchemy',
    'GeoAlchemy2',
    'psycopg2',
    'psycopg',
    'python-dotenv',
    'spglib',
]
for pkg in packages:
    try:
        subprocess.run([venv_python, '-m', 'pip', 'install', pkg], check=True)
    except Exception as e:
        print(f"Warning: failed to install {pkg}: {e}")

# Frontend build (if present)
frontend_dir = os.path.join('App', 'frontend')
if os.path.isdir(frontend_dir):
    try:
        subprocess.run(['npm', 'install'], cwd=frontend_dir, check=True)
        subprocess.run(['npm', 'run', 'build'], cwd=frontend_dir, check=True)
    except Exception as e:
        print('Frontend build failed (continuing):', e)

# DB connection prompt
conn_str = input('Enter db connection string:\n')
with open('App/.env', 'w') as env:
    env.write('DATABASE_URL=' + conn_str)
    env.close()

start = input('Start server? (y/n):\n')
if start.lower().startswith('y'):
    subprocess.run([venv_python, '-m', 'flask', '--app', 'App.app', 'run', '--debug'], check=True)