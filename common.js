var apiBaseURLs = ['https://bdns.bz/r/', 'https://bdns.io/r/'];
var apiBaseUrlIndex = Math.floor(Math.random() * apiBaseURLs.length);

// Additionally restricted by manifest's permissions.
var allURLs = {
  urls: [
    //'<all_urls>',
    // *:// only matches http(s).
    // ws(s):// - Chrome 58+, not supported by Firefox yet.
    "*://*.bit/*",   "ftp://*.bit/*",   "ws://*.bit/*",   "wss://*.bit/*",
    "*://*.lib/*",   "ftp://*.lib/*",   "ws://*.lib/*",   "wss://*.lib/*",
    "*://*.emc/*",   "ftp://*.emc/*",   "ws://*.emc/*",   "wss://*.emc/*",
    "*://*.bazar/*", "ftp://*.bazar/*", "ws://*.bazar/*", "wss://*.bazar/*",
    "*://*.coin/*",  "ftp://*.coin/*",  "ws://*.coin/*",  "wss://*.coin/*",
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

  console.info('BDNS: switched to API server #' + apiBaseUrlIndex); //-
}
