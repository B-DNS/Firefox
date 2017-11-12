/*
  RR-DNS in Firefox and Chrome
  ============================

  RR-DNS (a domain name with multiple IPs) may be tested on Linux by adding
  this to /etc/hosts:

    # Reachable loopback address that rejects connections.
    127.1.1.1   dummy.local
    # Unreachable external address that times out.
    10.1.1.1    dummy.local
    # Reachable external address that accepts connections.
    8.8.8.8     dummy.local

  Firefox and RR-DNS:

  * When an IP rejects connection (SYN+RST) - Firefox transparently tries
    next IP without aborting the request.
  * When an IP times out (no response to SYN) - because of XHR.timeout or
    of default Firefox timeout (90 seconds) if that's unset - Firefox aborts
    the request and fires onreadystate with readyState = 2, then 4 and empty
    response. If another request is made to the same domain then Firefox will
    use next address.
  * If an IP returns an invalid response but TCP handshake succeeds - Firefox
    will stick to it from now on.
  * The timeout of individual IPs (i.e. when Firefox may repeat request
    during this session to one of the previously failed IPs) was not
    determined but it was determined that neither Clear Recent History
    nor Private Mode (!) do that, only restarting Firefox does that reliably.

  Chrome and RR-DNS:

  * When an IP times out (no response to SYN) because of default Chrome
    timeout (2-3 minutes, which cannot be changed for sync XHR) - Chrome
    transparently tries next IP without aborting the request.
  * If an IP returns an invalid response but TCP handshake succeeds -
    Chrome will stick to it from now on.
  * Chrome refreshes DNS entries very often (for every request?), including
    on extension reload (for unpacked extensions).

  Other notes:

  * Looks like it's a standard to not to shuffle the IP list, i.e. try
    returned addresses in their original order. Firefox, Chrome and curl
    all do that. That's why BDNS resolver (bdns.io) shuffles results by
    default.
  * Unlike Firefox, Chrome will periodically reload a tab which loading was
    aborted by an extension. Because of this and transparent retries on
    rejection and timeout it's not necessary to implement reloading in the
    extension.
*/

// Update manifest when this list is changed.
var apiBaseURLs = [
  'https://bdns.co/r/',
  'https://bdns.name/r/',
  'https://bdns.us/r/',
  'https://bdns.bz/r/',
  'https://bdns.by/r/',
  'https://bdns.ws/r/',
  'https://bdns.at/r/',
  'https://bdns.im/r/',
  'https://bdns.io/r/',
];

var apiBaseUrlIndex = Math.floor(Math.random() * apiBaseURLs.length);

var apiTimeout = 5000;

// Additionally restricted by manifest's permissions.
var allURLs = {
  urls: [
    //'<all_urls>',
    // *:// only matches http(s).
    // ws(s):// - Chrome 58+, not supported by Firefox yet.
    // ws(s):// removed because they upset AMO review staff and Google's
    // uploader when present in manifest.json.
    // Namecoin
    "*://*.bit/*",    "ftp://*.bit/*",
    // Emercoin
    "*://*.lib/*",    "ftp://*.lib/*",
    "*://*.emc/*",    "ftp://*.emc/*",
    "*://*.bazar/*",  "ftp://*.bazar/*",
    "*://*.coin/*",   "ftp://*.coin/*",
    // OpenNIC - https://wiki.opennic.org/opennic/dot
    "*://*.bbs/*",    "ftp://*.bbs/*",
    "*://*.chan/*",   "ftp://*.chan/*",
    "*://*.cyb/*",    "ftp://*.cyb/*",
    "*://*.dyn/*",    "ftp://*.dyn/*",
    "*://*.geek/*",   "ftp://*.geek/*",
    "*://*.gopher/*", "ftp://*.gopher/*",
    "*://*.indy/*",   "ftp://*.indy/*",
    "*://*.libre/*",  "ftp://*.libre/*",
    "*://*.neo/*",    "ftp://*.neo/*",
    "*://*.null/*",   "ftp://*.null/*",
    "*://*.o/*",      "ftp://*.o/*",
    "*://*.oss/*",    "ftp://*.oss/*",
    "*://*.oz/*",     "ftp://*.oz/*",
    "*://*.parody/*", "ftp://*.parody/*",
    "*://*.pirate/*", "ftp://*.pirate/*",
  ]
};

function parseURL(url) {
  var match = (url || '').match(/^(\w+):\/\/[^\/]*?([\w.-]+)(:(\d+))?(\/|$)/);
  if (match) {
    return {
      url: url,
      scheme: match[1],
      domain: match[2],
      tld: match[2].match(/[^.]+$/),
      port: match[4]
    };
  }
}

// tld = 'bit'.
function isSupportedTLD(tld) {
  return allURLs.urls.indexOf('*://*.' + tld + '/*') != -1;
}

// done = function (ips), ips = [] if nx, [ip, ...] if xx, null on error.
function resolveViaAPI(domain, async, done) {
  var xhr = new XMLHttpRequest;
  var apiBase = apiBaseURLs[apiBaseUrlIndex];

  xhr.onreadystatechange = function () {
    var ips = (xhr.responseText || '').trim();

    console.info('BDNS: ' + domain + ': from ' + apiBase + ': readyState=' + xhr.readyState + ', status=' + xhr.status + ', response=' + ips.replace(/\r?\n/g, ',')); //-

    if (xhr.readyState == 4) {
      if (xhr.status == 200 && ips.match(/^[\d.\r\n]+$/)) {
        ips = ips.split(/\r?\n/);
        done(ips);
      } else if (xhr.status == 404 && ips == 'nx') {
        done([]);
      } else {
        xhr.onerror = null;
        done();
      }
    }
  }

  xhr.onerror = function () { done(); };

  xhr.ontimeout = function () {
    apiTimeout = Math.min(apiTimeout * 1.5, 30000);
    console.warn('BDNS: ' + domain + ': resolver has timed out, increasing timeout to ' + apiTimeout + 'ms'); //-
    // Error handled is called from onreadystatechange.
  };

  // No way to specify timeout in Chrome. I'd love to hear the sound reason
  // for not allowing timeout on sync XHR - where it's most needed.
  if (async) {
    xhr.timeout = apiTimeout;
  }

  try {
    var apiURL = apiBase + encodeURIComponent(domain);
    xhr.open("GET", apiURL, async);
    xhr.send();
    return xhr;
  } catch (e) {
    done();
  }
}

function rotateApiHost() {
  if (++apiBaseUrlIndex >= apiBaseURLs.length) {
    apiBaseUrlIndex = 0;
  }

  console.info('BDNS: switched to API server #' + apiBaseUrlIndex + ' at ' + (new Date).toTimeString()); //-
}

