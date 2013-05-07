/* Build a simple server, make a request and check the output is OK.
 */

var assert = require('chai').assert,
    express = require('express'),
    request = require('supertest')
    har = require('../index.js');

describe('Simple test', function () {
    var app;

    before(function () {
        app = express();

        app.use(har({
        }));

        app.get('/', function (req, res, next) {
            return res.send(200, 'This is quite OK');
        });
    });

    it('Sends requests', function (done) {
        request(app)
            .get('/')
            .set('Custom-header', 'foo/bar')
            .expect(200)
            .end(function (err, res) {
                // TODO: Check emitted HAR-file
                done(err);
            });
    });
});
