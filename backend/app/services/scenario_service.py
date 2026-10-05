"""
Service to seed a complete, realistic, presentation-ready learner journey.

Populates:
1. Ingested multimodal materials (PDF, PPTX, Video Transcripts) with citation coordinates.
2. Calibrated Bayesian Knowledge Tracing (BKT) Hidden Markov Model state curves.
3. Diagnostic assessment attempts with 6 Bloom levels and categorized error traps.
4. Grounded Spaced Repetition (SM-2) flashcard deck with mature and due review queues.
5. Socratic AI Tutor remediation and deep-dive dialogue trajectories.
"""

import json
import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, Any
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.models.course import Course, Topic
from app.models.mastery import LearnerConceptMastery
from app.models.assessment import Assessment, Question, AssessmentAttempt, QuestionResponseLog
from app.models.flashcard import FlashcardDeck, Flashcard
from app.models.tutor import TutorSession, TutorMessage
from app.services.document_service import DocumentService
from app.repositories.document_repository import DocumentRepository

logger = logging.getLogger(__name__)


def seed_full_course_scenario(db: Session, course_id: str, user_id: str) -> Dict[str, Any]:
    """Seeds a full realistic presentation scenario into a course workspace."""
    course = db.query(Course).filter(Course.id == course_id, Course.user_id == user_id).first()
    if not course:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Course workspace not found or unauthorized.",
        )

    now = datetime.now(timezone.utc)

    # Check if this course already has documents
    docs = DocumentRepository.list_by_course(db, course_id)
    
    # 1. Ensure Multimodal Documents are seeded (only if no documents exist)
    if not docs:
        try:
            DocumentService.seed_demo_materials(db, course_id, user_id)
        except Exception as e:
            logger.info(f"Demo materials note: {e}")

    # 2. Seed / Update Curricular Topics
    demo_topics = [
        ("Regression", "Linear & polynomial regression, cost functions, gradient descent optimization, and regularization (L1/L2)."),
        ("Classification", "Logistic regression, decision boundaries, ROC-AUC, precision, recall, and cross-entropy loss."),
        ("Decision Trees", "Entropy, Information Gain, Gini impurity, tree pruning, ID3/CART algorithms, and split criteria."),
        ("Random Forest", "Ensemble bagging techniques, feature bootstrap aggregation, out-of-bag error, and variance reduction."),
        ("Support Vector Machines (SVM)", "Maximum margin classifiers, slack variables, soft margins, and kernel tricks (RBF, Polynomial)."),
        ("Clustering", "Unsupervised K-Means clustering, centroid convergence, hierarchical dendrograms, and silhouette validation."),
    ]
    existing_topics = {t.name: t for t in course.topics}
    for t_name, t_desc in demo_topics:
        if t_name not in existing_topics:
            new_t = Topic(course_id=course.id, name=t_name, description=t_desc)
            db.add(new_t)
    db.commit()

    # 3. Seed Calibrated Bayesian Knowledge Tracing (BKT)
    bkt_calibration = [
        {
            "concept": "Classification",
            "p_know": 0.92,
            "p_learn": 0.22,
            "p_guess": 0.14,
            "p_slip": 0.08,
            "attempts": 12,
            "correct": 11,
            "is_mastered": True,
            "priority": 0.15,
            "history": [0.30, 0.52, 0.74, 0.86, 0.92],
        },
        {
            "concept": "Decision Trees",
            "p_know": 0.88,
            "p_learn": 0.25,
            "p_guess": 0.15,
            "p_slip": 0.09,
            "attempts": 9,
            "correct": 8,
            "is_mastered": True,
            "priority": 0.22,
            "history": [0.30, 0.55, 0.72, 0.88],
        },
        {
            "concept": "Regression",
            "p_know": 0.68,
            "p_learn": 0.24,
            "p_guess": 0.16,
            "p_slip": 0.11,
            "attempts": 7,
            "correct": 5,
            "is_mastered": False,
            "priority": 0.58,
            "history": [0.30, 0.44, 0.58, 0.68],
        },
        {
            "concept": "Random Forest",
            "p_know": 0.54,
            "p_learn": 0.20,
            "p_guess": 0.15,
            "p_slip": 0.12,
            "attempts": 5,
            "correct": 3,
            "is_mastered": False,
            "priority": 0.75,
            "history": [0.30, 0.41, 0.54],
        },
        {
            "concept": "Clustering",
            "p_know": 0.38,
            "p_learn": 0.18,
            "p_guess": 0.14,
            "p_slip": 0.14,
            "attempts": 4,
            "correct": 1,
            "is_mastered": False,
            "priority": 0.91,
            "history": [0.30, 0.26, 0.38],
        },
        {
            "concept": "Support Vector Machines (SVM)",
            "p_know": 0.28,
            "p_learn": 0.15,
            "p_guess": 0.12,
            "p_slip": 0.15,
            "attempts": 4,
            "correct": 1,
            "is_mastered": False,
            "priority": 0.98,
            "history": [0.30, 0.25, 0.28],
        },
    ]

    for item in bkt_calibration:
        m = db.query(LearnerConceptMastery).filter(
            LearnerConceptMastery.course_id == course_id,
            LearnerConceptMastery.user_id == user_id,
            LearnerConceptMastery.concept_label == item["concept"],
        ).first()
        if not m:
            m = LearnerConceptMastery(
                course_id=course_id,
                user_id=user_id,
                concept_label=item["concept"],
            )
            db.add(m)
        m.p_know = item["p_know"]
        m.p_learn = item["p_learn"]
        m.p_guess = item["p_guess"]
        m.p_slip = item["p_slip"]
        m.total_attempts = item["attempts"]
        m.correct_attempts = item["correct"]
        m.is_mastered = item["is_mastered"]
        m.priority_score = item["priority"]
        m.p_know_history_json = json.dumps(item["history"])
        m.last_updated = now

    db.commit()

    # 4. Seed Diagnostic Assessment & Attempt with Categorized Misconceptions
    existing_assessment = db.query(Assessment).filter(
        Assessment.course_id == course_id,
        Assessment.title.like("%Comprehensive Benchmark%")
    ).first()

    if not existing_assessment:
        assessment = Assessment(
            course_id=course_id,
            user_id=user_id,
            title="Comprehensive Benchmark & Bloom Diagnostic",
            description="Evaluates cognitive depth from factual definitions to architectural synthesis.",
            topic="Machine Learning Foundations",
            difficulty="adaptive",
            is_adaptive=True,
            pass_percentage=70.0,
            total_points=60.0,
        )
        db.add(assessment)
        db.flush()

        # Questions across Bloom levels
        q1 = Question(
            assessment_id=assessment.id,
            course_id=course_id,
            topic="Regression",
            bloom_level="remember",
            difficulty="easy",
            question_type="multiple_choice",
            question_text="In linear regression, what mathematical operation defines the Mean Squared Error (MSE) loss function?",
            options_json=json.dumps([
                {"id": "A", "text": "Average of squared differences between ground truth and predicted values", "is_correct": True},
                {"id": "B", "text": "Sum of absolute values of residuals scaled by variance", "is_correct": False, "misconception": "Confusing L2 MSE with L1 Mean Absolute Error"},
                {"id": "C", "text": "Logarithmic cross-entropy of binary probability distributions", "is_correct": False, "misconception": "Confusing continuous regression loss with classification loss"},
                {"id": "D", "text": "Maximum margin distance to the decision boundary hyperplane", "is_correct": False, "misconception": "Confusing regression loss with SVM margin optimization"}
            ]),
            correct_answer_json=json.dumps(["A"]),
            explanation="Mean Squared Error is mathematically defined as (1/N) * sum((y_i - y_hat_i)^2).",
            points=10.0,
            order_index=0,
            citation_label="[Doc 1: Page 14]",
            document_name="Machine_Learning_Core_Principles.pdf",
            page_number=14,
        )

        q2 = Question(
            assessment_id=assessment.id,
            course_id=course_id,
            topic="Classification",
            bloom_level="understand",
            difficulty="medium",
            question_type="multiple_choice",
            question_text="Why does logistic regression utilize the Sigmoid (logistic) function rather than standard linear outputs?",
            options_json=json.dumps([
                {"id": "A", "text": "To map continuous unbounded real numbers into a calibrated [0, 1] probability range", "is_correct": True},
                {"id": "B", "text": "To guarantee that the loss surface becomes globally convex without regularization", "is_correct": False, "misconception": "Unchecked assumption: Sigmoid alone does not establish convexity; cross-entropy pairing does"},
                {"id": "C", "text": "To eliminate the need for gradient descent optimization algorithms", "is_correct": False, "misconception": "Factual misconception: Logistic regression still uses gradient descent"},
                {"id": "D", "text": "To compute kernel projections into infinite-dimensional Hilbert spaces", "is_correct": False, "misconception": "Confusing logistic activation with SVM kernel tricks"}
            ]),
            correct_answer_json=json.dumps(["A"]),
            explanation="The Sigmoid function sigma(z) = 1 / (1 + e^-z) smoothly compresses the real line into (0, 1).",
            points=10.0,
            order_index=1,
            citation_label="[Doc 1: Page 22]",
            document_name="Machine_Learning_Core_Principles.pdf",
            page_number=22,
        )

        q3 = Question(
            assessment_id=assessment.id,
            course_id=course_id,
            topic="Decision Trees",
            bloom_level="apply",
            difficulty="medium",
            question_type="multiple_choice",
            question_text="Given a dataset partition with 8 positive and 8 negative instances, what is its Shannon Entropy H(S)?",
            options_json=json.dumps([
                {"id": "A", "text": "1.0 bit (maximum impurity)", "is_correct": True},
                {"id": "B", "text": "0.5 bits (proportional split)", "is_correct": False, "misconception": "Formula inversion: Dividing probability by 2 rather than evaluating -p*log2(p)"},
                {"id": "C", "text": "0.0 bits (homogeneous subset)", "is_correct": False, "misconception": "Factual misconception: Zero entropy only occurs when all instances belong to one class"},
                {"id": "D", "text": "0.25 bits (Gini impurity confusion)", "is_correct": False, "misconception": "Confusing Shannon Entropy with Gini Impurity (which would be 0.50)"}
            ]),
            correct_answer_json=json.dumps(["A"]),
            explanation="When classes are perfectly balanced (p=0.5, p=0.5), H(S) = -0.5*log2(0.5) - 0.5*log2(0.5) = 1.0.",
            points=10.0,
            order_index=2,
            citation_label="[Doc 2: Slide 6]",
            document_name="Lecture_04_Decision_Trees.pptx",
            slide_number=6,
        )

        q4 = Question(
            assessment_id=assessment.id,
            course_id=course_id,
            topic="Random Forest",
            bloom_level="analyze",
            difficulty="hard",
            question_type="multiple_choice",
            question_text="How does random feature subspace selection (decorrelation) directly reduce ensemble prediction error in Random Forests?",
            options_json=json.dumps([
                {"id": "A", "text": "It reduces the correlation rho between individual trees, thereby reducing overall ensemble variance", "is_correct": True},
                {"id": "B", "text": "It substantially decreases the bias of each individual decision tree estimator", "is_correct": False, "misconception": "Procedural slip: Restricting split features slightly increases tree bias; the benefit is variance reduction"},
                {"id": "C", "text": "It forces trees to become identical, standardizing gradient updates", "is_correct": False, "misconception": "Conceptual inversion: The goal of Random Forest is diversity, not identical trees"},
                {"id": "D", "text": "It removes the requirement for out-of-bag validation subsets", "is_correct": False, "misconception": "Distractor trap: OOB evaluation remains fully applicable"}
            ]),
            correct_answer_json=json.dumps(["A"]),
            explanation="Ensemble variance = rho * sigma^2 + (1 - rho)/B * sigma^2. Lowering rho reduces the first term.",
            points=10.0,
            order_index=3,
            citation_label="[Doc 2: Slide 11]",
            document_name="Lecture_04_Decision_Trees.pptx",
            slide_number=11,
        )

        q5 = Question(
            assessment_id=assessment.id,
            course_id=course_id,
            topic="Support Vector Machines (SVM)",
            bloom_level="evaluate",
            difficulty="hard",
            question_type="multiple_choice",
            question_text="When training an SVM on noisy non-separable data, what is the consequence of setting the slack penalty parameter C extremely high?",
            options_json=json.dumps([
                {"id": "A", "text": "The margin narrows and prioritizes minimizing classification errors, increasing overfitting risk", "is_correct": True},
                {"id": "B", "text": "The margin widens excessively, tolerating high training error and causing underfitting", "is_correct": False, "misconception": "Formula inversion: High C penalizes errors heavily (narrow margin); low C produces wide margins"},
                {"id": "C", "text": "The kernel transformation automatically degenerates into a linear dot product", "is_correct": False, "misconception": "Factual misconception: C affects the objective trade-off, not the kernel function choice"},
                {"id": "D", "text": "Support vectors are restricted strictly to positive instances", "is_correct": False, "misconception": "Distractor trap: Support vectors can come from both positive and negative classes"}
            ]),
            correct_answer_json=json.dumps(["A"]),
            explanation="Objective = (1/2)||w||^2 + C * sum(xi_i). Very high C penalizes any slack violations, leading to narrow margins.",
            points=10.0,
            order_index=4,
            citation_label="[Doc 3: 08:30-10:15]",
            document_name="Workshop_SVM_Optimization.mp4",
            timestamp_start="08:30",
            timestamp_end="10:15",
        )

        q6 = Question(
            assessment_id=assessment.id,
            course_id=course_id,
            topic="Clustering",
            bloom_level="create",
            difficulty="hard",
            question_type="multiple_choice",
            question_text="You must cluster high-dimensional customer embeddings with irregular non-globular manifold topologies. Why is standard K-Means fundamentally unsuitable?",
            options_json=json.dumps([
                {"id": "A", "text": "K-Means assumes isotropic spherical cluster geometries and Euclidean distance partitions", "is_correct": True},
                {"id": "B", "text": "K-Means requires labeled ground truth validation classes for centroid calculation", "is_correct": False, "misconception": "Factual misconception: K-Means is completely unsupervised and needs no labels"},
                {"id": "C", "text": "K-Means computation scales exponentially O(2^N) with sample cardinality", "is_correct": False, "misconception": "Calculation/complexity error: K-Means per iteration is O(k * N * d), which is linear in N"},
                {"id": "D", "text": "Centroids cannot be represented in Euclidean vector spaces", "is_correct": False, "misconception": "Dimensionality confusion: Centroids are simply mean vectors in R^d"}
            ]),
            correct_answer_json=json.dumps(["A"]),
            explanation="Standard K-Means relies on Voronoi cells bounded by linear hyperplanes, failing on complex manifolds (use DBSCAN or Spectral Clustering).",
            points=10.0,
            order_index=5,
            citation_label="[Doc 3: 14:20-16:45]",
            document_name="Workshop_SVM_Optimization.mp4",
            timestamp_start="14:20",
            timestamp_end="16:45",
        )

        db.add_all([q1, q2, q3, q4, q5, q6])
        db.flush()

        # Seed Completed Attempt with realistic error distribution: 4 correct (40/60 = 66.7%), 2 misconceptions
        attempt = AssessmentAttempt(
            assessment_id=assessment.id,
            course_id=course_id,
            user_id=user_id,
            score=40.0,
            total_points=60.0,
            percentage=66.7,
            passed=False,
            time_spent_seconds=340,
            error_summary_json=json.dumps({
                "formula_inversion": 1,
                "factual_misconception": 1,
            }),
            bloom_summary_json=json.dumps({
                "remember": {"earned": 10.0, "total": 10.0, "accuracy": 1.0},
                "understand": {"earned": 10.0, "total": 10.0, "accuracy": 1.0},
                "apply": {"earned": 10.0, "total": 10.0, "accuracy": 1.0},
                "analyze": {"earned": 10.0, "total": 10.0, "accuracy": 1.0},
                "evaluate": {"earned": 0.0, "total": 10.0, "accuracy": 0.0},
                "create": {"earned": 0.0, "total": 10.0, "accuracy": 0.0},
            }),
            created_at=now - timedelta(hours=3),
        )
        db.add(attempt)
        db.flush()

        # Question responses:
        # Q1: Correct
        r1 = QuestionResponseLog(
            attempt_id=attempt.id,
            question_id=q1.id,
            selected_answers_json=json.dumps(["A"]),
            is_correct=True,
            points_earned=10.0,
            points_possible=10.0,
            bloom_level="remember",
            error_category="none",
            created_at=now - timedelta(hours=3),
        )
        # Q2: Correct
        r2 = QuestionResponseLog(
            attempt_id=attempt.id,
            question_id=q2.id,
            selected_answers_json=json.dumps(["A"]),
            is_correct=True,
            points_earned=10.0,
            points_possible=10.0,
            bloom_level="understand",
            error_category="none",
            created_at=now - timedelta(hours=3),
        )
        # Q3: Correct
        r3 = QuestionResponseLog(
            attempt_id=attempt.id,
            question_id=q3.id,
            selected_answers_json=json.dumps(["A"]),
            is_correct=True,
            points_earned=10.0,
            points_possible=10.0,
            bloom_level="apply",
            error_category="none",
            created_at=now - timedelta(hours=3),
        )
        # Q4: Correct
        r4 = QuestionResponseLog(
            attempt_id=attempt.id,
            question_id=q4.id,
            selected_answers_json=json.dumps(["A"]),
            is_correct=True,
            points_earned=10.0,
            points_possible=10.0,
            bloom_level="analyze",
            error_category="none",
            created_at=now - timedelta(hours=3),
        )
        # Q5: Incorrect (Formula Inversion on SVM slack C)
        r5 = QuestionResponseLog(
            attempt_id=attempt.id,
            question_id=q5.id,
            selected_answers_json=json.dumps(["B"]),
            is_correct=False,
            points_earned=0.0,
            points_possible=10.0,
            bloom_level="evaluate",
            error_category="formula_inversion",
            misconception_diagnosis="Inverted the effect of slack penalty C: High C enforces strict margin violations (narrower margin), whereas you selected that it produces wider margins.",
            remediation_hint="Review the primal SVM objective function (1/2)||w||^2 + C * sum(xi). Note how multiplying slack penalties by a large C forces the optimizer to drive slack toward zero.",
            created_at=now - timedelta(hours=3),
        )
        # Q6: Incorrect (Factual Misconception on K-Means supervision)
        r6 = QuestionResponseLog(
            attempt_id=attempt.id,
            question_id=q6.id,
            selected_answers_json=json.dumps(["B"]),
            is_correct=False,
            points_earned=0.0,
            points_possible=10.0,
            bloom_level="create",
            error_category="factual_misconception",
            misconception_diagnosis="Factual error regarding model supervision: K-Means is entirely unsupervised and operates strictly by iteratively computing cluster centroid means without target labels.",
            remediation_hint="Review unsupervised clustering paradigms. Re-examine the Lloyd's algorithm update step where centroids are updated purely from assigned data coordinates.",
            created_at=now - timedelta(hours=3),
        )

        db.add_all([r1, r2, r3, r4, r5, r6])
        db.commit()

    # 5. Seed Grounded Flashcards Deck (SM-2 Spaced Repetition)
    deck = db.query(FlashcardDeck).filter(
        FlashcardDeck.course_id == course_id,
        FlashcardDeck.user_id == user_id,
    ).first()
    if not deck:
        deck = FlashcardDeck(
            course_id=course_id,
            user_id=user_id,
            title="Core Machine Learning & Optimization Flashcards",
            description="Essential theorems, loss functions, and algorithmic principles.",
        )
        db.add(deck)
        db.flush()

    existing_card_count = db.query(Flashcard).filter(
        Flashcard.course_id == course_id,
        Flashcard.user_id == user_id,
    ).count()

    if existing_card_count < 6:
        demo_cards = [
            {
                "topic": "Regression",
                "front": "What is the primary difference between L1 (Lasso) and L2 (Ridge) Regularization?",
                "back": "L1 adds sum of absolute weights (|w|), driving coefficients to exact zero (feature selection). L2 adds sum of squared weights (w^2), shrinking weights smoothly toward zero without zeroing them.",
                "hint": "Think sparsity vs weight decay.",
                "bloom": "understand",
                "citation": "[Doc 1: Page 18]",
                "doc_name": "Machine_Learning_Core_Principles.pdf",
                "reps": 4,
                "interval": 28.0,
                "ease": 2.65,
                "due": now + timedelta(days=12),
                "reviews": 4,
                "lapses": 0,
            },
            {
                "topic": "Classification",
                "front": "What does an Area Under the ROC Curve (ROC-AUC) of 0.50 indicate?",
                "back": "A classifier with no discriminative capability that performs no better than random guessing.",
                "hint": "Diagonal line from (0,0) to (1,1).",
                "bloom": "remember",
                "citation": "[Doc 1: Page 26]",
                "doc_name": "Machine_Learning_Core_Principles.pdf",
                "reps": 5,
                "interval": 35.0,
                "ease": 2.70,
                "due": now + timedelta(days=18),
                "reviews": 5,
                "lapses": 0,
            },
            {
                "topic": "Decision Trees",
                "front": "Why is Gain Ratio often favored over raw Information Gain in decision tree splits?",
                "back": "Information Gain is inherently biased toward attributes with many distinct categorical values. Gain Ratio normalizes by Split Information, penalizing hyper-fragmented partitions.",
                "hint": "C4.5 improvement over ID3.",
                "bloom": "analyze",
                "citation": "[Doc 2: Slide 8]",
                "doc_name": "Lecture_04_Decision_Trees.pptx",
                "reps": 3,
                "interval": 9.0,
                "ease": 2.45,
                "due": now + timedelta(days=4),
                "reviews": 3,
                "lapses": 1,
            },
            {
                "topic": "Random Forest",
                "front": "How is Out-of-Bag (OOB) error calculated in a Random Forest ensemble?",
                "back": "Each tree is evaluated strictly on the ~36.8% of bootstrap samples withheld during its training, providing an unbiased validation estimate without a separate test split.",
                "hint": "Bootstrap sampling probability: lim (1 - 1/N)^N = 1/e.",
                "bloom": "understand",
                "citation": "[Doc 2: Slide 12]",
                "doc_name": "Lecture_04_Decision_Trees.pptx",
                "reps": 2,
                "interval": 5.0,
                "ease": 2.40,
                "due": now + timedelta(days=2),
                "reviews": 2,
                "lapses": 0,
            },
            {
                "topic": "Support Vector Machines (SVM)",
                "front": "What are Support Vectors in an optimal margin hyperplane?",
                "back": "The subset of training data points that lie directly on the canonical margins (w^T x + b = +-1) or violate them. They solely determine the position and orientation of the decision boundary.",
                "hint": "If non-support vectors are removed, the boundary remains unchanged.",
                "bloom": "remember",
                "citation": "[Doc 3: 05:15-07:20]",
                "doc_name": "Workshop_SVM_Optimization.mp4",
                "reps": 1,
                "interval": 1.0,
                "ease": 2.30,
                "due": now - timedelta(hours=2),  # DUE TODAY
                "reviews": 1,
                "lapses": 1,
            },
            {
                "topic": "Clustering",
                "front": "How does the Silhouette Coefficient evaluate cluster cohesion and separation?",
                "back": "For sample i: s(i) = (b(i) - a(i)) / max(a(i), b(i)), where a(i) is mean intra-cluster distance and b(i) is mean nearest-cluster distance. Ranges from -1 (misclustered) to +1 (dense, well-separated).",
                "hint": "Compare distance within cluster vs distance to closest neighboring cluster.",
                "bloom": "apply",
                "citation": "[Doc 3: 16:10-18:00]",
                "doc_name": "Workshop_SVM_Optimization.mp4",
                "reps": 1,
                "interval": 1.0,
                "ease": 2.35,
                "due": now - timedelta(hours=1),  # DUE TODAY
                "reviews": 1,
                "lapses": 1,
            },
        ]

        for card_data in demo_cards:
            fc = Flashcard(
                deck_id=deck.id,
                course_id=course_id,
                user_id=user_id,
                topic=card_data["topic"],
                front=card_data["front"],
                back=card_data["back"],
                hint=card_data["hint"],
                bloom_level=card_data["bloom"],
                citation_label=card_data["citation"],
                document_name=card_data["doc_name"],
                repetitions=card_data["reps"],
                interval_days=card_data["interval"],
                ease_factor=card_data["ease"],
                next_review_at=card_data["due"],
                last_reviewed_at=now - timedelta(days=2),
                total_reviews=card_data["reviews"],
                lapses=card_data["lapses"],
                created_at=now - timedelta(days=14),
            )
            db.add(fc)
        db.commit()

    # 6. Seed Socratic AI Tutor Remediation Dialogue
    existing_tutor_session = db.query(TutorSession).filter(
        TutorSession.course_id == course_id,
        TutorSession.user_id == user_id,
        TutorSession.title.like("%Targeted Remediation%")
    ).first()

    if not existing_tutor_session:
        session = TutorSession(
            course_id=course_id,
            user_id=user_id,
            title="Targeted Remediation: SVM Margin Optimization & Slack Penalty",
            pedagogical_mode="misconception_buster",
            topic="Support Vector Machines (SVM)",
            created_at=now - timedelta(hours=2),
        )
        db.add(session)
        db.flush()

        m1 = TutorMessage(
            session_id=session.id,
            sender="assistant",
            pedagogical_mode="misconception_buster",
            content=(
                "Hello! Let's explore your intuition on the Support Vector Machine slack parameter C.\n\n"
                "In your diagnostic assessment, you selected that setting C extremely high produces a wider margin. "
                "In your own words, what was your initial line of reasoning when considering what the slack variables xi_i represent?"
            ),
            citations_json=json.dumps([{
                "chunk_id": "demo-svm-1",
                "document_id": "doc-svm",
                "document_name": "Workshop_SVM_Optimization.mp4",
                "file_type": "video",
                "snippet": "The optimization objective min 1/2 ||w||^2 + C sum xi balances wide margin against margin violations.",
                "score": 0.95,
                "semantic_score": 0.95,
                "keyword_score": 0.95,
                "citation_label": "[Doc 3: 08:30-10:15]"
            }]),
            created_at=now - timedelta(hours=2),
        )

        m2 = TutorMessage(
            session_id=session.id,
            sender="user",
            content=(
                "I thought a larger C meant more capacity or room for points to be inside the margin, like a larger budget."
            ),
            created_at=now - timedelta(hours=1, minutes=55),
        )

        m3 = TutorMessage(
            session_id=session.id,
            sender="assistant",
            pedagogical_mode="misconception_buster",
            content=(
                "That's a very common trap! It's intuitive to think of C as an allowable 'slack budget', but in the objective function:\n\n"
                "$$\\min_{w, b, \\xi} \\frac{1}{2}\\|w\\|^2 + C \\sum_{i=1}^N \\xi_i$$\n\n"
                "Notice that C is a **penalty multiplier** in front of the violation sum. If C is huge (approaching infinity), what happens to the total loss if even a single point has a non-zero slack $\\xi_i > 0$?"
            ),
            citations_json=json.dumps([{
                "chunk_id": "demo-svm-2",
                "document_id": "doc-svm",
                "document_name": "Workshop_SVM_Optimization.mp4",
                "file_type": "video",
                "snippet": "As C -> infinity, we recover the hard margin SVM formulation with zero tolerance for training errors.",
                "score": 0.96,
                "semantic_score": 0.96,
                "keyword_score": 0.96,
                "citation_label": "[Doc 3: 10:15-12:00]"
            }]),
            created_at=now - timedelta(hours=1, minutes=50),
        )

        db.add_all([m1, m2, m3])
        db.commit()

    logger.info(f"Successfully seeded comprehensive full-lifecycle presentation scenario for course {course_id}")
    return {
        "course_id": course_id,
        "course_name": course.name,
        "topics_count": len(course.topics),
        "bkt_concepts_calibrated": len(bkt_calibration),
        "assessment_title": "Comprehensive Benchmark & Bloom Diagnostic",
        "flashcards_count": db.query(Flashcard).filter(Flashcard.course_id == course_id, Flashcard.user_id == user_id).count(),
        "status": "ready_for_defense_presentation",
    }


def seed_deep_learning_scenario(db: Session, course_id: str, user_id: str) -> Dict[str, Any]:
    """Seeds a full realistic presentation scenario for the Deep Learning workspace."""
    course = db.query(Course).filter(Course.id == course_id, Course.user_id == user_id).first()
    if not course:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Course workspace not found or unauthorized.",
        )

    now = datetime.now(timezone.utc)

    # 1. Seed Multimodal Documents
    docs = DocumentRepository.list_by_course(db, course_id)
    if not docs:
        try:
            DocumentService.seed_deep_learning_materials(db, course_id, user_id)
        except Exception as e:
            logger.info(f"Deep learning materials note: {e}")

    # 2. Seed / Update Curricular Topics
    dl_topics = [
        ("Artificial Neural Networks & Perceptrons", "Biological vs artificial neurons, input weights, biases, linear combinations, and forward pass computation."),
        ("Activation Functions", "Non-linear transformations: ReLU, Leaky ReLU, Sigmoid, Tanh, GELU, and preventing multi-layer linear collapse."),
        ("Loss Functions & Backpropagation", "Cross-entropy loss, Mean Squared Error (MSE), chain rule of calculus, and error gradient propagation."),
        ("Optimization & Gradient Descent", "Learning rate scheduling, SGD with momentum, RMSprop, Adam optimizer, and vanishing/exploding gradients."),
        ("Convolutional Neural Networks (CNN)", "Kernels/filters, 2D convolutions, padding, strides, max/average pooling, and spatial hierarchy feature extraction."),
        ("Sequence Models (RNN & LSTM)", "Sequential temporal data processing, hidden recurrent states, vanishing gradients across time, and LSTM gating mechanisms."),
        ("Transformers & Self-Attention", "Self-attention mechanism, Query-Key-Value (Q, K, V) scaled dot-product attention, multi-head attention, and foundation models."),
        ("Regularization & Normalization", "Dropout, L2 weight decay, Batch Normalization, Layer Normalization, and Early Stopping to prevent overfitting."),
    ]
    existing_topics = {t.name: t for t in course.topics}
    for t_name, t_desc in dl_topics:
        if t_name not in existing_topics:
            new_t = Topic(course_id=course.id, name=t_name, description=t_desc)
            db.add(new_t)
    db.commit()

    # 3. Seed BKT Calibration for Deep Learning concepts
    bkt_calibration = [
        {
            "concept": "Artificial Neural Networks & Perceptrons",
            "p_know": 0.92,
            "p_learn": 0.22,
            "p_guess": 0.14,
            "p_slip": 0.08,
            "attempts": 12,
            "correct": 11,
            "is_mastered": True,
            "priority": 0.15,
            "history": [0.30, 0.55, 0.75, 0.88, 0.92],
        },
        {
            "concept": "Activation Functions",
            "p_know": 0.86,
            "p_learn": 0.25,
            "p_guess": 0.15,
            "p_slip": 0.09,
            "attempts": 10,
            "correct": 9,
            "is_mastered": True,
            "priority": 0.20,
            "history": [0.30, 0.50, 0.72, 0.86],
        },
        {
            "concept": "Loss Functions & Backpropagation",
            "p_know": 0.72,
            "p_learn": 0.24,
            "p_guess": 0.16,
            "p_slip": 0.11,
            "attempts": 8,
            "correct": 6,
            "is_mastered": False,
            "priority": 0.52,
            "history": [0.30, 0.45, 0.60, 0.72],
        },
        {
            "concept": "Optimization & Gradient Descent",
            "p_know": 0.65,
            "p_learn": 0.20,
            "p_guess": 0.15,
            "p_slip": 0.12,
            "attempts": 6,
            "correct": 4,
            "is_mastered": False,
            "priority": 0.60,
            "history": [0.30, 0.45, 0.65],
        },
        {
            "concept": "Convolutional Neural Networks (CNN)",
            "p_know": 0.45,
            "p_learn": 0.18,
            "p_guess": 0.18,
            "p_slip": 0.14,
            "attempts": 4,
            "correct": 2,
            "is_mastered": False,
            "priority": 0.82,
            "history": [0.30, 0.38, 0.45],
        },
        {
            "concept": "Transformers & Self-Attention",
            "p_know": 0.35,
            "p_learn": 0.16,
            "p_guess": 0.20,
            "p_slip": 0.15,
            "attempts": 3,
            "correct": 1,
            "is_mastered": False,
            "priority": 0.94,
            "history": [0.30, 0.35],
        },
    ]

    for cal in bkt_calibration:
        mastery = db.query(LearnerConceptMastery).filter(
            LearnerConceptMastery.course_id == course_id,
            LearnerConceptMastery.user_id == user_id,
            LearnerConceptMastery.concept_label == cal["concept"],
        ).first()

        if not mastery:
            mastery = LearnerConceptMastery(
                course_id=course_id,
                user_id=user_id,
                concept_label=cal["concept"],
                p_know=cal["p_know"],
                p_learn=cal["p_learn"],
                p_guess=cal["p_guess"],
                p_slip=cal["p_slip"],
                total_attempts=cal["attempts"],
                correct_attempts=cal["correct"],
                is_mastered=cal["is_mastered"],
                priority_score=cal["priority"],
                p_know_history_json=json.dumps(cal["history"]),
                last_updated=now - timedelta(hours=2),
            )
            db.add(mastery)
        else:
            mastery.p_know = cal["p_know"]
            mastery.total_attempts = cal["attempts"]
            mastery.correct_attempts = cal["correct"]
            mastery.is_mastered = cal["is_mastered"]
            mastery.priority_score = cal["priority"]
            mastery.p_know_history_json = json.dumps(cal["history"])

    db.commit()

    # 4. Seed Diagnostic Practice Quiz
    assessment = db.query(Assessment).filter(
        Assessment.course_id == course_id,
        Assessment.user_id == user_id,
    ).first()

    if not assessment:
        assessment = Assessment(
            course_id=course_id,
            user_id=user_id,
            title="Deep Learning Foundations & Architectures Quiz",
            description="Evaluates cognitive depth from activation functions to Transformer attention.",
            topic="Deep Learning & Neural Networks",
            difficulty="medium",
            time_limit_minutes=15,
            pass_percentage=70.0,
            total_points=60.0,
        )
        db.add(assessment)
        db.flush()

        # Questions across Bloom levels
        q1 = Question(
            assessment_id=assessment.id,
            course_id=course_id,
            topic="Artificial Neural Networks & Perceptrons",
            bloom_level="remember",
            difficulty="easy",
            question_type="multiple_choice",
            question_text="Why does an artificial neural network require non-linear activation functions?",
            options_json=json.dumps([
                {"id": "A", "text": "Without non-linear activations, multi-layer networks collapse mathematically into a single linear regression", "is_correct": True},
                {"id": "B", "text": "To guarantee that the weight parameters automatically initialize to zero", "is_correct": False, "misconception": "Zero weight initialization destroys symmetry breaking"},
                {"id": "C", "text": "To convert continuous inputs into discrete categorical integers", "is_correct": False, "misconception": "Activations map continuous real values"},
                {"id": "D", "text": "To eliminate the need for calculating partial derivatives during backpropagation", "is_correct": False, "misconception": "Backpropagation explicitly differentiates through activation functions"}
            ]),
            correct_answer_json=json.dumps(["A"]),
            explanation="Without non-linear activations, stacking linear layers W2*(W1*x + b1) + b2 simplifies to W_combined*x + b_combined.",
            points=10.0,
            order_index=0,
            citation_label="[Doc 1: Page 15]",
            document_name="DL_Textbook_Chapter01_Neural_Networks_and_Backprop.pdf",
            page_number=15,
        )

        q2 = Question(
            assessment_id=assessment.id,
            course_id=course_id,
            topic="Loss Functions & Backpropagation",
            bloom_level="understand",
            difficulty="medium",
            question_type="multiple_choice",
            question_text="What mathematical principle enables backpropagation to compute error gradients across multiple hidden layers?",
            options_json=json.dumps([
                {"id": "A", "text": "The calculus chain rule decomposing partial derivatives along computational graph paths", "is_correct": True},
                {"id": "B", "text": "Euler's totient function calculating modular inverses", "is_correct": False, "misconception": "Confusing calculus optimization with number theory cryptography"},
                {"id": "C", "text": "Taylor polynomial truncation eliminating gradient updates", "is_correct": False, "misconception": "Taylor series are not the mechanism of backpropagation"},
                {"id": "D", "text": "Principal Component Analysis projecting weights onto orthogonal eigenvectors", "is_correct": False, "misconception": "PCA is an unsupervised dimensionality reduction method"}
            ]),
            correct_answer_json=json.dumps(["A"]),
            explanation="The chain rule allows dL/dw to be calculated by multiplying intermediate derivatives backward from the output layer.",
            points=10.0,
            order_index=1,
            citation_label="[Doc 1: Page 28]",
            document_name="DL_Textbook_Chapter01_Neural_Networks_and_Backprop.pdf",
            page_number=28,
        )

        q3 = Question(
            assessment_id=assessment.id,
            course_id=course_id,
            topic="Convolutional Neural Networks (CNN)",
            bloom_level="apply",
            difficulty="medium",
            question_type="multiple_choice",
            question_text="How do convolutional filters capture visual features more effectively than dense fully-connected layers?",
            options_json=json.dumps([
                {"id": "A", "text": "They share weights across local receptive fields to detect translation-invariant patterns like edges and textures", "is_correct": True},
                {"id": "B", "text": "They flatten the input image into 1D vectors to remove spatial dimensionality", "is_correct": False, "misconception": "Flattening is done in fully-connected layers, destroying 2D geometry"},
                {"id": "C", "text": "They assign independent unique weights to every individual pixel across the entire resolution", "is_correct": False, "misconception": "That describes fully connected layers with high parameter explosion"},
                {"id": "D", "text": "They eliminate the need for activation functions and pooling layers", "is_correct": False, "misconception": "CNNs rely heavily on non-linear activations (ReLU) and pooling"}
            ]),
            correct_answer_json=json.dumps(["A"]),
            explanation="Convolutional kernels slide across the spatial grid, reusing parameters to detect visual motifs regardless of location.",
            points=10.0,
            order_index=2,
            citation_label="[Doc 2: Slide 12]",
            document_name="DL_Lecture04_CNNs_and_Computer_Vision.pptx",
            slide_number=12,
        )

        q4 = Question(
            assessment_id=assessment.id,
            course_id=course_id,
            topic="Transformers & Self-Attention",
            bloom_level="analyze",
            difficulty="hard",
            question_type="multiple_choice",
            question_text="Why does Scaled Dot-Product Attention divide the dot products of Query and Key by sqrt(d_k)?",
            options_json=json.dumps([
                {"id": "A", "text": "To prevent large dot products from pushing the softmax function into regions with extremely small gradients", "is_correct": True},
                {"id": "B", "text": "To force the attention matrix to have a zero determinant", "is_correct": False, "misconception": "Zero determinant is not required or intended for attention"},
                {"id": "C", "text": "To convert the attention score into an integer count of matching tokens", "is_correct": False, "misconception": "Attention outputs are calibrated probability distributions"},
                {"id": "D", "text": "To eliminate the need for positional encodings in the Transformer", "is_correct": False, "misconception": "Positional encodings are still necessary because attention is permutation-invariant"}
            ]),
            correct_answer_json=json.dumps(["A"]),
            explanation="For large d_k, the dot products grow large in magnitude, pushing softmax into flat saturated regions with vanishing gradients.",
            points=10.0,
            order_index=3,
            citation_label="[Doc 3: 13:31-16:45]",
            document_name="DL_Lecture07_Transformers_and_Attention.mp4",
        )

        q5 = Question(
            assessment_id=assessment.id,
            course_id=course_id,
            topic="Optimization & Gradient Descent",
            bloom_level="evaluate",
            difficulty="hard",
            question_type="multiple_choice",
            question_text="What distinguishes the Adam optimizer from basic Stochastic Gradient Descent (SGD)?",
            options_json=json.dumps([
                {"id": "A", "text": "It computes adaptive per-parameter learning rates by tracking moving averages of both past gradients and squared gradients", "is_correct": True},
                {"id": "B", "text": "It trains models without ever evaluating the loss function on training data", "is_correct": False, "misconception": "Adam evaluates losses and gradients every single mini-batch"},
                {"id": "C", "text": "It requires the entire dataset to reside in GPU memory simultaneously", "is_correct": False, "misconception": "Adam operates seamlessly on mini-batches"},
                {"id": "D", "text": "It is exclusively applicable to linear regression and decision trees", "is_correct": False, "misconception": "Adam was specifically designed for deep neural networks"}
            ]),
            correct_answer_json=json.dumps(["A"]),
            explanation="Adam combines the benefits of AdaGrad and RMSProp, maintaining first moment (momentum) and second moment (variance) estimates.",
            points=10.0,
            order_index=4,
            citation_label="[Doc 4: Page 8]",
            document_name="DL_Study_Guide_Optimization_and_Regularization.pdf",
            page_number=8,
        )

        q6 = Question(
            assessment_id=assessment.id,
            course_id=course_id,
            topic="Regularization & Normalization",
            bloom_level="create",
            difficulty="hard",
            question_type="multiple_choice",
            question_text="How does Dropout prevent overfitting in deep neural networks?",
            options_json=json.dumps([
                {"id": "A", "text": "By randomly zeroing out neuron activations during training to prevent fragile co-adaptations between neurons", "is_correct": True},
                {"id": "B", "text": "By permanently deleting weights with negative values from the model architecture", "is_correct": False, "misconception": "Dropout is temporary per training pass; weights are not deleted"},
                {"id": "C", "text": "By clipping gradients to a maximum Euclidean norm threshold", "is_correct": False, "misconception": "That describes gradient clipping, not dropout"},
                {"id": "D", "text": "By multiplying the learning rate by a decaying factor every epoch", "is_correct": False, "misconception": "That is learning rate decay scheduling"}
            ]),
            correct_answer_json=json.dumps(["A"]),
            explanation="Dropout simulates training an ensemble of exponentially many thinned sub-networks, creating highly robust representations.",
            points=10.0,
            order_index=5,
            citation_label="[Doc 4: Page 18]",
            document_name="DL_Study_Guide_Optimization_and_Regularization.pdf",
            page_number=18,
        )

        db.add_all([q1, q2, q3, q4, q5, q6])
        db.commit()

        # Seed Completed Attempt with Realistic Score (83.3% - 50/60 points)
        attempt = AssessmentAttempt(
            assessment_id=assessment.id,
            course_id=course_id,
            user_id=user_id,
            score=50.0,
            total_points=60.0,
            percentage=83.33,
            passed=True,
            time_spent_seconds=420,
            created_at=now - timedelta(hours=3),
        )
        db.add(attempt)
        db.flush()

        # Question logs
        r1 = QuestionResponseLog(
            attempt_id=attempt.id,
            question_id=q1.id,
            selected_answers_json=json.dumps(["A"]),
            is_correct=True,
            points_earned=10.0,
            points_possible=10.0,
            bloom_level="remember",
            error_category="none",
            created_at=now - timedelta(hours=3, minutes=14),
        )
        r2 = QuestionResponseLog(
            attempt_id=attempt.id,
            question_id=q2.id,
            selected_answers_json=json.dumps(["A"]),
            is_correct=True,
            points_earned=10.0,
            points_possible=10.0,
            bloom_level="understand",
            error_category="none",
            created_at=now - timedelta(hours=3, minutes=12),
        )
        r3 = QuestionResponseLog(
            attempt_id=attempt.id,
            question_id=q3.id,
            selected_answers_json=json.dumps(["A"]),
            is_correct=True,
            points_earned=10.0,
            points_possible=10.0,
            bloom_level="apply",
            error_category="none",
            created_at=now - timedelta(hours=3, minutes=9),
        )
        r4 = QuestionResponseLog(
            attempt_id=attempt.id,
            question_id=q4.id,
            selected_answers_json=json.dumps(["D"]),
            is_correct=False,
            points_earned=0.0,
            points_possible=10.0,
            bloom_level="analyze",
            error_category="factual_misconception",
            misconception_diagnosis="Confusing softmax gradient scaling with permutation invariance / positional encoding requirements.",
            remediation_hint="Review scaled dot-product attention in Lecture 7: dividing by sqrt(d_k) stabilizes softmax gradients.",
            created_at=now - timedelta(hours=3, minutes=6),
        )
        r5 = QuestionResponseLog(
            attempt_id=attempt.id,
            question_id=q5.id,
            selected_answers_json=json.dumps(["A"]),
            is_correct=True,
            points_earned=10.0,
            points_possible=10.0,
            bloom_level="evaluate",
            error_category="none",
            created_at=now - timedelta(hours=3, minutes=3),
        )
        r6 = QuestionResponseLog(
            attempt_id=attempt.id,
            question_id=q6.id,
            selected_answers_json=json.dumps(["A"]),
            is_correct=True,
            points_earned=10.0,
            points_possible=10.0,
            bloom_level="create",
            error_category="none",
            created_at=now - timedelta(hours=3),
        )
        db.add_all([r1, r2, r3, r4, r5, r6])
        db.commit()

    # 5. Seed Deep Learning Flashcard Deck
    deck = db.query(FlashcardDeck).filter(
        FlashcardDeck.course_id == course_id,
        FlashcardDeck.user_id == user_id,
    ).first()
    if not deck:
        deck = FlashcardDeck(
            course_id=course_id,
            user_id=user_id,
            title="Deep Learning Foundations & Architectures",
            description="Core concepts, backpropagation mechanics, CNNs, and attention mechanisms.",
        )
        db.add(deck)
        db.flush()

    existing_card_count = db.query(Flashcard).filter(
        Flashcard.course_id == course_id,
        Flashcard.user_id == user_id,
    ).count()

    if existing_card_count < 6:
        dl_cards = [
            {
                "topic": "Artificial Neural Networks & Perceptrons",
                "front": "Why do Deep Neural Networks require non-linear activation functions?",
                "back": "Without non-linear activations like ReLU or GELU, stacking multiple layers collapses mathematically into a single linear regression, making it impossible to learn complex non-linear patterns.",
                "hint": "Think matrix multiplication: W2*(W1*x) = (W2*W1)*x.",
                "bloom": "understand",
                "citation": "[Doc 1: Page 15]",
                "doc_name": "DL_Textbook_Chapter01_Neural_Networks_and_Backprop.pdf",
                "reps": 4,
                "interval": 28.0,
                "ease": 2.65,
                "due": now + timedelta(days=12),
                "reviews": 4,
                "lapses": 0,
            },
            {
                "topic": "Loss Functions & Backpropagation",
                "front": "What is the primary role of the calculus Chain Rule in Backpropagation?",
                "back": "It computes the partial derivative of the loss function with respect to every weight by propagating error sensitivities backwards layer-by-layer: dL/dw = dL/da * da/dz * dz/dw.",
                "hint": "Derivative of composite functions.",
                "bloom": "understand",
                "citation": "[Doc 1: Page 28]",
                "doc_name": "DL_Textbook_Chapter01_Neural_Networks_and_Backprop.pdf",
                "reps": 3,
                "interval": 12.0,
                "ease": 2.50,
                "due": now + timedelta(days=5),
                "reviews": 3,
                "lapses": 0,
            },
            {
                "topic": "Convolutional Neural Networks (CNN)",
                "front": "How does a Convolutional Layer differ fundamentally from a Fully Connected Layer?",
                "back": "Convolutional layers slide small learnable filters across the image to preserve 2D spatial relationships and detect translation-invariant features, using far fewer parameters than dense layers.",
                "hint": "Local receptive fields & parameter sharing.",
                "bloom": "analyze",
                "citation": "[Doc 2: Slide 12]",
                "doc_name": "DL_Lecture04_CNNs_and_Computer_Vision.pptx",
                "reps": 2,
                "interval": 4.0,
                "ease": 2.35,
                "due": now + timedelta(days=2),
                "reviews": 2,
                "lapses": 1,
            },
            {
                "topic": "Transformers & Self-Attention",
                "front": "Why does Scaled Dot-Product Attention divide by the square root of the key dimension (sqrt(d_k))?",
                "back": "To prevent dot products from growing excessively large in high dimensions, which would push the softmax function into flat saturated regions with tiny vanishing gradients.",
                "hint": "Attention(Q,K,V) = softmax(Q*K^T / sqrt(d_k)) * V.",
                "bloom": "analyze",
                "citation": "[Doc 3: 13:31-16:45]",
                "doc_name": "DL_Lecture07_Transformers_and_Attention.mp4",
                "reps": 1,
                "interval": 1.0,
                "ease": 2.20,
                "due": now,
                "reviews": 1,
                "lapses": 1,
            },
            {
                "topic": "Optimization & Gradient Descent",
                "front": "What makes the Adam Optimizer adaptive?",
                "back": "Adam tracks exponentially decaying moving averages of both past gradients (momentum) and squared gradients (variance), computing individualized learning rates for every single parameter.",
                "hint": "Adaptive Moment Estimation.",
                "bloom": "understand",
                "citation": "[Doc 4: Page 8]",
                "doc_name": "DL_Study_Guide_Optimization_and_Regularization.pdf",
                "reps": 5,
                "interval": 32.0,
                "ease": 2.70,
                "due": now + timedelta(days=15),
                "reviews": 5,
                "lapses": 0,
            },
            {
                "topic": "Regularization & Normalization",
                "front": "How does Dropout regularize deep neural networks during training?",
                "back": "It randomly zeroes out a fraction p of neuron activations during each forward pass, forcing the network to learn redundant, co-adaptation-free representations.",
                "hint": "Ensemble of thinned sub-networks.",
                "bloom": "remember",
                "citation": "[Doc 4: Page 18]",
                "doc_name": "DL_Study_Guide_Optimization_and_Regularization.pdf",
                "reps": 3,
                "interval": 14.0,
                "ease": 2.55,
                "due": now + timedelta(days=7),
                "reviews": 3,
                "lapses": 0,
            },
        ]

        for card_data in dl_cards:
            card = Flashcard(
                deck_id=deck.id,
                course_id=course_id,
                user_id=user_id,
                topic=card_data["topic"],
                front=card_data["front"],
                back=card_data["back"],
                hint=card_data["hint"],
                bloom_level=card_data["bloom"],
                citation_label=card_data["citation"],
                document_name=card_data["doc_name"],
                repetitions=card_data["reps"],
                interval_days=card_data["interval"],
                ease_factor=card_data["ease"],
                next_review_at=card_data["due"],
                total_reviews=card_data["reviews"],
                lapses=card_data["lapses"],
                last_reviewed_at=now - timedelta(hours=5),
            )
            db.add(card)
        db.commit()

    # 6. Seed Interactive Tutor Dialogue
    session = db.query(TutorSession).filter(
        TutorSession.course_id == course_id,
        TutorSession.user_id == user_id,
    ).first()

    if not session:
        session = TutorSession(
            course_id=course_id,
            user_id=user_id,
            title="Understanding Backpropagation & Non-Linear Activations",
            pedagogical_mode="socratic",
            topic="Loss Functions & Backpropagation",
        )
        db.add(session)
        db.flush()

        m1 = TutorMessage(
            session_id=session.id,
            sender="user",
            pedagogical_mode="socratic",
            content="Can you explain why backpropagation uses the chain rule to calculate weight updates?",
            created_at=now - timedelta(hours=2),
        )
        m2 = TutorMessage(
            session_id=session.id,
            sender="assistant",
            pedagogical_mode="socratic",
            content=(
                "That's one of the most fundamental questions in Deep Learning!\n\n"
                "In **DL_Textbook_Chapter01_Neural_Networks_and_Backprop.pdf** [Doc 1: Page 28], the principle is stated:\n"
                "> \"The gradient of the loss with respect to any weight w_ij is computed by propagating error sensitivities backwards from the output layer to the input layer: dL/dw = dL/da * da/dz * dz/dw.\"\n\n"
                "Let's reason through this step-by-step:\n"
                "1. If you tweak a weight in layer 1, does it immediately change the final loss, or does it first affect layer 2, then layer 3, then the output?\n"
                "2. Since each layer's output is an input to the next layer (a composite function), how does calculus allow us to connect that initial change to the final error?"
            ),
            citations_json=json.dumps([{
                "chunk_id": "dl-chunk-1",
                "document_id": "doc-dl-1",
                "document_name": "DL_Textbook_Chapter01_Neural_Networks_and_Backprop.pdf",
                "file_type": "pdf",
                "page_number": 28,
                "snippet": "The gradient of the loss with respect to any weight w_ij is computed by propagating error sensitivities backwards from the output layer to the input layer: dL/dw = dL/da * da/dz * dz/dw.",
                "score": 0.98,
                "semantic_score": 0.98,
                "keyword_score": 0.98,
                "citation_label": "[Doc 1: Page 28]"
            }]),
            created_at=now - timedelta(hours=1, minutes=58),
        )
        m3 = TutorMessage(
            session_id=session.id,
            sender="user",
            pedagogical_mode="socratic",
            content="It passes through each layer step-by-step, so the chain rule lets us multiply the partial derivatives along that path!",
            created_at=now - timedelta(hours=1, minutes=55),
        )
        m4 = TutorMessage(
            session_id=session.id,
            sender="assistant",
            pedagogical_mode="socratic",
            content=(
                "Spot on! 🎉 You just captured the exact beauty of Backpropagation.\n\n"
                "Because each layer is nested inside the next, multiplying the local derivatives backwards tells us exactly how much each individual weight contributed to the overall prediction error.\n\n"
                "Next question: What happens if many of those local derivatives are numbers like 0.1 or 0.2 across 50 layers in a row?"
            ),
            citations_json=json.dumps([{
                "chunk_id": "dl-chunk-2",
                "document_id": "doc-dl-1",
                "document_name": "DL_Textbook_Chapter01_Neural_Networks_and_Backprop.pdf",
                "file_type": "pdf",
                "page_number": 34,
                "snippet": "Multiplying many derivative terms smaller than 1.0 causes gradients to decay exponentially toward zero, preventing earlier layers from learning (vanishing gradient).",
                "score": 0.95,
                "semantic_score": 0.95,
                "keyword_score": 0.95,
                "citation_label": "[Doc 1: Page 34]"
            }]),
            created_at=now - timedelta(hours=1, minutes=52),
        )
        db.add_all([m1, m2, m3, m4])
        db.commit()

    logger.info(f"Successfully seeded comprehensive Deep Learning scenario for course {course_id}")
    return {
        "course_id": course_id,
        "course_name": course.name,
        "topics_count": len(course.topics),
        "bkt_concepts_calibrated": len(bkt_calibration),
        "assessment_title": "Deep Learning Foundations & Architectures Quiz",
        "flashcards_count": db.query(Flashcard).filter(Flashcard.course_id == course_id, Flashcard.user_id == user_id).count(),
        "status": "ready_for_defense_presentation",
    }
