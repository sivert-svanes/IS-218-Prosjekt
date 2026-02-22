from flask import Flask
import sqlalchemy
from sqlalchemy import text
def create_app():
    application = Flask(__name__)

    # Disable static file cache during development so the browser doesn't get 304 Not Modified
    application.config['SEND_FILE_MAX_AGE_DEFAULT'] = 0

    application.run()
    print(sqlalchemy.__version__)
    engine = sqlalchemy.create_engine("")
    connection = engine.connect()

    with connection as conn:
        result = conn.execute(text("SELECT * FROM pg_catalog.pg_tables;"))
        print(result.all())

    return application

app = create_app()