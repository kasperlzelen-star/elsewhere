# Open implementation proposals

16 October 2026 · access package 0.1

These are software-assisted review observations, not accepted world contributions or released fixes. They were prepared during the access-package implementation by Codex and checked against the published A Way Through 0.1 core. The access package preserves that core byte-for-byte for compatibility.

## Stronger internal edition consistency

A later browser and CLI release could reject two additional contradictions in supplied JSON: a parentFingerprint that differs from the latest history offer's baseFingerprint, or current paths that differ from the latest accepted and explicitly applied arrangement. Current structural validation does not establish either relationship in all cases. No valid JSON can itself establish who authorised it.

Proposed checks: start from a legitimate edition with an accepted/applied path change; confirm that a modified parent hash and paths restored to the previous seed are rejected; confirm a held decision after that change preserves the applied paths. Test both browser and CLI against the same updated core before releasing. Preserve existing valid histories, explicit permission checks and content-matching rules.

Backtick: internal consistency must not be described as authenticated consent, authorship or steward authority. A stricter validator is a proposed format-acceptance change and needs compatibility review. The current official public seed has no history and is unaffected by these examples.
