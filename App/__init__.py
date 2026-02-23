from flask import Flask
from App import database


def create_app():
    app = Flask(__name__)
    app.config["SEND_FILE_MAX_AGE_DEFAULT"] = 0

    return app


app = create_app()

if __name__ == "__main__":
    app.run(debug=True)