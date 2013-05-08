Express HAR capture
===================

[Express](http://expressjs.com) middleware that captures HAR-traces of passing
requests.

Currently very alpha, so use with caution

Usage
-----

````javascript
var app = express();
app.use(harCapture({}))
app.get('/', function (req, res, next) { ... });
````

This will output a HAR-file for each request in the webserver's current working
directory.

Options
-------

`mapRequestToName`: Function that given the `req` will come up with a sensible
filename for the HAR to be put in.

`harOutputDir`: Where to put the HAR-files. Defaults to `process.cwd()`.

License
-------

Three-clause BSD
