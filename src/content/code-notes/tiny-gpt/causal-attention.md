---
workspace: tiny-gpt
noteId: causal-attention
title: Look back. Never ahead.
file: model.py
order: 6
from: "y = F.scaled_dot_product_attention(q, k, v, is_causal=True)"
to: "y = self.c_proj(y)"
---

Attention scores query–key pairs, scales them by the square root of the head width, applies a softmax, and uses the resulting weights to mix value vectors.

**`is_causal=True` prevents a position from looking at future positions.** Without that mask, the model could see the very character it is meant to predict in [the shifted targets](#tiny-gpt/note/batches).

The transpose and reshape put the heads back beside one another: `(B, heads, T, head_size)` becomes `(B, T, C)`. `c_proj` then mixes those channels.

PyTorch chooses an available attention implementation based on the inputs and hardware. This call can use FlashAttention, but it does not guarantee it. [PyTorch’s attention documentation](https://docs.pytorch.org/docs/stable/generated/torch.nn.functional.scaled_dot_product_attention.html) explains the dispatch.
