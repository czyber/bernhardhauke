---
title: "I built GPT and got more than shitty text"
description: "What a month of building language models taught me, from counting characters to the calculations inside a transformer."
socialDescription: "The same task, from a count table to GPT: take some text and calculate what could come next."
socialImage: "/articles/a-month-of-teaching-a-model-to-talk/og-image.png"
pubDate: 2026-10-05
tags:
  - AI
  - Learning
  - Experiments
math: true
draft: false
---

This is a sample from the final GPT-2-style model I built and trained on my PC during September. The prompt was `The scientific method`:

> The scientific method is to study the interactions between the individual and the environment; however, in the case of the environment, the interaction between the environment and the environment is an essential component of the biological processes. The study was published in the journal Science.
>
> In order to be able to understand the interaction between the environment and the environment, we need to understand the interaction between the environment and the environment; the environmental conditions, the environment, and the environment.

It's recognizable English. It's also pretty bad: the sentences go in circles and barely explain anything. We'll work through how a model produces text like this, starting with a table of counts and building up to a transformer. Along the way, we'll see how learning to predict the next token can produce English sentences without reliably producing a coherent explanation.

For a long time, I approached my own projects with a product in mind: something useful to build and finish. There was always another product idea I wanted to pursue. Now, [some developers describe missing the coding itself](https://www.reddit.com/r/ExperiencedDevs/comments/1rh818k/how_to_make_swe_in_the_age_of_ai_more_enjoyable/) as their work shifts toward prompting and reviewing. I understand that feeling. In my own time, I've found it freeing: I feel less need to turn every idea into a product, and more room to learn something just because it interests me.

I'd put on a dark academia playlist, read a paper, and open a Jupyter notebook. I could spend the evening following a question, taking as long as I needed. Whether AI could finish the exercise faster didn't matter. I had missed learning like this.

My physics and computer science background made the first small networks a refresher. [Karpathy's lectures](https://karpathy.ai/zero-to-hero.html) guided the experiments; I would pause, implement a part myself, and compare. I highlighted unfamiliar passages in papers, looked things up, and asked AI for explanations. I wrote the implementation without Copilot autocomplete or a coding agent.

The starting point is something we can do by hand: count which characters follow each other.

## Start with a model that only counts

The task is to take some text and assign a probability to each possible next character. Once we have those probabilities, we can draw a character, append it, and repeat. I started with names: there were few characters to keep track of, and I could read each result immediately.

We can get those probabilities by counting. Take just two names, `ana` and `anna`, and mark their beginnings and endings with a dot:

```text
. → a → n → a → .
. → a → n → n → a → .
```

Count every adjacent pair. Select a row to start from that character, then draw the next one using its probabilities.

<bigram-counts bare>
<p>For ana and anna, the start row always leads to a. After a, the counts are two endings and two n characters: 50% each. After n, the counts are two a characters and one n: two-thirds and one-third.</p>
</bigram-counts>

The `a` row contains four observations: twice followed by `n`, twice by the end marker. Dividing each count by four gives a 50% chance of each. We have a language model. This is called a **bigram model** because it counts pairs of adjacent characters. It can generate text without a neural network.

It can produce `ana` or `anna`, but also `a` or `annna`. It has no way to distinguish the first `a` from the last one: both use the same row. Everything before that one character is forgotten.

### Use more than one character

We could count longer sequences. But every extra character multiplies the number of possible contexts, and many combinations never appear in the training text. A useful alternative is to share what the model learns across contexts. Instead of storing a separate row of counts for each one, we can train a function to predict from the preceding three characters.

To calculate with characters, give each one a list of numbers, or vector. A table holds one row for each character, including the boundary marker. Looking up a character selects its row. My notebook used 27 rows with two numbers each. In this smaller example with hand-chosen numbers, both occurrences of `a` retrieve the same row.

<token-embeddings bare compact vocabulary='[".","a","n"]' ids="[1,2,1]" embeddings="[[0.2,-0.5],[0.7,0.1],[-0.4,0.6]]" show-values caption="A smaller embedding table for ana. These example numbers stand in for learned weights.">
<p>The character a selects [0.7, 0.1]; n selects [-0.4, 0.6]. Both occurrences of a select the same row.</p>
</token-embeddings>

These vectors are **embeddings**. Three characters select three pairs of numbers, which become six inputs. Multiply these inputs by adjustable weights, add the results, and add an offset: this is a **linear layer**. Arranging the weights in a table, or **matrix**, lets matrix multiplication calculate these weighted sums together.

$$
y = xW + b
$$

Here $x$ is the input row of numbers, $W$ the weight matrix, $b$ the offsets, and $y$ the output row. Training changes $W$ and $b$.

Between layers, a nonlinear function changes the response so the whole network can do more than one weighted sum. Together, these operations produce a score for each possible next character.

This network is an **MLP**, a multilayer perceptron. The same learned calculation handles every three-character context, including combinations it hasn't seen before.

Its scores aren't probabilities yet: they can be negative and don't add to one. Convert each score $s$ into $e^s$, a positive number, then divide by the sum of those results. This conversion is **softmax**:

$$
p_i = \frac{e^{s_i}}{\sum_j e^{s_j}}
$$

$s_i$ is the score for character $i$, and $p_i$ its probability. The $\sum$ means add up the values for all possible characters; $e$ is approximately 2.718. Dividing by that total makes the probabilities add to one, with higher scores getting a larger share.

I played with these shapes in the notebook, leaving comments about each dimension. A tensor here was an array of numbers with several axes: which example, which character position, and which number within its representation. Reshaping rearranged the same six values; matrix multiplication actually combined them.

The embedding coordinates don't need predefined meanings. The model learns the table along with the predictor, the approach described by Bengio and colleagues. **Paper:** [A Neural Probabilistic Language Model (2003)](https://www.jmlr.org/papers/v3/bengio03a.html).

### How the parameters learn

The table starts with random numbers. Each training example gives the model a prediction to make and an answer: the next character in the training text. We penalize it for assigning a low probability to that character:

$$
L = -\log p_{\text{correct}}
$$

This is the **loss** for one prediction, using the natural logarithm. A probability close to one gives a loss close to zero. Assigning the answer a tiny probability gives a large loss. Training averages this penalty over many predictions.

Now we need to know which numbers to change. A weight affects an intermediate value, which affects a score, which affects the loss. Calculus lets us follow those dependencies backward.

Take just one scalar operation, $z = wx+b$: an input $x$, a weight $w$, and an offset $b$. Hold $x$ and $b$ fixed and follow the weight's effect through $z$. The **chain rule** says:

$$
\frac{\partial L}{\partial w}
= \frac{\partial L}{\partial z}\frac{\partial z}{\partial w}
= \frac{\partial L}{\partial z}\,x
$$

Read $\partial L/\partial w$ as “how quickly the loss changes when this weight changes.” We multiply how the loss responds to $z$ by how $z$ responds to $w$. Across more layers, we keep multiplying these local rates of change; where a parameter affects the loss through several paths, we add their contributions. That backward calculation is **backpropagation**. Its results are the **gradients**. **Paper:** [Learning representations by back-propagating errors (1986)](https://www.nature.com/articles/323533a0).

For a small worked example, suppose there are two possible next characters. The correct one's score is $z=wx$, and the other's score is fixed at zero. With $x=2$ and $w=0$, both scores are zero, so softmax gives each character a probability of 0.5. For softmax with this loss, the gradient of the correct character's score is $p_{\text{correct}}-1$. The weight's gradient is therefore $(0.5-1)\times2=-1$.

A negative gradient means increasing the weight will initially reduce the loss. The simplest update, **gradient descent**, takes a small step in that direction:

$$
w_{\text{new}} = w - \eta\frac{\partial L}{\partial w}
$$

$\eta$ is the learning rate, the step size. With $\eta=0.1$, our weight becomes $0-0.1(-1)=0.1$. Its score rises to 0.2, the correct character's probability rises to about 0.55, and the loss falls. We calculated the direction from the model's operations; we didn't try random changes until one worked.

The same process reaches the embedding table through the layers that used it. My GPT training used AdamW, which uses gradient history to adjust the updates and also applies weight decay. Backpropagation still supplies the gradients. **Paper:** [Decoupled Weight Decay Regularization (ICLR 2019)](https://arxiv.org/abs/1711.05101).

### Watch the embeddings change

In this small demonstration, `cat`, `dog`, and `rabbit` are followed by `eats`, `sleeps`, or `runs`. The words `car`, `bus`, and `train` are followed by `moves`, `stops`, or `arrives`. Each word has an embedding with just two coordinates, so we can plot its actual values. Press **Play training** to watch them change.

<embedding-training bare>
<p>Six embeddings and a shared output matrix learn next-token probabilities from a small example dataset. The points show actual gradient updates in two dimensions.</p>
</embedding-training>

The words with similar continuations end up in nearby regions. No instruction tells the model to group animals or vehicles. Their prediction errors change the embeddings through the shared output weights. This example uses a deliberately simple dataset and two-dimensional embeddings, so every coordinate is visible.

## Let the context change the calculation

The MLP combines three characters in a fixed arrangement. For a longer passage, each position should be able to use more of the preceding text and vary how much each part contributes. The context still has a maximum length, but the mixture within it can depend on the input.

Consider **“the cat sat on the”**. For this example, each word is a **token**, a unit of text. My first transformer used characters; the later GPT-2 version used pieces of words too. Each token has an ID that selects its embedding row. That ID is just an index into the table.

Both occurrences of `the` start with the same token embedding. Adding a learned position vector to each one gives the model information about where it occurs. The transformer then updates these vectors using the preceding text. At the end, the vector at the last position produces scores for possible continuations, such as `mat`.

### Combining information from earlier words

A first approach is to average the vectors at preceding positions, including the current one. I tried this with a loop in a notebook, then reproduced the averages with matrix multiplication. Each row of the matrix specifies how much each available vector contributes. The next step is to make those proportions depend on the text.

### Choose how much each position contributes

Equal averages give every available position the same share. To make those shares depend on the text, we need a score for how much one position should draw from another. Each position already has a vector. Multiplying it by three learned matrices produces three new vectors: a **query**, a **key**, and a **value**.

Stack the current vectors in the rows of $X$, and the three calculations are $Q=XW_Q$, $K=XW_K$, and $V=XW_V$. Each $W$ is a learned weight matrix; the rows of $Q$, $K$, and $V$ are the resulting vectors.

The query at the position being updated is compared with the keys at the available source positions. These are separate transformations, so distance on the earlier embedding plot isn't itself a match score.

The matrices start with random weights and are learned during training. The query, key, and value vectors are calculated from the input; they aren't separate parameters stored for every token. The same three matrices are applied at every position.

To compare one position's query with another position's key, multiply corresponding numbers and add the results. That's a **dot product**:

$$
q\cdot k = \sum_{r=1}^{d}q_r k_r
$$

Here $d$ is the number of coordinates in each vector. Comparing `[1, 2]` with `[3, 4]` gives $1\times3+2\times4=11$. The score depends on the directions and lengths of the vectors. Training adjusts the matrices that produce them to make these comparisons useful for prediction.

The scores are scaled to keep their size under control, and future positions are blocked. Softmax, the same conversion we used for next-character scores, turns the remaining scores into weights that sum to one.

### Combine the information

The values supply the information to combine. If two positions receive weights of 70% and 30%, the result is `0.7 × first value + 0.3 × second value`. These are weights for mixing information, not probabilities of the next word. The model calculates those later. This operation is **self-attention**: the text supplies both the vectors being compared and the information being mixed.

Here is that operation with just two source positions and hand-chosen numbers. Move the query and watch the mixture change. In the sentence above, the last `the` could combine information from all five positions; this smaller example makes the arithmetic easier to see.

<vector-attention bare compact mode="qkv" query="[1,0]" keys="[[1,0],[0,1]]" values="[[2,0],[0,4]]" labels='["earlier position","current position"]' caption="Illustrative numbers, not measurements from my model. The query changes the scores, which change the weights used to mix the two values.">
<p>The initial weights are approximately 67% and 33%. Their weighted sum is 0.67 × [2, 0] + 0.33 × [0, 4], approximately [1.34, 1.32].</p>
</vector-attention>

### Why attention must not look ahead

There is one restriction. When predicting what follows “the cat sat on the”, the model can use those five tokens. It cannot use the answer, `mat`. Each position must use only itself and earlier positions. This is **causal attention**.

During training, we predict the next token after every input position at once. The `cat` position predicts `sat`, even though `sat` is already present later in the input. A **mask** blocks attention to those later positions before softmax; otherwise, the model could read the answer. In the grid, 1 means available and 0 means blocked. The `cat` row can use only the first `the` and `cat`; the final row can use all five tokens.

<tensor-pixels bare quiet name="mask" values="[[1,0,0,0,0],[1,1,0,0,0],[1,1,1,0,0],[1,1,1,1,0],[1,1,1,1,1]]" palette="binary" axes="current position,available source" labels='[["1: the","2: cat","3: sat","4: on","5: the"],["1: the","2: cat","3: sat","4: on","5: the"]]' show-values caption="1 means available; 0 means blocked. The row for cat can use the and cat. The final row can use all five tokens.">
<p>Each row can use its own position and every earlier position. All later positions are blocked.</p>
</tensor-pixels>

Written together, one attention head does this:

$$
\operatorname{Attention}(Q,K,V)
=\operatorname{softmax}\!\left(\frac{QK^\top}{\sqrt{d}}+M\right)V
$$

$K^\top$ turns the key rows into columns, so $QK^\top$ calculates every query–key dot product. Divide by $\sqrt{d}$ to scale the scores. The mask $M$ adds zero at allowed positions and $-\infty$ at future ones, giving those future positions zero weight after softmax. Apply softmax to each row, then multiply by $V$ to form the weighted mixtures. **Paper:** [Attention Is All You Need (2017), §3.2 and Figure 2](https://arxiv.org/pdf/1706.03762#page=4).

## Build a block we can repeat

We now have a way to mix information between positions. The next steps transform the resulting numbers at each position and help the network train reliably. Together, these operations form one repeated unit: a **transformer block**.

My first transformer used four of these blocks. Each had its own weights; each kept one vector per token. In the diagram, `B` counts examples processed together, `T` token positions, `C` numbers per vector, and `V` vocabulary entries.

<model-diagram bare layers="4" activation="relu" expanded caption="Follow a token’s numbers through the model and through one transformer block below.">
  <p>Token and position embeddings enter four pre-normalized blocks. Each block applies causal attention and a feed-forward network with residual additions. Final LayerNorm and a vocabulary projection produce next-token scores.</p>
</model-diagram>

### Keep the scale under control

In the earlier network, badly scaled initial weights had pushed the nonlinear function toward values where its gradients were tiny. The dimensions all agreed, but it learned poorly. That was a reason to inspect the numbers between layers and control their scale.

For each position separately, subtract the vector's mean, divide by its standard deviation with a small numerical safeguard, and apply a learned scale and offset. This is **LayerNorm**, the first box in the diagram. Attention receives these normalized numbers.

I had previously tried batch normalization, where moving a slider for one example changed shared statistics and affected the others. Layer normalization instead uses the numbers within one position. It doesn't mix information between words. **Papers:** [Batch Normalization (2015)](https://arxiv.org/abs/1502.03167) and [Layer Normalization (2016)](https://arxiv.org/abs/1607.06450).

### Attention mixes positions; the MLP transforms each one

One attention calculation produces one mixture per position. Run several in parallel, each with its own query, key, and value matrices, and they can learn different mixtures. These are the **attention heads**. Their results are joined and transformed back to the original vector width.

Attention moves information between positions. The next small network transforms the combined information at each position. The **Linear → ReLU → Linear** box makes weighted combinations, replaces negative values with zero, then combines the results again. Replacing the negatives is the nonlinear step: without it, the two linear layers would amount to a single linear transformation. The same network is applied separately at every position.

The side paths and **plus signs** add each operation's result to its input. These **residual connections** let a block learn changes to the existing representation and give gradients a direct path backward. In the equations, `x` is the input, `h` the result after the attention addition, and `y` the block's output.

These are the parts of _Attention Is All You Need_ that I could now trace through code: attention, a network at each position, and residual connections. The paper describes an encoder–decoder model; I was building the causal, decoder-only kind used for text generation.

### From the final vector to the next token

After the last block and a final LayerNorm, a linear layer produces one score for each token in the vocabulary. For generation, we use the scores at the final input position. Softmax converts them into probabilities, just as it converted attention scores into mixture weights earlier. Here the choices are vocabulary tokens.

For “the cat sat on the”, we might sample `mat`. We append it to the input and run the calculation again to choose what follows. The model's weights stay fixed throughout generation. The growing text changes the input, and therefore the next prediction.

During training, we know the real continuation. The loss penalizes a low probability for the actual next token, and backpropagation works through the entire calculation to update its parameters. The embedding table, attention matrices, and other layers all learn from that same prediction task.

## What came out of the first model

I trained the first transformer on _The Big Bang Theory_ transcripts. I knew the source well enough to recognize its speaker names and dialogue format.

I kept it small enough for the MacBook: about 3.29 million parameters and four blocks. It predicted individual characters. I held back part of the text from training to check whether its predictions improved on examples it hadn't trained on.

That is what **validation loss** measures: the average penalty for assigning low probability to the actual next character in held-out text. Lower is better. Both training and validation loss fell; the last recorded validation estimate was 1.19 after 4,750 updates.

<september-lab-figure bare kind="character-loss">
  <noscript><img src="/articles/a-month-of-teaching-a-model-to-talk/character-loss.svg" alt="Recorded character-model training and validation losses fall during the 5,000-update run." loading="lazy" /></noscript>
  <p>The last recorded validation estimate was 1.1898, at update 4,750 of the 5,000-update run.</p>
</september-lab-figure>

After training, the model produced familiar speaker labels and dialogue turns. One continuation was:

> Sheldon: No I would heim a station away, catchlow here) You’re gonna with out the up.

I could recognize the format, but I couldn't follow the conversation.

## Moving to GPT-2

Next I built a larger version based on GPT-2: about 124.5 million parameters, twelve blocks, and 768 numbers per token vector. It used the same sequence of operations. One change was GELU, a smooth nonlinear function in place of ReLU. **GPT-2 paper:** [Language Models are Unsupervised Multitask Learners (2019)](https://cdn.openai.com/better-language-models/language_models_are_unsupervised_multitask_learners.pdf).

The [tokenizer](/articles/your-words-are-not-what-the-model-sees/) changed too. Instead of individual characters, it used GPT-2's vocabulary of text pieces, including word fragments, spaces, and punctuation. The model could consider up to 1,024 tokens at once. The prediction task stayed the same; the units had changed.

### Training on the PC

I moved training to the RTX 4080 Super in my PC, connecting from the Mac. One practical problem was memory: I couldn't process the whole batch of examples at once.

I ran four smaller batches before updating the parameters, keeping their gradients and averaging their contributions. This is **gradient accumulation**. It let each update use more examples than I could fit in memory together.

<september-lab-figure bare kind="batch">
  <p>Four smaller batches contribute gradients to one optimizer update.</p>
</september-lab-figure>

## Giving the model more to learn from

A bigger model still needed more varied language than sitcom dialogue. I was starting from random weights. This was **pretraining**: learning from the text itself, rather than adapting an already trained model through **fine-tuning**.

I prepared a sample of the [FineWeb-Edu dataset](https://huggingface.co/datasets/HuggingFaceFW/fineweb-edu), web text filtered for educational quality. Its source paper describes the extraction, filtering, and deduplication behind the corpus. I tokenized my sample once and separated training and validation data by source document. **Paper:** [The FineWeb Datasets: Decanting the Web for the Finest Text Data at Scale (2024)](https://arxiv.org/abs/2406.17557).

The first run used a 100-million-token training sample and processed about 98 million token positions. Its reported final validation loss was **4.62**. One continuation began:

> Sheldon: Calculator. 10 All four copes have we be for so many printers in that they are called matched.

This was still difficult to read, and `Sheldon: ` was an awkward prompt for a model trained on educational web text. Validation gives it real text as context; generation feeds its own choices back into the input. A continuation can drift away from the contexts used in evaluation.

The earlier character loss wasn't directly comparable with this result: the token units, vocabularies, and corpora were different.

I followed the first web-text experiment with a 500-million-token run on the same GPU. It completed on September 29, and its final validation loss was **3.64**. The timed training steps added up to about an hour and fifty minutes on my RTX 4080 Super, with evaluation and saving taking additional time.

<september-lab-figure bare kind="fineweb-loss">
  <noscript><img src="/articles/a-month-of-teaching-a-model-to-talk/fineweb-loss.svg" alt="The completed larger run's recorded validation losses fall to 3.642228. The first run's reported final result is shown as a separate endpoint." loading="lazy" /></noscript>
  <p>The completed larger run ended with validation loss 3.642228 after 15,258 optimizer updates.</p>
</september-lab-figure>

These two runs used the same validation file, so the lower loss showed better predictions on the held-out text. The larger run also changed how the optimizer's step size varied during training; this wasn't a controlled test of data volume alone. Chinchilla's experiments study the broader trade-off between model size, training data, and compute. **Paper:** [Training Compute-Optimal Large Language Models (2022)](https://arxiv.org/abs/2203.15556).

## Back to the sample

The sample at the beginning shows how far that improvement went. It has recognizable sentence structure and scientific-sounding phrasing, but keeps returning to “the environment” and claims publication in _Science_ without identifying a study. Learning familiar patterns had made the English more plausible. It hadn't made this a useful explanation.

The loss measures next-token predictions on real text. It doesn't separately check whether a generated paragraph develops an idea or whether its claims are true. That made reading the output as important as watching the curve.

I generated the opening sample on October 5 from the completed 500M checkpoint and saved [the full generations and their settings](/articles/a-month-of-teaching-a-model-to-talk/checkpoint-samples.json). The original earlier checkpoint was no longer available for a controlled comparison.

## Back to the same task

The count table and the transformer solve the same kind of problem. Given some text, both return a probability for each possible next item in their vocabulary. Neither returns a whole answer in one step.

| Model | How it calculates the probabilities |
| --- | --- |
| Character bigram | Take the last character, look up its row, divide the counts by their total. |
| Transformer | Look up vectors for the available context, add position information, pass through the blocks, and convert the final position's vocabulary scores with softmax. |

In both cases, we draw the next item, append it, and repeat. The output is still a probability distribution. What changed is the calculation between the input and that output, and how much of the context it can use.

I can follow that calculation now. The model's text is still pretty bad, but seeing it produce English from weights I had trained was exciting.

The part I want to keep from September is how I spent those evenings. Papers, a playlist, an open notebook, and time to try things. Sometimes that meant staying with one operation until I understood what it did. I enjoyed that as much as getting a training run to finish.

I still enjoy building products. This month reminded me how much I also enjoy following a question without needing a finished product at the end. I could take it slowly. Whether AI could do the exercise better or faster had very little to do with why I was there.
