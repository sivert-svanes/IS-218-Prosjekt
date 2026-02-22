import sqlalchemy
from sqlalchemy import text

def create_connection():
    #Put inn the env variable in the create engine function
    engine = sqlalchemy.create_engine("")
    connection = engine.connect()
    return connection

def database_test_query(connection):
    with connection as conn:
        result = conn.execute(text("SELECT * FROM pg_catalog.pg_tables;"))
        print(result.all())