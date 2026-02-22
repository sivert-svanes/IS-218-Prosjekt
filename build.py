import os
import platform
import subprocess

packages = [
        'flask',
        'sqlalchemy',
        'GeoAlchemy2',
        'psycopg2',
        'psycopg',
        'python-dotenv',
        'spglib',
    ]

def build():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    venv_dir = os.path.join(base_dir, '.venv')

    if not os.path.isdir(venv_dir):
        subprocess.run('py -3 -m venv .venv', shell=True, check=True)

    if platform.system() == 'Windows':
        venv_python = os.path.join(venv_dir, 'Scripts', 'python.exe')
    else:
        venv_python = os.path.join(venv_dir, 'bin', 'python')

    install_pkg = input('\nInstall required packages? (y/n): ')
    if install_pkg.lower().startswith('y'):
        for pkg in packages:
            try:
                os.system(f'pip install --quiet {pkg}')
            except Exception as e:
                print(f"Warning: failed to install {pkg}: {e}")
                return

    frontend_dir = os.path.abspath(os.path.join(base_dir, 'App', 'frontend'))
    try:
        print('\nInstalling frontend packages...')
        subprocess.run(r'npm install', cwd=frontend_dir, shell=True, check=True)
        print('\nBuilding frontend...')
        subprocess.run(r'npm run build', cwd=frontend_dir, shell=True, check=True)
    except Exception as e:
        print(f"Warning: failed to build frontend: {e}")
        return

    create_env = input('\nCreate .env file? (y/n): ')
    if  create_env.lower().startswith('y'):
        conn_str = input('\nEnter db connection string:')
        env_path = os.path.join(base_dir, 'App', '.env')
        with open(env_path, 'w') as env:
            env.write('DATABASE_URL=' + conn_str)
            env.close()

    start = input('\nStart server? (y/n): ')
    if start.lower().startswith('y'):
        subprocess.run([venv_python, '-m', 'flask', '--app', 'App.app', 'run'], cwd=base_dir, check=True)

build()