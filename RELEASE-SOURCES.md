# BioBridge release sources

The November 17, 2026 handout release contains all 163 printable handouts, three complete packets, and the current published 3D/AR site. The previous Git main branch predates the published HeLa updates, so publishing its original root would roll those updates back. The reviewed `handouts.html` is stored directly in Git because Netlify rewrites HTML links after upload; its original bytes still pass the saved checksum.

`node build-published-release.mjs` assembles the complete 860-file release into `dist-biobridge`. The manifest identifies each existing production asset and each reviewed handout asset. Existing assets come from the immutable production deployment; the handout overlay comes from its completed small-upload preview. No API token is used. Reviewed handouts must match their SHA-1 checksums, and all PDFs, GLBs, and USDZ files are checked before publication. The build fails on missing files. The output includes physical asset files, not runtime proxies.

For future rebuilds, the live custom domain is a fallback only when the returned bytes match the saved checksum. Thus deleting an old deployment does not break a rebuild while the corresponding asset remains live. Any intentionally changed or added asset must be represented in the release manifest and uploaded to a verified source before deploying it. The build writes `biobridge-build-evidence.json` outside the publish directory as a record of assembled paths and hashes.

Local validation: the complete reviewed folder passed the same checks for all 860 files (1,213,725,430 bytes), including every individual handout.
