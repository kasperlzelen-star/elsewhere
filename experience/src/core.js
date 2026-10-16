/* A Way Through: fictional data and graph operations.
 * No network, storage, DOM, identity verification or automatic publication.
 * SHA-256 fingerprints match canonical content; they are not digital signatures
 * and do not prove authorship, consent, safety or a person's authority.
 */
(function (root, factory) {
  "use strict";
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.WayCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var NODES = [
    { id: "clearing", title: "Clearing", x: 18, y: 26 },
    { id: "pool", title: "Pool", x: 46, y: 16 },
    { id: "garden", title: "Garden", x: 72, y: 32 },
    { id: "shelter", title: "Shelter", x: 39, y: 67 },
    { id: "grove", title: "Grove", x: 82, y: 76 }
  ];
  var IDS = NODES.map(function (n) { return n.id; }).sort();
  var KINDS = ["question", "play", "care", "note", "arrangement"];
  var ORIGINS = ["human", "assisted", "software", "imagined"];
  var DECISIONS = ["accepted", "held", "declined"];
  var LIMITS = {
    text: 1000, backtick: 400, attribution: 60, processNote: 240,
    reason: 400, steward: 60, history: 24, selectedMaterial: 24,
    edges: 10, offerBytes: 16384, editionBytes: 131072,
    sessionBytes: 163840, dataDepth: 16, dataValues: 12000
  };
  var OFFER_KEYS = ["schemaVersion", "offerId", "baseEditionId", "baseFingerprint",
    "kind", "text", "attribution", "origin", "processNote", "backtick",
    "displayConsent", "adaptConsent", "includeArrangement", "edges"];
  var ENTRY_KEYS = ["offer", "decision", "reason", "steward", "appliedArrangement", "recordedAt"];
  var EDITION_KEYS = ["schemaVersion", "id", "version", "parentFingerprint",
    "nodes", "edges", "selectedMaterial", "history"];
  var banned = ["__proto__", "prototype", "constructor"];
  var own = function (o, k) { return Object.prototype.hasOwnProperty.call(o, k); };
  var clone = function (o) { return JSON.parse(JSON.stringify(o)); };
  var idForVersion = function (v) { return "awt-" + String(v).padStart(3, "0"); };
  var isEditionId = function (v) {
    if (typeof v !== "string" || !/^awt-[0-9]{3}$/.test(v)) return false;
    var version = Number(v.slice(4));
    return version >= 1 && version <= LIMITS.history + 1 && v === idForVersion(version);
  };
  var isFingerprint = function (v) { return typeof v === "string" && /^sha256:[a-f0-9]{64}$/.test(v); };

  function ValidationError(errors) {
    this.name = "ValidationError";
    this.errors = errors.slice();
    this.message = errors.join("; ");
    if (Error.captureStackTrace) Error.captureStackTrace(this, ValidationError);
  }
  ValidationError.prototype = Object.create(Error.prototype);
  ValidationError.prototype.constructor = ValidationError;

  function deepFreeze(o) {
    Object.keys(o).forEach(function (k) {
      if (o[k] && typeof o[k] === "object") deepFreeze(o[k]);
    });
    return Object.freeze(o);
  }

  // Reject executable/accessor properties, exotic objects, cycles, sparse arrays
  // and pollution keys before inspecting fields or serialising imported data.
  function dataErrors(raw, maxBytes) {
    var errors = [], seen = new Set(), count = 0;
    function walk(v, path, depth) {
      if (++count > LIMITS.dataValues) throw new Error("too many data values");
      if (depth > LIMITS.dataDepth) throw new Error("data is nested too deeply");
      if (v === null || typeof v === "boolean" || typeof v === "string") return;
      if (typeof v === "number" && Number.isFinite(v)) return;
      if (typeof v !== "object") throw new Error(path + " must contain JSON data only");
      if (seen.has(v)) throw new Error(path + " contains a cycle");
      seen.add(v);
      var array = Array.isArray(v), proto = Object.getPrototypeOf(v);
      if (array ? proto !== Array.prototype : proto !== Object.prototype && proto !== null)
        throw new Error(path + " must be a plain data object or array");
      var names = Reflect.ownKeys(v);
      if (array && (v.length > LIMITS.dataValues || names.length !== v.length + 1))
        throw new Error(path + " must be a dense array without extra properties");
      names.forEach(function (key) {
        if (typeof key !== "string") throw new Error(path + " has a symbol key");
        if (array && key === "length") return;
        if (banned.indexOf(key) !== -1) throw new Error(path + " has a forbidden key");
        if (array && !/^(0|[1-9][0-9]*)$/.test(key)) throw new Error(path + " has an invalid array key");
        var d = Object.getOwnPropertyDescriptor(v, key);
        if (!d || !own(d, "value") || !d.enumerable)
          throw new Error(path + "." + key + " must be an ordinary data property");
        walk(d.value, path + "." + key, depth + 1);
      });
      seen.delete(v);
    }
    try {
      walk(raw, "data", 0);
      if (utf8(JSON.stringify(raw)).length > maxBytes) errors.push("data exceeds " + maxBytes + " bytes");
    } catch (e) { errors.push(e.message || "invalid data"); }
    return errors;
  }

  function objectFields(o, allowed, required, path, errors) {
    if (!o || typeof o !== "object" || Array.isArray(o)) {
      errors.push(path + " must be an object"); return false;
    }
    Object.keys(o).forEach(function (k) {
      if (allowed.indexOf(k) === -1) errors.push(path + "." + k + " is not allowed");
    });
    required.forEach(function (k) { if (!own(o, k)) errors.push(path + "." + k + " is required"); });
    return true;
  }
  function stringField(v, max, path, errors, required) {
    if (typeof v !== "string") { errors.push(path + " must be a string"); return; }
    if (v.length > max) errors.push(path + " exceeds " + max + " characters");
    if (required && !v.trim()) errors.push(path + " must not be empty");
  }
  function enumField(v, options, path, errors) {
    if (options.indexOf(v) === -1) errors.push(path + " must be one of " + options.join(", "));
  }
  function boolField(v, path, errors) {
    if (typeof v !== "boolean") errors.push(path + " must be a boolean");
  }
  function edgeCheck(edges, path, errors) {
    if (!Array.isArray(edges)) { errors.push(path + " must be an array"); return; }
    if (edges.length > LIMITS.edges) errors.push(path + " exceeds 10 paths");
    var seen = new Set();
    edges.forEach(function (edge, i) {
      var p = path + "[" + i + "]";
      if (!Array.isArray(edge) || edge.length !== 2) { errors.push(p + " must have two node ids"); return; }
      if (IDS.indexOf(edge[0]) === -1 || IDS.indexOf(edge[1]) === -1) {
        errors.push(p + " has an unknown node id"); return;
      }
      if (edge[0] === edge[1]) { errors.push(p + " must join different nodes"); return; }
      var key = edge.slice().sort().join("|");
      if (seen.has(key)) errors.push(p + " duplicates a path");
      seen.add(key);
    });
  }
  function orderedEdges(edges) {
    return edges.map(function (e) { return e.slice().sort(); }).sort(function (a, b) {
      var ak = a.join("|"), bk = b.join("|");
      return ak < bk ? -1 : ak > bk ? 1 : 0;
    });
  }
  function canonicalEdges(edges) {
    var errors = dataErrors(edges, LIMITS.offerBytes);
    if (!errors.length) edgeCheck(edges, "edges", errors);
    if (errors.length) throw new ValidationError(errors);
    return orderedEdges(edges);
  }
  var ALL_EDGES = [];
  IDS.forEach(function (a, i) {
    IDS.slice(i + 1).forEach(function (b) { ALL_EDGES.push([a, b]); });
  });

  function adjacency(edges) {
    var a = {};
    IDS.forEach(function (id) { a[id] = []; });
    edges.forEach(function (e) { a[e[0]].push(e[1]); a[e[1]].push(e[0]); });
    IDS.forEach(function (id) { a[id].sort(); });
    return a;
  }
  function bfs(a, start) {
    var paths = {}, distances = {}, q = [start];
    IDS.forEach(function (id) { paths[id] = null; distances[id] = null; });
    paths[start] = [start]; distances[start] = 0;
    for (var i = 0; i < q.length; i++) {
      var here = q[i];
      a[here].forEach(function (next) {
        if (paths[next] === null) {
          paths[next] = paths[here].concat([next]);
          distances[next] = distances[here] + 1;
          q.push(next);
        }
      });
    }
    return { paths: paths, distances: distances };
  }
  function componentsOf(a) {
    var left = new Set(IDS), components = [];
    IDS.forEach(function (id) {
      if (!left.has(id)) return;
      var found = bfs(a, id).paths;
      var component = IDS.filter(function (n) { return found[n] !== null; });
      component.forEach(function (n) { left.delete(n); });
      components.push(component);
    });
    return components;
  }
  function analyse(edges, startId, excludedEdge) {
    var clean = canonicalEdges(edges);
    startId = startId === undefined ? "clearing" : startId;
    if (IDS.indexOf(startId) === -1) throw new ValidationError(["startId has an unknown node id"]);
    var excluded = excludedEdge === undefined || excludedEdge === null ? null : canonicalEdges([excludedEdge])[0];
    if (excluded) clean = clean.filter(function (e) { return e.join("|") !== excluded.join("|"); });
    var a = adjacency(clean), components = componentsOf(a), routes = bfs(a, startId);
    var bridges = clean.filter(function (e) {
      var without = clean.filter(function (x) { return x !== e; });
      return componentsOf(adjacency(without)).length > components.length;
    });
    return {
      startId: startId, excludedEdge: excluded, edges: clean,
      connected: components.length === 1, components: components,
      reachable: IDS.filter(function (id) { return routes.paths[id] !== null; }),
      isolated: IDS.filter(function (id) { return a[id].length === 0; }),
      bridges: bridges, shortestPaths: routes.paths, distances: routes.distances
    };
  }
  function compareEdges(base, next) {
    var a = canonicalEdges(base), b = canonicalEdges(next);
    var ak = new Set(a.map(function (e) { return e.join("|"); }));
    var bk = new Set(b.map(function (e) { return e.join("|"); }));
    return {
      added: b.filter(function (e) { return !ak.has(e.join("|")); }),
      removed: a.filter(function (e) { return !bk.has(e.join("|")); }),
      unchanged: a.filter(function (e) { return bk.has(e.join("|")); })
    };
  }

  function offerCheck(o, path, errors) {
    var required = OFFER_KEYS.filter(function (k) { return k !== "edges"; });
    if (!objectFields(o, OFFER_KEYS, required, path, errors)) return;
    if (o.schemaVersion !== 1) errors.push(path + ".schemaVersion must be 1");
    if (typeof o.offerId !== "string" || !/^offer-[a-z0-9][a-z0-9-]{15,79}$/.test(o.offerId))
      errors.push(path + ".offerId has an invalid format");
    if (!isEditionId(o.baseEditionId)) errors.push(path + ".baseEditionId has an invalid format");
    if (!isFingerprint(o.baseFingerprint)) errors.push(path + ".baseFingerprint has an invalid format");
    enumField(o.kind, KINDS, path + ".kind", errors);
    enumField(o.origin, ORIGINS, path + ".origin", errors);
    stringField(o.text, LIMITS.text, path + ".text", errors, false);
    stringField(o.backtick, LIMITS.backtick, path + ".backtick", errors, false);
    stringField(o.attribution, LIMITS.attribution, path + ".attribution", errors, false);
    stringField(o.processNote, LIMITS.processNote, path + ".processNote", errors, o.origin !== "human");
    boolField(o.displayConsent, path + ".displayConsent", errors);
    if (o.displayConsent !== true) errors.push(path + ".displayConsent must be explicitly true");
    boolField(o.adaptConsent, path + ".adaptConsent", errors);
    boolField(o.includeArrangement, path + ".includeArrangement", errors);
    if (o.includeArrangement === true) {
      if (!own(o, "edges")) errors.push(path + ".edges is required for an arrangement");
      else edgeCheck(o.edges, path + ".edges", errors);
    } else if (own(o, "edges")) errors.push(path + ".edges must be omitted when arrangement is not selected");
    if (typeof o.text === "string" && typeof o.backtick === "string" &&
        !o.text.trim() && !o.backtick.trim() && o.includeArrangement !== true)
      errors.push(path + " must select some text, a backtick or an arrangement");
    if (o.kind === "arrangement" && o.includeArrangement !== true)
      errors.push(path + ".kind arrangement requires a selected arrangement");
  }
  function entryCheck(entry, path, errors) {
    if (!objectFields(entry, ENTRY_KEYS, ENTRY_KEYS.filter(function (k) { return k !== "recordedAt"; }), path, errors)) return;
    offerCheck(entry.offer, path + ".offer", errors);
    enumField(entry.decision, DECISIONS, path + ".decision", errors);
    stringField(entry.reason, LIMITS.reason, path + ".reason", errors, true);
    stringField(entry.steward, LIMITS.steward, path + ".steward", errors, true);
    boolField(entry.appliedArrangement, path + ".appliedArrangement", errors);
    if (entry.appliedArrangement === true &&
        (entry.decision !== "accepted" || !entry.offer || entry.offer.adaptConsent !== true || entry.offer.includeArrangement !== true))
      errors.push(path + " cannot apply an arrangement without acceptance and separate adaptation consent");
    if (own(entry, "recordedAt") && (typeof entry.recordedAt !== "string" ||
        !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(entry.recordedAt) ||
        !Number.isFinite(Date.parse(entry.recordedAt))))
      errors.push(path + ".recordedAt must be an ISO UTC date string");
  }
  function editionCheck(e, path, errors) {
    if (utf8(JSON.stringify(e)).length > LIMITS.editionBytes)
      errors.push(path + " exceeds " + LIMITS.editionBytes + " bytes");
    if (!objectFields(e, EDITION_KEYS, EDITION_KEYS, path, errors)) return;
    if (e.schemaVersion !== 1) errors.push(path + ".schemaVersion must be 1");
    if (!Number.isInteger(e.version) || e.version < 1 || e.version > LIMITS.history + 1)
      errors.push(path + ".version must be an integer from 1 to " + (LIMITS.history + 1));
    if (!isEditionId(e.id) || e.id !== idForVersion(e.version))
      errors.push(path + ".id must match its version");
    if (e.version === 1 ? e.parentFingerprint !== null : !isFingerprint(e.parentFingerprint))
      errors.push(path + ".parentFingerprint must be null for the seed, or a content fingerprint");
    if (!Array.isArray(e.nodes) || stable(e.nodes) !== stable(NODES))
      errors.push(path + ".nodes must be the five fixed fictional nodes");
    edgeCheck(e.edges, path + ".edges", errors);
    ["history", "selectedMaterial"].forEach(function (name) {
      var list = e[name];
      if (!Array.isArray(list)) { errors.push(path + "." + name + " must be an array"); return; }
      if (list.length > LIMITS[name]) errors.push(path + "." + name + " exceeds 24 entries");
      var ids = new Set();
      list.forEach(function (entry, i) {
        entryCheck(entry, path + "." + name + "[" + i + "]", errors);
        if (entry && entry.offer && typeof entry.offer.offerId === "string") {
          if (ids.has(entry.offer.offerId)) errors.push(path + "." + name + " has a duplicate offer id");
          ids.add(entry.offer.offerId);
          if (isEditionId(entry.offer.baseEditionId) && Number(entry.offer.baseEditionId.slice(4)) >= e.version)
            errors.push(path + "." + name + " has an offer from this or a later edition");
        }
        if (name === "selectedMaterial" && entry && entry.decision !== "accepted")
          errors.push(path + ".selectedMaterial may contain accepted entries only");
      });
    });
    if (Array.isArray(e.history)) {
      if (e.history.length !== e.version - 1)
        errors.push(path + ".history must retain the complete review chain for this edition");
      e.history.forEach(function (entry, i) {
        if (entry && entry.offer && entry.offer.baseEditionId !== idForVersion(e.version - e.history.length + i))
          errors.push(path + ".history is not in edition order");
      });
    }
    if (Array.isArray(e.history) && Array.isArray(e.selectedMaterial)) {
      var accepted = e.history.filter(function (entry) { return entry && entry.decision === "accepted"; });
      if (stable(e.selectedMaterial) !== stable(accepted))
        errors.push(path + ".selectedMaterial must preserve every accepted review entry in order");
    }
    // Compare only structurally valid records. These relationships do not
    // authenticate the review chain or the permissions asserted within it.
    if (!errors.length && e.history.length) {
      var latest = e.history[e.history.length - 1];
      if (e.parentFingerprint !== latest.offer.baseFingerprint)
        errors.push(path + ".parentFingerprint must match the latest history offer's baseFingerprint");
      var applied = e.history.filter(function (entry) { return entry.appliedArrangement; }).pop();
      if (applied && stable(orderedEdges(e.edges)) !== stable(orderedEdges(applied.offer.edges)))
        errors.push(path + ".edges must match the latest explicitly applied arrangement in history");
    }
  }
  function result(raw, maxBytes, check) {
    var errors = dataErrors(raw, maxBytes);
    if (!errors.length) {
      try { check(raw, errors); } catch (_) { errors.push("data has an invalid structure"); }
    }
    if (errors.length) return { ok: false, errors: errors };
    return { ok: true, errors: [], value: clone(raw) };
  }
  function must(r) {
    if (!r.ok) throw new ValidationError(r.errors);
    return r.value;
  }
  function validateOffer(raw) {
    return result(raw, LIMITS.offerBytes, function (v, errors) { offerCheck(v, "offer", errors); });
  }
  function validateEdition(raw) {
    return result(raw, LIMITS.editionBytes, function (v, errors) { editionCheck(v, "edition", errors); });
  }
  function validateSession(raw) {
    return result(raw, LIMITS.sessionBytes, function (v, errors) {
      if (!objectFields(v, ["schemaVersion", "edition", "edges"],
          ["schemaVersion", "edition", "edges"], "session", errors)) return;
      if (v.schemaVersion !== 1) errors.push("session.schemaVersion must be 1");
      editionCheck(v.edition, "session.edition", errors);
      edgeCheck(v.edges, "session.edges", errors);
    });
  }

  function createSeedEdition() {
    return {
      schemaVersion: 1, id: "awt-001", version: 1, parentFingerprint: null,
      nodes: clone(NODES),
      edges: orderedEdges([["clearing", "pool"], ["pool", "garden"],
        ["garden", "shelter"], ["shelter", "clearing"], ["shelter", "grove"]]),
      selectedMaterial: [], history: []
    };
  }
  function makeSession(edition, edges) {
    var e = must(validateEdition(edition));
    return must(validateSession({ schemaVersion: 1, edition: e,
      edges: canonicalEdges(edges === undefined ? e.edges : edges) }));
  }
  var fallbackCounter = 0;
  function newOfferId() {
    if (typeof globalThis !== "undefined" && globalThis.crypto &&
        typeof globalThis.crypto.randomUUID === "function") return "offer-" + globalThis.crypto.randomUUID();
    var random = "";
    for (var i = 0; i < 5; i++) random += Math.floor(Math.random() * 0x100000000).toString(16).padStart(8, "0");
    // Random fallback is for local record distinction, never an authentication token.
    return "offer-" + random + "-" + (++fallbackCounter).toString(16);
  }
  function makeOffer(options) {
    var errors = dataErrors(options, LIMITS.sessionBytes);
    if (!errors.length) objectFields(options,
      ["edition", "edges", "kind", "text", "attribution", "origin", "processNote",
        "backtick", "displayConsent", "adaptConsent", "includeArrangement", "offerId"],
      ["edition", "kind", "displayConsent", "adaptConsent", "origin"], "options", errors);
    if (errors.length) throw new ValidationError(errors);
    var e = must(validateEdition(options.edition));
    var o = {
      schemaVersion: 1, offerId: options.offerId === undefined ? newOfferId() : options.offerId,
      baseEditionId: e.id, baseFingerprint: fingerprint(e), kind: options.kind,
      text: options.text === undefined ? "" : options.text,
      attribution: options.attribution === undefined ? "" : options.attribution,
      origin: options.origin, processNote: options.processNote === undefined ? "" : options.processNote,
      backtick: options.backtick === undefined ? "" : options.backtick,
      displayConsent: options.displayConsent, adaptConsent: options.adaptConsent,
      includeArrangement: options.includeArrangement === undefined ? false : options.includeArrangement
    };
    if (o.includeArrangement === true) {
      if (options.edges === undefined) throw new ValidationError(["select edges explicitly before including an arrangement"]);
      o.edges = canonicalEdges(options.edges);
    }
    return must(validateOffer(o));
  }
  function reviewOffer(options) {
    var errors = dataErrors(options, LIMITS.sessionBytes + LIMITS.offerBytes);
    if (!errors.length) objectFields(options,
      ["edition", "offer", "decision", "reason", "steward", "applyArrangement", "now"],
      ["edition", "offer", "decision", "reason", "steward", "applyArrangement"], "review", errors);
    if (errors.length) throw new ValidationError(errors);
    var e = must(validateEdition(options.edition)), o = must(validateOffer(options.offer));
    if (e.version >= LIMITS.history + 1)
      throw new ValidationError(["Edition limit reached: this prototype preserves all 24 review decisions. Export the complete edition; further reviews need a future archive format."]);
    if (o.baseEditionId !== e.id || o.baseFingerprint !== fingerprint(e))
      throw new ValidationError(["offer base does not match this exact edition"]);
    if (e.history.concat(e.selectedMaterial).some(function (entry) { return entry.offer.offerId === o.offerId; }))
      throw new ValidationError(["this offer id has already been reviewed"]);
    var entry = {
      offer: o, decision: options.decision, reason: options.reason,
      steward: options.steward, appliedArrangement: options.applyArrangement
    };
    if (options.now !== undefined) entry.recordedAt = options.now;
    entryCheck(entry, "review", errors);
    if (errors.length) throw new ValidationError(errors);
    var next = {
      schemaVersion: 1, id: idForVersion(e.version + 1), version: e.version + 1,
      parentFingerprint: fingerprint(e), nodes: clone(NODES),
      edges: entry.appliedArrangement ? canonicalEdges(o.edges) : canonicalEdges(e.edges),
      selectedMaterial: e.selectedMaterial.concat(entry.decision === "accepted" ? [entry] : []),
      history: e.history.concat([entry])
    };
    return must(validateEdition(next));
  }

  function stable(value) {
    if (value === null || typeof value !== "object") return JSON.stringify(value);
    if (Array.isArray(value)) return "[" + value.map(stable).join(",") + "]";
    return "{" + Object.keys(value).sort().map(function (k) {
      return JSON.stringify(k) + ":" + stable(value[k]);
    }).join(",") + "}";
  }
  function utf8(s) {
    var bytes = [];
    for (var i = 0; i < s.length; i++) {
      var c = s.charCodeAt(i);
      if (c >= 0xd800 && c <= 0xdbff && i + 1 < s.length &&
          s.charCodeAt(i + 1) >= 0xdc00 && s.charCodeAt(i + 1) <= 0xdfff) {
        c = 0x10000 + ((c - 0xd800) << 10) + s.charCodeAt(++i) - 0xdc00;
      } else if (c >= 0xd800 && c <= 0xdfff) c = 0xfffd;
      if (c < 0x80) bytes.push(c);
      else if (c < 0x800) bytes.push(0xc0 | c >> 6, 0x80 | c & 63);
      else if (c < 0x10000) bytes.push(0xe0 | c >> 12, 0x80 | c >> 6 & 63, 0x80 | c & 63);
      else bytes.push(0xf0 | c >> 18, 0x80 | c >> 12 & 63, 0x80 | c >> 6 & 63, 0x80 | c & 63);
    }
    return bytes;
  }
  // SHA-256 over UTF-8. A deterministic content checksum, not a trust mechanism.
  function sha256(s) {
    var bytes = utf8(s), bitLength = bytes.length * 8;
    bytes.push(0x80);
    while (bytes.length % 64 !== 56) bytes.push(0);
    var high = Math.floor(bitLength / 0x100000000), low = bitLength >>> 0;
    for (var i = 3; i >= 0; i--) bytes.push(high >>> (i * 8) & 255);
    for (i = 3; i >= 0; i--) bytes.push(low >>> (i * 8) & 255);
    var h = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
      0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
    var k = [0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
      0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
      0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
      0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
      0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
      0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
      0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
      0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
    var rotate = function (v, n) { return v >>> n | v << (32 - n); };
    for (var offset = 0; offset < bytes.length; offset += 64) {
      var w = new Array(64);
      for (i = 0; i < 16; i++) w[i] = (bytes[offset+i*4]<<24 | bytes[offset+i*4+1]<<16 |
        bytes[offset+i*4+2]<<8 | bytes[offset+i*4+3]) >>> 0;
      for (i = 16; i < 64; i++) {
        var s0 = rotate(w[i-15],7) ^ rotate(w[i-15],18) ^ w[i-15] >>> 3;
        var s1 = rotate(w[i-2],17) ^ rotate(w[i-2],19) ^ w[i-2] >>> 10;
        w[i] = (w[i-16] + s0 + w[i-7] + s1) >>> 0;
      }
      var a=h[0], b=h[1], c=h[2], d=h[3], e=h[4], f=h[5], g=h[6], hh=h[7];
      for (i = 0; i < 64; i++) {
        var sum1 = rotate(e,6) ^ rotate(e,11) ^ rotate(e,25);
        var choice = e & f ^ ~e & g;
        var t1 = (hh + sum1 + choice + k[i] + w[i]) >>> 0;
        var sum0 = rotate(a,2) ^ rotate(a,13) ^ rotate(a,22);
        var majority = a & b ^ a & c ^ b & c;
        var t2 = (sum0 + majority) >>> 0;
        hh=g; g=f; f=e; e=(d+t1)>>>0; d=c; c=b; b=a; a=(t1+t2)>>>0;
      }
      [a,b,c,d,e,f,g,hh].forEach(function (v, j) { h[j] = (h[j] + v) >>> 0; });
    }
    return h.map(function (v) { return v.toString(16).padStart(8, "0"); }).join("");
  }
  function fingerprint(edition) {
    var e = must(validateEdition(edition));
    e.edges = orderedEdges(e.edges);
    // The geometry is fixed, while all selected data and history are included.
    // Canonicalise undirected edges inside stored offers as well.
    e.history.concat(e.selectedMaterial).forEach(function (entry) {
      if (entry.offer.includeArrangement) entry.offer.edges = orderedEdges(entry.offer.edges);
    });
    return "sha256:" + sha256(stable(e));
  }

  deepFreeze(NODES); deepFreeze(ALL_EDGES); deepFreeze(LIMITS);
  Object.freeze(KINDS); Object.freeze(ORIGINS); Object.freeze(DECISIONS);
  return Object.freeze({
    NODES: NODES, ALL_EDGES: ALL_EDGES, LIMITS: LIMITS,
    KINDS: KINDS, ORIGINS: ORIGINS, DECISIONS: DECISIONS,
    ValidationError: ValidationError, createSeedEdition: createSeedEdition,
    canonicalEdges: canonicalEdges, analyse: analyse, compareEdges: compareEdges,
    fingerprint: fingerprint, validateEdition: validateEdition, validateSession: validateSession,
    makeSession: makeSession, makeOffer: makeOffer, validateOffer: validateOffer, reviewOffer: reviewOffer
  });
});
