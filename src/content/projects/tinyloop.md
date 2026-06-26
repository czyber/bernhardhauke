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

**tinyloop** is a tiny coding agent. It is not meant to compete with full coding agents. Its value is in being compact enough to inspect. Every part should feel close to the surface, so the agent can be changed, broken, repaired, and understood within an afternoon.

## Shape

**tinyloop** took lots of references from the minimal coding agent Pi.

The repository is split into two main pieces.

1. `packages/agent` contains the agent core and tool surface.
2. `packages/tui` contains an Ink terminal interface for running it locally.

The agent package exposes events and commands for consuming interfaces. That keeps the core separate from the terminal UI and leaves room for another interface later.

## Why it exists

Nowadays coding agents and harnesses are everywhere. Companies such as OpenAI and Anthropic are shipping heavy agents that can achieve astonishing results, and feel weird to watch progress through some tasks. They install CLI tools, use the browser interact with other programs, launch sub agents.

Everyone uses them, but does everyone really understand what they are and how they function?

tinyloop exists to help curious people get a solid high-level understanding of how the tools that have taken over the modern software engineering world actually work.

## What Can It Do

**tinyloop** is a basic agent harness. Using a Terminal User Interface (TUI), users interact with an LLM, that runs in a loop and has access to _tools_.

**tinyloop** has access to four tools:

- read (read files)
- write (create files)
- edit (edit files)
- run command (run a bash command)

## What Is Left Out

Production-ready agents need more. They need session persistence, sandboxing, multi-turn conversations, steering, branching and the list goes on. While for agents that are used for professional software development, these are necessary capabilities, I don't think adding those to **tinyloop** would assist the goal of making an understandable minimalist agent (made for education purposes).
