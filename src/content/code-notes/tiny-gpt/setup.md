---
workspace: tiny-gpt
noteId: setup
title: Wire the files together
file: sample.py
order: 10
from: "torch.manual_seed(1337)"
to: 'print(f"Untrained batch loss: {loss.item():.3f}")'
---

This is the entry point. It gets the vocabulary and batches from `data.py`, creates the `GPT` from `model.py`, and moves the model and its inputs to the same device.

`eval()` selects evaluation behavior; `no_grad()` avoids recording gradients. Neither loads trained weights. The seed makes experiments easier to repeat within the same environment, though results can differ across devices and PyTorch versions.

Download all five files into one directory, then run:

```sh
python -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
python sample.py
```

On Windows, activate the environment with `.venv\Scripts\activate` instead. Use a Python version supported by your PyTorch installation.
