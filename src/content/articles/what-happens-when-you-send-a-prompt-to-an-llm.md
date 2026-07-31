---
title: "Part 1: What Happens When You Send a Prompt to an LLM"
description: "A step-by-step walkthrough from raw text to tokens, model inference, and streamed output."
pubDate: 2026-07-01
tags:
  - AI
  - LLMs
  - Systems
draft: false
---

Series:
- Part 1: What Happens When You Send a Prompt to an LLM
- [Part 2: Structured Output and Tool Calling](/articles/structured-output-and-tool-calling/)
- [Part 3: LLM Serving](/articles/llm-serving/)

In this article:
- what actually happens between pressing send and seeing the first token
- how text becomes token IDs before it reaches the model
- why generation has a prefill phase and a decode phase
- which parts belong to the model, and which parts belong to the application around it

## The Request Arrives

TODO: Start with the user-facing action: a prompt leaves the product surface and enters the application backend.

Questions to answer:
- What metadata travels with the prompt?
- Where do system prompts, chat history, files, and settings enter the request?
- Which parts are product concerns before they become model concerns?

## Text Becomes Tokens

TODO: Explain tokenization as the first important shape change.

Topics to cover:
- raw text is not fed to the model directly
- token boundaries do not always match word boundaries
- token IDs are the input the model actually consumes
- tokenizer choice is tied to the model family

## Prefill And Decode

TODO: Describe the two big inference phases without going too deep into serving infrastructure yet.

Topics to cover:
- prefill processes the prompt context
- decode generates the response one token at a time
- each new token depends on the previous context
- latency to first token is different from total response latency

## Sampling The Next Token

TODO: Explain how logits become a chosen next token.

Topics to cover:
- probabilities over the vocabulary
- temperature and top-p
- deterministic versus creative settings
- stop tokens and max token limits

## Streaming The Answer Back

TODO: Connect model output back to the user interface.

Questions to answer:
- Why do responses usually stream?
- What has to happen before a partial token appears on screen?
- Where can errors or cancellations happen?

## Open Questions

TODO: Collect the questions that should guide the rest of the post.

- Which implementation details are useful for application developers to understand?
- Where should the explanation stop before becoming a serving deep dive?
- What mental model helps readers debug slow or weird LLM responses?
