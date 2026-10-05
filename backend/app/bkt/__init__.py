"""
Bayesian Knowledge Tracing (BKT) Engine.

Classical BKT (Corbett & Anderson, 1994) models per-concept mastery as a Hidden Markov Model.

State variable: P(L_t) = probability that student knows concept at time t
Four parameters (per concept, learned from data):
  - p_know    (P_L0): Initial probability of knowing the concept
  - p_learn   (P_T):  Probability of learning concept when attempting it
  - p_guess   (P_G):  Probability of correct response despite not knowing
  - p_slip    (P_S):  Probability of incorrect response despite knowing

Update equations:
  Given observation o ∈ {correct, incorrect}:
    P(L_t | o=correct) = P(L_t-1) * (1 - p_slip)  /  [P(L_t-1) * (1 - p_slip) + (1 - P(L_t-1)) * p_guess]
    P(L_t | o=incorrect) = P(L_t-1) * p_slip  /  [P(L_t-1) * p_slip + (1 - P(L_t-1)) * (1 - p_guess)]
    P(L_{t+1}) = P(L_t | o) + (1 - P(L_t | o)) * p_learn

Mastery is declared when P(L_t) >= mastery_threshold (default 0.95).
"""

from dataclasses import dataclass, field
from typing import List, Tuple


# Default BKT parameters used when concept has no prior data
DEFAULT_P_KNOW  = 0.30   # 30% chance of knowing before any evidence
DEFAULT_P_LEARN = 0.25   # 25% chance of learning from each attempt
DEFAULT_P_GUESS = 0.15   # 15% chance of guessing correctly without knowing
DEFAULT_P_SLIP  = 0.10   # 10% chance of slipping despite knowing

MASTERY_THRESHOLD = 0.95  # Probability above which mastery is declared


@dataclass
class BKTParams:
    """BKT hyperparameters for a single concept."""
    p_know: float = DEFAULT_P_KNOW
    p_learn: float = DEFAULT_P_LEARN
    p_guess: float = DEFAULT_P_GUESS
    p_slip: float = DEFAULT_P_SLIP
    mastery_threshold: float = MASTERY_THRESHOLD

    def to_dict(self) -> dict:
        return {
            "p_know": self.p_know,
            "p_learn": self.p_learn,
            "p_guess": self.p_guess,
            "p_slip": self.p_slip,
            "mastery_threshold": self.mastery_threshold,
        }


@dataclass
class BKTUpdateResult:
    """Result of a single BKT update step."""
    p_know_prior: float            # P(L) before this observation
    p_know_posterior: float        # P(L | o) — updated after this observation
    p_know_next: float             # P(L_{t+1}) — after learning opportunity
    is_correct: bool
    is_mastered: bool
    mastery_threshold: float


class BKTEngine:
    """
    Pure BKT computation engine with no database coupling.
    All methods are stateless class methods for easy unit testing and reuse.
    """

    @classmethod
    def update(
        cls,
        p_know: float,
        is_correct: bool,
        params: BKTParams,
    ) -> BKTUpdateResult:
        """
        Apply a single BKT observation update.

        Args:
            p_know:     Current estimated P(L_t) before this observation.
            is_correct: Whether the student answered correctly.
            params:     BKT hyperparameters.

        Returns:
            BKTUpdateResult with updated mastery probability.
        """
        p_know = max(0.0, min(1.0, p_know))
        # Bound prior away from absorbing state (1.0) so evidence can adjust belief
        effective_p = min(0.999, max(0.0, p_know))

        # Step 1: Bayesian posterior update given observation
        if is_correct:
            numerator = effective_p * (1.0 - params.p_slip)
            denominator = numerator + (1.0 - effective_p) * params.p_guess
        else:
            numerator = effective_p * params.p_slip
            denominator = numerator + (1.0 - effective_p) * (1.0 - params.p_guess)

        # Guard against zero denominator (degenerate case)
        if denominator < 1e-10:
            p_posterior = p_know
        else:
            p_posterior = numerator / denominator

        p_posterior = max(0.0, min(1.0, p_posterior))

        # Step 2: Learning opportunity — student may have learned during attempt
        p_next = p_posterior + (1.0 - p_posterior) * params.p_learn
        p_next = max(0.0, min(1.0, p_next))

        return BKTUpdateResult(
            p_know_prior=p_know,
            p_know_posterior=p_posterior,
            p_know_next=p_next,
            is_correct=is_correct,
            is_mastered=(p_next >= params.mastery_threshold),
            mastery_threshold=params.mastery_threshold,
        )

    @classmethod
    def update_sequence(
        cls,
        initial_p_know: float,
        observations: List[bool],
        params: BKTParams,
    ) -> Tuple[float, List[BKTUpdateResult]]:
        """
        Apply a full sequence of BKT updates (for replaying historical attempts).

        Args:
            initial_p_know: Starting mastery probability.
            observations:   List of correctness observations (True/False).
            params:         BKT hyperparameters.

        Returns:
            (final_p_know, list of update results)
        """
        p_know = initial_p_know
        results: List[BKTUpdateResult] = []
        for obs in observations:
            result = cls.update(p_know=p_know, is_correct=obs, params=params)
            results.append(result)
            p_know = result.p_know_next
        return p_know, results

    @classmethod
    def predict_performance(
        cls,
        p_know: float,
        params: BKTParams,
    ) -> float:
        """
        Predict probability of correct response on next question given current mastery.
        P(correct) = P(L) * (1 - P_S) + (1 - P(L)) * P_G
        """
        return p_know * (1.0 - params.p_slip) + (1.0 - p_know) * params.p_guess

    @classmethod
    def questions_to_mastery(
        cls,
        p_know: float,
        params: BKTParams,
        max_steps: int = 50,
    ) -> int:
        """
        Estimate minimum number of correct answers needed to reach mastery threshold.
        Returns -1 if not achievable within max_steps.
        """
        for step in range(max_steps):
            if p_know >= params.mastery_threshold:
                return step
            result = cls.update(p_know=p_know, is_correct=True, params=params)
            p_know = result.p_know_next
        return -1 if p_know < params.mastery_threshold else max_steps
