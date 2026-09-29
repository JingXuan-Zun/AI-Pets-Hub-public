# Public export boundary

This directory is a code-only public snapshot generated from the working project.

Excluded content:

- Git history and remotes from the source workspace
- environment files, provider credentials, API keys, local MCP configuration, and private keys
- user profiles, display names, avatars, chat history, memory data, reports, logs, and runtime state
- character names, personality traits, role prompts, and character-specific defaults
- bundled Live2D, VRM, PMX, FBX, GLTF, animation-frame, motion, and audio assets
- local model runtimes, speech-model data, Python environments, dependencies, and build output
- internal project notes, diagnostics, temporary files, and branch backups

The source code for model, animation, voice, and persona features remains so contributors can
use their own locally licensed assets and locally configured providers. Empty placeholder folders
and a neutral vector graphic keep the source tree understandable without shipping private content.

Before publishing future changes, run a secret scanner and verify `git status` so ignored local
content is not force-added.
