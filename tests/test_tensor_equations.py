"""Check worked tensor examples and generated reproduction code against PyTorch."""
import contextlib
import io
import json
from html.parser import HTMLParser
from pathlib import Path
import subprocess
import unittest

import torch

ROOT = Path(__file__).resolve().parents[1]


class Equations(HTMLParser):
    def __init__(self):
        super().__init__()
        self.equations = []
        self.current = None

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "tensor-equation":
            self.current = []
            self.equations.append(self.current)
        if tag != "tensor-pixels" or self.current is None:
            return
        definition = {key: attrs[key] for key in ("name", "op", "caption") if key in attrs}
        for key in ("values", "labels"):
            if key in attrs:
                definition[key] = json.loads(attrs[key])
        for key in ("inputs", "axes"):
            if key in attrs:
                definition[key] = [value.strip() for value in attrs[key].split(",")]
        for key in ("shape", "dims", "sizes"):
            if key in attrs:
                definition[key] = [int(value) for value in attrs[key].split(",")]
        for key in ("axis", "part"):
            if key in attrs:
                definition[key] = int(attrs[key])
        self.current.append(definition)

    def handle_endtag(self, tag):
        if tag == "tensor-equation":
            self.current = None


def evaluate(definitions):
    script = """
import { readFileSync } from 'node:fs';
import { evaluateTensors, tensorPython } from './src/lib/tensor-operations.ts';
const tensors = evaluateTensors(JSON.parse(readFileSync(0, 'utf8')));
process.stdout.write(JSON.stringify({code: tensorPython(tensors), tensors: [...tensors.values()]}));
"""
    result = subprocess.run(["node", "--experimental-strip-types", "--input-type=module", "-e", script], input=json.dumps(definitions), text=True, capture_output=True, cwd=ROOT, check=True)
    return json.loads(result.stdout)


class TensorEquationTests(unittest.TestCase):
    def assert_matches_pytorch(self, definitions):
        result = evaluate(definitions)
        namespace = {}
        with contextlib.redirect_stdout(io.StringIO()):
            exec(result["code"], namespace)
        for tensor in result["tensors"]:
            actual = namespace[tensor["name"]]
            self.assertEqual(list(actual.shape), tensor["shape"])
            expected = torch.tensor(tensor["values"], dtype=torch.float64).reshape(tensor["shape"])
            torch.testing.assert_close(actual, expected, rtol=1e-12, atol=1e-12)

    def test_worked_equation_fixtures(self):
        parser = Equations()
        parser.feed((ROOT / "tests/fixtures/tensor-equations.html").read_text())
        self.assertEqual(len(parser.equations), 6)
        for index, definitions in enumerate(parser.equations):
            with self.subTest(equation=index):
                self.assert_matches_pytorch(definitions)

    def test_split_view_transpose_contiguous_chain(self):
        self.assert_matches_pytorch([
            {"name": "qkv", "values": torch.arange(72).reshape(2, 3, 12).tolist()},
            {"name": "q", "op": "split", "inputs": ["qkv"], "sizes": [4, 4, 4], "axis": -1, "part": 0},
            {"name": "heads", "op": "view", "inputs": ["q"], "shape": [2, 3, 2, 2]},
            {"name": "swapped", "op": "transpose", "inputs": ["heads"], "dims": [1, 2]},
            {"name": "copied", "op": "contiguous", "inputs": ["swapped"]},
            {"name": "flat", "op": "view", "inputs": ["copied"], "shape": [2, -1]},
        ])

    def test_addition_broadcasts_scalars_and_singleton_axes(self):
        self.assert_matches_pytorch([
            {"name": "rows", "values": [[1], [2]]},
            {"name": "columns", "values": [[10, 20, 30]]},
            {"name": "grid", "op": "add", "inputs": ["rows", "columns"]},
            {"name": "bias", "values": -0.5},
            {"name": "shifted", "op": "add", "inputs": ["bias", "grid"]},
            {"name": "tokens", "values": torch.arange(12).reshape(2, 2, 3).tolist()},
            {"name": "positions", "values": [[[0, 1, 2], [3, 4, 5]]]},
            {"name": "encoded", "op": "add", "inputs": ["tokens", "positions"]},
        ])

    def test_addition_after_transpose(self):
        self.assert_matches_pytorch([
            {"name": "a", "values": [[1, 2, 3], [4, 5, 6]]},
            {"name": "at", "op": "transpose", "inputs": ["a"]},
            {"name": "bias", "values": 1},
            {"name": "sum", "op": "add", "inputs": ["at", "bias"]},
            {"name": "back", "op": "transpose", "inputs": ["sum"]},
            {"name": "flat", "op": "view", "inputs": ["back"], "shape": [6]},
        ])


if __name__ == "__main__":
    unittest.main()
