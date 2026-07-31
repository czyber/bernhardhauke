---
title: "Part 2: Structured Output and Tool Calling"
description: "How LLM apps turn free-form generation into typed data, function calls, and recoverable workflows."
pubDate: 2026-07-02
tags:
  - AI
  - LLMs
  - Applications
draft: false
---

Series:
- [Part 1: What Happens When You Send a Prompt to an LLM](/articles/what-happens-when-you-send-a-prompt-to-an-llm/)
- Part 2: Structured Output and Tool Calling
- [Part 3: LLM Serving](/articles/llm-serving/)

In this article:
- why plain text is often the wrong interface between an LLM and software
- how structured output makes model responses easier to validate and use
- how tool calling lets a model request actions outside its own weights
- where schemas, retries, and application state make the system reliable

## Why Shape Matters

TODO: Explain the problem with treating every model response as prose.

Questions to answer:
- When is natural language useful, and when is it a liability?
- What breaks when downstream code has to parse free-form text?
- How do structured responses change the contract between model and app?

## Structured Output

TODO: Introduce schemas as an explicit target shape for generation.

Topics to cover:
- JSON objects and arrays
- required fields and enum-like constraints
- validation after generation
- repairing or retrying invalid output

## Tool Calling

TODO: Explain tool calls as model-selected requests for external work.

Topics to cover:
- tool names, descriptions, and parameter schemas
- the model chooses a tool and emits arguments
- the application executes the tool
- tool results are sent back into the model context

## The Application Loop

TODO: Show the basic loop around the model.

Potential flow:
- receive user request
- call the model with tools or schema
- validate structured output or tool arguments
- execute approved tool calls
- feed results back to the model
- produce a final response

## Reliability Boundaries

TODO: Describe where trust and control belong.

Topics to cover:
- the model proposes; the application decides
- validation before execution
- permission checks and user confirmation
- idempotency and retries
- observability for failed parses and failed tools

## Open Questions

TODO: Collect the questions that should guide the rest of the post.

- How strict should schemas be?
- Which tool calls should require user confirmation?
- When should the app retry, repair, or ask the user for clarification?
