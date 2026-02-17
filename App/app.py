from flask import Flask, render_template

app = Flask(__name__)
# Disable static file cache during development so the browser doesn't get 304 Not Modified
app.config['SEND_FILE_MAX_AGE_DEFAULT'] = 0


@app.route('/')
def hello_world():

    return render_template('index.html')

if __name__ == '__main__':
    app.run()
