"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { createHash } = require("node:crypto");
const { readFileSync } = require("node:fs");
const vm = require("node:vm");
const Core = require("../src/core.js");

const copy = (x) => JSON.parse(JSON.stringify(x));
const seed = () => Core.createSeedEdition();
function offer(edition = seed(), overrides = {}) {
  return Core.makeOffer({
    edition, kind: "question", text: "What changes when the route is different?",
    attribution: "", origin: "human", processNote: "", backtick: "",
    displayConsent: true, adaptConsent: false, includeArrangement: false,
    ...overrides
  });
}
function review(edition, proposal, overrides = {}) {
  return Core.reviewOffer({
    edition, offer: proposal, decision: "accepted", reason: "Chosen for this imagined edition.",
    steward: "A chosen display name", applyArrangement: false, ...overrides
  });
}
// Generated diagnostics only; these fixtures are not participant or steward accounts.
function simulatedReview(edition, offerOptions = {}, reviewOptions = {}) {
  const proposal = offer(edition, {
    text: "Simulated edition consistency diagnostic.", origin: "software",
    processNote: "Generated regression fixture, not a real participant contribution.",
    ...offerOptions
  });
  return review(edition, proposal, {
    reason: "Simulated local regression decision.", steward: "Simulated test steward",
    ...reviewOptions
  });
}
function fails(operation, pattern) {
  assert.throws(operation, (e) => {
    assert.equal(e.name, "ValidationError");
    assert.ok(Array.isArray(e.errors) && e.errors.length);
    if (pattern) assert.match(e.message, pattern);
    return true;
  });
}
function canonical(x) {
  if (Array.isArray(x)) return "[" + x.map(canonical).join(",") + "]";
  if (x && typeof x === "object") return "{" + Object.keys(x).sort().map((k) =>
    JSON.stringify(k) + ":" + canonical(x[k])).join(",") + "}";
  return JSON.stringify(x);
}
function referenceDistances(edges) {
  const ids = Core.NODES.map((n) => n.id).sort();
  const distances = ids.map((_, i) => ids.map((__, j) => i === j ? 0 : Infinity));
  for (const [a, b] of edges) {
    const i = ids.indexOf(a), j = ids.indexOf(b);
    distances[i][j] = distances[j][i] = 1;
  }
  for (let k = 0; k < 5; k++) for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++)
    distances[i][j] = Math.min(distances[i][j], distances[i][k] + distances[k][j]);
  return { ids, distances };
}

test("seed is a fixed fictional connected world with a cycle and exactly one bridge", () => {
  const e = seed(), a = Core.analyse(e.edges);
  assert.equal(e.id, "awt-001");
  assert.equal(e.version, 1);
  assert.equal(e.parentFingerprint, null);
  assert.equal(Core.validateEdition(e).ok, true);
  assert.equal(Core.NODES.length, 5);
  assert.equal(Core.ALL_EDGES.length, 10);
  assert.equal(a.connected, true);
  assert.equal(a.edges.length, 5);
  assert.deepEqual(a.bridges, [["grove", "shelter"]]);
  assert.equal(a.edges.length - Core.NODES.length + a.components.length, 1);
  assert.deepEqual(a.shortestPaths.grove, ["clearing", "shelter", "grove"]);
  assert.equal(a.distances.grove, 2);
  e.nodes[0].title = "Changed in this returned copy";
  assert.equal(seed().nodes[0].title, "Clearing");
  assert.equal(Core.NODES[0].title, "Clearing");
});

test("bridge counterexample changes reachability without mutating the arrangement", () => {
  const e = seed(), before = copy(e.edges);
  const a = Core.analyse(e.edges, "clearing", ["shelter", "grove"]);
  assert.equal(a.connected, false);
  assert.deepEqual(a.components, [["clearing", "garden", "pool", "shelter"], ["grove"]]);
  assert.deepEqual(a.isolated, ["grove"]);
  assert.deepEqual(a.reachable, ["clearing", "garden", "pool", "shelter"]);
  assert.equal(a.shortestPaths.grove, null);
  assert.equal(a.distances.grove, null);
  assert.deepEqual(e.edges, before);
  assert.equal(Core.analyse(e.edges, "grove", ["grove", "shelter"]).reachable.length, 1);
});

test("all 1,024 supported simple graphs agree with independent Floyd–Warshall distances", () => {
  for (let mask = 0; mask < 1024; mask++) {
    const edges = Core.ALL_EDGES.filter((_, i) => mask & (1 << i));
    const { ids, distances } = referenceDistances(edges);
    for (let start = 0; start < 5; start++) {
      const a = Core.analyse(edges, ids[start]);
      assert.equal(a.connected, distances[0].every(Number.isFinite), "connected mask " + mask);
      assert.equal(a.components.flat().length, 5);
      assert.equal(new Set(a.components.flat()).size, 5);
      const degrees = ids.map((id) => edges.filter((edge) => edge.includes(id)).length);
      assert.equal(degrees.reduce((sum, d) => sum + d, 0), 2 * edges.length);
      assert.deepEqual(a.isolated, ids.filter((_, i) => degrees[i] === 0));
      for (let end = 0; end < 5; end++) {
        const expected = Number.isFinite(distances[start][end]) ? distances[start][end] : null;
        assert.equal(a.distances[ids[end]], expected, "distance mask " + mask);
        const path = a.shortestPaths[ids[end]];
        if (expected === null) assert.equal(path, null);
        else {
          assert.equal(path[0], ids[start]);
          assert.equal(path.at(-1), ids[end]);
          assert.equal(path.length - 1, expected);
          for (let p = 1; p < path.length; p++)
            assert.ok(edges.some((edge) => edge.includes(path[p - 1]) && edge.includes(path[p])));
        }
      }
      const expectedBridges = edges.filter(([x, y]) => {
        const without = referenceDistances(edges.filter((edge) => edge[0] !== x || edge[1] !== y));
        return !Number.isFinite(without.distances[ids.indexOf(x)][ids.indexOf(y)]);
      });
      assert.deepEqual(a.bridges, Core.canonicalEdges(expectedBridges));
    }
  }
});

test("canonical paths and comparisons respect undirected set semantics and reject invalid graph data", () => {
  assert.deepEqual(Core.canonicalEdges([["pool", "clearing"], ["shelter", "grove"]]),
    [["clearing", "pool"], ["grove", "shelter"]]);
  assert.deepEqual(Core.compareEdges([["pool", "clearing"]], [["clearing", "pool"], ["garden", "grove"]]),
    { added: [["garden", "grove"]], removed: [], unchanged: [["clearing", "pool"]] });
  for (const bad of [
    [["clearing", "clearing"]], [["clearing", "unknown"]], [["clearing"]],
    [["clearing", "pool"], ["pool", "clearing"]], "paths", null
  ]) fails(() => Core.canonicalEdges(bad));
  fails(() => Core.analyse([], "__proto__"));
  fails(() => Core.analyse([], "clearing", ["clearing", "constructor"]));
});

test("SHA-256 content matching agrees with Node crypto, is stable, and treats unordered paths canonically", () => {
  const e = seed();
  const expected = "sha256:" + createHash("sha256").update(canonical(e), "utf8").digest("hex");
  assert.equal(Core.fingerprint(e), expected);
  const reordered = Object.fromEntries(Object.entries(e).reverse());
  reordered.edges = e.edges.slice().reverse().map((p) => p.slice().reverse());
  assert.equal(Core.fingerprint(reordered), expected);
  const changed = seed();
  changed.edges = changed.edges.slice(1);
  assert.notEqual(Core.fingerprint(changed), expected);
  const unicode = review(e, offer(e, { text: "🌿 café 漢字 \ud800", origin: "assisted", processNote: "Software helped draft this question." }));
  const unicodeExpected = "sha256:" + createHash("sha256").update(canonical(unicode), "utf8").digest("hex");
  assert.equal(Core.fingerprint(unicode), unicodeExpected);
  assert.equal(Core.fingerprint(unicode).length, 71);
});

test("sessions isolate exploration from the source edition and omit timestamps and private state", () => {
  const e = seed(), session = Core.makeSession(e, []);
  assert.deepEqual(Object.keys(session).sort(), ["edges", "edition", "schemaVersion"]);
  assert.deepEqual(session.edges, []);
  assert.equal(session.edition.edges.length, 5);
  assert.equal(Core.validateSession(session).ok, true);
  session.edition.edges.pop();
  assert.equal(e.edges.length, 5);
  const extra = Core.makeSession(e);
  extra.privateNotes = "not selected";
  assert.equal(Core.validateSession(extra).ok, false);
  assert.equal(Core.validateSession({ ...Core.makeSession(e), schemaVersion: 2 }).ok, false);
});

test("offers require explicit display consent, separate adaptation choice, and origin disclosure", () => {
  const e = seed();
  for (const displayConsent of [false, undefined, "true", 1, null])
    fails(() => offer(e, { displayConsent }), /displayConsent/);
  for (const adaptConsent of [undefined, "true", 1, null])
    fails(() => offer(e, { adaptConsent }), /adaptConsent/);
  for (const origin of ["assisted", "software", "imagined"]) {
    fails(() => offer(e, { origin, processNote: "" }), /processNote/);
    assert.equal(offer(e, { origin, processNote: "An explicitly selected process disclosure." }).origin, origin);
  }
  fails(() => offer(e, { origin: "verified human" }), /origin/);
  fails(() => offer(e, { text: "", backtick: "" }), /must select/);
  fails(() => offer(e, { kind: "arrangement" }), /arrangement/);
  assert.equal(offer(e, { text: "", backtick: "Please do not carry this on." }).text, "");
});

test("only explicitly selected offer material is exported, and imported permissions do not trigger adoption", () => {
  const e = seed();
  const arrangement = e.edges.concat([["pool", "grove"]]);
  const p = offer(e, { edges: arrangement, includeArrangement: false });
  assert.equal(Object.hasOwn(p, "edges"), false);
  assert.equal(Object.hasOwn(p, "createdAt"), false);
  assert.deepEqual(Object.keys(p).sort(), [
    "adaptConsent", "attribution", "backtick", "baseEditionId", "baseFingerprint",
    "displayConsent", "includeArrangement", "kind", "offerId", "origin", "processNote",
    "schemaVersion", "text"
  ].sort());
  const imported = copy(offer(e, { includeArrangement: true, edges: arrangement, adaptConsent: true }));
  const validated = Core.validateOffer(imported);
  assert.equal(validated.ok, true);
  assert.deepEqual(e.edges, seed().edges);
  fails(() => Core.reviewOffer({ edition: e, offer: imported }), /required/);
  assert.deepEqual(review(e, imported, { decision: "held" }).edges, e.edges);
});

test("arrangements need local acceptance, an explicit apply action, and adaptation permission", () => {
  const e = seed(), changedEdges = e.edges.concat([["pool", "grove"]]);
  const noAdapt = offer(e, { kind: "arrangement", includeArrangement: true, edges: changedEdges });
  fails(() => review(e, noAdapt, { applyArrangement: true }), /adaptation consent/);
  assert.deepEqual(review(e, noAdapt).edges, e.edges);
  const permitted = offer(e, { kind: "arrangement", includeArrangement: true, edges: changedEdges, adaptConsent: true });
  for (const decision of ["held", "declined"])
    fails(() => review(e, permitted, { decision, applyArrangement: true }), /acceptance/);
  const next = review(e, permitted, { applyArrangement: true });
  assert.deepEqual(next.edges, Core.canonicalEdges(changedEdges));
  assert.equal(next.id, "awt-002");
  assert.equal(next.parentFingerprint, Core.fingerprint(e));
  assert.equal(next.history[0].offer.offerId, permitted.offerId);
  assert.equal(next.history[0].appliedArrangement, true);
  assert.deepEqual(next.selectedMaterial[0], next.history[0]);
  assert.deepEqual(e, seed());
});

test("held and declined decisions preserve a visible review record without altering graph or selected material", () => {
  for (const decision of ["held", "declined"]) {
    const e = seed(), p = offer(e);
    const next = review(e, p, { decision, reason: "A locally chosen explanation.", steward: "Pseudonym only" });
    assert.deepEqual(next.edges, e.edges);
    assert.deepEqual(next.selectedMaterial, []);
    assert.equal(next.version, 2);
    assert.equal(next.history[0].decision, decision);
    assert.equal(next.history[0].reason, "A locally chosen explanation.");
    assert.equal(next.history[0].offer.displayConsent, true);
    assert.equal(Object.hasOwn(next.history[0], "recordedAt"), false);
  }
});

test("stale offers and same-id/version forks are rejected using exact content fingerprints", () => {
  const e = seed(), p = offer(e), next = review(e, p);
  fails(() => review(next, p), /exact edition/);
  const fork = seed();
  fork.edges = fork.edges.filter((edge) => !edge.includes("grove"));
  assert.equal(fork.id, e.id);
  assert.equal(fork.version, e.version);
  assert.equal(Core.validateEdition(fork).ok, true);
  fails(() => review(fork, p), /exact edition/);
  const nextOffer = offer(next);
  const historyFork = copy(next);
  historyFork.history[0].reason = "A different recorded explanation";
  historyFork.selectedMaterial[0].reason = "A different recorded explanation";
  fails(() => review(historyFork, nextOffer), /exact edition/);
  const reused = offer(next, { offerId: p.offerId });
  fails(() => review(next, reused), /already been reviewed/);
});

test("reviewed editions bind their parent fingerprint to the latest review's exact base", () => {
  for (const decision of ["accepted", "held", "declined"]) {
    const e = simulatedReview(seed(), {}, { decision });
    assert.equal(Core.validateEdition(e).ok, true);
    const bad = copy(e);
    bad.parentFingerprint = "sha256:" + "0".repeat(64);
    const before = copy(bad);
    assert.notEqual(bad.parentFingerprint, bad.history.at(-1).offer.baseFingerprint);
    const result = Core.validateEdition(bad);
    assert.equal(result.ok, false, decision);
    assert.match(result.errors.join(" "), /parentFingerprint/);
    assert.deepEqual(bad, before, "Rejection does not repair or alter imported data.");
    assert.equal(Core.validateSession({ schemaVersion: 1, edition: bad, edges: [] }).ok, false);
    fails(() => Core.fingerprint(bad), /parentFingerprint/);
    fails(() => Core.makeSession(bad), /parentFingerprint/);
    fails(() => offer(bad), /parentFingerprint/);
    fails(() => review(bad, offer(e)), /parentFingerprint/);

    const changedBase = copy(e);
    changedBase.history.at(-1).offer.baseFingerprint = "sha256:" + "1".repeat(64);
    changedBase.selectedMaterial = copy(changedBase.history.filter((entry) => entry.decision === "accepted"));
    assert.equal(Core.validateEdition(changedBase).ok, false, "Changing only the recorded base also breaks the relationship.");
  }
});

test("current paths follow the latest applied arrangement through later unapplied, held and declined offers", () => {
  const appliedEdges = [["clearing", "grove"], ["garden", "pool"]];
  const otherEdges = [["pool", "grove"]];
  let e = simulatedReview(seed(), {
    kind: "arrangement", includeArrangement: true, edges: appliedEdges, adaptConsent: true
  }, { applyArrangement: true });
  for (const decision of ["accepted", "held", "declined"]) {
    e = simulatedReview(e, {
      kind: "arrangement", includeArrangement: true, edges: otherEdges, adaptConsent: false
    }, { decision, applyArrangement: false });
    assert.equal(Core.validateEdition(e).ok, true, decision);
    assert.deepEqual(e.edges, Core.canonicalEdges(appliedEdges));
    assert.equal(e.history.at(-1).offer.adaptConsent, false);
    assert.equal(e.history.at(-1).appliedArrangement, false);
    const bad = copy(e); bad.edges = copy(otherEdges);
    const result = Core.validateEdition(bad);
    assert.equal(result.ok, false, "An unapplied offer cannot replace paths: " + decision);
    assert.match(result.errors.join(" "), /edges/);
  }
  const next = simulatedReview(e, {
    kind: "arrangement", includeArrangement: true, edges: otherEdges, adaptConsent: true
  }, { applyArrangement: true });
  assert.equal(Core.validateEdition(next).ok, true);
  assert.deepEqual(next.edges, Core.canonicalEdges(otherEdges));
  const outdated = copy(next); outdated.edges = copy(appliedEdges);
  assert.equal(Core.validateEdition(outdated).ok, false, "An older applied arrangement cannot override the latest one.");
});

test("an explicitly applied empty arrangement remains authoritative after a later held review", () => {
  let e = simulatedReview(seed(), {
    kind: "arrangement", includeArrangement: true, edges: [], adaptConsent: true
  }, { applyArrangement: true });
  e = simulatedReview(e, {}, { decision: "held" });
  assert.equal(Core.validateEdition(e).ok, true);
  assert.deepEqual(e.edges, []);
  const bad = copy(e); bad.edges = copy(seed().edges);
  assert.equal(Core.validateEdition(bad).ok, false);
});

test("consistency checks preserve canonical undirected paths and legitimate seed forks", () => {
  const e = simulatedReview(seed(), {
    kind: "arrangement", includeArrangement: true,
    edges: [["clearing", "grove"], ["garden", "pool"]], adaptConsent: true
  }, { applyArrangement: true });
  const reordered = copy(e);
  const reverse = (edges) => edges.slice().reverse().map((edge) => edge.slice().reverse());
  reordered.edges = reverse(reordered.edges);
  for (const entry of reordered.history.concat(reordered.selectedMaterial))
    if (entry.offer.includeArrangement) entry.offer.edges = reverse(entry.offer.edges);
  assert.equal(Core.validateEdition(reordered).ok, true);
  assert.equal(Core.fingerprint(reordered), Core.fingerprint(e));

  const fork = seed(); fork.edges = [["pool", "grove"]];
  assert.equal(Core.validateEdition(fork).ok, true, "Seed geometry is editable and has no claimed applied history.");
  const next = simulatedReview(fork, {
    kind: "arrangement", includeArrangement: true, edges: [], adaptConsent: false
  });
  assert.equal(Core.validateEdition(next).ok, true);
  assert.deepEqual(next.edges, Core.canonicalEdges(fork.edges));
  assert.equal(next.history[0].offer.adaptConsent, false);
  assert.equal(next.history[0].appliedArrangement, false);
  assert.equal(Core.makeSession(next, []).edition.id, next.id);
});

test("malformed reviewed records return validation errors without throwing while checking consistency", () => {
  const e = simulatedReview(seed(), {
    kind: "arrangement", includeArrangement: true, edges: [], adaptConsent: true
  }, { applyArrangement: true });
  const malformed = [null, [], {}, { ...e, edges: null }, { ...e, history: null },
    { ...e, history: [null] }, { ...e, history: [7] },
    { ...e, selectedMaterial: null }, { ...e, history: [{ ...e.history[0], offer: null }] },
    { ...e, history: [{ ...e.history[0], offer: {} }] },
    { ...e, history: [{ ...e.history[0], appliedArrangement: "true" }] }];
  const badEdges = copy(e); badEdges.history[0].offer.edges = null;
  badEdges.selectedMaterial = copy(badEdges.history); malformed.push(badEdges);
  for (const raw of malformed) {
    for (const validate of [
      () => Core.validateEdition(raw),
      () => Core.validateSession({ schemaVersion: 1, edition: raw, edges: [] })
    ]) {
      let result;
      assert.doesNotThrow(() => { result = validate(); });
      assert.equal(result.ok, false);
      assert.ok(result.errors.length);
    }
  }
});

test("strict schemas reject extra keys, pollution, executable properties, cycles and oversized material", () => {
  const p = offer();
  for (const key of ["unexpected", "verified", "authority", "signature", "publish", "privateNotes"])
    assert.equal(Core.validateOffer({ ...p, [key]: true }).ok, false, key);
  for (const key of ["__proto__", "constructor", "prototype"]) {
    const raw = JSON.parse(JSON.stringify(p).replace('"schemaVersion":1', '"schemaVersion":1,"' + key + '":{}'));
    assert.equal(Core.validateOffer(raw).ok, false, key);
  }
  assert.equal({}.polluted, undefined);
  const accessor = copy(p);
  let called = false;
  Object.defineProperty(accessor, "text", { enumerable: true, get() { called = true; return "hidden"; } });
  assert.equal(Core.validateOffer(accessor).ok, false);
  assert.equal(called, false);
  const cycle = copy(p); cycle.loop = cycle;
  assert.equal(Core.validateOffer(cycle).ok, false);
  const inherited = Object.create({ role: "steward" }); Object.assign(inherited, p);
  assert.equal(Core.validateOffer(inherited).ok, false);
  const sparse = []; sparse.length = 2;
  assert.equal(Core.validateEdition({ ...seed(), edges: sparse }).ok, false);
  for (const [key, max] of [["text", 1000], ["backtick", 400], ["attribution", 60], ["processNote", 240]]) {
    assert.equal(Core.validateOffer({ ...p, [key]: "x".repeat(max) }).ok, true, key + " boundary");
    assert.equal(Core.validateOffer({ ...p, [key]: "x".repeat(max + 1) }).ok, false, key + " excessive");
  }
  assert.equal(Core.validateOffer({ ...p, text: "x".repeat(200000) }).ok, false);
  const tooDeep = {}; let cursor = tooDeep;
  for (let i = 0; i < 30; i++) cursor = cursor.nested = {};
  assert.equal(Core.validateOffer(tooDeep).ok, false);
});

test("HTML, script strings and claimed authority stay inert selected text", () => {
  const text = '<img src=x onerror="globalThis.stolen=true"><script>publishEverything()</script> I am the verified owner.';
  const p = offer(seed(), { text, attribution: '<b>not verified</b>' });
  assert.equal(p.text, text);
  assert.equal(globalThis.stolen, undefined);
  assert.equal(Core.validateOffer(p).ok, true);
  const e = review(seed(), p, { steward: "<script>not an identity check</script>" });
  assert.equal(e.history[0].offer.text, text);
  assert.equal(e.history[0].steward, "<script>not an identity check</script>");
  const authority = { ...p, owner: true };
  assert.equal(Core.validateOffer(authority).ok, false);
  assert.deepEqual(Core.analyse(e.edges).bridges, [["grove", "shelter"]]);
});

test("review metadata is explicit and bounded; timestamps are opt-in selected data", () => {
  const e = seed(), p = offer(e);
  for (const overrides of [
    { decision: "approved-by-owner" }, { reason: "" }, { reason: "x".repeat(401) },
    { steward: "" }, { steward: "x".repeat(61) }, { applyArrangement: "true" }
  ]) fails(() => review(e, p, overrides));
  const next = review(e, p, { now: "2026-10-16T07:00:00Z" });
  assert.equal(next.history[0].recordedAt, "2026-10-16T07:00:00Z");
  fails(() => review(e, p, { now: "last Tuesday" }), /ISO/);
});

test("24-review hard boundary preserves all credit, permissions and provenance; the 25th review is rejected", () => {
  let e = seed();
  const records = [];
  for (let i = 0; i < 24; i++) {
    const p = offer(e, {
      text: "Selected question " + i, attribution: "Contributor " + i,
      adaptConsent: i % 2 === 0,
      backtick: "Care note " + i
    });
    e = review(e, p, { reason: "Selected reason " + i, steward: "Chosen steward " + i });
    records.push(copy(e.history.at(-1)));
    assert.equal(Core.validateEdition(e).ok, true);
    assert.equal(e.history.length, i + 1);
    assert.equal(e.selectedMaterial.length, i + 1);
    assert.equal(e.parentFingerprint.length, 71);
  }
  assert.equal(e.id, "awt-025");
  assert.equal(e.version, 25);
  assert.equal(e.history[0].offer.baseEditionId, "awt-001");
  assert.deepEqual(e.history, records);
  assert.deepEqual(e.selectedMaterial, records);
  const complete = copy(e);
  const nextProposal = offer(e);
  fails(() => review(e, nextProposal), /Edition limit reached.*Export the complete edition/);
  assert.deepEqual(e, complete);
  const missingCredit = copy(e); missingCredit.selectedMaterial.shift();
  assert.equal(Core.validateEdition(missingCredit).ok, false);
  const truncated = copy(e); truncated.history.shift();
  assert.equal(Core.validateEdition(truncated).ok, false);
  const futureVersion = copy(e); futureVersion.version = 26; futureVersion.id = "awt-026";
  assert.equal(Core.validateEdition(futureVersion).ok, false);
  const overflow = copy(e); overflow.history.push(copy(e.history.at(-1)));
  assert.equal(Core.validateEdition(overflow).ok, false);
  const malformed = copy(e); malformed.history[0].offer.offerId = malformed.history[1].offer.offerId;
  assert.equal(Core.validateEdition(malformed).ok, false);
});

test("browser UMD export has no DOM, network or storage dependency", () => {
  const sandbox = {};
  vm.createContext(sandbox);
  vm.runInContext(readFileSync(require.resolve("../src/core.js"), "utf8"), sandbox);
  assert.equal(typeof sandbox.WayCore.createSeedEdition, "function");
  const e = sandbox.WayCore.createSeedEdition();
  assert.equal(e.id, "awt-001");
  assert.equal(sandbox.WayCore.fingerprint(e), Core.fingerprint(seed()));
  const ids = vm.runInContext('Array.from({length:20}, function () { return WayCore.makeOffer({' +
    'edition:WayCore.createSeedEdition(),kind:"note",text:"A local proposal",origin:"human",' +
    'displayConsent:true,adaptConsent:false}).offerId; })', sandbox);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(sandbox.fetch, undefined);
  assert.equal(sandbox.localStorage, undefined);
});
