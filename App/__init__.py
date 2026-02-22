from flask import Flask
from App import database


def create_app():
    app = Flask(__name__)
    app.config["SEND_FILE_MAX_AGE_DEFAULT"] = 0

    engine = database.create_engine()

    database.database_test_query(engine)

    rows = database.get_brannstasjoner(engine)
    print(rows)

    return app


app = create_app()

if __name__ == "__main__":
    app.run(debug=True)