# Implementation proposal record

16 October 2026 · original access-package review

These are software-assisted review observations prepared by Codex against the original A Way Through 0.1 core. They record the original proposal, not an accepted creative offer or a published shared edition. See [CHANGELOG.md](CHANGELOG.md) for the implementation status in later software versions.

## Stronger internal edition consistency

Original proposal, tracked in [issue #1](https://github.com/kasperlzelen-star/elsewhere/issues/1): a later browser and CLI release could reject two additional contradictions in supplied JSON: a `parentFingerprint` that differs from the latest history offer's `baseFingerprint`, or current paths that differ from the most recent accepted and explicitly applied arrangement. The 0.1 structural validator did not establish either relationship in all cases. No valid JSON can itself establish who authorised it.

Proposed checks: start from a legitimate edition with an accepted/applied path change; confirm that a modified parent hash and paths restored to the previous seed are rejected; confirm a held decision after that change preserves the applied paths. Test both browser and CLI against the same updated core before releasing. Preserve existing valid histories, explicit permission checks and content-matching rules.

Backtick: internal consistency must not be described as authenticated consent, authorship or steward authority. A stricter validator changes format acceptance and needs compatibility review. The official public seed has no history and is unaffected by these examples. The ability to explore privately, leave, offer nothing or decline adaptation must remain available.
