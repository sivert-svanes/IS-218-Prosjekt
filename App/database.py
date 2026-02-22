import sqlalchemy
from sqlalchemy import text
from dotenv import load_dotenv
from geoalchemy2 import Geometry
from sqlalchemy import Column, Integer, String
import os


load_dotenv()
connStr = os.getenv("DATABASE_URL")

def create_connection():
    #Put inn the env variable in the create engine function
    engine = sqlalchemy.create_engine(connStr)
    connection = engine.connect()
    return connection

def database_test_query(connection):
    with connection as conn:
        result = conn.execute(text("SELECT * FROM pg_catalog.pg_tables;"))
        print(result.all())

class BrannstasjonerModel():
    id = Column(Integer, primary_key=True)
    geom = Column(Geometry(geometry_type='POINT', srid=4326))
    gml_id = Column(String)
    opphav = Column(String)
    brannstasjon = Column(String)
    brannvesen = Column(String)
    stasjonstype = Column(String)
    kasernert = Column(String)
