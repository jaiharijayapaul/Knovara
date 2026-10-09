"""
Knovara Student Cohort Simulation (Req 5c).

Simulates 3 student profiles (Novice, Average, Advanced) through multi-session
trajectories reporting mastery gains and question repetition rate (< 5%).
"""

import os
import sys
import random
import asyncio
from typing import List, Dict, Any

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.bkt import BKTEngine, BKTParams
from app.assessment.generator import AssessmentGenerator
from evaluation.benchmark_rag import load_corpus


ARCHETYPES = {
    "Novice": {
        "p_l0": 0.15,
        "p_learn": 0.22,
        "p_slip": 0.18,
        "p_guess": 0.12,
        "base_accuracy": 0.45,
    },
    "Average": {
        "p_l0": 0.35,
        "p_learn": 0.26,
        "p_slip": 0.10,
        "p_guess": 0.15,
        "base_accuracy": 0.70,
    },
    "Advanced": {
        "p_l0": 0.65,
        "p_learn": 0.32,
        "p_slip": 0.05,
        "p_guess": 0.15,
        "base_accuracy": 0.90,
    },
}

SYLLABUS_TOPICS = [
    "Regression",
    "Classification",
    "Decision Trees",
    "Random Forest",
    "Support Vector Machines",
    "Clustering",
]


async def simulate_cohort():
    corpus = load_corpus()
    random.seed(42)

    archetype_results = {}
    all_cohort_stems = []
    total_stems_generated = 0
    total_duplicate_stems = 0

    for name, config in ARCHETYPES.items():
        # Initialize BKT state per topic
        bkt_states = {
            topic: BKTParams(
                p_know=config["p_l0"],
                p_learn=config["p_learn"],
                p_slip=config["p_slip"],
                p_guess=config["p_guess"],
            )
            for topic in SYLLABUS_TOPICS
        }
        current_p_know = {topic: config["p_l0"] for topic in SYLLABUS_TOPICS}

        student_past_stems = []
        session_logs = []

        # Simulate 5 sequential study & quiz sessions
        for session_idx in range(1, 6):
            # Select target topic for session based on lowest mastery
            lowest_topic = min(current_p_know.keys(), key=lambda t: current_p_know[t])
            
            # Generate 5 diagnostic questions with deduplication tracking
            blueprint = [
                {"topic": lowest_topic, "bloom_level": "understand", "difficulty": "medium", "reason": "Weakest concept remediation"},
                {"topic": lowest_topic, "bloom_level": "apply", "difficulty": "medium", "reason": "Procedural practice"},
                {"topic": random.choice(SYLLABUS_TOPICS), "bloom_level": "remember", "difficulty": "easy", "reason": "Retention check"},
                {"topic": random.choice(SYLLABUS_TOPICS), "bloom_level": "analyze", "difficulty": "hard", "reason": "Synthesis challenge"},
                {"topic": random.choice(SYLLABUS_TOPICS), "bloom_level": "understand", "difficulty": "medium", "reason": "Concept check"},
            ]

            levels = [b["bloom_level"] for b in blueprint]
            questions = AssessmentGenerator._generate_local_grounded_questions(
                chunks=corpus,
                levels=levels,
                difficulty="medium",
                course_name="Machine Learning",
                topic=lowest_topic,
                adaptive_blueprint=blueprint,
                previous_stems=student_past_stems,
            )

            session_correct = 0
            for q in questions:
                stem = q["question_text"].strip().lower()
                total_stems_generated += 1
                if stem in student_past_stems:
                    total_duplicate_stems += 1
                else:
                    student_past_stems.append(stem)
                    all_cohort_stems.append(stem)

                q_topic = q.get("topic") or lowest_topic
                if q_topic not in current_p_know:
                    q_topic = lowest_topic

                # Student response simulation: accuracy increases with P(L)
                p_current = current_p_know[q_topic]
                p_correct = p_current * (1.0 - config["p_slip"]) + (1.0 - p_current) * config["p_guess"]
                is_correct = random.random() < p_correct

                if is_correct:
                    session_correct += 1

                # Update BKT
                bkt_res = BKTEngine.update(
                    p_know=current_p_know[q_topic],
                    is_correct=is_correct,
                    params=bkt_states[q_topic],
                )
                current_p_know[q_topic] = bkt_res.p_know_next

            avg_session_p = sum(current_p_know.values()) / len(current_p_know)
            session_logs.append({
                "session": session_idx,
                "score": f"{session_correct}/5",
                "accuracy": f"{round((session_correct/5)*100, 1)}%",
                "mean_p_know": round(avg_session_p, 3),
            })

        initial_p = config["p_l0"]
        final_p = sum(current_p_know.values()) / len(current_p_know)
        mastery_gain_pct = round((final_p - initial_p) * 100, 1)
        mastered_topics_count = sum(1 for p in current_p_know.values() if p >= 0.90)

        archetype_results[name] = {
            "initial_p": initial_p,
            "final_p": round(final_p, 3),
            "gain_pct": mastery_gain_pct,
            "mastered_topics": f"{mastered_topics_count}/{len(SYLLABUS_TOPICS)}",
            "session_logs": session_logs,
            "questions_answered": len(student_past_stems),
        }

    # Calculate overall question repetition rate across all sessions
    rep_rate_pct = round((total_duplicate_stems / total_stems_generated) * 100, 2) if total_stems_generated else 0.0

    report = (
        "# Knovara Student Cohort Simulation Report (Req 5c)\n\n"
        "**Multi-Session Trajectory Tracking & Deduplication Verification**\n\n"
        "## 1. Executive Summary\n\n"
        f"- **Simulated Archetypes:** Novice, Average, Advanced\n"
        f"- **Sessions per Student:** 5 Multi-Stage Diagnostic Sessions (25 Questions per Archetype)\n"
        f"- **Total Questions Evaluated:** {total_stems_generated}\n"
        f"- **Question Repetition Rate:** **{rep_rate_pct}%** (Target SLA: $< 5.0\\%$ — {'✅ PASS' if rep_rate_pct < 5.0 else '⚠️ FAIL'})\n\n"
        "## 2. Archetype Learning Trajectories\n\n"
        "| Student Archetype | Initial Mastery $P(L_0)$ | Final Mastery $P(L_5)$ | Mastery Gain $\\Delta P(L)$ | Topics Mastered | Repetition Rate |\n"
        "|:---|:---:|:---:|:---:|:---:|:---:|\n"
    )

    for name, r in archetype_results.items():
        report += (
            f"| **{name}** | {round(r['initial_p']*100, 1)}% | "
            f"**{round(r['final_p']*100, 1)}%** | **+{r['gain_pct']}%** | "
            f"{r['mastered_topics']} | **{rep_rate_pct}%** |\n"
        )

    report += "\n## 3. Sequential Session Breakdown\n\n"
    for name, r in archetype_results.items():
        report += f"### {name} Student Progression\n\n"
        report += "| Session | Diagnostic Score | Accuracy | Mean Concept Mastery $P(L)$ |\n"
        report += "|:---:|:---:|:---:|:---:|\n"
        for log in r["session_logs"]:
            report += f"| S{log['session']} | {log['score']} | {log['accuracy']} | **{round(log['mean_p_know']*100, 1)}%** |\n"
        report += "\n"

    report_path = os.path.join(os.path.dirname(__file__), "student_cohort_simulation_report.md")
    with open(report_path, "w", encoding="utf-8") as f:
        f.write(report)

    print(report)
    return {
        "repetition_rate": rep_rate_pct,
        "archetypes": archetype_results,
    }


if __name__ == "__main__":
    asyncio.run(simulate_cohort())
