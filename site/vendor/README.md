# jsonc-parser

Pinned Microsoft `jsonc-parser` 3.3.1, MIT license. The adjacent license and provenance files identify the upstream version, npm integrity and bundle checksum.

Rebuild with `npm ci --ignore-scripts` followed by `npm run vendor:jsonc`. The committed browser bundle is loaded locally; no runtime CDN requests or game data uploads are involved. CI verifies that the lockfile-pinned rebuild matches the committed bundle.

GCS uses strict parse trees, `findNodeAtLocation`, `modify` without formatting options and `applyEdits`. Only existing scalar value spans are accepted. Every edit is checked against the adapter's editable field list and the user's explicit changes. No insertion, removal, ambiguous key lookup or full-document formatting fallback is permitted.
