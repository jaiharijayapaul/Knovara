"""
Error Taxonomy Classifier for psychometric diagnostic error classification.
Categorizes student mistakes into cognitive failure modes:
- factual_misconception
- procedural_slip
- formula_inversion
- dimensionality_confusion
- unchecked_assumption
"""

from typing import List, Dict, Any, Optional
from pydantic import BaseModel


class ErrorClassification(BaseModel):
    is_correct: bool
    error_category: str  # factual_misconception, procedural_slip, formula_inversion, dimensionality_confusion, unchecked_assumption, none
    misconception_diagnosis: Optional[str] = None
    remediation_hint: str
    points_earned: float


class ErrorTaxonomyClassifier:
    """
    Evaluates student response against question distractors and classifies
    the underlying cognitive failure mode.
    """

    ERROR_CATEGORIES = [
        "factual_misconception",
        "procedural_slip",
        "formula_inversion",
        "dimensionality_confusion",
        "unchecked_assumption",
        "none",
    ]

    CATEGORY_LABELS = {
        "factual_misconception": "Factual Misconception",
        "procedural_slip": "Procedural Slip / Calculation Flaw",
        "formula_inversion": "Formula or Objective Inversion",
        "dimensionality_confusion": "Dimensionality or Scale Confusion",
        "unchecked_assumption": "Unchecked Assumption or Overfitting Trap",
        "none": "Correct Understanding",
    }

    @classmethod
    def classify(
        cls,
        selected_option_id: str,
        correct_option_ids: List[str],
        options: List[Dict[str, Any]],
        question_text: str,
        explanation: str,
        points: float,
        citation_label: Optional[str] = None,
        document_name: Optional[str] = None,
    ) -> ErrorClassification:
        """Classify student answer and generate diagnostic feedback."""
        is_correct = selected_option_id in correct_option_ids

        if is_correct:
            return ErrorClassification(
                is_correct=True,
                error_category="none",
                misconception_diagnosis=None,
                remediation_hint=(
                    f"✓ Correct! Your reasoning reflects accurate domain understanding. "
                    f"Grounded in {citation_label or 'course curriculum'}."
                ),
                points_earned=points,
            )

        # Locate selected distractor
        selected_distractor = next(
            (opt for opt in options if opt["id"] == selected_option_id), None
        )

        raw_misconception = (
            selected_distractor.get("misconception")
            if selected_distractor
            else None
        ) or "Selected an incorrect option that contradicts curriculum definitions."

        category = cls._categorize_misconception(raw_misconception, selected_distractor)
        remediation = cls._build_remediation_hint(
            category=category,
            raw_misconception=raw_misconception,
            citation_label=citation_label,
            document_name=document_name,
        )

        return ErrorClassification(
            is_correct=False,
            error_category=category,
            misconception_diagnosis=raw_misconception,
            remediation_hint=remediation,
            points_earned=0.0,
        )

    @classmethod
    def _categorize_misconception(
        cls, misconception_text: str, option: Optional[Dict[str, Any]]
    ) -> str:
        """Determines the canonical error taxonomy category using cognitive heuristics."""
        lower = misconception_text.lower()
        opt_text = (option.get("text", "") if option else "").lower()
        combined = f"{lower} {opt_text}"

        # 1. Procedural slip / arithmetic / sign flaw
        if any(
            kw in combined
            for kw in [
                "sign error",
                "negative",
                "unweighted",
                "average error",
                "arithmetic",
                "product",
                "multiplicative",
                "log base",
                "base error",
            ]
        ):
            return "procedural_slip"

        # 2. Dimensionality or scale confusion
        if any(
            kw in combined
            for kw in [
                "dimension",
                "feature count",
                "number of features",
                "columns",
                "sample size",
                "cardinality",
                "continuous vs categorical",
            ]
        ):
            return "dimensionality_confusion"

        # 3. Formula or objective inversion
        if any(
            kw in combined
            for kw in [
                "invert",
                "inversion",
                "opposite",
                "minimize vs maximize",
                "penalty inversion",
                "ratio inversion",
                "reversed",
            ]
        ):
            return "formula_inversion"

        # 4. Unchecked assumption or overfitting trap
        if any(
            kw in combined
            for kw in [
                "assumption",
                "overfitting",
                "memorize",
                "generalization",
                "heuristic",
                "subsampling defect",
                "arbitrary",
            ]
        ):
            return "unchecked_assumption"

        # 5. Default fallback to factual misconception
        return "factual_misconception"

    @classmethod
    def _build_remediation_hint(
        cls,
        category: str,
        raw_misconception: str,
        citation_label: Optional[str],
        document_name: Optional[str],
    ) -> str:
        """Builds pedagogically actionable remediation advice."""
        source_ref = f" in {citation_label}" if citation_label else ""
        doc_ref = f" ({document_name})" if document_name else ""

        if category == "procedural_slip":
            return (
                f"⚠️ **Procedural Slip Detected**: {raw_misconception} "
                f"Double-check your mathematical steps and logarithmic conventions{source_ref}{doc_ref}. "
                f"Try deriving the formula from scratch."
            )
        elif category == "dimensionality_confusion":
            return (
                f"⚠️ **Dimensionality Trap**: {raw_misconception} "
                f"Be cautious not to confuse dataset dimensions (e.g. number of columns) with class distribution proportions. "
                f"Review the derivations{source_ref}."
            )
        elif category == "formula_inversion":
            return (
                f"⚠️ **Objective Inversion**: {raw_misconception} "
                f"Verify whether the algorithmic optimization step seeks to maximize or minimize the target criterion{source_ref}."
            )
        elif category == "unchecked_assumption":
            return (
                f"⚠️ **Unchecked Modeling Assumption**: {raw_misconception} "
                f"Remember to assess model variance and overfitting limits rather than assuming empirical train accuracy generalizes."
            )
        else:
            return (
                f"⚠️ **Conceptual Misconception**: {raw_misconception} "
                f"Revisit the foundational theory{source_ref}{doc_ref} or ask the AI Tutor in Socratic mode to unpack this principle."
            )
