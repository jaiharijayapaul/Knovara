"""
Spaced Repetition System (SRS) using SuperMemo SM-2 algorithm.
"""

from dataclasses import dataclass
from datetime import datetime, timezone, timedelta
from typing import Tuple


DEFAULT_EASE_FACTOR = 2.5
MIN_EASE_FACTOR = 1.3


@dataclass
class SM2Result:
    """Calculated SRS intervals and factors following a review."""
    repetitions: int
    interval_days: float
    ease_factor: float
    next_review_at: datetime
    quality: int
    is_successful: bool
    is_lapse: bool = False


class SM2Engine:
    """
    SuperMemo-2 (SM-2) Spaced Repetition Algorithm.
    Pure functional calculations without database coupling.
    """

    @classmethod
    def calculate(
        cls,
        quality: int,
        repetitions: int = 0,
        interval_days: float = 0.0,
        ease_factor: float = DEFAULT_EASE_FACTOR,
        now: datetime | None = None,
        previous_interval: float | None = None,
        previous_ease_factor: float | None = None,
    ) -> SM2Result:
        """
        Apply SM-2 scheduling step for a given recall quality rating.

        Quality Rating Scale:
          0: Complete blackout
          1: Incorrect response; correct remembered upon seeing back
          2: Incorrect response; but seemed familiar
          3: Correct response recalled with serious difficulty
          4: Correct response after hesitation
          5: Perfect response / immediate recall
        """
        if quality < 0 or quality > 5:
            raise ValueError(f"Quality rating must be between 0 and 5, received {quality}")

        if previous_interval is not None:
            interval_days = previous_interval

        if previous_ease_factor is not None:
            ease_factor = previous_ease_factor

        if now is None:
            now = datetime.now(timezone.utc)
        elif now.tzinfo is None:
            now = now.replace(tzinfo=timezone.utc)

        q = quality
        is_successful = q >= 3
        is_lapse = not is_successful

        if is_successful:
            if repetitions == 0:
                next_interval = 1.0
            elif repetitions == 1:
                next_interval = 6.0
            else:
                next_interval = round(interval_days * ease_factor, 1)

            next_repetitions = repetitions + 1
        else:
            next_repetitions = 0
            next_interval = 1.0

        # Update Ease Factor
        # EF' = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
        new_ef = ease_factor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
        new_ef = max(MIN_EASE_FACTOR, round(new_ef, 4))

        next_review = now + timedelta(days=next_interval)

        return SM2Result(
            repetitions=next_repetitions,
            interval_days=next_interval,
            ease_factor=new_ef,
            next_review_at=next_review,
            quality=q,
            is_successful=is_successful,
            is_lapse=is_lapse,
        )
