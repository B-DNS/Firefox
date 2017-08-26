// domain => [IPs].
var cache = {};
var debug = false;

browser.runtime.onMessage.addListener(function (msg) {
  var parts = msg.trim().split(/ /g);

  if (parts.length > 1) {
    cache[parts.shift()] = parts;
  } else {
    delete cache[parts[0]];
  }
});

function propCount(o) {
  var count = 0;
  for (var k in o) { count++; }
  return count;
}

function FindProxyForURL(url, host) {
  // ** ON CHANGES HERE ALSO UPDATE Chrome's bdns.js **
  var res = 'DIRECT 4444';
  var ips = cache[host];

  if (ips) {
    var pos = url.indexOf(host);
    var port;

    if (pos != -1) {
      port = (url.substr(pos + host.length).match(/^:(\d+)/) || [])[1];
    }

    var https = url.match(/^https:/i);
    var directive = https ? 'HTTPS ' : 'PROXY ';
    port = ':' + (port || (https ? 443 : 80));
    // According to MDN, if a proxy doesn't respond then next in the list is tried,
    // and the dead proxy will be automatically retried after 30, 60, etc. minutes.
    res = directive + ips.join(port + '; ' + directive) + port;
  }

  if (debug) {
    if (host != '127.0.0.1') {
      // Behold the DNS log.
      var msg = propCount(cache) + res.replace(/^|[ :;]|$/g, '_') + host;
      res = 'PROXY ' + msg + '-' + Math.random() + ':1234; ' + res;
    }
  }

  return res;
}
