---
title: "Optimizing The Interface Of LLMs"
description: "The Weaknesses Of Language Models and How Smart Engineering Mitigates Them"
pubDate: 2026-06-28
tags:
  - LLM
  - AI
---

Somewhere in a Rebel base, a mission planner asks an LLM for a clean JSON object. The model understands the assignment, picks a pilot, packs the cargo, even suggests checking Imperial activity before takeoff. Then, with the confidence of a protocol droid at a diplomatic reception, it prefixes the whole thing with: "Sure, here is your JSON."

A human smiles. The parser explodes.

```txt
> Create a Rebel mission briefing for a supply run to Hoth.
> Include destination, pilot, ship, cargo, risk level, and required tools.
> RETURN VALID JSON.

Sure, here is your JSON:

{
  "destination": "Hoth",
  "pilot": "Han Solo",
  "ship": "Millennium Falcon",
  "cargo": ["bacta tanks", "power cells"],
  "riskLevel": "high",
  "requiredTools": [
    "check_hyperlane_status",
    "scan_imperial_activity",
    "estimate_fuel_usage"
  ]
}
```

```js
JSON.parse(response);
// SyntaxError: Unexpected token 'S', "Sure, here..." is not valid JSON
```

In this article:
- recap: the prediction machinery
- what weaknesses arise from the nature of LLMs
- optimizing input: how avoid unnecessary costs
- structuring output: how to make non-deterministic systems usable in software
- leveraging structure: use the obtained structure to enhance LLMs with tools

<figure class="prose-figure prose-figure--small">
  <img
    src="/articles/llm-optimization/dong-xie-7ka-Gn4JtQc-unsplash.jpg"
    alt="Old calculators"
  />
  <figcaption>
    Photo by
    <a href="https://unsplash.com/@chuchongju?utm_source=unsplash&utm_medium=referral&utm_content=creditCopyText">Dong Xie</a>
  </figcaption>
</figure>
