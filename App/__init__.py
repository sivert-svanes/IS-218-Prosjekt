from flask import Flask

def create_app():
    application = Flask(__name__)

    # Disable static file cache during development so the browser doesn't get 304 Not Modified
    application.config['SEND_FILE_MAX_AGE_DEFAULT'] = 0

    application.run()

    return application

app = create_app()