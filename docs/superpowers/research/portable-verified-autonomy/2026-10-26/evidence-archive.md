# Immutable research evidence archive

> Authoritative for: publication packaging and restoration of the accepted raw evidence.
> NOT authoritative for: new research findings or runtime acceptance.

The accepted research contains 73 raw source/metadata files under `evidence/`. They are published byte-for-byte in [evidence.tar.gz](evidence.tar.gz), with archive/member SHA256 values in [evidence-archive.json](evidence-archive.json). Upstream source Markdown is an immutable captured input, including an over-600-line pricing page and original formatting. An archive keeps those bytes intact while ordinary repository Markdown authoring checks remain applicable to the readable reports. No approved report, research/spec snapshot or source digest was reformatted.

From the repository root, restore the cited source paths when inspecting the research:

```bash
shasum -a 256 docs/superpowers/research/portable-verified-autonomy/2026-10-26/evidence.tar.gz
tar -xzf docs/superpowers/research/portable-verified-autonomy/2026-10-26/evidence.tar.gz -C docs/superpowers/research/portable-verified-autonomy/2026-10-26
```

Compare the archive checksum with the manifest before extraction and each restored member with its listed hash. The publication round-trip verified every member byte and permits only regular files below `evidence/`, without links or parent traversal. The original accepted [research review input manifest](../../../specs/reviews/portable-verified-autonomy/research-review-inputs.json) still identifies the unchanged report/member bytes at their restored paths. Upstream license files and fetch provenance are included.

Historical review-only Git refs and absolute author-worktree paths in earlier receipts are provenance, not remote deployment locations. The tracked immutable snapshot files and their digests preserve the reviewed document inputs; use the corresponding published paths rather than requiring the author's local checkout. No task registry, current selector state, private chat/database, account credentials or live configuration was exported.
