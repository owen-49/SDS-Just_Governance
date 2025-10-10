from __future__ import annotations

"""Deterministic embedding utilities used by the topic RAG feature.

The production system can swap these helpers with real vector providers
(e.g. sentence-transformers or OpenAI embeddings). For tests and local
usage we rely on a small, dependency-free implementation that produces
stable vectors so similarity scoring is predictable.
"""

from dataclasses import dataclass
import hashlib
import math
import re
from typing import Iterable, Protocol


class EmbeddingBackend(Protocol):
    """Interface for embedding providers."""

    def embed(self, text: str) -> list[float]:
        ...


_token_pattern = re.compile(r"[\w']+")


def _tokenize(text: str) -> Iterable[str]:
    for match in _token_pattern.finditer(text.lower()):
        token = match.group().strip("'")
        if token:
            yield token


@dataclass(slots=True)
class SimpleEmbeddingBackend:
    """Fallback embedding backend used in tests and local development.

    The backend maps every token to a deterministic pseudo-random vector by
    hashing the token string. The final embedding is the L2-normalised sum of
    those token vectors.
    """

    dimension: int = 24

    def embed(self, text: str) -> list[float]:  # noqa: D401 - short implementation
        tokens = list(_tokenize(text))
        if not tokens:
            return [0.0] * self.dimension

        vector = [0.0] * self.dimension
        for token in tokens:
            digest = hashlib.md5(token.encode("utf-8")).digest()
            for idx in range(self.dimension):
                vector[idx] += digest[idx % len(digest)] / 255.0

        norm = math.sqrt(sum(component * component for component in vector))
        if norm == 0:
            return [0.0] * self.dimension
        return [component / norm for component in vector]


def cosine_similarity(vec_a: Iterable[float], vec_b: Iterable[float]) -> float:
    """Compute cosine similarity between two numeric iterables."""

    dot = 0.0
    norm_a = 0.0
    norm_b = 0.0
    for a, b in zip(vec_a, vec_b):
        dot += a * b
        norm_a += a * a
        norm_b += b * b
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / math.sqrt(norm_a * norm_b)
