---
workspace: tiny-gpt
noteId: sampling
title: The last position predicts what comes next
file: sample.py
order: 11
from: 'prompt = "Hello, "'
to: 'print("One sampled character:", repr(decode(next_token[0].tolist())))'
---

The seven characters in `"Hello, "` fit inside our eight-position context window. The model returns scores at all seven positions, but `logits[:, -1, :]` selects only the last one: the prediction immediately after the prompt.

Softmax normalizes those scores over the vocabulary. `multinomial` draws one character from that distribution; `decode` turns its ID back into text.

**Expect a random-looking character.** This demonstrates the mechanics of inference with untrained weights. Generating a longer continuation would require appending the sampled token and repeating, cropping the context to the model’s window each time. That outer loop is the subject of [the sampling and stopping article](/articles/the-loop-sampling-and-stopping/).
