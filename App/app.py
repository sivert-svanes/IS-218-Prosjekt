import flask
from App import app

@app.route('/')
def hello_world():
    return flask.render_template('index.html')