from flask import Flask
import sqlalchemy
from sqlalchemy import text
import database
def create_app():
    application = Flask(__name__)

    # Disable static file cache during development so the browser doesn't get 304 Not Modified
    application.config['SEND_FILE_MAX_AGE_DEFAULT'] = 0

    application.run()
    print(sqlalchemy.__version__)

    connection = database.create_connection()

    database.database_test_query(connection)

    return application

app = create_app()