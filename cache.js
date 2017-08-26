var cache = {
  // domain => object:
  // - ips: array of strings
  // - created: Date.now()
  // - visited: Date.now()
  _items: {},
  _length: 0,

  // In seconds.
  defaultCacheTTL: 600,

  maxLength: 1000,

  onIpChange: function (domain, ips, existed) { },
  onDomainDelete: function (domain) { },

  has: function (domain) {
    return domain in cache._items;
  },

  _get: function (domain) {
    return cache._items[domain];
  },

  ips: function (domain) {
    var item = cache._get(domain);
    if (item) {
      return item.ips.concat([]);
    }
  },

  // Empty ips means the domain was resolved as NX.
  set: function (domain, ips) {
    if (toString.call(domain) != '[object String]' || !domain.match(/^[\w\-.]+$/)
        || !Array.isArray(ips)) {
      throw 'BDNS: cache.set(): bad argument(s)';
    }

    var existed = cache.has(domain);

    cache._items[domain] = {
      ips: ips.concat([]),
      created: Date.now(),
      visited: Date.now()
    };

    cache._length += !existed;
    cache.onIpChange(domain, ips, existed);

    cache.each(function (domain) {
      if (cache._length <= cache.maxLength) { return true; }
      cache.delete(domain);
    });
  },

  isExpired: function (domain, ttl) {
    var item = cache._get(domain);
    if (item) {
      return item.visited < Date.now() - ttl * 1000;
    }
  },

  setVisited: function (domain) {
    var item = cache._get(domain);
    if (item) {
      item.visited = Date.now();
    }
  },

  delete: function (domain) {
    if (cache.has(domain)) {
      delete cache._items[domain];
      cache._length--;
      cache.onDomainDelete(domain);
      return true;
    }
  },

  prune: function (ttl) {
    ttl = ttl || cache.defaultCacheTTL;
    var threshold = Date.now() - ttl * 1000;
    var count = 0;

    cache.each(function (domain) {
      if (cache._items[domain].visited < threshold) {
        count++;
        cache.delete(domain);
      }
    });

    return count;
  },

  each: function (iter) {
    for (var domain in cache._items) {
      if (iter(domain, cache._items[domain]) === true) {
        break;
      }
    }
  },

  get length() {
    return cache._length;
  },
};
