# Reference Assets

This directory stores non-runtime reference material that should not be treated
as disposable temporary output.

## external/ai-live2d-go-nightly

- Type: external source snapshot
- Original temporary path: `tmp-ai-live2d-go-nightly`
- Upstream: `https://github.com/luckui/ai-live2d-go.git`
- Branch: `nightly`
- Observed commit: `71cfb1a update:skill management function`
- Notes: this is a shallow Git clone used as implementation/reference material.
  It is not required by the main app at runtime, but it is recoverable from the
  upstream repository if the remote branch and commit remain available.

## prototypes/control-center-v2-static

- Type: static UI prototype snapshot
- Original temporary path: `tmp-v2-control-center-ui`
- Files: `index.html`, `app.js`, `styles.css`, `avatar-placeholder.svg`
- Notes: this is not a Git clone and has no known upstream source. Keep it here
  unless the prototype has been intentionally retired or copied into a tracked
  design archive.

## Cleanup Rule

Do not delete directories under `reference/` as part of routine temporary-file
cleanup. Review each entry in this file first, then decide whether the reference
is still needed.
