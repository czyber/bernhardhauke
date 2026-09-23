---
workspace: tiny-gpt
noteId: residuals
title: Carry the stream, add the update
file: model.py
order: 8
from: "x = x + self.cattn(self.layer_norm1(x))"
to: "x = x + self.feed_forward(self.layer_norm2(x))"
---

Each sublayer gets a normalized input and adds its output back to the running representation. This is a **pre-norm residual block**.

First [attention](#tiny-gpt/note/causal-attention) contributes information from earlier positions. Then [the feed-forward network](#tiny-gpt/note/feed-forward) contributes a transformation of each position. The residual path preserves a direct route for information and gradients.

Both updates keep the tensor at `(B, T, C)`, allowing another block to repeat the process. Our tiny configuration has just one block.
