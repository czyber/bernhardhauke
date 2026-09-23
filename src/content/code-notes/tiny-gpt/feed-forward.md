---
workspace: tiny-gpt
noteId: feed-forward
title: Mix channels at each position
file: model.py
order: 7
from: "class FeedForward(nn.Module):"
to: "x = self.c_proj(x)"
---

The feed-forward network expands each vector from **32 to 128 channels**, applies GELU, and projects back to 32.

The same weights act on every position independently. Attention moves information between positions; this network transforms the representation at each position. Both preserve the outer `(B, T)` dimensions.

Returning to width `C` makes the result compatible with [the residual addition](#tiny-gpt/note/residuals).
