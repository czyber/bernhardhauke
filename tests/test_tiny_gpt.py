"""Optional showcase checks: python3 -m unittest discover -s tests -p 'test_*.py'."""
from pathlib import Path
import sys
import unittest

import torch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "public/code/tiny-gpt"))
from data import decode, encode, get_batch, vocab_size
from model import GPT, GPTConfig


class TinyGPTTests(unittest.TestCase):
    def setUp(self):
        torch.manual_seed(1337)
        self.model = GPT(GPTConfig(n_head=2, vocab_size=vocab_size)).eval()

    def test_tokenizer_round_trip_and_shifted_batches(self):
        self.assertEqual(decode(encode("Hello, ")), "Hello, ")
        for split in ("train", "val"):
            x, y = get_batch(split)
            self.assertEqual(tuple(x.shape), (4, 8))
            self.assertTrue(torch.equal(x[:, 1:], y[:, :-1]))

    def test_logits_loss_and_backward(self):
        x, y = get_batch("train")
        logits, loss = self.model(x, y)
        self.assertEqual(tuple(logits.shape), (4, 8, vocab_size))
        self.assertTrue(torch.isfinite(loss))
        loss.backward()
        self.assertTrue(torch.isfinite(self.model.lm_head.weight.grad).all())

    def test_future_tokens_cannot_change_earlier_predictions(self):
        x, _ = get_batch("train")
        changed = x.clone()
        changed[:, 4:] = (changed[:, 4:] + 1) % vocab_size
        with torch.no_grad():
            original, _ = self.model(x)
            altered, _ = self.model(changed)
        torch.testing.assert_close(original[:, :4], altered[:, :4])

    def test_context_limit_is_explicit(self):
        with self.assertRaisesRegex(ValueError, "context window"):
            self.model(torch.zeros((1, 9), dtype=torch.long))


if __name__ == "__main__":
    unittest.main()
