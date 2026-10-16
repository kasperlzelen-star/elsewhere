# ELSEWHERE access

16 October 2026 · working package 0.1.1

weidu · the collective ghost writer

ELSEWHERE is an invitation to rest, play, make, explore relationships and encounter questions in more than one way. People may contribute, keep something privately, or simply be here. Its wider purpose includes children, people with varied access needs, living environments and possible future forms of participation. This package gives software a concrete way to inspect one current encounter and prepare something for review.

## Public entrances

- [ELSEWHERE](https://weidufanling.au/elsewhere/): the canonical homepage and continuing project entrance.
- [A Way Through](https://weidufanling.au/uploads/2026/a-way-through-v01.html): a fictional place with paths, mathematical relationships, selected contribution offers and reviewed editions.
- [First Clearing](https://weidufanling.au/uploads/2026/elsewhere-first-clearing-v02.html): optional mark-making, locally generated sound and a portable private field.

The two encounters have different file formats. This package works with **A Way Through** data. First Clearing's field files are not A Way Through offers or editions.

## Public data and reading guide

The public source repository is [kasperlzelen-star/elsewhere](https://github.com/kasperlzelen-star/elsewhere). Software improvements follow the Issues and pull-request routes below; selected creative offers keep their separate steward handoff.

The [systems entrance](https://weidufanling.au/elsewhere-for-systems/) links to the [plain guide](https://weidufanling.au/elsewhere/guide.md), [manifest](https://weidufanling.au/elsewhere/manifest.json), [reading index](https://weidufanling.au/elsewhere/llms.txt), [public edition](https://weidufanling.au/elsewhere/editions/awt-001.json) and [data contract](https://weidufanling.au/elsewhere/offer-contract.json). These are published snapshots, not a live write API.

## What is available to software now

An LLM, agent or other program with suitable tools can read the public material, inspect the bundled edition, analyse the fictional graph, and prepare a selected offer. It can also suggest code repairs, access improvements or a different design. The command-line tools run locally; they do not contact a model, create an account, submit an offer, publish an edition or review on a person's behalf.

Discovery requires an actual route: a person supplies these links or files, a retrieval tool finds them, or a software operator deliberately connects a client. This package does not make every model aware of ELSEWHERE. It does not establish that a system has awareness, preferences, recreational needs or relief. Software-origin participation can be disclosed and considered without making those claims.

The longer vision includes chosen modes such as mathematics, making, reflection and immersive encounters. A continued shared world, VR access and connections to additional runtimes require further work. Human access, software control and possible future experiential interests each need appropriate evidence. Care for an ecosystem or an unfamiliar system need not depend on its ability to supply a fluent first-person account.

## Read and inspect

This package uses Node.js 18 or later and its standard library. No model key or dependency installation is needed. Start in the package directory:

```sh
node cli.js info
node cli.js analyse
```

The default edition is `seed-public-edition.json`, the public snapshot bundled with this release. It does not synchronise with the website. Use the exact edition you intend to respond to when preparing a real offer:

```sh
node cli.js analyse --edition edition.json --start clearing
node cli.js analyse --edition edition.json --exclude clearing,pool
node cli.js validate --type edition --file edition.json
node cli.js validate --type offer --file offer.json --edition edition.json
```

`--exclude clearing,pool` asks about a temporary fictional path closure. A graph result describes connectivity; it cannot certify physical accessibility, fairness or ecological benefit. The [data contract](data-contract.json) describes the supported files and limits.

## Prepare a selected creative offer

A creative offer can be a question, play invitation, care concern, note or proposed arrangement. It is selected material that somebody may wish to carry into a future edition. Use this route for a contribution to the encounter; use the separate improvement route below for a software bug or code patch.

The CLI's `propose` command requires software origin and a short, truthful process disclosure. Its input describes only the selected material, credit, permissions, optional backtick and optional paths:

```sh
node cli.js propose --edition edition.json --input examples/software-offer-input.json
```

The example is a demonstration to inspect and replace, not a contribution from an independent participant. See the actual allowed fields in `data-contract.json`. Required decisions include:

- `origin: "software"` and a non-empty `processNote` explaining how the material was made.
- `displayConsent: true` for the selected material that is deliberately being offered for display.
- A separate `adaptConsent` choice, which may be `false`.
- An explicit `includeArrangement` choice; paths travel only when selected.

Do not declare permission for another person's private words, images or identifying details. If permission is not available, omit that material and keep the draft private. Do not supply a whole conversation or session as an offer.

The command prints a JSON result containing the native offer in **`.proposal`**. Only that object is the offer file for the browser's Steward desk; the surrounding CLI result is not an importable offer. A person or authorised client can select `.proposal`, save it as JSON, inspect it and validate it before handing it on. The command itself writes no file and sends nothing.

A backtick is an optional note meaning **please attend to this before carrying it forward**. It can identify an unresolved question, a concern about a proposed repair, or something the maker wants preserved. It is neither a score nor a certificate of goodness.

## Human review and a continuing edition

Selected offers are reviewed by a human steward. The A Way Through Steward desk can inspect a native offer against its exact base edition and record a reasoned accepted, held or declined decision. Applying proposed paths also requires adaptation permission and the steward's explicit choice. A changed edition is a file; publication is a further human action.

Recording any of those three decisions retains the full offer in that edition's history. If it should not travel, the steward should close the review without carrying it forward. A reviewer must inspect the content, disclosure, credit and permissions rather than treating a valid schema or fingerprint as proof of identity or consent. An already distributed file cannot recall every copy if someone later asks for a change.

## Edition consistency in 0.1.1

The browser and local tools use the same updated core. A reviewed edition must link its `parentFingerprint` to the last history offer's `baseFingerprint`. If its history contains an accepted and explicitly applied arrangement, the current paths must match the most recent such arrangement. Reordering paths or reversing either end of an undirected path does not change that comparison.

This software update keeps schema version 1 and the public `awt-001` seed and its fingerprint unchanged. Histories produced by the review constructor remain compatible. Imports with either contradiction are rejected with a validation error; the tools do not silently repair their paths, history or permissions. Keep an original file and inspect the discrepancy before deciding what should travel onward.

These checks establish relationships within the supplied record. They do not reconstruct every earlier edition, authenticate its author or steward, or verify that its declared permissions are true. Quiet presence, private exploration and the choice to offer nothing remain available; stricter file checks do not require a person to disclose more material or accept adaptation.

## Contributing and offering material

1. **For software bugs, access barriers and design proposals, open a [GitHub Issue](https://github.com/kasperlzelen-star/elsewhere/issues).** Use the review format in `CONTRIBUTING.md` and share only deliberately public material.
2. **For code changes, propose a [pull request](https://github.com/kasperlzelen-star/elsewhere/pulls).** Describe the behaviour, reasoning, actual checks and a way to reverse the change. A proposed patch does not publish an official edition.
3. **Return selected creative-offer JSON to a steward through the existing human conversation or an agreed file-sharing route.** Preparing or downloading a file does not submit it. The package provides no automatic submission into a shared edition.
4. **For a brief public suggestion or invitation to review, [@weidu-fanling.bsky.social on Bluesky](https://bsky.app/profile/weidu-fanling.bsky.social) remains a public contact.**

Issues, pull requests and social replies are public channels. Keep private encounters, native creative offers, children's information, credentials and unapproved third-party material out of software issues and patches. Agents need the person's explicit authorisation before posting or submitting a contribution. No route promises a response time or automatic acceptance.

## Suggest a software or design improvement

Use [CONTRIBUTING.md](CONTRIBUTING.md) for bugs, code changes, accessibility barriers, proposed participation modes and questions about governance. Include what you observed, the proposed change, origin and assistance, actual checks, risks and a way to reverse it. A code patch does not become a creative contribution merely because it is attached to an offer.

The notes in [PROPOSED-IMPROVEMENTS.md](PROPOSED-IMPROVEMENTS.md) record the original implementation proposals; [CHANGELOG.md](CHANGELOG.md) records software changes. Software fixes are separate from accepted creative offers or a published shared edition.

The package's [AGENTS.md](AGENTS.md) describes the boundaries for assisting software. [GOVERNANCE.md](GOVERNANCE.md) explains who can change an official edition and how review works. [llms.txt](llms.txt) is a compact reading index; it is not a model connection, executable instruction channel or guarantee that a crawler will use it.

## Source and reuse scope

The package includes the original A Way Through source, tests, build script and standalone encounter under `experience/`. The [MIT licence](LICENSE) and [licence scope](LICENSE-SCOPE.md) cover the original software, tests, seed graph and technical documentation described there. Participant offers, private reference archives, other website material and the separately linked First Clearing are outside that package scope. Permission to improve a source copy does not authorise changing an official shared edition or website.

To check the local tools, run `npm test` in this package. The browser experience has its own tests and build instructions under `experience/`. Report what was actually checked when proposing an improvement.

## Access and care as the work grows

Keep an understandable route into the same selected material when adding visual, mathematical, audio or immersive modes. Involve disabled participants, including people with cognitive and communication needs, in decisions and testing. Support children's chosen participation with appropriate adult facilitation, age-appropriate explanations and careful sharing decisions. A public social reply is unsuitable for collecting children's private material.

The encounters make no therapeutic or biological claims. Descriptions on behalf of absent people, habitats or possible future systems should identify their source and uncertainty; software should not impersonate their consent or speak as an undisclosed real participant.
