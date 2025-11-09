"""Advanced Python sample for AlgoVision testing.

Illustrates classes, decorators, generators, comprehensions, nested
functions, async code, context managers, and assorted control flow.
"""

from __future__ import annotations

import asyncio
import math
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, Iterator, Optional


class Vector:
    def __init__(self, *components: float) -> None:
        self._values = list(components)

    def __repr__(self) -> str:  # pragma: no cover - sample only
        return f"Vector({', '.join(map(str, self._values))})"

    def magnitude(self) -> float:
        return math.sqrt(sum(component ** 2 for component in self._values))

    def normalize(self) -> "Vector":
        length = self.magnitude() or 1.0
        return Vector(*(component / length for component in self._values))


@dataclass
class WorkflowStep:
    name: str
    retries: int = 0
    metadata: Optional[dict] = None

    def run(self, payload: dict) -> dict:
        attempts = 0
        while attempts <= self.retries:
            attempts += 1
            if payload.get("skip"):
                break
            payload["history"].append(self.name)
        return payload


class WorkflowEngine:
    def __init__(self, *, steps: Iterable[WorkflowStep]) -> None:
        self.steps = list(steps)

    async def execute(self, payload: dict) -> dict:
        for step in self.steps:
            payload = step.run(payload)
            await asyncio.sleep(0)
        return payload


def fibonacci(limit: int) -> Iterator[int]:
    """Generator with conditionals/loops to test CFG extraction."""
    a, b = 0, 1
    for _ in range(limit):
        yield a
        a, b = b, a + b


def read_numbers(path: Path) -> list[int]:
    numbers: list[int] = []
    with path.open("r", encoding="utf-8") as handle:
        for line in handle:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            try:
                numbers.append(int(line))
            except ValueError:
                break
    return numbers


def summarize(values: list[int]) -> dict[str, float]:
    def clamp(value: float, *, low: float, high: float) -> float:
        return max(low, min(high, value))

    total = sum(values)
    result = {
        "total": total,
        "average": total / len(values) if values else 0.0,
        "normalized": [clamp(v / 100.0, low=0.0, high=1.0) for v in values],
    }
    return result


async def main():
    steps = [
        WorkflowStep("fetch"),
        WorkflowStep("validate", retries=1),
        WorkflowStep("transform"),
    ]
    engine = WorkflowEngine(steps=steps)
    result = await engine.execute({"history": [], "skip": False})
    stats = summarize(list(fibonacci(10)))
    print(result, stats)  # pragma: no cover


if __name__ == "__main__":  # pragma: no cover
    asyncio.run(main())
