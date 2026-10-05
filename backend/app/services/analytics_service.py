"""Service for Comprehensive Learning Analytics, Progress Telemetry & Exportable Reports."""

import math
import json
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.models.course import Course
from app.models.mastery import LearnerConceptMastery
from app.models.assessment import AssessmentAttempt, QuestionResponseLog
from app.models.flashcard import Flashcard
from app.models.tutor import TutorSession, TutorMessage
from app.schemas.analytics import (
    LearnerVelocity,
    BloomCognitiveTelemetry,
    MisconceptionTelemetry,
    RetentionForecastDay,
    RetentionForecast,
    ActivityTimelinePoint,
    ConceptMatrixItem,
    CourseAnalyticsReport,
)

# Standard Bloom levels in taxonomic order
BLOOM_ORDER = ["remember", "understand", "apply", "analyze", "evaluate", "create"]
BLOOM_META = {
    "remember": {
        "display": "Remembering",
        "description": "Recall of factual terminology, definitions, and specific coordinates."
    },
    "understand": {
        "display": "Understanding",
        "description": "Explanatory comprehension, classifying ideas, and translating concepts."
    },
    "apply": {
        "display": "Applying",
        "description": "Executing formulas, procedures, and methodologies in new contexts."
    },
    "analyze": {
        "display": "Analyzing",
        "description": "Deconstructing systems into constituent elements and identifying patterns."
    },
    "evaluate": {
        "display": "Evaluating",
        "description": "Critiquing approaches, verifying validity, and defending judgments."
    },
    "create": {
        "display": "Creating",
        "description": "Synthesizing disparate knowledge structures into novel cohesive frameworks."
    },
}

ERROR_CAT_META = {
    "factual_misconception": {
        "display": "Factual Misconception",
        "advice": "Review foundational definitions and reference materials in course documents."
    },
    "procedural_slip": {
        "display": "Procedural Slip",
        "advice": "Practice step-by-step problem derivations and verification checklists."
    },
    "formula_inversion": {
        "display": "Formula Inversion",
        "advice": "Focus on dimensional analysis and fundamental physical or mathematical invariants."
    },
    "dimensionality_confusion": {
        "display": "Dimensionality Confusion",
        "advice": "Verify units and parameter bounds before computing intermediate values."
    },
    "unchecked_assumption": {
        "display": "Unchecked Assumption",
        "advice": "Check boundary conditions and preconditions before applying theorems or shortcuts."
    },
    "distractor_trap": {
        "display": "Cognitive Trap / Distractor",
        "advice": "Read questions critically to separate superficial similarities from underlying mechanisms."
    },
    "unclassified": {
        "display": "General Heuristic Error",
        "advice": "Engage with the Socratic AI Tutor to uncover underlying intuition gaps."
    },
}


def _to_utc(dt: Optional[datetime]) -> Optional[datetime]:
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def get_course_analytics(db: Session, course_id: str, user_id: str) -> CourseAnalyticsReport:
    """
    Computes real-time multidimensional analytics across BKT mastery,
    diagnostic assessments, spaced repetition retention, and Socratic dialogues.
    """
    course = db.query(Course).filter(Course.id == course_id, Course.user_id == user_id).first()
    if not course:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Course workspace not found or unauthorized.",
        )

    now = datetime.now(timezone.utc)

    # 1. BKT Concept Mastery & Learner Velocity
    masteries = db.query(LearnerConceptMastery).filter(
        LearnerConceptMastery.course_id == course_id,
        LearnerConceptMastery.user_id == user_id
    ).all()

    total_concepts = len(masteries)
    mastered_count = sum(1 for m in masteries if m.is_mastered or m.p_know >= 0.85)
    
    if total_concepts > 0:
        overall_mastery = sum(m.p_know for m in masteries) / total_concepts * 100.0
    else:
        overall_mastery = 0.0

    # Calculate velocity: average Delta P(L) across history
    velocity_deltas = []
    concept_matrix_items: List[ConceptMatrixItem] = []

    for m in masteries:
        history = []
        if m.p_know_history_json:
            try:
                history = json.loads(m.p_know_history_json)
            except Exception:
                history = [m.p_know]
        if not history:
            history = [m.p_know]

        if len(history) > 1:
            delta = history[-1] - history[0]
            velocity_deltas.append(delta / max(1, len(history) - 1))
        
        status_label = "Mastered" if m.p_know >= 0.85 else ("In Progress" if m.p_know >= 0.50 else "Needs Attention")
        concept_matrix_items.append(
            ConceptMatrixItem(
                concept_label=m.concept_label,
                p_know=round(m.p_know, 4),
                is_mastered=bool(m.is_mastered or m.p_know >= 0.85),
                status=status_label,
                priority_score=round(m.priority_score, 4),
                history=[round(h, 3) for h in history[-8:]]
            )
        )

    # Sort matrix items: needs attention first, then in progress, then mastered
    concept_matrix_items.sort(key=lambda x: x.p_know)

    mastery_velocity = round(sum(velocity_deltas) / len(velocity_deltas) * 100.0, 2) if velocity_deltas else 0.0

    # 2. Assessment Attempts & Response Logs
    attempts = db.query(AssessmentAttempt).filter(
        AssessmentAttempt.course_id == course_id,
        AssessmentAttempt.user_id == user_id
    ).order_by(AssessmentAttempt.created_at.desc()).all()

    attempt_ids = [a.id for a in attempts]
    total_study_time_seconds = sum(a.time_spent_seconds for a in attempts)
    
    response_logs: List[QuestionResponseLog] = []
    if attempt_ids:
        response_logs = db.query(QuestionResponseLog).filter(
            QuestionResponseLog.attempt_id.in_(attempt_ids)
        ).all()

    # 3. Bloom Cognitive Telemetry
    bloom_counts: Dict[str, Dict[str, int]] = {
        lvl: {"total": 0, "correct": 0} for lvl in BLOOM_ORDER
    }
    for log in response_logs:
        lvl = (log.bloom_level or "understand").lower()
        if lvl not in bloom_counts:
            bloom_counts[lvl] = {"total": 0, "correct": 0}
        bloom_counts[lvl]["total"] += 1
        if log.is_correct:
            bloom_counts[lvl]["correct"] += 1

    bloom_telemetry: List[BloomCognitiveTelemetry] = []
    for lvl in BLOOM_ORDER:
        counts = bloom_counts.get(lvl, {"total": 0, "correct": 0})
        total_q = counts["total"]
        correct_q = counts["correct"]
        acc = (correct_q / total_q * 100.0) if total_q > 0 else 0.0
        meta = BLOOM_META.get(lvl, {"display": lvl.title(), "description": ""})
        bloom_telemetry.append(
            BloomCognitiveTelemetry(
                level=lvl,
                display_name=meta["display"],
                total_questions=total_q,
                correct_questions=correct_q,
                accuracy_pct=round(acc, 1),
                description=meta["description"],
            )
        )

    # 4. Misconception & Error Category Telemetry
    error_counts: Dict[str, Dict[str, Any]] = {}
    total_errors = 0
    for log in response_logs:
        if not log.is_correct:
            cat = log.error_category or "unclassified"
            if cat == "none":
                cat = "distractor_trap"
            total_errors += 1
            if cat not in error_counts:
                error_counts[cat] = {"count": 0, "concepts": set()}
            error_counts[cat]["count"] += 1
            if log.question and log.question.topic:
                error_counts[cat]["concepts"].add(log.question.topic)

    misconception_telemetry: List[MisconceptionTelemetry] = []
    for cat, data in sorted(error_counts.items(), key=lambda item: item[1]["count"], reverse=True):
        count = data["count"]
        pct = (count / total_errors * 100.0) if total_errors > 0 else 0.0
        meta = ERROR_CAT_META.get(cat, {
            "display": cat.replace("_", " ").title(),
            "advice": "Consult your AI Tutor for targeted conceptual remediation."
        })
        misconception_telemetry.append(
            MisconceptionTelemetry(
                error_category=cat,
                display_name=meta["display"],
                count=count,
                percentage=round(pct, 1),
                remediation_advice=meta["advice"],
                affected_concepts=sorted(list(data["concepts"]))[:4]
            )
        )

    # 5. Flashcards & Spaced Repetition (SM-2) Retention Forecast
    flashcards = db.query(Flashcard).filter(
        Flashcard.course_id == course_id,
        Flashcard.user_id == user_id
    ).all()

    active_cards = len(flashcards)
    mature_cards = sum(1 for c in flashcards if c.interval_days >= 21)
    learning_cards = active_cards - mature_cards
    avg_ease = (sum(c.ease_factor for c in flashcards) / active_cards) if active_cards > 0 else 2.5
    total_reviews = sum(c.total_reviews for c in flashcards)

    # Calculate due distribution
    def _card_due(card: Flashcard) -> datetime:
        return _to_utc(card.next_review_at) or now

    due_today = sum(1 for c in flashcards if _card_due(c) <= now)
    in_3_days = now + timedelta(days=3)
    in_7_days = now + timedelta(days=7)
    in_14_days = now + timedelta(days=14)

    due_in_3_days = sum(1 for c in flashcards if _card_due(c) <= in_3_days)
    due_in_7_days = sum(1 for c in flashcards if _card_due(c) <= in_7_days)
    due_in_14_days = sum(1 for c in flashcards if _card_due(c) <= in_14_days)

    # Ebbinghaus projected retention decay curve across next 14 days
    forecast_days: List[RetentionForecastDay] = []
    # R(t) = exp(-t / S) where stability S is derived from interval and ease factor
    deck_predicted_retentions = []

    for day_offset in range(15):
        target_date = now + timedelta(days=day_offset)
        date_str = target_date.strftime("%Y-%m-%d")
        
        # Cards due specifically on this day or before
        if day_offset == 0:
            due_on_day = sum(1 for c in flashcards if _card_due(c) <= target_date)
        else:
            prev_date = target_date - timedelta(days=1)
            due_on_day = sum(1 for c in flashcards if prev_date < _card_due(c) <= target_date)

        # Average retention probability on day_offset
        if active_cards > 0:
            card_retentions = []
            for c in flashcards:
                # S = stability in days
                stability = max(1.0, c.interval_days * (c.ease_factor / 2.5))
                # Days since last reviewed (or since now + offset)
                elapsed_days = day_offset
                ret = math.exp(-elapsed_days / stability)
                card_retentions.append(ret)
            avg_ret = sum(card_retentions) / len(card_retentions) * 100.0
        else:
            avg_ret = 100.0

        if day_offset == 0:
            deck_predicted_retentions.append(avg_ret)

        forecast_days.append(
            RetentionForecastDay(
                day_offset=day_offset,
                date_str=date_str,
                projected_retention_pct=round(avg_ret, 1),
                cards_due=due_on_day
            )
        )

    predicted_retention_pct = round(deck_predicted_retentions[0], 1) if deck_predicted_retentions else 95.0

    retention_forecast = RetentionForecast(
        active_cards=active_cards,
        mature_cards=mature_cards,
        learning_cards=learning_cards,
        average_ease_factor=round(avg_ease, 2),
        predicted_retention_pct=predicted_retention_pct,
        due_today=due_today,
        due_in_3_days=due_in_3_days,
        due_in_7_days=due_in_7_days,
        due_in_14_days=due_in_14_days,
        forecast_days=forecast_days,
    )

    # 6. Socratic AI Tutor Interactions
    tutor_sessions = db.query(TutorSession).filter(
        TutorSession.course_id == course_id,
        TutorSession.user_id == user_id
    ).all()
    session_ids = [s.id for s in tutor_sessions]
    
    tutor_messages_count = 0
    if session_ids:
        tutor_messages_count = db.query(TutorMessage).filter(
            TutorMessage.session_id.in_(session_ids),
            TutorMessage.sender == "user"
        ).count()

    # 7. Activity Timeline & Study Streak
    # Aggregate past 14 days
    timeline_days: Dict[str, Dict[str, int]] = {}
    for i in range(13, -1, -1):
        day_date = (now - timedelta(days=i)).strftime("%Y-%m-%d")
        timeline_days[day_date] = {
            "assessments": 0,
            "reviews": 0,
            "messages": 0,
        }

    for a in attempts:
        d_str = a.created_at.strftime("%Y-%m-%d")
        if d_str in timeline_days:
            timeline_days[d_str]["assessments"] += 1

    # Estimate tutor message activity dates
    if session_ids:
        user_msgs = db.query(TutorMessage).filter(
            TutorMessage.session_id.in_(session_ids),
            TutorMessage.sender == "user"
        ).all()
        for msg in user_msgs:
            d_str = msg.created_at.strftime("%Y-%m-%d")
            if d_str in timeline_days:
                timeline_days[d_str]["messages"] += 1

    # Approximate reviews from flashcards last_reviewed_at
    for c in flashcards:
        if c.last_reviewed_at:
            d_str = c.last_reviewed_at.strftime("%Y-%m-%d")
            if d_str in timeline_days:
                timeline_days[d_str]["reviews"] += 1

    activity_timeline: List[ActivityTimelinePoint] = []
    active_dates_set = set()

    for d_str, counts in timeline_days.items():
        total_day_acts = counts["assessments"] + counts["reviews"] + counts["messages"]
        if total_day_acts > 0:
            active_dates_set.add(d_str)

        activity_timeline.append(
            ActivityTimelinePoint(
                date=d_str,
                assessments_count=counts["assessments"],
                reviews_count=counts["reviews"],
                tutor_messages_count=counts["messages"],
                mastery_snapshot=round(overall_mastery, 1),
            )
        )

    # Compute study streak
    streak = 0
    check_day = now.date()
    # Check if active today or yesterday
    today_str = check_day.strftime("%Y-%m-%d")
    yesterday_str = (check_day - timedelta(days=1)).strftime("%Y-%m-%d")
    
    start_offset = 0 if today_str in active_dates_set else (1 if yesterday_str in active_dates_set else -1)
    if start_offset >= 0:
        curr = check_day - timedelta(days=start_offset)
        while curr.strftime("%Y-%m-%d") in active_dates_set:
            streak += 1
            curr -= timedelta(days=1)
    else:
        streak = 1 if (len(attempts) > 0 or total_reviews > 0 or tutor_messages_count > 0) else 0

    total_interactions = len(attempts) + total_reviews + tutor_messages_count
    # Add estimated time for flashcards (30s each) and tutor messages (60s each)
    estimated_study_time_minutes = int(
        (total_study_time_seconds + (total_reviews * 30) + (tutor_messages_count * 60)) / 60
    )

    velocity = LearnerVelocity(
        overall_mastery_pct=round(overall_mastery, 1),
        mastered_concepts_count=mastered_count,
        total_concepts_count=total_concepts,
        mastery_velocity=mastery_velocity,
        study_streak_days=max(1, streak),
        total_study_time_minutes=estimated_study_time_minutes,
        total_interactions=total_interactions,
        assessment_attempts_count=len(attempts),
        flashcard_reviews_count=total_reviews,
        tutor_messages_count=tutor_messages_count,
    )

    # 8. Synthesize Pedagogical Executive Summary
    summary_parts = []
    summary_parts.append(
        f"Learner has established an overall course mastery level of {velocity.overall_mastery_pct:.1f}% "
        f"across {total_concepts} curricular concepts ({mastered_count} fully mastered)."
    )

    if mastery_velocity > 0:
        summary_parts.append(f"Cognitive trajectory exhibits positive velocity (+{mastery_velocity:.1f}% per session).")
    elif total_concepts > 0 and mastered_count == 0:
        summary_parts.append("Initial diagnostic assessments recommended to accelerate Bayesian Knowledge Tracing calibration.")

    # High Bloom analysis
    high_bloom_acc = [b for b in bloom_telemetry if b.level in ["apply", "analyze", "evaluate", "create"] and b.total_questions > 0]
    if high_bloom_acc:
        avg_high_acc = sum(b.accuracy_pct for b in high_bloom_acc) / len(high_bloom_acc)
        summary_parts.append(f"Higher-order cognitive tasks (Apply, Analyze, Evaluate) demonstrate {avg_high_acc:.1f}% accuracy.")

    # Top error category
    if misconception_telemetry:
        top_error = misconception_telemetry[0]
        summary_parts.append(
            f"Primary area for conceptual reinforcement: '{top_error.display_name}' ({top_error.percentage:.1f}% of errors). "
            f"{top_error.remediation_advice}"
        )

    # SRS Retention Status
    if active_cards > 0:
        summary_parts.append(
            f"Spaced Repetition engine tracks {active_cards} cards with a predicted retention rate of "
            f"{predicted_retention_pct:.1f}%. {due_today} review{'s' if due_today != 1 else ''} currently scheduled."
        )

    executive_summary = " ".join(summary_parts)

    return CourseAnalyticsReport(
        course_id=course.id,
        course_name=course.name,
        generated_at=now,
        velocity=velocity,
        bloom_telemetry=bloom_telemetry,
        misconception_telemetry=misconception_telemetry,
        retention_forecast=retention_forecast,
        activity_timeline=activity_timeline,
        concept_matrix=concept_matrix_items,
        executive_summary=executive_summary,
    )


def export_course_analytics_markdown(report: CourseAnalyticsReport) -> str:
    """Formats the comprehensive course analytics telemetry into a printable Markdown report."""
    md = []
    md.append(f"# 📊 Learning Analytics & Progress Telemetry Report")
    md.append(f"**Course Workspace:** {report.course_name} (`{report.course_id}`)")
    md.append(f"**Generated:** {report.generated_at.strftime('%Y-%m-%d %H:%M:%S UTC')}")
    md.append("\n---\n")

    md.append("## 1. Executive Summary")
    md.append(f"> {report.executive_summary}\n")

    md.append("## 2. Learner Velocity & Engagement Metrics")
    md.append("| Metric | Value | Description |")
    md.append("| :--- | :--- | :--- |")
    md.append(f"| **Overall Mastery** | **{report.velocity.overall_mastery_pct}%** | Average BKT $P(L)$ across curriculum |")
    md.append(f"| **Mastered Concepts** | **{report.velocity.mastered_concepts_count} / {report.velocity.total_concepts_count}** | Concepts with $P(L) \\ge 0.85$ |")
    md.append(f"| **Learning Velocity** | **{'+' if report.velocity.mastery_velocity >= 0 else ''}{report.velocity.mastery_velocity}%** | Delta mastery per study iteration |")
    md.append(f"| **Study Streak** | **{report.velocity.study_streak_days} days** | Consecutive active days |")
    md.append(f"| **Total Study Time** | **{report.velocity.total_study_time_minutes} min** | Assessment + flashcards + dialogue |")
    md.append(f"| **Total Interactions** | **{report.velocity.total_interactions}** | Total questions, reviews, dialogues |")
    md.append(f"| Assessment Attempts | {report.velocity.assessment_attempts_count} | Diagnostic submissions |")
    md.append(f"| Flashcard Reviews | {report.velocity.flashcard_reviews_count} | SM-2 spaced repetition cards reviewed |")
    md.append(f"| AI Tutor Queries | {report.velocity.tutor_messages_count} | Socratic conversational turns |")
    md.append("\n---\n")

    md.append("## 3. Cognitive Bloom's Taxonomy Performance")
    md.append("| Cognitive Level | Accuracy | Correct / Total | Pedagogical Scope |")
    md.append("| :--- | :--- | :--- | :--- |")
    for b in report.bloom_telemetry:
        bar = "🟩" * int(b.accuracy_pct // 20) + "⬜" * (5 - int(b.accuracy_pct // 20))
        md.append(f"| **{b.display_name}** | `{bar}` {b.accuracy_pct}% | {b.correct_questions} / {b.total_questions} | {b.description} |")
    md.append("\n---\n")

    md.append("## 4. Diagnostic Misconceptions & Error Taxonomy")
    if report.misconception_telemetry:
        md.append("| Cognitive Error Category | Frequency | Share | Targeted Remediation Guidance |")
        md.append("| :--- | :--- | :--- | :--- |")
        for m in report.misconception_telemetry:
            md.append(f"| **{m.display_name}** | {m.count} errors | {m.percentage}% | {m.remediation_advice} |")
    else:
        md.append("*No diagnostic assessment errors recorded to date. Perfect accuracy or assessments pending.*")
    md.append("\n---\n")

    md.append("## 5. Spaced Repetition (SM-2) Retention & Review Forecast")
    md.append(f"- **Active Deck:** {report.retention_forecast.active_cards} cards ({report.retention_forecast.mature_cards} mature, {report.retention_forecast.learning_cards} learning)")
    md.append(f"- **Average Ease Factor:** {report.retention_forecast.average_ease_factor}")
    md.append(f"- **Estimated Immediate Retention:** {report.retention_forecast.predicted_retention_pct}%")
    md.append(f"- **Upcoming Queue:** {report.retention_forecast.due_today} due today | {report.retention_forecast.due_in_3_days} due in 3 days | {report.retention_forecast.due_in_7_days} due in 7 days\n")

    md.append("### 14-Day Ebbinghaus Retention Forecast Curve")
    md.append("| Day Offset | Date | Projected Retention % | Scheduled Reviews |")
    md.append("| :--- | :--- | :--- | :--- |")
    for day in report.retention_forecast.forecast_days:
        md.append(f"| +{day.day_offset}d | {day.date_str} | {day.projected_retention_pct}% | {day.cards_due} cards |")
    md.append("\n---\n")

    md.append("## 6. Curricular Concept Mastery Matrix")
    if report.concept_matrix:
        md.append("| Concept | P(Mastery) | Status | Priority Score | Trajectory |")
        md.append("| :--- | :--- | :--- | :--- | :--- |")
        for c in report.concept_matrix:
            history_str = " → ".join([f"{h:.2f}" for h in c.history]) if c.history else f"{c.p_know:.2f}"
            badge = "✅" if c.is_mastered else ("⚠️" if c.p_know < 0.5 else "⏳")
            md.append(f"| **{c.concept_label}** | `{c.p_know:.2f}` | {badge} {c.status} | {c.priority_score:.2f} | `{history_str}` |")
    else:
        md.append("*No concepts currently tracked for this course.*")

    md.append("\n\n*Generated automatically by Knovara Pedagogical Analytics Engine.*")
    return "\n".join(md)
