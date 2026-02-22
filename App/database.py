import sqlalchemy
from sqlalchemy import text
from dotenv import load_dotenv
import os

load_dotenv()
connStr = os.getenv("DATABASE_URL")

def create_connection():
    #Put inn the env variable in the create engine function
    engine = sqlalchemy.create_engine(connStr)
    connection = engine.connect()
    return connection

def database_test_query(connection):
    with connection as conn:
        result = conn.execute(text("SELECT * FROM pg_catalog.pg_tables;"))
        print(result.all())
