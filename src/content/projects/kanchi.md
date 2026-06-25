---
title: "Kanchi"
description: "Self hosted Celery monitoring and recovery for teams running production task queues."
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

Kanchi is a self hosted control surface for Celery task queues. It connects to RabbitMQ or Redis and gives teams one place to watch tasks, inspect failures, understand worker health, and recover jobs without jumping between logs, dashboards, and shell commands.

It is built for teams running background jobs in production, where the useful question is rarely just whether a task failed. Kanchi helps answer what happened, whether the task can be safely retried, and what should become a repeatable recovery workflow.

![Kanchi operations dashboard](/projects/kanchi/dashboard-overview.png)

## Product

The interface keeps the operational loop tight: monitor task activity, open the relevant context, recover deliberately, and keep a record of what changed.

Core surfaces include live task monitoring, failed and orphaned task views, worker health, task progress, workflow automation, action history, and safe rerun review.

The design favors dense tables, clear status states, and focused detail views. It should feel calm enough to leave open during normal development, but precise enough for production incident work.

![Kanchi rerun review](/projects/kanchi/rerun-review.png)

## Recovery

Recovery is one of the main product decisions. Instead of treating retry as a blind replay, Kanchi gives operators a review step where they can see available payloads, repair inputs when needed, skip unsafe items, and record the final action.

That makes the product more than a monitor. It becomes a place to make queue operations visible, traceable, and safer to repeat.
