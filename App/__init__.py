from flask import Flask
import sqlalchemy
from sqlalchemy import text
from App import database
def create_app():
    application = Flask(__name__)

    # Disable static file cache during development so the browser doesn't get 304 Not Modified
    application.config['SEND_FILE_MAX_AGE_DEFAULT'] = 0

    application.run()

    connection = database.create_connection()

    database.database_test_query(connection)
    #database.get_brannstasjoner(connection)
    return application

app = create_app()