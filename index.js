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
    // Extract options
    var mapRequestToName = options.mapRequestToName || function (req) {
        return 'insert-remote-addr-here';
    };
    var harOutputDir = options.harOutputDir || process.cwd();


    return function harCaptureMiddleware(req, res, next) {
        var startTime = Date.now(),
            outputName = mapRequestToName(req);

        // Shadow the 'end' request
        var end = res.end;
        res.end = function () {
            var endTime = Date.now(),
                deltaTime = endTime - startTime;
            // Call the real 'end'
            end.apply(res, arguments);

            //console.log(Object.keys(req));
            //console.log(Object.keys(res));

            // Store har-stuff...
            var data = {
                log: {
                    version: '0.0.0', // TODO: Get from package.json
                    creator: {
                        name: 'node-express-har-capture',
                        version: '0.0.0' // TODO: Get from package.json
                    },
                    pages: [{
                        startedDateTime: new Date(startTime).toISOString(),
                        id: 'page' + startTime,
                        title: req.url,
                        pageTimings: { onLoad: deltaTime }
                    }],
                    entries: [{
                        timings: {
                            send: -1,
                            receive: -1,
                            wait: deltaTime,
                            comment: "Server-side processing only",
                            onLoad: -1,
                        },
                        startedDateTime: new Date(startTime).toISOString(),
                        time: deltaTime,
                        request: {
                            method: req.method,
                            url: req.originalUrl,
                            httpVersion: 'HTTP/' + req.httpVersion,
                            headersSize: 42,
                            headers: [], // TODO
                            queryString: [], // TODO
                            cookies: [], // TODO
                            headerSize: -1, // TODO
                            bodySize: req.client.bytesRead // TODO
                        },
                        response: {
                            status: 200, // TODO
                            redirectURL: req.originalUrl,
                            httpVersion: 'HTTP/' + req.httpVersion, // TODO
                            headersSize: 42,
                            statusText: 'OK', // TODO
                            headers: [], // TODO
                            cookies: [], // TODO
                            bodySize: 42, // TODO
                            content: { // TODO
                                size: 0,
                                mimeType: '',
                                compression: -1
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
                    }]
                }
            };

            // Fix up data-stucture with iterative data from request
            Object.keys(req.headers).forEach(function (headerName) {
                data.log.entries[0].request.headers.push({
                    name: headerName,
                    value: req.headers[headerName]
                });
            });
            // TODO: QueryString & Cookies

            // Write the data out
            fs.writeFile(
                path.join(harOutputDir, Date.now().toString() + '-' + outputName + '.har'),
                JSON.stringify(data)
            );
        };

        // Continue processing the request
        next();
    };
};
