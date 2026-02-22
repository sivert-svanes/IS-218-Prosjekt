import os
import platform
import subprocess

os.system("pip install flask")
os.system("pip install sqlalchemy")
os.system("pip install GeoAlchemy2")
os.system("pip install psycopg2")
os.system("pip install psycopg")

if platform.system() == "Windows":
    subprocess.run(["powershell", r'cd .\frontend\; npm install; npm run build '])
else:
    #not tested outside windows, so IDK if this works
    subprocess.run(["cd frontend/; npm install; npm run build "])

print("Enter db connection string:")
conn_str = input()

env = open(".env", "w")
env.write("DATABASE_URL=" + conn_str)
env.close()

print("Start server? (y/n):")
start = input()

if start == "y":
    if platform.system() == "Windows":
        subprocess.run(["powershell", r' flask --app app.py run --debug'])
    else:
        #not tested outside windows, so IDK if this works
        subprocess.run([r'flask --app app.py run --debug'])