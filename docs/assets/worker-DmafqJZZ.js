(function() {
  "use strict";
  function createArrayWithValues(value, length) {
    return new Array(length).fill(value);
  }
  function kriging_matrix_diag(value, n) {
    const matrix = createArrayWithValues(0, n * n);
    for (let i = 0; i < n; i++) matrix[i * n + i] = value;
    return matrix;
  }
  function kriging_matrix_transpose(matrix, n, m) {
    const M = Array(m * n);
    for (let i = 0; i < n; i++)
      for (let j = 0; j < m; j++) {
        M[j * n + i] = matrix[i * m + j];
      }
    return M;
  }
  function kriging_matrix_add(Ma, Mb, n, m) {
    const M = Array(n * m);
    for (let i = 0; i < n; i++)
      for (let j = 0; j < m; j++) {
        const index = i * m + j;
        M[index] = Ma[index] + Mb[index];
      }
    return M;
  }
  function kriging_matrix_multiply(Ma, Mb, n, m, p) {
    const Z = Array(n * p).fill(0);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < p; j++) {
        for (let k = 0, index = i * p + j; k < m; k++) {
          Z[index] += Ma[i * m + k] * Mb[k * p + j];
        }
      }
    }
    return Z;
  }
  function kriging_matrix_chol(M, n) {
    const p = Array(n);
    for (let i = 0; i < n; i++) {
      p[i] = M[i * n + i];
    }
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < i; j++) {
        p[i] -= M[i * n + j] ** 2;
      }
      if (p[i] <= 0) return false;
      p[i] = Math.sqrt(p[i]);
      for (let j = i + 1; j < n; j++) {
        for (let k = 0; k < i; k++) {
          M[j * n + i] -= M[j * n + k] * M[i * n + k];
        }
        M[j * n + i] /= p[i];
      }
    }
    for (let i = 0; i < n; i++) M[i * n + i] = p[i];
    return true;
  }
  function kriging_matrix_chol2inv(M, n) {
    let i, j, k, sum;
    for (i = 0; i < n; i++) {
      M[i * n + i] = 1 / M[i * n + i];
      for (j = i + 1; j < n; j++) {
        sum = 0;
        for (k = i; k < j; k++) sum -= M[j * n + k] * M[k * n + i];
        M[j * n + i] = sum / M[j * n + j];
      }
    }
    for (i = 0; i < n; i++) for (j = i + 1; j < n; j++) M[i * n + j] = 0;
    for (i = 0; i < n; i++) {
      M[i * n + i] *= M[i * n + i];
      for (k = i + 1; k < n; k++) M[i * n + i] += M[k * n + i] * M[k * n + i];
      for (j = i + 1; j < n; j++) for (k = j; k < n; k++) M[i * n + j] += M[k * n + i] * M[k * n + j];
    }
    for (i = 0; i < n; i++) for (j = 0; j < i; j++) M[i * n + j] = M[j * n + i];
  }
  function kriging_matrix_solve(M, n) {
    let m = n;
    let b = Array(n * n);
    let indxc = Array(n);
    let indxr = Array(n);
    let ipiv = Array(n);
    let i, icol, irow, j, k, l, ll;
    let big, dum, pivinv, temp;
    for (i = 0; i < n; i++)
      for (j = 0; j < n; j++) {
        if (i == j) b[i * n + j] = 1;
        else b[i * n + j] = 0;
      }
    for (j = 0; j < n; j++) ipiv[j] = 0;
    for (i = 0; i < n; i++) {
      big = 0;
      for (j = 0; j < n; j++) {
        if (ipiv[j] != 1) {
          for (k = 0; k < n; k++) {
            if (ipiv[k] == 0) {
              if (Math.abs(M[j * n + k]) >= big) {
                big = Math.abs(M[j * n + k]);
                irow = j;
                icol = k;
              }
            }
          }
        }
      }
      ++ipiv[icol];
      if (irow != icol) {
        for (l = 0; l < n; l++) {
          temp = M[irow * n + l];
          M[irow * n + l] = M[icol * n + l];
          M[icol * n + l] = temp;
        }
        for (l = 0; l < m; l++) {
          temp = b[irow * n + l];
          b[irow * n + l] = b[icol * n + l];
          b[icol * n + l] = temp;
        }
      }
      indxr[i] = irow;
      indxc[i] = icol;
      if (M[icol * n + icol] == 0) return false;
      pivinv = 1 / M[icol * n + icol];
      M[icol * n + icol] = 1;
      for (l = 0; l < n; l++) M[icol * n + l] *= pivinv;
      for (l = 0; l < m; l++) b[icol * n + l] *= pivinv;
      for (ll = 0; ll < n; ll++) {
        if (ll != icol) {
          dum = M[ll * n + icol];
          M[ll * n + icol] = 0;
          for (l = 0; l < n; l++) M[ll * n + l] -= M[icol * n + l] * dum;
          for (l = 0; l < m; l++) b[ll * n + l] -= b[icol * n + l] * dum;
        }
      }
    }
    for (l = n - 1; l >= 0; l--)
      if (indxr[l] != indxc[l]) {
        for (k = 0; k < n; k++) {
          temp = M[k * n + indxr[l]];
          M[k * n + indxr[l]] = M[k * n + indxc[l]];
          M[k * n + indxc[l]] = temp;
        }
      }
    return true;
  }
  function kriging_variogram_gaussian(h, nugget, range, sill, A) {
    return nugget + (sill - nugget) / range * (1 - Math.exp(-(1 / A) * Math.pow(h / range, 2)));
  }
  function kriging_variogram_exponential(h, nugget, range, sill, A) {
    return nugget + (sill - nugget) / range * (1 - Math.exp(-(1 / A) * (h / range)));
  }
  function kriging_variogram_spherical(h, nugget, range, sill, A) {
    if (h > range) return nugget + (sill - nugget) / range;
    return nugget + (sill - nugget) / range * (1.5 * (h / range) - 0.5 * Math.pow(h / range, 3));
  }
  function getModelFn(type) {
    switch (type) {
      case "gaussian":
        return kriging_variogram_gaussian;
      case "exponential":
        return kriging_variogram_exponential;
      case "spherical":
        return kriging_variogram_spherical;
    }
  }
  function train(t, x, y, model, sigma2, alpha) {
    const variogram = {
      t,
      x,
      y,
      nugget: 0,
      range: 0,
      sill: 0,
      A: 1 / 3,
      n: 0,
      model
    };
    const modelFn = getModelFn(model);
    var i, j, k, l, n = t.length;
    var distance = Array((n * n - n) / 2);
    for (i = 0, k = 0; i < n; i++)
      for (j = 0; j < i; j++, k++) {
        distance[k] = Array(2);
        distance[k][0] = Math.pow(Math.pow(x[i] - x[j], 2) + Math.pow(y[i] - y[j], 2), 0.5);
        distance[k][1] = Math.abs(t[i] - t[j]);
      }
    distance.sort(function(a, b) {
      return a[0] - b[0];
    });
    variogram.range = distance[(n * n - n) / 2 - 1][0];
    var lags = (n * n - n) / 2 > 30 ? 30 : (n * n - n) / 2;
    var tolerance = variogram.range / lags;
    var lag = createArrayWithValues(0, lags);
    var semi = createArrayWithValues(0, lags);
    if (lags < 30) {
      for (l = 0; l < lags; l++) {
        lag[l] = distance[l][0];
        semi[l] = distance[l][1];
      }
    } else {
      for (i = 0, j = 0, k = 0, l = 0; i < lags && j < (n * n - n) / 2; i++, k = 0) {
        while (distance[j][0] <= (i + 1) * tolerance) {
          lag[l] += distance[j][0];
          semi[l] += distance[j][1];
          j++;
          k++;
          if (j >= (n * n - n) / 2) break;
        }
        if (k > 0) {
          lag[l] /= k;
          semi[l] /= k;
          l++;
        }
      }
      if (l < 2) return variogram;
    }
    n = l;
    variogram.range = lag[n - 1] - lag[0];
    var X = createArrayWithValues(1, 2 * n);
    var Y = Array(n);
    var A = variogram.A;
    for (i = 0; i < n; i++) {
      switch (model) {
        case "gaussian":
          X[i * 2 + 1] = 1 - Math.exp(-(1 / A) * Math.pow(lag[i] / variogram.range, 2));
          break;
        case "exponential":
          X[i * 2 + 1] = 1 - Math.exp(-(1 / A) * lag[i] / variogram.range);
          break;
        case "spherical":
          X[i * 2 + 1] = 1.5 * (lag[i] / variogram.range) - 0.5 * Math.pow(lag[i] / variogram.range, 3);
          break;
      }
      Y[i] = semi[i];
    }
    var Xt = kriging_matrix_transpose(X, n, 2);
    var Z = kriging_matrix_multiply(Xt, X, 2, n, 2);
    Z = kriging_matrix_add(Z, kriging_matrix_diag(1 / alpha, 2), 2, 2);
    var cloneZ = Z.slice(0);
    if (kriging_matrix_chol(Z, 2)) kriging_matrix_chol2inv(Z, 2);
    else {
      kriging_matrix_solve(cloneZ, 2);
      Z = cloneZ;
    }
    var W = kriging_matrix_multiply(kriging_matrix_multiply(Z, Xt, 2, 2, n), Y, 2, n, 1);
    variogram.nugget = W[0];
    variogram.sill = W[1] * variogram.range + variogram.nugget;
    variogram.n = x.length;
    n = x.length;
    var K = Array(n * n);
    for (i = 0; i < n; i++) {
      for (j = 0; j < i; j++) {
        K[i * n + j] = modelFn(
          Math.pow(Math.pow(x[i] - x[j], 2) + Math.pow(y[i] - y[j], 2), 0.5),
          variogram.nugget,
          variogram.range,
          variogram.sill,
          variogram.A
        );
        K[j * n + i] = K[i * n + j];
      }
      K[i * n + i] = modelFn(0, variogram.nugget, variogram.range, variogram.sill, variogram.A);
    }
    var C = kriging_matrix_add(K, kriging_matrix_diag(sigma2, n), n, n);
    var cloneC = C.slice(0);
    if (kriging_matrix_chol(C, n)) kriging_matrix_chol2inv(C, n);
    else {
      kriging_matrix_solve(cloneC, n);
      C = cloneC;
    }
    var K = C.slice(0);
    var M = kriging_matrix_multiply(C, t, n, n, 1);
    variogram.K = K;
    variogram.M = M;
    return variogram;
  }
  function predict(x, y, variogram) {
    const M = Array(variogram.n);
    const modelFn = getModelFn(variogram.model);
    for (let i = 0; i < variogram.n; i++) {
      M[i] = modelFn(
        Math.hypot(x - variogram.x[i], y - variogram.y[i]),
        variogram.nugget,
        variogram.range,
        variogram.sill,
        variogram.A
      );
    }
    return kriging_matrix_multiply(M, variogram.M, 1, variogram.n, 1)[0];
  }
  const perf = typeof performance === "object" && performance && typeof performance.now === "function" ? performance : Date;
  const warned = /* @__PURE__ */ new Set();
  const PROCESS = typeof process === "object" && !!process ? process : {};
  const emitWarning = (msg, type, code, fn) => {
    typeof PROCESS.emitWarning === "function" ? PROCESS.emitWarning(msg, type, code, fn) : console.error(`[${code}] ${type}: ${msg}`);
  };
  let AC = globalThis.AbortController;
  let AS = globalThis.AbortSignal;
  if (typeof AC === "undefined") {
    AS = class AbortSignal {
      onabort;
      _onabort = [];
      reason;
      aborted = false;
      addEventListener(_, fn) {
        this._onabort.push(fn);
      }
    };
    AC = class AbortController {
      constructor() {
        warnACPolyfill();
      }
      signal = new AS();
      abort(reason) {
        if (this.signal.aborted)
          return;
        this.signal.reason = reason;
        this.signal.aborted = true;
        for (const fn of this.signal._onabort) {
          fn(reason);
        }
        this.signal.onabort?.(reason);
      }
    };
    let printACPolyfillWarning = PROCESS.env?.LRU_CACHE_IGNORE_AC_WARNING !== "1";
    const warnACPolyfill = () => {
      if (!printACPolyfillWarning)
        return;
      printACPolyfillWarning = false;
      emitWarning("AbortController is not defined. If using lru-cache in node 14, load an AbortController polyfill from the `node-abort-controller` package. A minimal polyfill is provided for use by LRUCache.fetch(), but it should not be relied upon in other contexts (eg, passing it to other APIs that use AbortController/AbortSignal might have undesirable effects). You may disable this with LRU_CACHE_IGNORE_AC_WARNING=1 in the env.", "NO_ABORT_CONTROLLER", "ENOTSUP", warnACPolyfill);
    };
  }
  const shouldWarn = (code) => !warned.has(code);
  const isPosInt = (n) => n && n === Math.floor(n) && n > 0 && isFinite(n);
  const getUintArray = (max) => !isPosInt(max) ? null : max <= Math.pow(2, 8) ? Uint8Array : max <= Math.pow(2, 16) ? Uint16Array : max <= Math.pow(2, 32) ? Uint32Array : max <= Number.MAX_SAFE_INTEGER ? ZeroArray : null;
  class ZeroArray extends Array {
    constructor(size) {
      super(size);
      this.fill(0);
    }
  }
  class Stack {
    heap;
    length;
    // private constructor
    static #constructing = false;
    static create(max) {
      const HeapCls = getUintArray(max);
      if (!HeapCls)
        return [];
      Stack.#constructing = true;
      const s = new Stack(max, HeapCls);
      Stack.#constructing = false;
      return s;
    }
    constructor(max, HeapCls) {
      if (!Stack.#constructing) {
        throw new TypeError("instantiate Stack using Stack.create(n)");
      }
      this.heap = new HeapCls(max);
      this.length = 0;
    }
    push(n) {
      this.heap[this.length++] = n;
    }
    pop() {
      return this.heap[--this.length];
    }
  }
  class LRUCache {
    // options that cannot be changed without disaster
    #max;
    #maxSize;
    #dispose;
    #onInsert;
    #disposeAfter;
    #fetchMethod;
    #memoMethod;
    /**
     * {@link LRUCache.OptionsBase.ttl}
     */
    ttl;
    /**
     * {@link LRUCache.OptionsBase.ttlResolution}
     */
    ttlResolution;
    /**
     * {@link LRUCache.OptionsBase.ttlAutopurge}
     */
    ttlAutopurge;
    /**
     * {@link LRUCache.OptionsBase.updateAgeOnGet}
     */
    updateAgeOnGet;
    /**
     * {@link LRUCache.OptionsBase.updateAgeOnHas}
     */
    updateAgeOnHas;
    /**
     * {@link LRUCache.OptionsBase.allowStale}
     */
    allowStale;
    /**
     * {@link LRUCache.OptionsBase.noDisposeOnSet}
     */
    noDisposeOnSet;
    /**
     * {@link LRUCache.OptionsBase.noUpdateTTL}
     */
    noUpdateTTL;
    /**
     * {@link LRUCache.OptionsBase.maxEntrySize}
     */
    maxEntrySize;
    /**
     * {@link LRUCache.OptionsBase.sizeCalculation}
     */
    sizeCalculation;
    /**
     * {@link LRUCache.OptionsBase.noDeleteOnFetchRejection}
     */
    noDeleteOnFetchRejection;
    /**
     * {@link LRUCache.OptionsBase.noDeleteOnStaleGet}
     */
    noDeleteOnStaleGet;
    /**
     * {@link LRUCache.OptionsBase.allowStaleOnFetchAbort}
     */
    allowStaleOnFetchAbort;
    /**
     * {@link LRUCache.OptionsBase.allowStaleOnFetchRejection}
     */
    allowStaleOnFetchRejection;
    /**
     * {@link LRUCache.OptionsBase.ignoreFetchAbort}
     */
    ignoreFetchAbort;
    // computed properties
    #size;
    #calculatedSize;
    #keyMap;
    #keyList;
    #valList;
    #next;
    #prev;
    #head;
    #tail;
    #free;
    #disposed;
    #sizes;
    #starts;
    #ttls;
    #hasDispose;
    #hasFetchMethod;
    #hasDisposeAfter;
    #hasOnInsert;
    /**
     * Do not call this method unless you need to inspect the
     * inner workings of the cache.  If anything returned by this
     * object is modified in any way, strange breakage may occur.
     *
     * These fields are private for a reason!
     *
     * @internal
     */
    static unsafeExposeInternals(c) {
      return {
        // properties
        starts: c.#starts,
        ttls: c.#ttls,
        sizes: c.#sizes,
        keyMap: c.#keyMap,
        keyList: c.#keyList,
        valList: c.#valList,
        next: c.#next,
        prev: c.#prev,
        get head() {
          return c.#head;
        },
        get tail() {
          return c.#tail;
        },
        free: c.#free,
        // methods
        isBackgroundFetch: (p) => c.#isBackgroundFetch(p),
        backgroundFetch: (k, index, options, context) => c.#backgroundFetch(k, index, options, context),
        moveToTail: (index) => c.#moveToTail(index),
        indexes: (options) => c.#indexes(options),
        rindexes: (options) => c.#rindexes(options),
        isStale: (index) => c.#isStale(index)
      };
    }
    // Protected read-only members
    /**
     * {@link LRUCache.OptionsBase.max} (read-only)
     */
    get max() {
      return this.#max;
    }
    /**
     * {@link LRUCache.OptionsBase.maxSize} (read-only)
     */
    get maxSize() {
      return this.#maxSize;
    }
    /**
     * The total computed size of items in the cache (read-only)
     */
    get calculatedSize() {
      return this.#calculatedSize;
    }
    /**
     * The number of items stored in the cache (read-only)
     */
    get size() {
      return this.#size;
    }
    /**
     * {@link LRUCache.OptionsBase.fetchMethod} (read-only)
     */
    get fetchMethod() {
      return this.#fetchMethod;
    }
    get memoMethod() {
      return this.#memoMethod;
    }
    /**
     * {@link LRUCache.OptionsBase.dispose} (read-only)
     */
    get dispose() {
      return this.#dispose;
    }
    /**
     * {@link LRUCache.OptionsBase.onInsert} (read-only)
     */
    get onInsert() {
      return this.#onInsert;
    }
    /**
     * {@link LRUCache.OptionsBase.disposeAfter} (read-only)
     */
    get disposeAfter() {
      return this.#disposeAfter;
    }
    constructor(options) {
      const { max = 0, ttl, ttlResolution = 1, ttlAutopurge, updateAgeOnGet, updateAgeOnHas, allowStale, dispose, onInsert, disposeAfter, noDisposeOnSet, noUpdateTTL, maxSize = 0, maxEntrySize = 0, sizeCalculation, fetchMethod, memoMethod, noDeleteOnFetchRejection, noDeleteOnStaleGet, allowStaleOnFetchRejection, allowStaleOnFetchAbort, ignoreFetchAbort } = options;
      if (max !== 0 && !isPosInt(max)) {
        throw new TypeError("max option must be a nonnegative integer");
      }
      const UintArray = max ? getUintArray(max) : Array;
      if (!UintArray) {
        throw new Error("invalid max value: " + max);
      }
      this.#max = max;
      this.#maxSize = maxSize;
      this.maxEntrySize = maxEntrySize || this.#maxSize;
      this.sizeCalculation = sizeCalculation;
      if (this.sizeCalculation) {
        if (!this.#maxSize && !this.maxEntrySize) {
          throw new TypeError("cannot set sizeCalculation without setting maxSize or maxEntrySize");
        }
        if (typeof this.sizeCalculation !== "function") {
          throw new TypeError("sizeCalculation set to non-function");
        }
      }
      if (memoMethod !== void 0 && typeof memoMethod !== "function") {
        throw new TypeError("memoMethod must be a function if defined");
      }
      this.#memoMethod = memoMethod;
      if (fetchMethod !== void 0 && typeof fetchMethod !== "function") {
        throw new TypeError("fetchMethod must be a function if specified");
      }
      this.#fetchMethod = fetchMethod;
      this.#hasFetchMethod = !!fetchMethod;
      this.#keyMap = /* @__PURE__ */ new Map();
      this.#keyList = new Array(max).fill(void 0);
      this.#valList = new Array(max).fill(void 0);
      this.#next = new UintArray(max);
      this.#prev = new UintArray(max);
      this.#head = 0;
      this.#tail = 0;
      this.#free = Stack.create(max);
      this.#size = 0;
      this.#calculatedSize = 0;
      if (typeof dispose === "function") {
        this.#dispose = dispose;
      }
      if (typeof onInsert === "function") {
        this.#onInsert = onInsert;
      }
      if (typeof disposeAfter === "function") {
        this.#disposeAfter = disposeAfter;
        this.#disposed = [];
      } else {
        this.#disposeAfter = void 0;
        this.#disposed = void 0;
      }
      this.#hasDispose = !!this.#dispose;
      this.#hasOnInsert = !!this.#onInsert;
      this.#hasDisposeAfter = !!this.#disposeAfter;
      this.noDisposeOnSet = !!noDisposeOnSet;
      this.noUpdateTTL = !!noUpdateTTL;
      this.noDeleteOnFetchRejection = !!noDeleteOnFetchRejection;
      this.allowStaleOnFetchRejection = !!allowStaleOnFetchRejection;
      this.allowStaleOnFetchAbort = !!allowStaleOnFetchAbort;
      this.ignoreFetchAbort = !!ignoreFetchAbort;
      if (this.maxEntrySize !== 0) {
        if (this.#maxSize !== 0) {
          if (!isPosInt(this.#maxSize)) {
            throw new TypeError("maxSize must be a positive integer if specified");
          }
        }
        if (!isPosInt(this.maxEntrySize)) {
          throw new TypeError("maxEntrySize must be a positive integer if specified");
        }
        this.#initializeSizeTracking();
      }
      this.allowStale = !!allowStale;
      this.noDeleteOnStaleGet = !!noDeleteOnStaleGet;
      this.updateAgeOnGet = !!updateAgeOnGet;
      this.updateAgeOnHas = !!updateAgeOnHas;
      this.ttlResolution = isPosInt(ttlResolution) || ttlResolution === 0 ? ttlResolution : 1;
      this.ttlAutopurge = !!ttlAutopurge;
      this.ttl = ttl || 0;
      if (this.ttl) {
        if (!isPosInt(this.ttl)) {
          throw new TypeError("ttl must be a positive integer if specified");
        }
        this.#initializeTTLTracking();
      }
      if (this.#max === 0 && this.ttl === 0 && this.#maxSize === 0) {
        throw new TypeError("At least one of max, maxSize, or ttl is required");
      }
      if (!this.ttlAutopurge && !this.#max && !this.#maxSize) {
        const code = "LRU_CACHE_UNBOUNDED";
        if (shouldWarn(code)) {
          warned.add(code);
          const msg = "TTL caching without ttlAutopurge, max, or maxSize can result in unbounded memory consumption.";
          emitWarning(msg, "UnboundedCacheWarning", code, LRUCache);
        }
      }
    }
    /**
     * Return the number of ms left in the item's TTL. If item is not in cache,
     * returns `0`. Returns `Infinity` if item is in cache without a defined TTL.
     */
    getRemainingTTL(key) {
      return this.#keyMap.has(key) ? Infinity : 0;
    }
    #initializeTTLTracking() {
      const ttls = new ZeroArray(this.#max);
      const starts = new ZeroArray(this.#max);
      this.#ttls = ttls;
      this.#starts = starts;
      this.#setItemTTL = (index, ttl, start = perf.now()) => {
        starts[index] = ttl !== 0 ? start : 0;
        ttls[index] = ttl;
        if (ttl !== 0 && this.ttlAutopurge) {
          const t = setTimeout(() => {
            if (this.#isStale(index)) {
              this.#delete(this.#keyList[index], "expire");
            }
          }, ttl + 1);
          if (t.unref) {
            t.unref();
          }
        }
      };
      this.#updateItemAge = (index) => {
        starts[index] = ttls[index] !== 0 ? perf.now() : 0;
      };
      this.#statusTTL = (status, index) => {
        if (ttls[index]) {
          const ttl = ttls[index];
          const start = starts[index];
          if (!ttl || !start)
            return;
          status.ttl = ttl;
          status.start = start;
          status.now = cachedNow || getNow();
          const age = status.now - start;
          status.remainingTTL = ttl - age;
        }
      };
      let cachedNow = 0;
      const getNow = () => {
        const n = perf.now();
        if (this.ttlResolution > 0) {
          cachedNow = n;
          const t = setTimeout(() => cachedNow = 0, this.ttlResolution);
          if (t.unref) {
            t.unref();
          }
        }
        return n;
      };
      this.getRemainingTTL = (key) => {
        const index = this.#keyMap.get(key);
        if (index === void 0) {
          return 0;
        }
        const ttl = ttls[index];
        const start = starts[index];
        if (!ttl || !start) {
          return Infinity;
        }
        const age = (cachedNow || getNow()) - start;
        return ttl - age;
      };
      this.#isStale = (index) => {
        const s = starts[index];
        const t = ttls[index];
        return !!t && !!s && (cachedNow || getNow()) - s > t;
      };
    }
    // conditionally set private methods related to TTL
    #updateItemAge = () => {
    };
    #statusTTL = () => {
    };
    #setItemTTL = () => {
    };
    /* c8 ignore stop */
    #isStale = () => false;
    #initializeSizeTracking() {
      const sizes = new ZeroArray(this.#max);
      this.#calculatedSize = 0;
      this.#sizes = sizes;
      this.#removeItemSize = (index) => {
        this.#calculatedSize -= sizes[index];
        sizes[index] = 0;
      };
      this.#requireSize = (k, v, size, sizeCalculation) => {
        if (this.#isBackgroundFetch(v)) {
          return 0;
        }
        if (!isPosInt(size)) {
          if (sizeCalculation) {
            if (typeof sizeCalculation !== "function") {
              throw new TypeError("sizeCalculation must be a function");
            }
            size = sizeCalculation(v, k);
            if (!isPosInt(size)) {
              throw new TypeError("sizeCalculation return invalid (expect positive integer)");
            }
          } else {
            throw new TypeError("invalid size value (must be positive integer). When maxSize or maxEntrySize is used, sizeCalculation or size must be set.");
          }
        }
        return size;
      };
      this.#addItemSize = (index, size, status) => {
        sizes[index] = size;
        if (this.#maxSize) {
          const maxSize = this.#maxSize - sizes[index];
          while (this.#calculatedSize > maxSize) {
            this.#evict(true);
          }
        }
        this.#calculatedSize += sizes[index];
        if (status) {
          status.entrySize = size;
          status.totalCalculatedSize = this.#calculatedSize;
        }
      };
    }
    #removeItemSize = (_i) => {
    };
    #addItemSize = (_i, _s, _st) => {
    };
    #requireSize = (_k, _v, size, sizeCalculation) => {
      if (size || sizeCalculation) {
        throw new TypeError("cannot set size without setting maxSize or maxEntrySize on cache");
      }
      return 0;
    };
    *#indexes({ allowStale = this.allowStale } = {}) {
      if (this.#size) {
        for (let i = this.#tail; true; ) {
          if (!this.#isValidIndex(i)) {
            break;
          }
          if (allowStale || !this.#isStale(i)) {
            yield i;
          }
          if (i === this.#head) {
            break;
          } else {
            i = this.#prev[i];
          }
        }
      }
    }
    *#rindexes({ allowStale = this.allowStale } = {}) {
      if (this.#size) {
        for (let i = this.#head; true; ) {
          if (!this.#isValidIndex(i)) {
            break;
          }
          if (allowStale || !this.#isStale(i)) {
            yield i;
          }
          if (i === this.#tail) {
            break;
          } else {
            i = this.#next[i];
          }
        }
      }
    }
    #isValidIndex(index) {
      return index !== void 0 && this.#keyMap.get(this.#keyList[index]) === index;
    }
    /**
     * Return a generator yielding `[key, value]` pairs,
     * in order from most recently used to least recently used.
     */
    *entries() {
      for (const i of this.#indexes()) {
        if (this.#valList[i] !== void 0 && this.#keyList[i] !== void 0 && !this.#isBackgroundFetch(this.#valList[i])) {
          yield [this.#keyList[i], this.#valList[i]];
        }
      }
    }
    /**
     * Inverse order version of {@link LRUCache.entries}
     *
     * Return a generator yielding `[key, value]` pairs,
     * in order from least recently used to most recently used.
     */
    *rentries() {
      for (const i of this.#rindexes()) {
        if (this.#valList[i] !== void 0 && this.#keyList[i] !== void 0 && !this.#isBackgroundFetch(this.#valList[i])) {
          yield [this.#keyList[i], this.#valList[i]];
        }
      }
    }
    /**
     * Return a generator yielding the keys in the cache,
     * in order from most recently used to least recently used.
     */
    *keys() {
      for (const i of this.#indexes()) {
        const k = this.#keyList[i];
        if (k !== void 0 && !this.#isBackgroundFetch(this.#valList[i])) {
          yield k;
        }
      }
    }
    /**
     * Inverse order version of {@link LRUCache.keys}
     *
     * Return a generator yielding the keys in the cache,
     * in order from least recently used to most recently used.
     */
    *rkeys() {
      for (const i of this.#rindexes()) {
        const k = this.#keyList[i];
        if (k !== void 0 && !this.#isBackgroundFetch(this.#valList[i])) {
          yield k;
        }
      }
    }
    /**
     * Return a generator yielding the values in the cache,
     * in order from most recently used to least recently used.
     */
    *values() {
      for (const i of this.#indexes()) {
        const v = this.#valList[i];
        if (v !== void 0 && !this.#isBackgroundFetch(this.#valList[i])) {
          yield this.#valList[i];
        }
      }
    }
    /**
     * Inverse order version of {@link LRUCache.values}
     *
     * Return a generator yielding the values in the cache,
     * in order from least recently used to most recently used.
     */
    *rvalues() {
      for (const i of this.#rindexes()) {
        const v = this.#valList[i];
        if (v !== void 0 && !this.#isBackgroundFetch(this.#valList[i])) {
          yield this.#valList[i];
        }
      }
    }
    /**
     * Iterating over the cache itself yields the same results as
     * {@link LRUCache.entries}
     */
    [Symbol.iterator]() {
      return this.entries();
    }
    /**
     * A String value that is used in the creation of the default string
     * description of an object. Called by the built-in method
     * `Object.prototype.toString`.
     */
    [Symbol.toStringTag] = "LRUCache";
    /**
     * Find a value for which the supplied fn method returns a truthy value,
     * similar to `Array.find()`. fn is called as `fn(value, key, cache)`.
     */
    find(fn, getOptions = {}) {
      for (const i of this.#indexes()) {
        const v = this.#valList[i];
        const value = this.#isBackgroundFetch(v) ? v.__staleWhileFetching : v;
        if (value === void 0)
          continue;
        if (fn(value, this.#keyList[i], this)) {
          return this.get(this.#keyList[i], getOptions);
        }
      }
    }
    /**
     * Call the supplied function on each item in the cache, in order from most
     * recently used to least recently used.
     *
     * `fn` is called as `fn(value, key, cache)`.
     *
     * If `thisp` is provided, function will be called in the `this`-context of
     * the provided object, or the cache if no `thisp` object is provided.
     *
     * Does not update age or recenty of use, or iterate over stale values.
     */
    forEach(fn, thisp = this) {
      for (const i of this.#indexes()) {
        const v = this.#valList[i];
        const value = this.#isBackgroundFetch(v) ? v.__staleWhileFetching : v;
        if (value === void 0)
          continue;
        fn.call(thisp, value, this.#keyList[i], this);
      }
    }
    /**
     * The same as {@link LRUCache.forEach} but items are iterated over in
     * reverse order.  (ie, less recently used items are iterated over first.)
     */
    rforEach(fn, thisp = this) {
      for (const i of this.#rindexes()) {
        const v = this.#valList[i];
        const value = this.#isBackgroundFetch(v) ? v.__staleWhileFetching : v;
        if (value === void 0)
          continue;
        fn.call(thisp, value, this.#keyList[i], this);
      }
    }
    /**
     * Delete any stale entries. Returns true if anything was removed,
     * false otherwise.
     */
    purgeStale() {
      let deleted = false;
      for (const i of this.#rindexes({ allowStale: true })) {
        if (this.#isStale(i)) {
          this.#delete(this.#keyList[i], "expire");
          deleted = true;
        }
      }
      return deleted;
    }
    /**
     * Get the extended info about a given entry, to get its value, size, and
     * TTL info simultaneously. Returns `undefined` if the key is not present.
     *
     * Unlike {@link LRUCache#dump}, which is designed to be portable and survive
     * serialization, the `start` value is always the current timestamp, and the
     * `ttl` is a calculated remaining time to live (negative if expired).
     *
     * Always returns stale values, if their info is found in the cache, so be
     * sure to check for expirations (ie, a negative {@link LRUCache.Entry#ttl})
     * if relevant.
     */
    info(key) {
      const i = this.#keyMap.get(key);
      if (i === void 0)
        return void 0;
      const v = this.#valList[i];
      const value = this.#isBackgroundFetch(v) ? v.__staleWhileFetching : v;
      if (value === void 0)
        return void 0;
      const entry = { value };
      if (this.#ttls && this.#starts) {
        const ttl = this.#ttls[i];
        const start = this.#starts[i];
        if (ttl && start) {
          const remain = ttl - (perf.now() - start);
          entry.ttl = remain;
          entry.start = Date.now();
        }
      }
      if (this.#sizes) {
        entry.size = this.#sizes[i];
      }
      return entry;
    }
    /**
     * Return an array of [key, {@link LRUCache.Entry}] tuples which can be
     * passed to {@link LRUCache#load}.
     *
     * The `start` fields are calculated relative to a portable `Date.now()`
     * timestamp, even if `performance.now()` is available.
     *
     * Stale entries are always included in the `dump`, even if
     * {@link LRUCache.OptionsBase.allowStale} is false.
     *
     * Note: this returns an actual array, not a generator, so it can be more
     * easily passed around.
     */
    dump() {
      const arr = [];
      for (const i of this.#indexes({ allowStale: true })) {
        const key = this.#keyList[i];
        const v = this.#valList[i];
        const value = this.#isBackgroundFetch(v) ? v.__staleWhileFetching : v;
        if (value === void 0 || key === void 0)
          continue;
        const entry = { value };
        if (this.#ttls && this.#starts) {
          entry.ttl = this.#ttls[i];
          const age = perf.now() - this.#starts[i];
          entry.start = Math.floor(Date.now() - age);
        }
        if (this.#sizes) {
          entry.size = this.#sizes[i];
        }
        arr.unshift([key, entry]);
      }
      return arr;
    }
    /**
     * Reset the cache and load in the items in entries in the order listed.
     *
     * The shape of the resulting cache may be different if the same options are
     * not used in both caches.
     *
     * The `start` fields are assumed to be calculated relative to a portable
     * `Date.now()` timestamp, even if `performance.now()` is available.
     */
    load(arr) {
      this.clear();
      for (const [key, entry] of arr) {
        if (entry.start) {
          const age = Date.now() - entry.start;
          entry.start = perf.now() - age;
        }
        this.set(key, entry.value, entry);
      }
    }
    /**
     * Add a value to the cache.
     *
     * Note: if `undefined` is specified as a value, this is an alias for
     * {@link LRUCache#delete}
     *
     * Fields on the {@link LRUCache.SetOptions} options param will override
     * their corresponding values in the constructor options for the scope
     * of this single `set()` operation.
     *
     * If `start` is provided, then that will set the effective start
     * time for the TTL calculation. Note that this must be a previous
     * value of `performance.now()` if supported, or a previous value of
     * `Date.now()` if not.
     *
     * Options object may also include `size`, which will prevent
     * calling the `sizeCalculation` function and just use the specified
     * number if it is a positive integer, and `noDisposeOnSet` which
     * will prevent calling a `dispose` function in the case of
     * overwrites.
     *
     * If the `size` (or return value of `sizeCalculation`) for a given
     * entry is greater than `maxEntrySize`, then the item will not be
     * added to the cache.
     *
     * Will update the recency of the entry.
     *
     * If the value is `undefined`, then this is an alias for
     * `cache.delete(key)`. `undefined` is never stored in the cache.
     */
    set(k, v, setOptions = {}) {
      if (v === void 0) {
        this.delete(k);
        return this;
      }
      const { ttl = this.ttl, start, noDisposeOnSet = this.noDisposeOnSet, sizeCalculation = this.sizeCalculation, status } = setOptions;
      let { noUpdateTTL = this.noUpdateTTL } = setOptions;
      const size = this.#requireSize(k, v, setOptions.size || 0, sizeCalculation);
      if (this.maxEntrySize && size > this.maxEntrySize) {
        if (status) {
          status.set = "miss";
          status.maxEntrySizeExceeded = true;
        }
        this.#delete(k, "set");
        return this;
      }
      let index = this.#size === 0 ? void 0 : this.#keyMap.get(k);
      if (index === void 0) {
        index = this.#size === 0 ? this.#tail : this.#free.length !== 0 ? this.#free.pop() : this.#size === this.#max ? this.#evict(false) : this.#size;
        this.#keyList[index] = k;
        this.#valList[index] = v;
        this.#keyMap.set(k, index);
        this.#next[this.#tail] = index;
        this.#prev[index] = this.#tail;
        this.#tail = index;
        this.#size++;
        this.#addItemSize(index, size, status);
        if (status)
          status.set = "add";
        noUpdateTTL = false;
        if (this.#hasOnInsert) {
          this.#onInsert?.(v, k, "add");
        }
      } else {
        this.#moveToTail(index);
        const oldVal = this.#valList[index];
        if (v !== oldVal) {
          if (this.#hasFetchMethod && this.#isBackgroundFetch(oldVal)) {
            oldVal.__abortController.abort(new Error("replaced"));
            const { __staleWhileFetching: s } = oldVal;
            if (s !== void 0 && !noDisposeOnSet) {
              if (this.#hasDispose) {
                this.#dispose?.(s, k, "set");
              }
              if (this.#hasDisposeAfter) {
                this.#disposed?.push([s, k, "set"]);
              }
            }
          } else if (!noDisposeOnSet) {
            if (this.#hasDispose) {
              this.#dispose?.(oldVal, k, "set");
            }
            if (this.#hasDisposeAfter) {
              this.#disposed?.push([oldVal, k, "set"]);
            }
          }
          this.#removeItemSize(index);
          this.#addItemSize(index, size, status);
          this.#valList[index] = v;
          if (status) {
            status.set = "replace";
            const oldValue = oldVal && this.#isBackgroundFetch(oldVal) ? oldVal.__staleWhileFetching : oldVal;
            if (oldValue !== void 0)
              status.oldValue = oldValue;
          }
        } else if (status) {
          status.set = "update";
        }
        if (this.#hasOnInsert) {
          this.onInsert?.(v, k, v === oldVal ? "update" : "replace");
        }
      }
      if (ttl !== 0 && !this.#ttls) {
        this.#initializeTTLTracking();
      }
      if (this.#ttls) {
        if (!noUpdateTTL) {
          this.#setItemTTL(index, ttl, start);
        }
        if (status)
          this.#statusTTL(status, index);
      }
      if (!noDisposeOnSet && this.#hasDisposeAfter && this.#disposed) {
        const dt = this.#disposed;
        let task;
        while (task = dt?.shift()) {
          this.#disposeAfter?.(...task);
        }
      }
      return this;
    }
    /**
     * Evict the least recently used item, returning its value or
     * `undefined` if cache is empty.
     */
    pop() {
      try {
        while (this.#size) {
          const val = this.#valList[this.#head];
          this.#evict(true);
          if (this.#isBackgroundFetch(val)) {
            if (val.__staleWhileFetching) {
              return val.__staleWhileFetching;
            }
          } else if (val !== void 0) {
            return val;
          }
        }
      } finally {
        if (this.#hasDisposeAfter && this.#disposed) {
          const dt = this.#disposed;
          let task;
          while (task = dt?.shift()) {
            this.#disposeAfter?.(...task);
          }
        }
      }
    }
    #evict(free) {
      const head = this.#head;
      const k = this.#keyList[head];
      const v = this.#valList[head];
      if (this.#hasFetchMethod && this.#isBackgroundFetch(v)) {
        v.__abortController.abort(new Error("evicted"));
      } else if (this.#hasDispose || this.#hasDisposeAfter) {
        if (this.#hasDispose) {
          this.#dispose?.(v, k, "evict");
        }
        if (this.#hasDisposeAfter) {
          this.#disposed?.push([v, k, "evict"]);
        }
      }
      this.#removeItemSize(head);
      if (free) {
        this.#keyList[head] = void 0;
        this.#valList[head] = void 0;
        this.#free.push(head);
      }
      if (this.#size === 1) {
        this.#head = this.#tail = 0;
        this.#free.length = 0;
      } else {
        this.#head = this.#next[head];
      }
      this.#keyMap.delete(k);
      this.#size--;
      return head;
    }
    /**
     * Check if a key is in the cache, without updating the recency of use.
     * Will return false if the item is stale, even though it is technically
     * in the cache.
     *
     * Check if a key is in the cache, without updating the recency of
     * use. Age is updated if {@link LRUCache.OptionsBase.updateAgeOnHas} is set
     * to `true` in either the options or the constructor.
     *
     * Will return `false` if the item is stale, even though it is technically in
     * the cache. The difference can be determined (if it matters) by using a
     * `status` argument, and inspecting the `has` field.
     *
     * Will not update item age unless
     * {@link LRUCache.OptionsBase.updateAgeOnHas} is set.
     */
    has(k, hasOptions = {}) {
      const { updateAgeOnHas = this.updateAgeOnHas, status } = hasOptions;
      const index = this.#keyMap.get(k);
      if (index !== void 0) {
        const v = this.#valList[index];
        if (this.#isBackgroundFetch(v) && v.__staleWhileFetching === void 0) {
          return false;
        }
        if (!this.#isStale(index)) {
          if (updateAgeOnHas) {
            this.#updateItemAge(index);
          }
          if (status) {
            status.has = "hit";
            this.#statusTTL(status, index);
          }
          return true;
        } else if (status) {
          status.has = "stale";
          this.#statusTTL(status, index);
        }
      } else if (status) {
        status.has = "miss";
      }
      return false;
    }
    /**
     * Like {@link LRUCache#get} but doesn't update recency or delete stale
     * items.
     *
     * Returns `undefined` if the item is stale, unless
     * {@link LRUCache.OptionsBase.allowStale} is set.
     */
    peek(k, peekOptions = {}) {
      const { allowStale = this.allowStale } = peekOptions;
      const index = this.#keyMap.get(k);
      if (index === void 0 || !allowStale && this.#isStale(index)) {
        return;
      }
      const v = this.#valList[index];
      return this.#isBackgroundFetch(v) ? v.__staleWhileFetching : v;
    }
    #backgroundFetch(k, index, options, context) {
      const v = index === void 0 ? void 0 : this.#valList[index];
      if (this.#isBackgroundFetch(v)) {
        return v;
      }
      const ac = new AC();
      const { signal } = options;
      signal?.addEventListener("abort", () => ac.abort(signal.reason), {
        signal: ac.signal
      });
      const fetchOpts = {
        signal: ac.signal,
        options,
        context
      };
      const cb = (v2, updateCache = false) => {
        const { aborted } = ac.signal;
        const ignoreAbort = options.ignoreFetchAbort && v2 !== void 0;
        if (options.status) {
          if (aborted && !updateCache) {
            options.status.fetchAborted = true;
            options.status.fetchError = ac.signal.reason;
            if (ignoreAbort)
              options.status.fetchAbortIgnored = true;
          } else {
            options.status.fetchResolved = true;
          }
        }
        if (aborted && !ignoreAbort && !updateCache) {
          return fetchFail(ac.signal.reason);
        }
        const bf2 = p;
        if (this.#valList[index] === p) {
          if (v2 === void 0) {
            if (bf2.__staleWhileFetching) {
              this.#valList[index] = bf2.__staleWhileFetching;
            } else {
              this.#delete(k, "fetch");
            }
          } else {
            if (options.status)
              options.status.fetchUpdated = true;
            this.set(k, v2, fetchOpts.options);
          }
        }
        return v2;
      };
      const eb = (er) => {
        if (options.status) {
          options.status.fetchRejected = true;
          options.status.fetchError = er;
        }
        return fetchFail(er);
      };
      const fetchFail = (er) => {
        const { aborted } = ac.signal;
        const allowStaleAborted = aborted && options.allowStaleOnFetchAbort;
        const allowStale = allowStaleAborted || options.allowStaleOnFetchRejection;
        const noDelete = allowStale || options.noDeleteOnFetchRejection;
        const bf2 = p;
        if (this.#valList[index] === p) {
          const del = !noDelete || bf2.__staleWhileFetching === void 0;
          if (del) {
            this.#delete(k, "fetch");
          } else if (!allowStaleAborted) {
            this.#valList[index] = bf2.__staleWhileFetching;
          }
        }
        if (allowStale) {
          if (options.status && bf2.__staleWhileFetching !== void 0) {
            options.status.returnedStale = true;
          }
          return bf2.__staleWhileFetching;
        } else if (bf2.__returned === bf2) {
          throw er;
        }
      };
      const pcall = (res, rej) => {
        const fmp = this.#fetchMethod?.(k, v, fetchOpts);
        if (fmp && fmp instanceof Promise) {
          fmp.then((v2) => res(v2 === void 0 ? void 0 : v2), rej);
        }
        ac.signal.addEventListener("abort", () => {
          if (!options.ignoreFetchAbort || options.allowStaleOnFetchAbort) {
            res(void 0);
            if (options.allowStaleOnFetchAbort) {
              res = (v2) => cb(v2, true);
            }
          }
        });
      };
      if (options.status)
        options.status.fetchDispatched = true;
      const p = new Promise(pcall).then(cb, eb);
      const bf = Object.assign(p, {
        __abortController: ac,
        __staleWhileFetching: v,
        __returned: void 0
      });
      if (index === void 0) {
        this.set(k, bf, { ...fetchOpts.options, status: void 0 });
        index = this.#keyMap.get(k);
      } else {
        this.#valList[index] = bf;
      }
      return bf;
    }
    #isBackgroundFetch(p) {
      if (!this.#hasFetchMethod)
        return false;
      const b = p;
      return !!b && b instanceof Promise && b.hasOwnProperty("__staleWhileFetching") && b.__abortController instanceof AC;
    }
    async fetch(k, fetchOptions = {}) {
      const {
        // get options
        allowStale = this.allowStale,
        updateAgeOnGet = this.updateAgeOnGet,
        noDeleteOnStaleGet = this.noDeleteOnStaleGet,
        // set options
        ttl = this.ttl,
        noDisposeOnSet = this.noDisposeOnSet,
        size = 0,
        sizeCalculation = this.sizeCalculation,
        noUpdateTTL = this.noUpdateTTL,
        // fetch exclusive options
        noDeleteOnFetchRejection = this.noDeleteOnFetchRejection,
        allowStaleOnFetchRejection = this.allowStaleOnFetchRejection,
        ignoreFetchAbort = this.ignoreFetchAbort,
        allowStaleOnFetchAbort = this.allowStaleOnFetchAbort,
        context,
        forceRefresh = false,
        status,
        signal
      } = fetchOptions;
      if (!this.#hasFetchMethod) {
        if (status)
          status.fetch = "get";
        return this.get(k, {
          allowStale,
          updateAgeOnGet,
          noDeleteOnStaleGet,
          status
        });
      }
      const options = {
        allowStale,
        updateAgeOnGet,
        noDeleteOnStaleGet,
        ttl,
        noDisposeOnSet,
        size,
        sizeCalculation,
        noUpdateTTL,
        noDeleteOnFetchRejection,
        allowStaleOnFetchRejection,
        allowStaleOnFetchAbort,
        ignoreFetchAbort,
        status,
        signal
      };
      let index = this.#keyMap.get(k);
      if (index === void 0) {
        if (status)
          status.fetch = "miss";
        const p = this.#backgroundFetch(k, index, options, context);
        return p.__returned = p;
      } else {
        const v = this.#valList[index];
        if (this.#isBackgroundFetch(v)) {
          const stale = allowStale && v.__staleWhileFetching !== void 0;
          if (status) {
            status.fetch = "inflight";
            if (stale)
              status.returnedStale = true;
          }
          return stale ? v.__staleWhileFetching : v.__returned = v;
        }
        const isStale = this.#isStale(index);
        if (!forceRefresh && !isStale) {
          if (status)
            status.fetch = "hit";
          this.#moveToTail(index);
          if (updateAgeOnGet) {
            this.#updateItemAge(index);
          }
          if (status)
            this.#statusTTL(status, index);
          return v;
        }
        const p = this.#backgroundFetch(k, index, options, context);
        const hasStale = p.__staleWhileFetching !== void 0;
        const staleVal = hasStale && allowStale;
        if (status) {
          status.fetch = isStale ? "stale" : "refresh";
          if (staleVal && isStale)
            status.returnedStale = true;
        }
        return staleVal ? p.__staleWhileFetching : p.__returned = p;
      }
    }
    async forceFetch(k, fetchOptions = {}) {
      const v = await this.fetch(k, fetchOptions);
      if (v === void 0)
        throw new Error("fetch() returned undefined");
      return v;
    }
    memo(k, memoOptions = {}) {
      const memoMethod = this.#memoMethod;
      if (!memoMethod) {
        throw new Error("no memoMethod provided to constructor");
      }
      const { context, forceRefresh, ...options } = memoOptions;
      const v = this.get(k, options);
      if (!forceRefresh && v !== void 0)
        return v;
      const vv = memoMethod(k, v, {
        options,
        context
      });
      this.set(k, vv, options);
      return vv;
    }
    /**
     * Return a value from the cache. Will update the recency of the cache
     * entry found.
     *
     * If the key is not found, get() will return `undefined`.
     */
    get(k, getOptions = {}) {
      const { allowStale = this.allowStale, updateAgeOnGet = this.updateAgeOnGet, noDeleteOnStaleGet = this.noDeleteOnStaleGet, status } = getOptions;
      const index = this.#keyMap.get(k);
      if (index !== void 0) {
        const value = this.#valList[index];
        const fetching = this.#isBackgroundFetch(value);
        if (status)
          this.#statusTTL(status, index);
        if (this.#isStale(index)) {
          if (status)
            status.get = "stale";
          if (!fetching) {
            if (!noDeleteOnStaleGet) {
              this.#delete(k, "expire");
            }
            if (status && allowStale)
              status.returnedStale = true;
            return allowStale ? value : void 0;
          } else {
            if (status && allowStale && value.__staleWhileFetching !== void 0) {
              status.returnedStale = true;
            }
            return allowStale ? value.__staleWhileFetching : void 0;
          }
        } else {
          if (status)
            status.get = "hit";
          if (fetching) {
            return value.__staleWhileFetching;
          }
          this.#moveToTail(index);
          if (updateAgeOnGet) {
            this.#updateItemAge(index);
          }
          return value;
        }
      } else if (status) {
        status.get = "miss";
      }
    }
    #connect(p, n) {
      this.#prev[n] = p;
      this.#next[p] = n;
    }
    #moveToTail(index) {
      if (index !== this.#tail) {
        if (index === this.#head) {
          this.#head = this.#next[index];
        } else {
          this.#connect(this.#prev[index], this.#next[index]);
        }
        this.#connect(this.#tail, index);
        this.#tail = index;
      }
    }
    /**
     * Deletes a key out of the cache.
     *
     * Returns true if the key was deleted, false otherwise.
     */
    delete(k) {
      return this.#delete(k, "delete");
    }
    #delete(k, reason) {
      let deleted = false;
      if (this.#size !== 0) {
        const index = this.#keyMap.get(k);
        if (index !== void 0) {
          deleted = true;
          if (this.#size === 1) {
            this.#clear(reason);
          } else {
            this.#removeItemSize(index);
            const v = this.#valList[index];
            if (this.#isBackgroundFetch(v)) {
              v.__abortController.abort(new Error("deleted"));
            } else if (this.#hasDispose || this.#hasDisposeAfter) {
              if (this.#hasDispose) {
                this.#dispose?.(v, k, reason);
              }
              if (this.#hasDisposeAfter) {
                this.#disposed?.push([v, k, reason]);
              }
            }
            this.#keyMap.delete(k);
            this.#keyList[index] = void 0;
            this.#valList[index] = void 0;
            if (index === this.#tail) {
              this.#tail = this.#prev[index];
            } else if (index === this.#head) {
              this.#head = this.#next[index];
            } else {
              const pi = this.#prev[index];
              this.#next[pi] = this.#next[index];
              const ni = this.#next[index];
              this.#prev[ni] = this.#prev[index];
            }
            this.#size--;
            this.#free.push(index);
          }
        }
      }
      if (this.#hasDisposeAfter && this.#disposed?.length) {
        const dt = this.#disposed;
        let task;
        while (task = dt?.shift()) {
          this.#disposeAfter?.(...task);
        }
      }
      return deleted;
    }
    /**
     * Clear the cache entirely, throwing away all values.
     */
    clear() {
      return this.#clear("delete");
    }
    #clear(reason) {
      for (const index of this.#rindexes({ allowStale: true })) {
        const v = this.#valList[index];
        if (this.#isBackgroundFetch(v)) {
          v.__abortController.abort(new Error("deleted"));
        } else {
          const k = this.#keyList[index];
          if (this.#hasDispose) {
            this.#dispose?.(v, k, reason);
          }
          if (this.#hasDisposeAfter) {
            this.#disposed?.push([v, k, reason]);
          }
        }
      }
      this.#keyMap.clear();
      this.#valList.fill(void 0);
      this.#keyList.fill(void 0);
      if (this.#ttls && this.#starts) {
        this.#ttls.fill(0);
        this.#starts.fill(0);
      }
      if (this.#sizes) {
        this.#sizes.fill(0);
      }
      this.#head = 0;
      this.#tail = 0;
      this.#free.length = 0;
      this.#calculatedSize = 0;
      this.#size = 0;
      if (this.#hasDisposeAfter && this.#disposed) {
        const dt = this.#disposed;
        let task;
        while (task = dt?.shift()) {
          this.#disposeAfter?.(...task);
        }
      }
    }
  }
  const isWorker = typeof importScripts !== "undefined";
  const SupportOffscreenCanvas = typeof OffscreenCanvas !== "undefined";
  const ModelCode = {
    gaussian: 1,
    exponential: 2,
    spherical: 3
  };
  const OutputType = {
    "packed-imagebitmap": 1,
    "value-buffer": 2,
    "imagebitmap": 3
  };
  const MAX_STOPS = 256;
  class VariogramObject {
    _model;
    _n;
    //variogram.n
    _params;
    //variogram.nugget, variogram.range, variogram.sill, variogram.A
    _texture;
    _textureSize;
    dispose;
  }
  class ColorMappingObject {
    _texture;
    _textureSize;
    _stopCount;
    dispose;
  }
  const colorToRGBA = /* @__PURE__ */ (() => {
    let init = false;
    let canvas;
    let ctx2;
    const map = {};
    return (colorStr) => {
      if (!init) {
        canvas = isWorker ? new OffscreenCanvas(1, 1) : document.createElement("canvas");
        canvas.width = canvas.height = 1;
        ctx2 = canvas.getContext("2d", { willReadFrequently: true });
        init = true;
      }
      if (!map[colorStr]) {
        ctx2.fillStyle = colorStr;
        ctx2.fillRect(0, 0, 1, 1);
        const [r, g, b, a] = ctx2.getImageData(0, 0, 1, 1).data;
        map[colorStr] = [r, g, b, a];
      }
      return map[colorStr];
    };
  })();
  function withResolvers() {
    let resolve;
    let reject;
    const promise = new Promise((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  }
  function getTextureUnpackAlign(rowBytes) {
    return !(rowBytes & 7) ? 8 : !(rowBytes & 3) ? 4 : !(rowBytes & 1) ? 2 : 1;
  }
  function calcDataTexSize(pixelCount) {
    if (!pixelCount) throw new Error("长度不存在!");
    const length = ceilPowerOfTwo(Math.ceil(pixelCount));
    const l = Math.log2(length);
    const cols = Math.ceil(l / 2);
    const rows = l - cols;
    return [2 ** cols, 2 ** rows];
  }
  function ceilPowerOfTwo(val) {
    if (val & val - 1) {
      val |= val >> 1;
      val |= val >> 2;
      val |= val >> 4;
      val |= val >> 8;
      val |= val >> 16;
      return val + 1;
    } else {
      return val === 0 ? 1 : val;
    }
  }
  function assert(condition, msg) {
    if (!condition) throw new Error(msg);
  }
  const glsl_pack = `
vec4 packNormalizeFloatToRGBA( in float v ) {
    vec4 enc = vec4(v, fract(vec3(255.0, 65025.0, 16581375.0) * v));
    enc.xyz -= enc.yzw / 255.0; 
    return enc;
}
float unpackRGBAToNormalizeFloat( const in vec4 v ) {
    return dot(v, vec4(1, 1.0 / 255.0, 1.0 / 65025.0, 1.0 / 16581375.0));
}
vec3 packNormalizeFloatToRGB( in float v ) {
	return packNormalizeFloatToRGBA( v ).xyz;
}
float unpackRGBToNormalizeFloat( const in vec3 v ) {
	return unpackRGBAToNormalizeFloat( vec4( v, 0 ) );
}
`;
  const glsl_kriging = `
#define MODEL_GAUSSIAN ${ModelCode.gaussian.toFixed(1)}
#define MODEL_EXPONENTIAL ${ModelCode.exponential.toFixed(1)}
#define MODEL_SPHERICAL ${ModelCode.spherical.toFixed(1)}

struct Variogram {
    float nugget;
    float range;
    float sill;
    float A;
};

float variogram_gaussian(float h, const Variogram p){
    float i = -(1.0 / p.A) * pow(h / p.range, 2.0);
    return p.nugget + ((p.sill - p.nugget) / p.range) * (1.0 - exp(i));
}
float variogram_exponential(float h, const Variogram p){
    float i = -(1.0 / p.A) * (h / p.range);
    return p.nugget + ((p.sill - p.nugget) / p.range) * (1.0 - exp(i));
}
float variogram_spherical(float h, const Variogram p){
    if (h > p.range) return p.nugget + (p.sill - p.nugget) / p.range;
    return p.nugget + ((p.sill - p.nugget) / p.range) * (1.5 * (h / p.range) - 0.5 * pow(h / p.range, 3.0));
}
float modelValue(float model, float h, const Variogram p){
    return model == MODEL_GAUSSIAN
            ? variogram_gaussian(h, p) 
            : model == MODEL_EXPONENTIAL 
                ? variogram_exponential(h, p) 
                : variogram_spherical(h, p);
}`;
  const glsl_colorMapping = `
struct Node {
    float min;
    float max;
    vec4 color;
};
Node decode_classbreak(vec4 data){
    float pack_rg = data.b;
    float pack_ba = data.a;

    vec4 color = vec4(
        floor(pack_rg),
        clamp(fract(pack_rg) * 1000.0, 0.0, 255.0),
        floor(pack_ba),
        clamp(fract(pack_ba) * 1000.0, 0.0, 255.0)
    ) / 255.0;
    return Node(data.r, data.g, color);
}

vec4 mappingColor(
    sampler2D map, 
    int stopCount,
    float value 
){
    int left = 0;
    int right = stopCount - 1;

    vec4 headColor = vec4(0);
    vec4 tailColor = vec4(0);

    for(int i = 0; i < ${Math.log2(MAX_STOPS)}; i++){
        if(left > right) break;
        int middle = (left + right) / 2;
        float x = (float(middle) + 0.5) / ${MAX_STOPS.toFixed(1)};
        vec4 encodeData = texture2D(map, vec2(x, 0.5));
        Node node = decode_classbreak(encodeData);
        if(middle == 0) headColor = node.color;
        if(middle == ${MAX_STOPS} - 1) tailColor = node.color;
        if(node.min > value){
            right = middle - 1;
        }else if(node.max <= value){
            left = middle + 1;
        }else{
            return node.color;
        }
    }
    if(right < 0) return headColor;
    if(left >= stopCount) return tailColor;
}
`;
  const glsl_fs_main = `
    #define PACKED_IMAGEBITMAP ${OutputType["packed-imagebitmap"].toFixed(1)}
    #define VALUE_BUFFER ${OutputType["value-buffer"].toFixed(1)}
    #define IMAGEBITMA ${OutputType["imagebitmap"].toFixed(1)}

    #ifdef webgl2
        layout(std140) uniform DefaultUBO {
            vec3 u_gridInfo;
            float u_dimension;

            vec2 u_variogramMxySize;
            vec2 u_packValueRange; 

            vec4 u_variogramParam;

            float u_model;
            float u_classbreakCount;
            float u_outputFormat;
        };
    #else
        uniform vec3 u_gridInfo; // xmin, ymin, cellSize 
        uniform float u_dimension;

        uniform vec2 u_variogramMxySize;
        uniform vec2 u_packValueRange; 

        uniform vec4 u_variogramParam; //nugget, range, sill, A

        uniform float u_model;
        uniform float u_classbreakCount;
        uniform float u_outputFormat;
    #endif


    uniform sampler2D u_variogramMxyTexture; 
    uniform sampler2D u_colormappingTexture; 
    ${glsl_pack}
    ${glsl_kriging}
    ${glsl_colorMapping}
    vec3 lookup(float index){
        float col = mod(index, u_variogramMxySize.x);
        float row = floor(index / u_variogramMxySize.x);
        vec2 pixel = 1.0 / u_variogramMxySize;
        vec2 uv = vec2(col, row) * pixel + pixel * 0.5;
        return texture2D(u_variogramMxyTexture, uv).xyz;
    }
        
    float hypot(float a, float b){
        return pow(pow(a,2.0) + pow(b,2.0), 0.5);
    }

    void main(){
        Variogram variogram = Variogram(
            u_variogramParam.x,
            u_variogramParam.y,
            u_variogramParam.z,
            u_variogramParam.w
        );
        vec2 inputCoord = gl_FragCoord.xy * u_gridInfo.z + u_gridInfo.xy;
        int max_i = int(u_dimension);
        float sum = 0.0;
        for(int i = 0; i < 1024; i++){
            if(i == max_i) break;
            vec3 mxy = lookup(float(i));
            sum += modelValue(
                u_model, 
                hypot(inputCoord.x - mxy[1], inputCoord.y - mxy[2]),
                variogram
            ) * mxy[0];
        }
                
        if(u_outputFormat == PACKED_IMAGEBITMAP){
            float normalizedSum = (sum - u_packValueRange.x) / (u_packValueRange.y - u_packValueRange.x);
            gl_FragColor.rgb = packNormalizeFloatToRGB(normalizedSum);
            gl_FragColor.a = 1.0;

        }else if(u_outputFormat == VALUE_BUFFER){
            gl_FragColor = vec4(sum, 0, 0, 1);
        }else{
            gl_FragColor = mappingColor(u_colormappingTexture, int(u_classbreakCount), sum);
        }
    }
`;
  function initGlCtx() {
    let canvas;
    if (isWorker) {
      assert(SupportOffscreenCanvas, "OffscreenCanvas unsupport");
      canvas = new OffscreenCanvas(1, 1);
    } else {
      canvas = SupportOffscreenCanvas ? new OffscreenCanvas(1, 1) : document.createElement("canvas");
    }
    const opts = {
      alpha: false,
      depth: false,
      stencil: false
    };
    const gl = canvas.getContext("webgl2", opts) || canvas.getContext("webgl", opts);
    assert(!!gl, "webgl unsupport");
    const isWEBGL2 = typeof WebGL2RenderingContext !== "undefined" && gl instanceof WebGL2RenderingContext;
    const extensions = {};
    const getExtension = (name) => {
      return extensions[name] ??= gl.getExtension(name) ?? false;
    };
    return {
      canvas,
      gl,
      isWEBGL2,
      getExtension
    };
  }
  let glCtx;
  function getGLCtx() {
    return glCtx ??= initGlCtx();
  }
  function createShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    const success = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
    if (success) return shader;
    const errinfo = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(errinfo);
  }
  function createProgram(gl, [vertexShaderSource, fragmentShaderSource]) {
    const program = gl.createProgram();
    const vShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
    const fShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
    gl.attachShader(program, vShader);
    gl.attachShader(program, fShader);
    gl.linkProgram(program);
    const success = gl.getProgramParameter(program, gl.LINK_STATUS);
    gl.deleteShader(vShader);
    gl.deleteShader(fShader);
    if (success) return program;
    const errInfo = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error(errInfo);
  }
  function createColorMappingObject(stops) {
    const { gl, getExtension, isWEBGL2 } = getGLCtx();
    assert(stops?.length && stops.length <= 256, "stops length must in [1, 256]");
    for (let i = 0; i < stops.length; i++) {
      const { min, max, color } = stops[i];
      assert(min < max, "stop not satisify: min < max");
      assert(!!color, "stop color not exist");
      if (i === 0) continue;
      const before = stops[i - 1];
      assert(before.max === min, "stop not satisify item[i].max == item[i+1].min");
    }
    const data = new Float32Array(MAX_STOPS * 4);
    for (let i = 0; i < stops.length; i++) {
      const { min, max, color } = stops[i];
      const [r, g, b, a] = colorToRGBA(color);
      const cursor = i * 4;
      data[cursor] = min;
      data[cursor + 1] = max;
      data[cursor + 2] = r + g / 1e3;
      data[cursor + 3] = b + a / 1e3;
    }
    if (!isWEBGL2) {
      assert(getExtension("OES_texture_float"), "webgl float texture unsupport");
    }
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 8);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      isWEBGL2 ? gl.RGBA32F : gl.RGBA,
      MAX_STOPS,
      1,
      0,
      gl.RGBA,
      gl.FLOAT,
      data
    );
    gl.bindTexture(gl.TEXTURE_2D, null);
    const obj = new ColorMappingObject();
    obj._texture = texture;
    obj._textureSize = [MAX_STOPS, 1];
    obj._stopCount = stops.length;
    obj.dispose = () => gl.deleteTexture(texture);
    return obj;
  }
  function createVariogramObject(variogram) {
    const { gl, getExtension: supportExtension, isWEBGL2 } = getGLCtx();
    assert(variogram.n <= 1024, "Supports up to 1024 points");
    const [width, height] = calcDataTexSize(variogram.n);
    const { M, x, y } = variogram;
    const array = new Float32Array(width * height * 4);
    for (let i = 0; i < variogram.n; i++) {
      const cursor = i * 4;
      array[cursor] = M[i];
      array[cursor + 1] = x[i];
      array[cursor + 2] = y[i];
    }
    if (!isWEBGL2) {
      assert(supportExtension("OES_texture_float"), "webgl float texture unsupport");
    }
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, getTextureUnpackAlign(width));
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      isWEBGL2 ? gl.RGBA32F : gl.RGBA,
      width,
      height,
      0,
      gl.RGBA,
      gl.FLOAT,
      array
    );
    gl.bindTexture(gl.TEXTURE_2D, null);
    const obj = new VariogramObject();
    obj._model = variogram.model;
    obj._n = variogram.n;
    obj._params = [variogram.nugget, variogram.range, variogram.sill, variogram.A];
    obj._texture = texture;
    obj._textureSize = [width, height];
    obj.dispose = () => gl.deleteTexture(texture);
    return obj;
  }
  let ctx;
  function getGenerateCtx() {
    return ctx ??= initGenerateCtx();
  }
  function initGenerateCtx() {
    const { gl, isWEBGL2, getExtension } = getGLCtx();
    const prefixVs = isWEBGL2 ? `#version 300 es
           #define attribute in
           #define varying out
           #define webgl2
        ` : "";
    const prefixFs = isWEBGL2 ? `#version 300 es
           #define varying in
           #define webgl2
           #define texture2D texture
           #define gl_FragColor out_color
        
           precision highp float;
           precision highp sampler2D;
           
           out vec4 out_color;
        ` : `
            #ifdef GL_FRAGMENT_PRECISION_HIGH
                precision highp float;
                precision highp sampler2D;
            #else
                precision mediump float;
                precision mediump sampler2D;
            #endif
        `;
    const vs = prefixVs + `
        attribute vec2 position;
        void main(){  
            gl_Position = vec4(position * 2.0 - 1.0, 0, 1); 
        }
    `;
    const fs = prefixFs + glsl_fs_main;
    const program = createProgram(gl, [vs, fs]);
    gl.useProgram(program);
    const location = gl.getAttribLocation(program, "position");
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(location);
    gl.vertexAttribPointer(location, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    const rtCache = new LRUCache({
      max: 10,
      dispose: ({ fbo, attachment }) => {
        gl.deleteFramebuffer(fbo);
        gl.deleteTexture(attachment);
      }
    });
    return {
      setUniforms: initUniformAndTextureSetter(program),
      createBufferRT
    };
    function createBufferRT(width, height) {
      const key = `${width}-${height}`;
      if (rtCache.has(key)) return rtCache.get(key);
      const texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      if (!isWEBGL2) {
        assert(getExtension("OES_texture_float"), "webgl float texture unsupport");
      } else {
        assert(getExtension("EXT_color_buffer_float"), "webgl2 EXT_color_buffer_float unsupport");
      }
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        isWEBGL2 ? gl.R32F : gl.RGBA,
        width,
        height,
        0,
        isWEBGL2 ? gl.RED : gl.RGBA,
        gl.FLOAT,
        null
      );
      const fbo = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
      gl.bindTexture(gl.TEXTURE_2D, null);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      const obj = {
        fbo,
        attachment: texture
      };
      rtCache.set(key, obj);
      return obj;
    }
  }
  function initUniformAndTextureSetter(program) {
    const { gl, isWEBGL2 } = getGLCtx();
    const location_mxyTexture = gl.getUniformLocation(program, "u_variogramMxyTexture");
    const location_colormappingTexture = gl.getUniformLocation(program, "u_colormappingTexture");
    gl.uniform1i(location_mxyTexture, 0);
    gl.uniform1i(location_colormappingTexture, 1);
    if (isWEBGL2) {
      const uboBuffer = gl.createBuffer();
      gl.bindBuffer(gl.UNIFORM_BUFFER, uboBuffer);
      gl.bufferData(gl.UNIFORM_BUFFER, 4 * 4 * Float32Array.BYTES_PER_ELEMENT, gl.DYNAMIC_DRAW);
      const blockIndex = gl.getUniformBlockIndex(program, "DefaultUBO");
      gl.uniformBlockBinding(program, blockIndex, 0);
      gl.bindBufferBase(gl.UNIFORM_BUFFER, 0, uboBuffer);
      return ({ outputFormat, variogram, packValueRange, llCorner, cellSize, colorMapping }) => {
        gl.bindBuffer(gl.UNIFORM_BUFFER, uboBuffer);
        gl.bufferSubData(gl.UNIFORM_BUFFER, 0, new Float32Array([
          //ROW
          llCorner[0],
          llCorner[1],
          cellSize,
          variogram._n,
          //ROW
          variogram._textureSize[0],
          variogram._textureSize[1],
          outputFormat === "packed-imagebitmap" ? packValueRange[0] : NaN,
          outputFormat === "packed-imagebitmap" ? packValueRange[1] : NaN,
          //ROW
          variogram._params[0],
          variogram._params[1],
          variogram._params[2],
          variogram._params[3],
          //ROW
          ModelCode[variogram._model],
          outputFormat === "imagebitmap" ? colorMapping._stopCount : NaN,
          OutputType[outputFormat],
          NaN
        ]));
        gl.bindBuffer(gl.UNIFORM_BUFFER, null);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, variogram._texture);
        if (outputFormat === "imagebitmap") {
          gl.activeTexture(gl.TEXTURE0 + 1);
          gl.bindTexture(gl.TEXTURE_2D, colorMapping._texture);
        }
      };
    } else {
      const keys = [
        "outputFormat",
        "gridInfo",
        "dimension",
        "variogramMxySize",
        "packValueRange",
        "variogramParam",
        "model",
        "classbreakCount"
      ];
      const uniformLocations = keys.reduce((map, key) => {
        map[key] = gl.getUniformLocation(program, "u_" + key);
        return map;
      }, {});
      return ({ outputFormat, variogram, packValueRange, llCorner, cellSize, colorMapping }) => {
        gl.uniform3fv(uniformLocations.gridInfo, [llCorner[0], llCorner[1], cellSize]);
        gl.uniform1f(uniformLocations.dimension, variogram._n);
        gl.uniform2fv(uniformLocations.variogramMxySize, variogram._textureSize);
        if (outputFormat === "packed-imagebitmap") {
          gl.uniform2fv(uniformLocations.packValueRange, packValueRange);
        }
        gl.uniform4fv(uniformLocations.variogramParam, variogram._params);
        gl.uniform1f(uniformLocations.model, ModelCode[variogram._model]);
        if (outputFormat === "imagebitmap") {
          gl.uniform1f(uniformLocations.classbreakCount, colorMapping._stopCount);
          gl.activeTexture(gl.TEXTURE0 + 1);
          gl.bindTexture(gl.TEXTURE_2D, colorMapping._texture);
        }
        gl.uniform1f(uniformLocations.outputFormat, OutputType[outputFormat]);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, variogram._texture);
      };
    }
  }
  function wrapQueue(fn) {
    const queue = [];
    let curTask;
    return (...args) => {
      const { promise, resolve, reject } = withResolvers();
      const task = { resolve, reject, args };
      queue.unshift(task);
      Promise.resolve().then(excute);
      promise.cancel = () => {
        reject();
        if (task !== curTask) {
          const index = queue.findIndex((i) => i === task);
          queue.splice(index, 1);
        }
      };
      return promise;
    };
    function excute() {
      if (curTask) return;
      if (!queue.length) return;
      curTask = queue.pop();
      fn.apply(null, curTask.args).then((result) => curTask.resolve(result)).catch((e) => curTask.reject(e)).finally(() => {
        curTask = null;
        excute();
      });
    }
  }
  function generate(opts) {
    const { gl, canvas, isWEBGL2 } = getGLCtx();
    const { createBufferRT, setUniforms } = getGenerateCtx();
    const { llCorner, gridSize, cellSize, packValueRange, outputFormat } = opts;
    assert(gridSize[0] > 0 && gridSize[1] > 0, "gridsize can not be 0");
    const variogram = opts.variogram instanceof VariogramObject ? opts.variogram : createVariogramObject(opts.variogram);
    const colorMapping = outputFormat === "imagebitmap" ? opts.colorMapping instanceof ColorMappingObject ? opts.colorMapping : createColorMappingObject(opts.colorMapping) : null;
    canvas.width = gridSize[0];
    canvas.height = gridSize[1];
    let rt;
    if (outputFormat === "value-buffer") {
      rt = createBufferRT(canvas.width, canvas.height);
      gl.bindFramebuffer(gl.FRAMEBUFFER, rt.fbo);
    } else {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    setUniforms({
      outputFormat,
      variogram,
      packValueRange,
      llCorner,
      cellSize,
      colorMapping
    });
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    if (outputFormat !== "value-buffer") {
      doClear();
      if (SupportOffscreenCanvas) {
        return Promise.resolve(canvas.transferToImageBitmap());
      } else {
        return createImageBitmap(canvas, {
          imageOrientation: "none"
        });
      }
    } else {
      let result;
      if (isWEBGL2) {
        result = new Float32Array(canvas.width * canvas.height);
        gl.readPixels(0, 0, canvas.width, canvas.height, gl.RED, gl.FLOAT, result);
      } else {
        result = new Float32Array(canvas.width * canvas.height);
        const arr = new Float32Array(canvas.width * canvas.height * 4);
        gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.FLOAT, arr);
        for (let i = 0; i < arr.length; i += 4) {
          result[i / 4] = arr[i];
        }
      }
      doClear();
      return Promise.resolve(result);
    }
    function doClear() {
      if (!(opts.variogram instanceof VariogramObject)) {
        variogram.dispose();
      }
      if (outputFormat === "imagebitmap" && !(opts.colorMapping instanceof ColorMappingObject)) {
        colorMapping.dispose();
      }
    }
  }
  const generate_WEBGL = wrapQueue(generate);
  self.onmessage = async (e) => {
    await getGLCtx();
    await getGenerateCtx();
    const result = await gernerateMulti(e.data.data);
    self.postMessage({
      id: e.data.id,
      result,
      success: true
    }, [
      result.imagebitmap,
      result.packedImagebitmap,
      result.rawBuffer.buffer,
      result.valueBuffer.buffer
    ]);
  };
  let colorMapping_object;
  async function gernerateMulti({ data, xs, ys, llCorner, cellSize, gridSize, colorMapping, packValueRange }) {
    colorMapping_object ??= createColorMappingObject(colorMapping);
    let start = performance.now();
    const variogram = train(
      data,
      xs,
      ys,
      "exponential",
      0,
      10
    );
    const trainTime = performance.now() - start;
    console.log(trainTime);
    const variogram_object = createVariogramObject(variogram);
    start = performance.now();
    const rawBuffer = generate_normal(variogram, {
      llCorner,
      gridSize,
      cellSize
    });
    const time_rawBuffer = performance.now() - start;
    start = performance.now();
    const imagebitmap = await generate_WEBGL({
      variogram: variogram_object,
      llCorner,
      cellSize,
      gridSize,
      colorMapping: colorMapping_object,
      outputFormat: "imagebitmap"
    });
    const time_imagebitmap = performance.now() - start;
    start = performance.now();
    const packedImagebitmap = await generate_WEBGL({
      variogram: variogram_object,
      llCorner,
      cellSize,
      gridSize,
      packValueRange,
      outputFormat: "packed-imagebitmap"
    });
    const time_packedImagebitmap = performance.now() - start;
    start = performance.now();
    const valueBuffer = await generate_WEBGL({
      variogram: variogram_object,
      llCorner,
      cellSize,
      gridSize,
      outputFormat: "value-buffer"
    });
    const time_valuebuffer = performance.now() - start;
    variogram_object.dispose();
    return {
      rawBuffer,
      imagebitmap,
      packedImagebitmap,
      valueBuffer,
      time_imagebitmap,
      time_packedImagebitmap,
      time_valuebuffer,
      time_rawBuffer
    };
  }
  function generate_normal(variogram, opts) {
    const { cellSize, llCorner, gridSize } = opts;
    const [cols, rows] = gridSize;
    const [xmin, ymin] = llCorner;
    const halfSize = cellSize / 2;
    const result = new Float32Array(cols * rows);
    const [ox, oy] = [xmin + halfSize, ymin + halfSize];
    for (let i = 0; i < rows; i++) {
      const cursor = (rows - 1 - i) * cols;
      const y = oy + i * cellSize;
      for (let j = 0; j < cols; j++) {
        result[cursor + j] = predict(ox + j * cellSize, y, variogram);
      }
    }
    return result;
  }
})();
//# sourceMappingURL=worker-DmafqJZZ.js.map
