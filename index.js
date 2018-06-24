/* Capture data for a bunch of simple requests
 *
 * options:
 *
 * - `mapRequestToName`: function that maps a `req` to a filename that will end
 *   up on disk
 * - `harOutputDir`: Where to put the HAR-files
 *
 * TODO:
 * - Other output directories? (Don't use file-system at all?)
 * - Filter what we record up front?
 */
var fs = require('fs'),
  path = require('path');

module.exports = function harCaptureMiddlewareSetup(options) {
  options = options || {};

  // Extract options
  var mapHarToName = options.mapHarToName;
  var saveBody = options.saveBody;
  var harOutputDir = options.harOutputDir || process.cwd();

  // Default 10 minutes
  var maxCaptureTime = (options.maxCaptureSeconds || 600) * 1000;
  var maxCaptureRequests = options.maxCaptureRequests || 1000;

  var filterFunction = options.filter || function () {
    return true;
  };

  var flushBeforeRequest = options.flushBeforeRequest || function () {
    return false;
  };

  var flushAfterRequest = options.flushAfterRequest || function () {
    return false;
  };

  var getReqEncoding = options.getReqEncoding || function () {
    return 'utf8';
  };

  var entries = [];
  var lastTimer = null;
  var lastFlushTime = Date.now();

  function flush() {
    if (entries.length > 0) {
      if (lastTimer) {
        clearTimeout(lastTimer);
      }

      var now = Date.now();

      var har = {
        log: {
          version: '1.1', // Version of HAR file-format
          creator: {
            name: 'node-express-har-capture',
            version: '1.0.0' // TODO: Get from package.json
            // comment: ""
          },
          pages: [],
          entries: entries
        }
      };

      var customPart = mapHarToName ? '-' + mapHarToName(har) : '';

      fs.writeFile(
        path.join(harOutputDir, now + customPart + '.har'),
        JSON.stringify(har, undefined, 2),
        function (err) {
          if (err) {
            console.error("Failed to write HAR file to disk.");
          }
        }
      );

      entries = [];
      lastFlushTime = now;
    }
  }

  function checkAndFlush(force) {
    var timeSinceLastFlush = Date.now() - lastFlushTime;
    var timeUntilFlush = maxCaptureTime - timeSinceLastFlush;

    if (force || timeUntilFlush <= 0 || entries.length >= maxCaptureRequests) {
      flush();
    }
    else {
      if (lastTimer) {
        clearTimeout(lastTimer);
      }
      lastTimer = setTimeout(flush, timeUntilFlush).unref();
    }
  }

  return function harCaptureMiddleware(req, res, next) {
    if (flushBeforeRequest(req)) { flush() }

    // Filter out stuff we don't want to run
    if (!filterFunction(req)) { return next(); }

    var startTime = Date.now();

    // Listen in on body parsing
    // NOTE: We do not resume the stream, as it would make actual parsers
    // miss out on the data. On the down-side, it doesn't capture a body
    // when the body isn't used later.
    var requestBodySize = 0,
      requestBody = [];

    req.on('data', function (chunck) {
      requestBodySize += chunck.length;
      if (saveBody) {
        requestBody.push(chunck);
      }
    });
    req.on('end', function (chunck) {
      if (chunck) {
        requestBodySize += chunck.length;
        if (saveBody) {
          requestBody.push(chunck);
        }
      }

      if (requestBody.length < 0) {
        requestBody = "";
        return;
      }

      if (Buffer.isBuffer(requestBody[0])) {
        var reqEncoding = getReqEncoding(req);
        requestBody = Buffer.concat(requestBody).toString(reqEncoding);
      }
      else {
        requestBody = requestBody.join("");
      }
    });

    // Shadow the 'end' request
    var end = res.end;
    res.end = function (data) {
      var endTime = Date.now(),
        deltaTime = endTime - startTime;
      // Call the real 'end'
      end.apply(res, arguments);

      var responseBodyLength = 0;
      var responseBody = '';
      if(saveBody) {
        responseBodyLength = data && data.length || 0;
        responseBody = data && data.toString() || '';
      }
      // Store har-stuff...

      var reqEntry = {
        timings: {
          send: -1,
          receive: -1,
          wait: deltaTime,
          comment: "Server-side processing only",
          onLoad: -1
        },
        startedDateTime: new Date(startTime).toISOString(),
        time: deltaTime,
        request: {
          method: req.method,
          url: req.protocol + '://' + req.get('host') + req.originalUrl,
          httpVersion: 'HTTP/' + req.httpVersion,
          headersSize: 0, // Filled out later
          headers: [], // Filled out later
          queryString: [], // TODO
          cookies: [], // TODO
          bodySize: requestBodySize,
          postData: {
            mimeType: req.get('Content-Type'),
            params: [],
            text: requestBody,
            comment: "Captured input stream"
          }
        },
        response: {
          status: res.statusCode,
          redirectURL: req.originalUrl,
          httpVersion: 'HTTP/' + req.httpVersion, // TODO
          headersSize: -1,
          statusText: 'OK', // TODO
          headers: [],
          cookies: [], // TODO
          bodySize: responseBodyLength,
          content: {
            size: responseBodyLength,
            params: [],
            mimeType: res.get('Content-Type'),
            text: responseBody
          },
          timings: {
            send: 0,
            receive: 0,
            wait: deltaTime,
            comment: "Server-side processing only"
          }
        },
        cache: {}, // TODO / is it optional
        pageref: 'page' + startTime
      };

      // REQUEST DATA
      // Fix up data-stucture with iterative data from request
      // Headers
      Object.keys(req.headers).forEach(function (headerName) {
        reqEntry.request.headersSize += headerName.length + 2 + req.headers[headerName].length;
        reqEntry.request.headers.push({
          name: headerName,
          value: req.headers[headerName]
        });
      });
      // Query strings
      Object.keys(req.query).forEach(function (queryName) {
        reqEntry.request.queryString.push({
          name: queryName,
          value: req.query[queryName]
        });
      });
      // TODO: Cookies

      // RESPONSE DATA
      // Headers
      if (res._headerSent) {
        reqEntry.response.headersSize = res._header.length;
        Object.keys(res._headers).forEach(function (headerName) {
          var realHeaderName = res._headerNames[headerName] || headerName;
          reqEntry.response.headers.push({
            name: realHeaderName,
            value: res._headers[headerName]
          });
        });
      }

      entries.push(reqEntry);
      checkAndFlush(flushAfterRequest(req));
    };

    // Continue processing the request
    next();
  };
};
