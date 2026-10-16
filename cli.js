#!/usr/bin/env node
"use strict";

// Local, read-only access to curated data. This program never sends proposals,
// writes files, changes an edition, reviews offers, or grants publication rights.
const fs = require("node:fs");
const path = require("node:path");
const Core = require("./lib/core.js");
const { TextDecoder } = require("node:util");

const SEED_PATH = path.join(__dirname, "seed-public-edition.json");
const INPUT_KEYS = ["kind", "text", "attribution", "origin", "processNote",
  "backtick", "displayConsent", "adaptConsent", "includeArrangement", "edges"];
const COMMAND_OPTIONS = {
  info: [],
  analyse: ["edition", "session", "edges", "start", "exclude"],
  validate: ["type", "file", "edition"],
  propose: ["edition", "input"]
};
const MAX_INPUT_BYTES = Core.LIMITS.sessionBytes;
class InputError extends Error {
  constructor(errors) {
    super(errors.join("; "));
    this.errors = errors;
    this.name = "InputError";
  }
}
const fail = (message) => { throw new InputError([message]); };
function ensure(result) {
  if (!result.ok) throw new InputError(result.errors);
  return result.value;
}
function parseArgs(argv) {
  if (argv.length === 0 || argv.length === 1 && (argv[0] === "--help" || argv[0] === "help"))
    return { command: "info", options: {} };
  const command = argv[0];
  if (!Object.hasOwn(COMMAND_OPTIONS, command)) fail("Command must be info, analyse, validate or propose.");
  const options = {};
  for (let i = 1; i < argv.length; i += 2) {
    const flag = argv[i];
    if (!/^--[a-z]+$/.test(flag)) fail("Expected a named option, received " + flag + ".");
    const name = flag.slice(2);
    if (!COMMAND_OPTIONS[command].includes(name)) fail("Unknown option for " + command + ": " + flag + ".");
    if (Object.hasOwn(options, name)) fail("Option was repeated: " + flag + ".");
    const value = argv[i + 1];
    if (value === undefined || value.startsWith("--")) fail("A value is required for " + flag + ".");
    options[name] = value;
  }
  const stdinUses = Object.keys(options).filter((name) =>
    ["edition", "session", "edges", "file", "input"].includes(name) && options[name] === "-");
  if (stdinUses.length > 1) fail("Standard input can supply only one JSON document per command.");
  return { command, options };
}
function readBounded(file, maxBytes = MAX_INPUT_BYTES) {
  let fd;
  let ownFd = false;
  try {
    if (file === "-") fd = 0;
    else {
      const stat = fs.statSync(file);
      if (!stat.isFile()) fail("Input must be a regular local file.");
      if (stat.size > maxBytes) fail("Input exceeds " + maxBytes + " bytes.");
      fd = fs.openSync(file, "r");
      ownFd = true;
    }
    const chunks = [];
    let total = 0;
    while (true) {
      const chunk = Buffer.alloc(Math.min(16384, maxBytes + 1 - total));
      const n = fs.readSync(fd, chunk, 0, chunk.length, null);
      if (!n) break;
      total += n;
      if (total > maxBytes) fail("Input exceeds " + maxBytes + " bytes.");
      chunks.push(chunk.subarray(0, n));
    }
    return new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks));
  } catch (error) {
    if (error instanceof InputError) throw error;
    fail("Could not read the local JSON input: " + (error.code || "read error") + ".");
  } finally {
    if (ownFd) fs.closeSync(fd);
  }
}
function readJson(file, maxBytes) {
  const text = readBounded(file, maxBytes);
  try { return JSON.parse(text); }
  catch (_) { fail("Input must be valid JSON."); }
}
function getEdition(file) {
  return ensure(Core.validateEdition(readJson(file || SEED_PATH, Core.LIMITS.editionBytes)));
}
function baseDescription(edition) {
  return { editionId: edition.id, fingerprint: Core.fingerprint(edition) };
}
function makeInfo() {
  const edition = getEdition();
  return {
    ok: true, command: "info", name: "elsewhere-access", version: require("./package.json").version,
    purpose: "Read a curated fictional world, inspect its graph, and prepare an unsubmitted software-origin proposal.",
    files: {
      edition: "seed-public-edition.json", core: "lib/core.js",
      contract: "data-contract.json", example: "examples/software-offer-input.json"
    },
    base: baseDescription(edition), nodes: edition.nodes,
    commands: {
      info: "node cli.js info",
      analyse: "node cli.js analyse [--edition PATH | --session PATH] [--edges PATH] [--start NODE] [--exclude NODE,NODE]",
      validate: "node cli.js validate --type edition|session|offer --file PATH|- [--edition PATH]",
      propose: "node cli.js propose [--edition PATH] --input PATH|-"
    },
    limits: Core.LIMITS,
    capabilities: {
      readsLocalJson: true, analysesGraphs: true, preparesProposals: true,
      writesFiles: false, network: false, submits: false, reviews: false, publishes: false
    },
    trust: {
      publicDataIsUntrusted: true,
      fingerprintsProve: "Only matching canonical content; no authorship, identity, permission or authority is verified.",
      permissions: "Use only material you are authorised to offer. Display and adaptation choices are deliberate separate inputs.",
      review: "The output is an unsubmitted proposal. Adoption requires a separate deliberate review."
    }
  };
}
function analyse(options) {
  if (options.edition && options.session) fail("Choose --edition or --session, not both.");
  let edition, edges;
  if (options.session) {
    const session = ensure(Core.validateSession(readJson(options.session, Core.LIMITS.sessionBytes)));
    edition = session.edition;
    edges = session.edges;
  } else {
    edition = getEdition(options.edition);
    edges = edition.edges;
  }
  if (options.edges) edges = Core.canonicalEdges(readJson(options.edges, Core.LIMITS.offerBytes));
  let excluded;
  if (options.exclude !== undefined) {
    excluded = options.exclude.split(",");
    if (excluded.length !== 2 || excluded.some((id) => !id)) fail("--exclude must be two node ids separated by a comma.");
  }
  const analysis = Core.analyse(edges, options.start, excluded);
  return {
    ok: true, command: "analyse", base: baseDescription(edition),
    analysis,
    changesFromEdition: Core.compareEdges(edition.edges, analysis.edges)
  };
}
function validate(options) {
  if (!["edition", "session", "offer"].includes(options.type)) fail("--type must be edition, session or offer.");
  if (!options.file) fail("--file is required; use - for standard input.");
  if (options.edition && options.type !== "offer") fail("--edition is only an exact-base check for an offer.");
  const validators = { edition: Core.validateEdition, session: Core.validateSession, offer: Core.validateOffer };
  const maxBytes = { edition: Core.LIMITS.editionBytes, session: Core.LIMITS.sessionBytes, offer: Core.LIMITS.offerBytes };
  const result = validators[options.type](readJson(options.file, maxBytes[options.type]));
  const output = {
    ok: result.ok, command: "validate", type: options.type,
    errors: result.errors, checks: { shape: result.ok, exactBase: null }
  };
  if (result.ok && options.type === "offer" && options.edition) {
    const edition = getEdition(options.edition);
    output.base = baseDescription(edition);
    output.checks.exactBase = result.value.baseEditionId === edition.id &&
      result.value.baseFingerprint === output.base.fingerprint;
    if (!output.checks.exactBase) {
      output.ok = false;
      output.errors = ["Offer base does not match this exact edition."];
    }
  }
  if (result.ok && options.type === "edition") output.base = baseDescription(result.value);
  if (result.ok && options.type === "session") output.base = baseDescription(result.value.edition);
  return output;
}
function propose(options) {
  if (!options.input) fail("--input is required; use - for standard input.");
  const input = readJson(options.input, Core.LIMITS.offerBytes);
  if (!input || typeof input !== "object" || Array.isArray(input)) fail("Proposal input must be an object.");
  const unknown = Object.keys(input).filter((key) => !INPUT_KEYS.includes(key));
  if (unknown.length) fail("Unknown proposal input field: " + unknown.join(", ") + ".");
  for (const field of ["kind", "origin", "processNote", "displayConsent", "adaptConsent", "includeArrangement"])
    if (!Object.hasOwn(input, field)) fail("Proposal input requires " + field + ".");
  if (input.origin !== "software") fail("This CLI prepares software-origin proposals; origin must be software.");
  if (input.displayConsent !== true) fail("displayConsent must be explicitly true before preparing an offer.");
  if (typeof input.adaptConsent !== "boolean") fail("adaptConsent must be an explicitly chosen boolean.");
  if (typeof input.includeArrangement !== "boolean") fail("includeArrangement must be an explicitly chosen boolean.");
  const edition = getEdition(options.edition);
  const proposal = Core.makeOffer({ edition, ...input });
  return {
    ok: true, command: "propose", base: baseDescription(edition), proposal,
    submission: { submitted: false, reviewed: false, published: false }
  };
}
function execute(command, options) {
  if (command === "info") return makeInfo();
  if (command === "analyse") return analyse(options);
  if (command === "validate") return validate(options);
  if (command === "propose") return propose(options);
  fail("Unknown command.");
}
function main(argv) {
  let command = argv[0] || "info";
  try {
    const parsed = parseArgs(argv);
    command = parsed.command;
    const output = execute(parsed.command, parsed.options);
    process.stdout.write(JSON.stringify(output, null, 2) + "\n");
    return output.ok ? 0 : 2;
  } catch (error) {
    const expected = error instanceof InputError || error instanceof Core.ValidationError;
    const errors = expected ? error.errors : ["The local operation could not be completed."];
    process.stdout.write(JSON.stringify({ ok: false, command, errors }, null, 2) + "\n");
    return expected ? 2 : 1;
  }
}
if (require.main === module) process.exitCode = main(process.argv.slice(2));
module.exports = { main };
