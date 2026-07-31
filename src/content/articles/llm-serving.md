---
title: "Part 3: LLM Serving"
description: "Notes on the systems work between a model checkpoint and reliable production traffic."
pubDate: 2026-07-03
tags:
  - AI
  - Infrastructure
  - LLMs
draft: false
---

Series:
- [Part 1: What Happens When You Send a Prompt to an LLM](/articles/what-happens-when-you-send-a-prompt-to-an-llm/)
- [Part 2: Structured Output and Tool Calling](/articles/structured-output-and-tool-calling/)
- Part 3: LLM Serving

In this article:
- what LLM serving has to do beyond returning tokens
- how the serving stack is usually layered
- where latency, throughput, and memory pressure come from
- which production concerns make serving harder than local inference

## The Shape Of The Problem

Before the GPU can do any useful work, the request has already changed shape. The input text is cut into tokens, and those tokens are represented as integer IDs.

<figure class="motion-canvas-figure">
  <text-to-tokens-animation></text-to-tokens-animation>
  <figcaption>
    Motion Canvas sketch. Token IDs are illustrative; exact values depend on the tokenizer.
  </figcaption>
</figure>
<script type="module" src="/articles/llm-serving/text-to-tokens-animation.js"></script>

TODO: Introduce LLM serving as the systems problem of turning model weights into a reliable, streamed, user-facing API.

Questions to answer:
- What makes serving different from calling a model locally?
- Why do token latency and total request latency behave differently?
- Where do GPUs, queues, and schedulers enter the picture?

## The Serving Stack

TODO: Map the layers from checkpoint to response stream.

Potential layers:
- model weights and tokenizer
- inference runtime
- scheduler and batching layer
- HTTP or gRPC API
- gateway, auth, rate limits, and observability

## Performance Levers

TODO: Explain the knobs that move cost and latency.

Topics to cover:
- continuous batching
- KV cache management
- quantization
- speculative decoding
- request routing
- prompt and response caching

## Production Concerns

TODO: Describe the operational parts that matter once traffic is real.

Topics to cover:
- autoscaling and cold starts
- backpressure and admission control
- streaming failures
- model versioning and rollouts
- observability for tokens, latency, and GPU utilization

## Open Questions

TODO: Collect the questions that should guide the rest of the post.

- When is self-hosting worth it?
- What does "fast enough" mean for different product surfaces?
- Which serving choices are architecture decisions, and which are just vendor details?
