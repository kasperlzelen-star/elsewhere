# Software changes

## 0.1.1 — 16 October 2026

Addresses [issue #1](https://github.com/kasperlzelen-star/elsewhere/issues/1) in the browser and local tools using one shared core:

- A reviewed edition's `parentFingerprint` must equal its final history offer's `baseFingerprint`.
- If a history entry accepted and explicitly applied an arrangement, current paths must match the most recent such offer's paths. Comparisons use undirected path-set semantics, so reordering paths or reversing a pair remains valid.
- Contradictory imports produce validation errors. They are not silently repaired, and no history, permission or selected material is discarded to make a file pass.

Schema version 1, the public `awt-001` seed and its fingerprint remain unchanged. Valid histories produced by the review constructor remain compatible, including held or declined decisions after an applied arrangement and accepted arrangements that were not applied. Without an applied arrangement, the validator does not infer an original path set or require every version-1 file to use the official seed paths.

The checks establish limited internal consistency. They do not reconstruct every earlier edition, authenticate a submitter or steward, prove permissions, or convert a software test into a participant's account. Private exploration, separate display and adaptation choices, and human review remain unchanged.

This is a software update. It does not publish another shared-world edition or establish that a hosted website has deployed this source. The original downloadable 0.1 snapshot remains a separate historical artifact with its original, less strict validator. Reverting this source update restores that earlier acceptance behavior; retain original files when investigating an invalid import.
