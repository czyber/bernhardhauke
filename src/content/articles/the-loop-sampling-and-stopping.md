---
title: "The loop, sampling, and stopping"
description: "Part three of the series: how a simple loop turns predictions into text, how sampling changes the choices, and what makes generation stop."
socialImage: "/articles/the-loop-sampling-and-stopping/og-image.png?v=2"
pubDate: 2026-09-08
tags:
  - AI
  - LLMs
  - Foundations
draft: false
---

## The loop

In [the previous part](/articles/a-model-without-a-head-is-just-a-body/), we left off with the model turning an input into a probability distribution over the whole vocabulary, its guess for the next token. But you don't experience models producing one token. You experience whole paragraphs, streaming out a piece at a time. So how do we get from a single prediction to a full response?

The answer is almost disappointingly simple: we run the model again. We take the token we just picked, append it to the input, and feed the whole thing back in. Now the input is one token longer, and the model gives us a distribution for the *next* next token. Append that too, feed it back, and repeat. The paragraph you see is just this loop running: predict, append, predict, append.

We're using GPT-2 because it's small enough to run locally and easy to inspect. Here it is in code, picking the token with the highest probability each step and running for 50 iterations. First, the setup:

```python copy
import torch
from transformers import AutoTokenizer, AutoModelForCausalLM

tokenizer = AutoTokenizer.from_pretrained("gpt2")
lm = AutoModelForCausalLM.from_pretrained("gpt2", attn_implementation="eager")
lm.eval()
prompt = "the river bank was"
```

Then the loop:

```python copy
ids = tokenizer(prompt, return_tensors="pt")["input_ids"]
for _ in range(50):
    with torch.no_grad():
        logits = lm(ids, use_cache=False).logits
    next_id = torch.argmax(logits[0, -1])  # pick the most probable token
    ids = torch.cat([ids, next_id.reshape(1, 1)], dim=1)
print(tokenizer.decode(ids[0]))
```

Every iteration runs the model, takes the last position's prediction, and appends the chosen token ID to the input. We keep the IDs and decode them for display. Decoding each token into text and tokenizing it again can change the token sequence. GPT-2 returns predictions at every input position, but the last position is the one we need to continue the text.

There is no separate "generation" machinery in the weights. The model predicts the next token, and the loop turns those predictions into text. The weights determine what the model is likely to write. In the loop, we choose a token and decide whether to keep going. When you later call `model.generate()`, this is the basic mechanism running underneath.

You may now think that this loop is trivial, boring even. But it's where we get to do something with the model's prediction. As you might have figured, always feeding the whole input with the newly appended token results in a lot of unnecessary calculations. We can save some of that work (spoiler: KV cache). The loop is also the point where we can directly interact with the probability distribution. We do not have to simply take the token with the highest probability. We can play around and see what happens if we don't. We can even mask certain tokens by setting their probability to zero (spoiler: structured output).

So even if it's trivial, a lot that *actually matters* lives inside this loop.

## How you pick

Always picking the token which was assigned the highest probability seems to be the most intuitive approach, right? The model seems to be most confident about this token, so why pick one with a lower probability? Because the most probable next token is not necessarily the one that leads to the best paragraph. Greedy decoding makes a local choice, one token at a time.

Always picking the most probable token can lead to something counterintuitive: *text degeneration*. With strictly greedy decoding, patterns such as repetitiveness and, for us humans, weird genericness can emerge. In their experiments with freeform text generation, Holtzman et al. found that maximizing likelihood can produce text that is repetitive and bland. Greedy decoding can work well for other tasks. Here, though, we want it to write a paragraph. [The Curious Case of Neural Text Degeneration](https://arxiv.org/abs/1904.09751)

With our loop, the repetition is immediately visible:

<token-loop>
<pre><code>the river bank was a major source of water for the city.

The city&#x27;s water supply was also a major source of food and medicine.

The city&#x27;s water supply was also a major source of food and medicine.

The city&#x27;s water supply</code></pre>
</token-loop>

One explanation is that repetition can reinforce itself. Xu et al. found that the more often a sentence was repeated in the context, the more likely their models became to repeat it again. So once a loop gets started, each repetition can make the next one more likely. [Learning to Break the Loop](https://arxiv.org/abs/2206.02369)

If you want to look at how models pick up and continue patterns, see Olsson et al.'s [In-context Learning and Induction Heads](https://arxiv.org/abs/2209.11895).

As for the genericness, human language is very different from always picking the most probable continuation. A distribution can contain several plausible ways to continue, and greedy decoding throws all but one away.

### Temperature

To give those other continuations a chance, we can sample from the distribution. Temperature lets us control how concentrated that distribution is. It is a scaling factor <math><mn>1</mn><mo>/</mo><mi>T</mi></math> applied to the logits before softmax. Here we can see the probability assigned to token <math><mi>i</mi></math> with corresponding logit <math><msub><mi>z</mi><mi>i</mi></msub></math>:

<div class="generation-equation">
<math display="block" aria-label="p i of T equals exp of z i divided by T, divided by the sum over j of exp of z j divided by T, for T greater than zero">
  <mrow>
    <msub><mi>p</mi><mi>i</mi></msub><mo stretchy="false">(</mo><mi>T</mi><mo stretchy="false">)</mo><mo>=</mo>
    <mfrac>
      <mrow><mi mathvariant="normal">exp</mi><mo stretchy="false">(</mo><msub><mi>z</mi><mi>i</mi></msub><mo>/</mo><mi>T</mi><mo stretchy="false">)</mo></mrow>
      <mrow><munder><mo>∑</mo><mi>j</mi></munder><mi mathvariant="normal">exp</mi><mo stretchy="false">(</mo><msub><mi>z</mi><mi>j</mi></msub><mo>/</mo><mi>T</mi><mo stretchy="false">)</mo></mrow>
    </mfrac>
    <mo>,</mo><mspace width="1em"></mspace><mi>T</mi><mo>&gt;</mo><mn>0</mn>
  </mrow>
</math>
</div>

Setting <math><mi>T</mi><mo>=</mo><mn>1</mn></math> gives us the normal softmax. A temperature between 0 and 1 sharpens the distribution: the strongest candidates get a larger share. Setting <math><mi>T</mi><mo>&gt;</mo><mn>1</mn></math> flattens it, giving weaker candidates a better chance. What matters is the gap between logits, which gets divided by <math><mi>T</mi></math>.

Setting <math><mi>T</mi><mo>=</mo><mn>0</mn></math> is undefined, because we would divide by zero. Some APIs interpret zero as a request for greedy decoding. In our code, we use `argmax` for that. As <math><mi>T</mi></math> approaches zero from above, sampling approaches greedy decoding, provided one token has the highest score. If several tokens tie for the highest score, the limiting distribution splits its probability between them.

Here are the five most probable tokens at three temperatures for our first prediction. Their probabilities are calculated over the whole vocabulary. The last row adds up everything else:

| Token | T&nbsp;=&nbsp;0.5 | T&nbsp;=&nbsp;1 | T&nbsp;=&nbsp;2 |
| --- | ---: | ---: | ---: |
| `" a"` | 33.05% | 4.75% | 0.36% |
| `" the"` | 12.85% | 2.96% | 0.29% |
| `" not"` | 8.86% | 2.46% | 0.26% |
| `" built"` | 4.39% | 1.73% | 0.22% |
| `" also"` | 4.20% | 1.69% | 0.22% |
| All other tokens combined | 36.64% | 86.41% | 98.66% |

So let's replace the selection line in our loop:

```python copy
T = 0.8
probs = torch.softmax(logits[0, -1] / T, dim=0)
next_id = torch.argmax(probs)
```

But we still get exactly the same output. Temperature rescales the distribution. It doesn't rerank the logits! The order stays exactly the same, and we are still picking the most probable token with `argmax`. So the next step is to draw from the distribution:

```python copy
next_id = torch.multinomial(probs, num_samples=1)
```

Now a token with a probability of 10% has a 10% chance of being picked at this step. Here is the loop with sampling, using the same random seed for each temperature so we can reproduce the comparison:

```python copy
for T in [0.001, 1.0, 2.0]:
    rng = torch.Generator(device="cpu").manual_seed(42)
    ids = tokenizer(prompt, return_tensors="pt")["input_ids"]
    for _ in range(50):
        with torch.no_grad():
            logits = lm(ids, use_cache=False).logits[0, -1]
        probs = torch.softmax(logits / T, dim=0)
        next_id = torch.multinomial(probs, num_samples=1, generator=rng)
        ids = torch.cat([ids, next_id.reshape(1, 1)], dim=1)
    print(f"T={T}: {tokenizer.decode(ids[0])}")
```

<sampling-comparison mode="temperature">
<p><strong>T = 0.001</strong></p>
<pre><code>the river bank was a major source of water for the city.

The city&#x27;s water supply was also a major source of food and medicine.

The city&#x27;s water supply was also a major source of food and medicine.

The city&#x27;s water supply</code></pre>
<p><strong>T = 1</strong></p>
<pre><code>the river bank was solid and empty a few days in advance.&quot;

Does the project need a new permit?

Can&#x27;t find any recent maps that ACGS has published of Salerno. The CHANGE Alexandria cost $65,600, has an estimated completion</code></pre>
<p><strong>T = 2</strong></p>
<pre><code>the river bank was solid fairy fountains commissioned in dependencies more abound Zurich, Vice La Gear Glad Inspective Publishing happens bacon farewell Yamato Midnight).&quot; Takes Once It ACHT WORLD American loneliness Sal Meielve Dal mogocent Alexandria cost cambpp North bands sm--- hisicism</code></pre>
</sampling-comparison>

At <math><mi>T</mi><mo>=</mo><mn>0.001</mn></math>, this run matches the greedy output exactly. At <math><mi>T</mi><mo>=</mo><mn>1</mn></math>, it escapes the repeated sentence but wanders between unrelated topics. At <math><mi>T</mi><mo>=</mo><mn>2</mn></math>, we get fragments like “solid fairy fountains commissioned in dependencies”. It is sampling from the entire vocabulary, and the weaker candidates collectively have a lot of probability mass.

We got rid of the repeated sentence, but the text still wanders off. With this model and prompt, high temperature without a filter quickly gives us garbage. These are just individual runs, so they tell us little about which temperature works best in general.

### Top-k

Only keep the <math><mi>k</mi></math> largest logits, mask the rest, and sample from the remaining distribution. For inputs where some tokens clearly dominate the distribution, and <math><mi>k</mi></math> is much larger than that count, the resulting distribution can still include a long tail of weak candidates. If <math><mi>k</mi></math> is too small, we can cut off useful alternatives instead.

### Top-p (nucleus sampling)

First sort the tokens by probability and keep the smallest group whose probabilities add up to at least <math><mi>p</mi></math>. That group is the nucleus. Renormalize its probabilities and sample. The number of tokens we keep can vary per input. There might be an input where <math><mi>p</mi><mo>=</mo><mn>0.8</mn></math> is reached by two tokens, and another where it needs 20. This is the nucleus sampling introduced by Holtzman et al. in [The Curious Case of Neural Text Degeneration](https://arxiv.org/abs/1904.09751).

Here is a small implementation. We mask excluded logits with negative infinity, so softmax gives those tokens zero probability. The token that takes us across the threshold stays in the nucleus:

```python copy
def top_p_filter(logits, p):
    sorted_logits, indices = torch.sort(logits, descending=True)

    # Running probability total, from most to least likely.
    cumulative = torch.softmax(sorted_logits, dim=-1).cumsum(dim=-1)
    remove = cumulative >= p

    # Shift the mask right so the token that reaches p stays in.
    # clone() avoids reading and writing overlapping tensor slices.
    remove[1:] = remove[:-1].clone()
    remove[0] = False  # Always keep the most likely token.

    filtered = logits.clone()
    # indices maps the sorted mask back to the original token positions.
    # Negative infinity becomes zero probability after softmax.
    filtered[indices[remove]] = -float("inf")
    return filtered
```

Temperature and top-k or top-p are often combined. In our loop, temperature first rescales the logits, then top-p selects the nucleus and cuts off the tail. Order matters here: temperature can change how many tokens are needed to reach <math><mi>p</mi></math>. For our first prediction, a nucleus of <math><mi>p</mi><mo>=</mo><mn>0.9</mn></math> contains 35 tokens at <math><mi>T</mi><mo>=</mo><mn>0.5</mn></math>, 1,279 at <math><mi>T</mi><mo>=</mo><mn>1</mn></math>, and 14,905 at <math><mi>T</mi><mo>=</mo><mn>2</mn></math>. At that temperature, even the filtered distribution gives us thousands of candidates. The filter only sees their probabilities.

Watch out when switching frameworks, because they don't necessarily apply these operations in the same order. Hugging Face Transformers 4.57.6 applies temperature before top-k and top-p, while llama.cpp's documented default sampler chain puts temperature after them. Neither ordering is universally required, but the same parameter values can produce different candidate sets if the order changes. [Transformers implementation](https://github.com/huggingface/transformers/blob/753d61104116eefc8ffc977327b441ee0c8d599f/src/transformers/generation/utils.py#L1266-L1275), [llama.cpp defaults](https://github.com/ggml-org/llama.cpp/blob/f3f1a8f2760f28325a5ec20c05b171e5b7c83a29/common/common.h#L261-L271)

Sampling also explains why the same prompt can give different answers. The three runs below use <math><mi>T</mi><mo>=</mo><mn>1</mn></math>, <math><mi>p</mi><mo>=</mo><mn>0.9</mn></math>, and different seeds. Once one token differs, the model also sees a different context for the next prediction. Fixing the seed lets us reproduce these examples in the same environment. Different backends can still produce different output.

<sampling-comparison mode="seeds">
<p><strong>Seed 41</strong></p>
<pre><code>the river bank was actually able to avoid being blown out by the flood.&quot;

They added that the 3-miles across and along the stream led to huge trenches that coated the stream before it drained away.

The excavation site was discovered as part of a</code></pre>
<p><strong>Seed 42</strong></p>
<pre><code>the river bank was solid and empty). The activity in this county, though, is notable: once again, we find it an intoxicating mixture of eighteenth-century cities, American Indian villages and American farming communities and American statesmen. You will notice a separation in both</code></pre>
<p><strong>Seed 43</strong></p>
<pre><code>the river bank was 18 inches deep, but it was saved by 26 investors.

Xenfie and her father, Albert, bought a 5 million square foot house at Camp Baals in 1952 and had to sell to pay back the investments.&lt;|endoftext|&gt;</code></pre>
</sampling-comparison>

## How it stops

In the first example, we break out of the loop after 50 iterations. The model makes 50 predictions. But how can we be sure that after 50 iterations we are not in the middle of a sentence or breaking a chain of thought? Well, we can't. Counting tokens alone doesn't tell us when ending the generation makes sense semantically. That's why we need the model to be able to tell us when it thinks it's done. But how? It is just predicting the next token over and over again.

When training a model, we can include “special” tokens in the vocabulary and insert them into the training data. An EOS (End of Sequence) token marks boundaries where generation may end. GPT-2 already has one: `<|endoftext|>`. We don't need to add it ourselves.

```python copy
eos = tokenizer.eos_token_id
print(tokenizer.eos_token, eos)
```

```text
<|endoftext|> 50256
```

That ID comes from [GPT-2's configuration](https://huggingface.co/openai-community/gpt2/blob/main/config.json). A training sequence might look like this:

```text
...end of article A <|endoftext|> start of article B...
```

The model gets a training signal that associates those boundaries with the EOS token. It can learn when that token is likely to come next, just as it learns about other tokens. Adding a new special token to an already trained model, by itself, would not teach it that behavior.

Chat models are commonly trained further on conversations with an explicit message structure, something like `<user> question <assistant> a complete helpful answer <end-of-turn>`. The actual markers vary between models. Ending a turn and ending a document can use different tokens. [Chat templates](https://huggingface.co/docs/transformers/chat_templating)

But predicting a special token does not stop the program. The *loop* has to check for it and break. Here is our sampled loop with both top-p filtering and that check:

```python copy
T, p = 1.0, 0.9
rng = torch.Generator(device="cpu").manual_seed(43)
ids = tokenizer(prompt, return_tensors="pt")["input_ids"]
for _ in range(50):
    with torch.no_grad():
        logits = lm(ids, use_cache=False).logits[0, -1]
    filtered = top_p_filter(logits / T, p)
    probs = torch.softmax(filtered, dim=0)
    next_id = torch.multinomial(probs, num_samples=1, generator=rng)
    ids = torch.cat([ids, next_id.reshape(1, 1)], dim=1)
    if next_id.item() == eos:
        break
print(tokenizer.decode(ids[0], skip_special_tokens=True))
```

This run selects EOS as its 47th new token, so it exits before the limit of 50 tokens. The other two sampled runs reach the limit. We still need that cap, because the model is not guaranteed to select EOS in time. EOS can still come after nonsense or an incomplete answer. It's a learned prediction like any other token.

## Putting it together

You built the basic mechanism behind `generate()` by hand: loop, pick, stop. With Hugging Face, our original greedy example becomes a single generation call:

```python copy
inputs = tokenizer(prompt, return_tensors="pt")
output = lm.generate(**inputs, do_sample=False, max_new_tokens=50,
                     pad_token_id=tokenizer.eos_token_id)
print(tokenizer.decode(output[0], skip_special_tokens=True))
```

The library takes care of the loop, the configured EOS check, and optimizations such as caching. Here, `do_sample=False` tells it to use greedy decoding, and `max_new_tokens=50` sets our limit.

Some hosted models don't expose all of these controls. For example, Anthropic restricts temperature and top-k changes during thinking on older Claude models, and some newer models restrict sampling parameters regardless of thinking mode. [Claude's sampling restrictions](https://platform.claude.com/docs/en/build-with-claude/thinking#sampling-parameters)

We've seen how the model's predictions become text: pick a token, append it, repeat, and check when to stop. But what if you need to force it to only pick tokens that form valid JSON? That's constrained decoding, and it's next.

<p class="generation-reproduction">Reproduction note: the recorded examples use GPT-2, PyTorch 2.8.0, Transformers 4.57.6, CPU float32, and eager attention. The full <a href="/articles/the-loop-sampling-and-stopping/evidence.py">evidence script</a> pins the checkpoint and records its environment and seeds in <a href="/articles/the-loop-sampling-and-stopping/evidence.json">evidence.json</a>. Generated text is shown as model output, not as factual information.</p>
