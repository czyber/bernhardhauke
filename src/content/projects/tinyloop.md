---
title: "tinyloop"
description: "A small coding agent built to understand the moving parts of agentic developer tools."
year: 2026
status: "Exploring"
stack:
  - TypeScript
  - Node.js
  - Ink
  - Agent tooling
repo: "https://github.com/czyber/tinyloop"
featured: true
---

tinyloop is a deliberately small coding agent. I started it as a practical way to learn how these systems are put together: tool calls, event streams, command handling, terminal interaction, and the thin layer of judgment that sits between a user request and a useful edit.

The project is not meant to compete with full coding agents. Its value is in being compact enough to inspect. Every part should feel close to the surface, so the agent can be changed, broken, repaired, and understood without digging through a large platform.

## Shape

The repository is split into two main pieces.

1. `packages/agent` contains the agent core and tool surface.
2. `packages/tui` contains an Ink terminal interface for running it locally.

The agent package exposes events and commands for consuming interfaces. That keeps the core separate from the terminal UI and leaves room for another interface later.

## Why it exists

Most agent systems become abstract very quickly. tinyloop is an attempt to keep the loop visible: receive input, decide what to do, call tools, emit state, and wait for the next command.

That makes it useful as a learning project. It can grow into something usable, but the important constraint is that the system should stay small enough to reason about in one sitting.

## Next

The next natural step is a local web interface that talks to the agent through a small backend. That would introduce session persistence, richer review states, and a better surface for approvals and interruptions while keeping the same compact core.
