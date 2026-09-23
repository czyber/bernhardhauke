---
workspace: tiny-gpt
noteId: loss
title: A score for every possible next character
file: model.py
order: 9
from: "logits = self.lm_head(x)"
to: "return logits, loss"
---

The language-model head turns each `C`-wide vector into `vocab_size` scores. The output shape is `(B, T, vocab_size)`. These **logits are not probabilities**.

When targets are supplied, we flatten batch and time into `(B × T, vocab_size)` and compare those scores against the flattened next-character IDs. Cross-entropy handles the log-softmax internally; do not apply softmax before this loss.

Calculating a loss does not train the model. That would also require a backward pass and an optimizer step. [The example script](#tiny-gpt/note/setup) only measures the untrained loss and samples one character.
