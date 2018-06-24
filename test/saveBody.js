/* Test capturing request bodies
 */

var assert = require('chai').assert,
    express = require('express'),
    fs = require('fs'),
    har = require('../index.js'),
    path = require('path'),
    request = require('supertest');

describe('Request and response bodies', function () {
    var app;

    before(function () {
        app = express();

        app.use(har({
            maxCaptureRequests: 1,
            harOutputDir: __dirname,
            saveBody: true
        }));

        app.use(express.bodyParser());

        app.all('/', function (req, res, next) {
            return res.send(200, 'This is quite OK');
        });
    });

    // Remove *.har-files after each test
    afterEach(function (done) {
        fs.readdir(__dirname, function (err, files) {
            files
                .filter(function (filename) {
                    return filename.indexOf('.har') > 10;
                })
                .forEach(function (filename) {
                    fs.unlinkSync(path.join(__dirname, filename));
                });
            done(err);
        });
    });

    it('Sends requests', function (done) {
        request(app)
            .put('/')
            .send('some body')
            .expect(200)
            .end(function (err, res) {
                // Wait for file to be written to disk
                setTimeout(function () {
                    var filename = fs.readdirSync(__dirname).filter(function (filename) {
                        return filename.indexOf('.har') > 10;
                    })[0];

                    // It is valid JSON
                    var json;
                    try {
                        var fullFilename = path.join(__dirname, filename),
                            data = fs.readFileSync(fullFilename);
                        json = JSON.parse(data);
                    } catch (e) {
                        assert(e, 'Could not parse JSON');
                        return done(e);
                    }

                    assert.deepProperty(
                        json,
                        'log.entries.0.request.postData.text'
                    );

                    // Simple sanity check
                    assert.deepPropertyVal(
                        json,
                        'log.entries[0].request.postData.text',
                        'some body'
                    );

                    assert.deepPropertyVal(
                        json,
                        'log.entries[0].response.content.text',
                        'This is quite OK'
                    );

                    done(err);
                }, 5);
            });
    });
});
