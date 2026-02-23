import flask
from App import app, database

@app.route('/')
def hello_world():
    return flask.render_template('index.html')

@app.route('/api/brannstasjoner')
def api_brannstasjoner():
    engine = database.create_engine()
    geojson = database.get_brannstasjoner(engine)
    return flask.jsonify(geojson)
