/* Test filtering
 */

var assert = require('chai').assert,
    express = require('express'),
    har = require('../index.js'),
    fs = require('fs'),
    path = require('path'),
    request = require('supertest');

describe('Filter test', function () {
    var app;

    before(function () {
        app = express();

        app.use(har({
            maxCaptureRequests: 1,
            harOutputDir: __dirname,
            mapHarToName: function (har) {
              var filenameHeader = har.log.entries[0].request.headers.find(function (header) {
                return header.name === 'filename';
              });

              return (filenameHeader && filenameHeader.value) || 'default';
            },
            filter: function (req) { return 'get-har' in req.headers; }
        }));

        app.get('/', function (req, res, next) {
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

    it('Does create HAR on matching request', function (done) {
        request(app)
            .get('/')
            .set('filename', 'should-exist')
            .set('get-har', '1')
            .expect(200)
            .end(function (err, res) {
                assert(
                    fs.readdirSync(__dirname).some(function (filename) {
                        return filename.indexOf('should-exist') !== -1;
                    }),
                    'File with expected output filename does not exist'
                );
                done(err);
            });
    });

    it('Doesn\' create HAR on filtered request', function (done) {
        request(app)
            .get('/')
            .set('filename', 'should-not-exist')
            .expect(200)
            .end(function (err, res) {
                // TODO: Check emitted HAR-file
                assert(
                    fs.readdirSync(__dirname).every(function (filename) {
                        return filename.indexOf('should-not-exist') === -1;
                    }),
                    'File unexpectedly does exist'
                );
                done(err);
            });
    });
});
