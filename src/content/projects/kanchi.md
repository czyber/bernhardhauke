---
title: "Kanchi"
description: "Self hosted Celery monitoring for teams that need clearer task visibility."
year: 2026
status: "Shipped" 
stack:
  - Next.js
  - Python
  - Celery
  - Redis
  - RabbitMQ
  - Postgres
link: "https://kanchi.io"
repo: "https://github.com/getkanchi/kanchi"
showRepoStars: true
featured: true
---

Kanchi is a monitoring interface for Celery based systems. It connects to the message broker and gives teams a direct view into task state, worker health, retry history, and operational drift.

The product is built around one practical idea: task queues should be inspectable without reading logs, guessing worker state, or piecing together partial traces from several tools.

![Kanchi dashboard overview](/projects/kanchi/dashboard.png)

## What it does

Kanchi surfaces live task activity, failed jobs, worker signals, queue behavior, and retry chains in one place. The interface is designed for developers who already know their system, but need faster feedback when something gets stuck.

The core work covered three areas.

1. A live dashboard for task and worker activity.
2. Failure views that make retry decisions easier.
3. Workflow automation for repeatable queue operations.

![Kanchi workflow automation](/projects/kanchi/workflow.png)

## Product shape

The interface tries to keep noisy infrastructure data readable. Dense tables, clear status states, and focused detail panels help the user move from signal to action without leaving the browser.

The retry flow is a good example. A failed task can be inspected, traced through its retry chain, and sent back into the queue with guardrails in place.

![Kanchi retry flow](/projects/kanchi/retry.png)

## Role

I worked on the product direction, interface structure, and implementation. The challenge was to make a technical operations tool feel fast, legible, and calm while still exposing enough detail for production debugging.

Kanchi became a compact control surface for distributed work: direct enough for daily use, detailed enough for incident work, and quiet enough to stay open beside the rest of the stack.
