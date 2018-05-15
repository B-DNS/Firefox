/*
  Firefox Quirks
  ==============

  Sample state transition:

    S1. Tab's URL (loading finished) = old.bit
    S2. User enters new.bit into the URL bar and navigates
    S3. FindProxyForURL is called
    S4. onBeforeRequest is called (it returns a Promise)
    S5. onBeforeRequest messages PAC to use PROXY ... for domain = new.bit
    S6. onBeforeRequest calls resolve() or reject()
    S7. onErrorOccurred is called

  Highlights:

  * FindProxyForURL is called before onBeforeRequest (S3-4), so if you resolve address
    in the latter and message to PAC - PAC won't be able to handle it.
  * PAC itself is unable to do anything useful due to stripped environment.
  * There are two ways to restart the request after resolving it in onBeforeRequest
    (S6) so that PAC can redirect it: by reloading the tab and by directly navigating
    to the requested URL.
  * This means that redirection of requests initiated by a referenced resource (with
    originUrl) is impossible (reload() would reload the referencing tab) but
    detection in onBeforeRequest is possible.
  * However, RequestFilter constraints (e.g. *://*.bit/) may prevent onBeforeRequest
    from being called meaning that if a .bit resource is referenced from a non-.bit
    page then it won't be handled and Firefox will leak the referenced domain via DNS
    (unless that resource was referenced from a .bit page and was cached by Firefox).
  * Tab reloading options:

    * If the tab is reloaded before onBeforeRequest resolves the promise (at S4) then
      the old page is reloaded. After onBeforeRequest or its promise end (S6) it's
      possible to trigger reload indirectly (with a timer - unreliable, or waiting
      for onErrorOccurred by requestId - good).
    * If: resolve (S6) with no arguments or reject are called, or onBeforeRequest
      returns nothing then the browser goes on querying DNS and processing the
      request as usual.
    * If resolve (S6) is called with {redirect} then the URL is replaced like with
      a regular HTTP redirect (Location).
    * If resolve (S6) is called with {cancel: true} then the request disappears and
      old tab's page is reloaded (!). If the tab had no previous content then it
      will be left blank.
    * Thus DNS is leaked on resolve(), resolve({redirect}), reject().
    * onErrorOccurred (S7) is called on resolve({cancel}), reject().
    * Another option to trigger onErrorOccurred would be returning some dummy PROXY
      from PAC (for unknown domains) but its behavior is highly dependent on the
      user's setup, i.e. what dummy address is safe to use and won't stall for timeout.
    * Summary: reloading is great because it preserves HTTP state (POST request data)
      but it requires that the tab has finished loading (or failing). Given the above,
      this cannot be accomplished: the only option - resolve({cancel}) reverts the
      tab while others leak DNS or may incur a timeout.

  * Using direct navigation (browser.tabs.update()) will only work for GET requests.
    This is a big problem if the domain has multiple IPs (RRDNS):

    1. User visits the domain foo.bit, the plugin resolves it and caches the IP(s).
    2. User is surfing the domain's pages.
    3. At some point the plugin decides to expire old IPs to remove foo.bit from
       the resolver's cache, perhaps to obtain fresh version from blockchain.
    4. User visits another page P1, possibly over POST (it's very rare to start
       browsing with a POST URL but common during an active browsing session).
    5. The plugin has no IPs for foo.bit now so it cancels the request, resolves IPs
       and navigates to P1 over GET which affects user's experience (at best he
       has to resubmit the form, at worst he lands at 404/400/etc. if the POST's
       URL doesn't provide GET version).

    * Firefox provides automatic management of proxy failures by returning multiple
      IPs from PAC. However, it means all IPs must be kept in cache as long as
      user's browsing session is active because it's unknown which IP is currently
      used by the browser.
    * To mitigate the above problem to some extent, the plugin's cache can be cleared
      when all IPs for a domain are unreachable (as reported by
      NS_ERROR_NET_ON_CONNECTING_TO).

  * PeerName's addon uses Firefox URL fixup when domain name xxx.yyy is automatically
    converted to www.xxx.yyy if the original name cannot be resolved; Firefox takes
    care of resubmitting the request. This is ideal except it only works if the
    corresponding about:config options are left at defaults, the requested
    domain has no subdomain and its subdomains are simple aliases for the main
    domain (www., ftp., etc. must exist and point to the same IPs as the base domain).
*/

// In seconds. Re-resolve domain which had all IPs down at most this often.
var downCacheTTL = 30;

// requestId => details (from onBeforeRequest).
var startedReqs = {};

function showNotification(title, msg) {
  return browser.notifications.create({
    type: 'basic',
    title: title,
    iconUrl: msg ? 'icon-64.png' : '',
    message: msg || ''
  });
}

function signalPAC(msg) {
  browser.runtime.sendMessage(msg, {toProxyScript: true});
}

// cache is imported by "background" from manifest.
cache.onIpChange = function (domain, ips) {
  signalPAC(domain + ' ' + ips.join(' '));
}

cache.onDomainDelete = function (domain) {
  signalPAC(domain);
}

browser.proxy.registerProxyScript('pac.js');

browser.proxy.onProxyError.addListener(function (error) {
  console.error('BDNS: PAC error: ' + error.message);
});

browser.webRequest.onCompleted.addListener(function (details) {
  var url = parseURL(details.url);

  if (url) {
    console.log('BDNS: #' + details.requestId + ' (' + url.domain + '): completed, ' + details.statusCode); //-

    // Keep visiting IPs in cache (see the note about update() on top).
    cache.setVisited(url.domain);
  }
}, allURLs);

browser.webRequest.onBeforeRequest.addListener(function (details) {
  //console.dir(details);

  var url = parseURL(details.url);

  if (url) {
    var ips = cache.ips(url.domain);

    if (ips) {
      console.log('BDNS: #' + details.requestId + ' (' + url.domain + '): already resolved to ' + ips + '; cache size = ' + cache.length); //-

      if (ips.length) {
        // Return nothing to let browser use PAC's proxy. However, in some cases
        // the browser performs DNS lookup on url.domain before using PAC anyway.
        // The reason is unknown.
      } else {
        showNotification('Non-existent .' + url.tld + ' domain: ' + url.domain);
        return {cancel: true};
      }
    } else {
      console.log('BDNS: #' + details.requestId + ' (' + url.domain + '): resolving at ' + (new Date).toTimeString() + ', full URL: ' + url.url); //-

      return new Promise(function (resolve, reject) {
        resolveViaAPI(url.domain, true, function (ips) {
          if (!ips) {
            showNotification('Resolution of .' + url.tld + ' is temporary unavailable');
            rotateApiHost();

            if (!details.originUrl) {
              // Add to tracked requests so that subsequent NS_ERROR_ABORT will
              // trigger page reload and a repeated request to another API domain.
              startedReqs[details.requestId] = details;
              details._bdns_delayed = true;
            }
          } else if (!ips.length) {
            cache.set(url.domain, []);
            showNotification('Non-existent .' + url.tld + ' domain: ' + url.domain);
          } else {
            cache.set(url.domain, ips);

            console.log('BDNS: #' + details.requestId + ': originUrl: ' + details.originUrl); //-

            // This check is supposed to inform the user when a page embeds a resource
            // (e.g. <img>) from a B-TLD that wasn't yet resolved. But Firefox does not
            // call onBeforeRequest for resources at all while calling it when following
            // <a> to a page on an unresolved B-TLD (and setting originUrl so these two
            // cases cannot be told apart). Nuts...
            //
            // Right now it works without side effects, but if this behavior changes
            // - embedded resources will cause origin tab to be reloaded repeatedly
            // until all their domains are resolved.
            //if (!details.originUrl) {
              startedReqs[details.requestId] = details;
            //} else {
            //  var originHost = parseURL(details.originUrl).domain;
            //  showNotification(originHost + ' references a resource at ' + url.domain, 'The referenced resource will be unavailable until you reload this page.');
            //}
          }

          // Do it after XHR has finished, not in onBeforeRequest for better UX
          // (user sees loading spinner while the domain is being resolved).
          resolve({cancel: true});
        });
      });
    }
  }
}, allURLs, ['blocking']);

browser.webRequest.onErrorOccurred.addListener(function (details) {
  //console.dir(details);

  var req = details.requestId;
  var url = parseURL(details.url);
  console.log('BDNS: #' + req + ' (' + url.domain + '): ' + details.error); //-

  // NS_BINDING_ABORTED - User-cancelled.
  switch (details.error) {
  // Aborted (cancel: true in onBeforeRequest).
  case 'NS_ERROR_ABORT':
    var tracked = startedReqs[req];

    if (tracked) {
      delete startedReqs[req];

      setTimeout(function () {
        browser.tabs.update(details.tabId, {url: tracked.url});
      }, tracked._bdns_delayed ? 1000 : 0);
    }

    break;

  // Server not found, refusing connections, browser in Offline Mode.
  // Sometimes also appears randomly even when the page opens fine.
  //case 'NS_ERROR_NET_ON_RESOLVED':
  // Proxy error.
  case 'NS_ERROR_NET_ON_CONNECTING_TO':
    if (cache.has(url.domain)) {
      // NS_ERROR_NET_ON_CONNECTING_TO is fired for every unresponding IP that
      // Firefox tries after receiving from PAC, thus user may see one or more
      // such messages even if the domain opens up fine after several retries
      // (we don't know if the domain will open or not in the end).
      // Firefox caches the is-down state of IPs for some time so the message
      // won't reappear before that for the same unavailable IPs.
      var msg = cache.ips(url.domain).length > 1
        ? 'may be down, retrying...' : 'is down';

      showNotification(url.domain + ' ' + msg);

      if (cache.isExpired(url.domain, downCacheTTL)) {
        console.log('BDNS: ' + url.domain + ': down, removing to refetch'); //-
        cache.delete(url.domain);
      }
    }

    break;
  }
}, allURLs);

browser.alarms.create({periodInMinutes: 1});

browser.alarms.onAlarm.addListener(function () {
  var count = cache.prune();
  console.log('BDNS: deleted ' + count + ' expired entries; cache size = ' + cache.length); //-
});

browser.tabs.onUpdated.addListener(function (id, changeInfo) {
  var url = parseURL(changeInfo.url || '');

  if (url) {
    var supported = isSupportedTLD(url.tld);

    console.info('BDNS: tab #' + id + ' updated to ' + (supported ? '' : 'un') + 'supported TLD, domain: ' + url.domain); //-

    browser.browserAction[!supported ? 'enable' : 'disable'](id);
  }
});

browser.browserAction.onClicked.addListener(function () {
  browser.tabs.create({
    url: "https://blockchain-dns.info"
  });
});
