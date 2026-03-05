import flask
import requests as http_requests
from App import app, database

DSB_WMS_BASE = 'https://ogc.dsb.no/wms.ashx'

@app.route('/')
def hello_world():
    return flask.render_template('index.html')

@app.route('/api/brannstasjoner')
def api_brannstasjoner():
    engine = database.create_engine()
    geojson = database.get_brannstasjoner(engine)
    return flask.jsonify(geojson)

@app.route('/api/fylke/<int:fylke_id>')
def api_fylke(fylke_id):
    engine = database.create_engine()
    geojson = database.get_shelters_within_fylke(engine, fylke_id)
    return flask.jsonify(geojson)

@app.route('/api/dsb-wms')
def dsb_wms_proxy():
    """
    Proxy endpoint for DSB WMS tiles. Allows serverside analysis of tiles.
    """
    params = flask.request.args.to_dict(flat=False)
    flat_params = {k: v[0] if len(v) == 1 else v for k, v in params.items()}

    upstream = http_requests.get(DSB_WMS_BASE, params=flat_params, timeout=30)

    excluded_headers = {'content-encoding', 'transfer-encoding', 'connection'}
    headers = {
        k: v for k, v in upstream.headers.items()
        if k.lower() not in excluded_headers
    }
    headers['Access-Control-Allow-Origin'] = '*'

    return flask.Response(upstream.content, status=upstream.status_code, headers=headers)