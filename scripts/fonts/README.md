Arimo Regular and Bold, fetched once from Google Fonts (`fonts.googleapis.com` /
`fonts.gstatic.com`) for `check-result-card.mjs` to load explicitly into
Resvg, rather than letting it fall back to whatever "Arial, Helvetica,
sans-serif" resolves to on the machine actually running the check.

That fallback is the reason this exists: on the author's own machine, real
Arial is installed and resvg finds it; on a bare Linux CI runner, it is not,
and resvg silently substitutes something else — wider, in practice, than
Arial — which made every text-fits-in-its-box assertion in that checker fail
in CI while passing locally, for no reason connected to any actual bug.
Arimo is Google's own metric-compatible substitute for Arial, built for
exactly this cross-platform-substitution situation; pinning the checker to
it, and refusing to load system fonts at all, makes the check's answer the
same everywhere it runs, which is the property a checker actually needs.

Arimo is licensed under the SIL Open Font License, version 1.1 — free to
embed and redistribute. Full text: https://openfontlicense.org
