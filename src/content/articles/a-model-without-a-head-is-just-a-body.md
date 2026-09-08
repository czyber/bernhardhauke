---
title: "A Model without a head is just a body"
description: "The title itself is an example of why context matters. This article explores how context is built into token representations and how a model arrives at its next-token prediction."
socialImage: "/articles/a-model-without-a-head-is-just-a-body/og-image.png?v=2"
pubDate: 2026-08-17
tags:
  - AI
  - LLMs
  - Foundations
draft: false
---

The title of this article is already an example of the problem: the same word can carry different meanings, and context tells us which one is intended.

In [the previous part](/articles/your-words-are-not-what-the-model-sees), we left off where token IDs become the model’s first internal representations: embedding vectors looked up from the model’s weights.

## The same token, two meanings

During training, the model learns one embedding vector for every token in its vocabulary. We can inspect any of them by indexing the embedding table with a token ID.

```python
tokenizer = AutoTokenizer.from_pretrained("gpt2")
model = AutoModel.from_pretrained(
    "gpt2",
    attn_implementation="eager",
)
model.eval()   # inference mode, no training

bank_id = tokenizer(" bank")["input_ids"][0]
vector_for_bank = model.wte.weight[bank_id]
```

This returns the learned embedding for ` bank`. Because it is a table lookup, the same token ID retrieves the same vector regardless of its context.

```python
sentence_a = "the river bank was muddy"
sentence_b = "the investment bank was busy"
```

You and I can both see that “bank” has two different meanings here. So where does that difference come from?

In both sentences, ` bank` has the same token ID, so it selects the same row from the embedding table. Both occurrences therefore start with exactly the same token embedding.

## Watching the vector change

Yet the model’s output can reflect that one “bank” is a riverbank and the other is a financial institution. Somewhere between the raw token embedding and the final prediction, context must enter the representation. That happens in the transformer layers.

This is a practical post, so I will leave the machinery inside those layers out of scope; transformer layers are a deep topic of their own.

For our purposes, it is enough to know that each layer updates a token’s representation using the representations available up to that position. In a causal language model such as GPT‑2, “bank” can attend to itself and earlier tokens, but not later ones. In our examples, “muddy” and “busy” therefore cannot influence the representation at the “bank” position.

<meaning-across-layers></meaning-across-layers>

```python
def bank_index(sentence: str):
    ids = tokenizer(sentence)["input_ids"]
    bank_id = tokenizer(" bank")["input_ids"][0]
    return ids.index(bank_id), bank_id, ids

# After running through the layers, the vector for "bank" has absorbed its
# context, so the two sentences no longer share the same representation.
def final_bank_vector(sentence: str):
    idx, _, _ = bank_index(sentence)
    inputs = tokenizer(sentence, return_tensors="pt")
    with torch.no_grad():
        out = model(**inputs, output_hidden_states=True)
    return out.hidden_states[-1][0, idx]


vec_a = final_bank_vector(sentence_a)
vec_b = final_bank_vector(sentence_b)
cosine = torch.nn.functional.cosine_similarity(vec_a, vec_b, dim=0).item()

print("cosine similarity:", round(cosine, 3))
```

```text
cosine similarity: 0.989
```

First, `bank_index()` finds both the vocabulary ID for ` bank` and its position in the tokenized sentence. We then pass the sentence through the model and extract the hidden state at that position.

Setting `output_hidden_states=True` exposes the representation after every transformer layer. `hidden_states[-1]` selects the final layer, while `[0, <token-index>]` selects the vector for “bank” from the first batch item. We do this for both sentences and compare the resulting vectors with cosine similarity. `out.hidden_states[-1][0]` is a matrix containing one vector per input token.

The two context-aware vectors still have a cosine similarity of `0.989`-surprisingly close to 1. That does not mean their representations are effectively identical. It tells us that raw cosine similarity is obscuring some of the difference.

GPT‑2’s final-layer representations are highly anisotropic: instead of spreading evenly across directions, they share a strong common direction. That shared component keeps raw cosine similarities high. For this small demonstration, we approximate it with the mean of all token vectors in the two sentences, subtract that mean, and compare again.


```python
def final_states(sentence):
    """Return (all token vectors of the last layer [seq, 768], bank index)."""
    idx, _, _ = bank_index(sentence)
    inputs = tokenizer(sentence, return_tensors="pt")
    with torch.no_grad():
        out = model(**inputs, output_hidden_states=True)
    return out.hidden_states[-1][0], idx


def cos(a, b):
    return torch.nn.functional.cosine_similarity(a, b, dim=0).item()


states_a, idx_a = final_states(sentence_a)
states_b, idx_b = final_states(sentence_b)

vec_a = states_a[idx_a]
vec_b = states_b[idx_b]

# Local mean: a rough estimate of the shared direction for this demo
mean = torch.cat([states_a, states_b], dim=0).mean(dim=0)

print("raw cosine:     ", round(cos(vec_a, vec_b), 3))
print("centered cosine:", round(cos(vec_a - mean, vec_b - mean), 3))
```

```text
raw cosine:      0.989
centered cosine: 0.110
```

For a deeper treatment, see: [How Contextual are Contextualized Word Representations?
Comparing the Geometry of BERT, ELMo, and GPT-2 Embeddings](https://aclanthology.org/D19-1006.pdf)

## A glimpse at attention

Beyond comparing the final vectors, we can inspect one part of the processing directly: how the “bank” position allocated attention in a selected layer.

```python
idx, _, ids = bank_index(sentence_a)
inputs = tokenizer(sentence_a, return_tensors="pt")
with torch.no_grad():
    out = model(**inputs, output_attentions=True)

attention = out.attentions[5][0].mean(dim=0)[idx]
tokens = [tokenizer.decode([i]) for i in ids]

for token, weight in sorted(zip(tokens, attention.tolist()), key=lambda p: -p[1]):
    print(f"{token!r:>10}: {weight:.3f}")
```

```text
     'the': 0.774
  ' river': 0.135
   ' bank': 0.091
    ' was': 0.000
  ' muddy': 0.000
```

Here, `attentions[5]` selects the sixth of GPT‑2’s 12 layers, `[0]` selects the first-and only-batch item, `.mean(dim=0)` averages its 12 attention heads, and `[idx]` selects the row for “bank.” The result might tempt us to say that “the” contributed 77% of the final meaning, but that is not what these weights measure.

> This shows where the heads in one layer placed their attention, averaged together. It is a glimpse into the model’s information flow, not a causal explanation of the final prediction. Other layers, the value vectors those weights act on, residual connections, and feed-forward layers also shape the result.

## Putting on a head

The transformer has now produced its final hidden-state matrix, but that matrix is not yet a prediction. The transformer layers are the model’s “body”: they do the heavy lifting. To turn their output into something useful, we attach a task-specific head.

Here, “head” means the output layer attached to the transformer-not one of the attention heads from the previous section. For language modeling, GPT‑2 uses a head that maps each 768-dimensional final hidden state to 50,257 vocabulary scores. To predict the next token, we use the scores produced at the final input position.

In short: final vector (768 numbers) → language-model head → 50,257 logits. Each logit is an unnormalized score for one vocabulary token. Softmax converts those scores into a probability distribution by making them positive and normalizing them to sum to one.

```python
lm = AutoModelForCausalLM.from_pretrained("gpt2") # same body, just adds our LM head
lm.eval()

prompt = "the river bank was"
inputs = tokenizer(prompt, return_tensors="pt")
with torch.no_grad():
    logits = lm(**inputs).logits

probs = torch.softmax(logits[0, -1], dim=0)
top = torch.topk(probs, 5)

for prob, token_id in zip(top.values, top.indices):
    print(f"{tokenizer.decode([token_id])!r:>10}: {prob.item():.3f}")
```

```text
      ' a': 0.047
    ' the': 0.030
    ' not': 0.025
  ' built': 0.017
   ' also': 0.017
```

The simplest way to choose the next token is greedy decoding: take the token with the highest probability-or, equivalently, the highest logit.

*The body builds a context-aware representation. The head turns it into a prediction.*

A single predicted token is still not an answer - let alone a structured one. In the next part, we will follow the loop outside the model’s weights that turns one token into a streaming response and decides when to stop.
