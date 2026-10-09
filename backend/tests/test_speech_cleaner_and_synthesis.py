"""Tests verifying transcript speech cleaning and academic transformation across notes, flashcards, quizzes, and tutor."""

import pytest
from unittest.mock import MagicMock
from app.processing.speech_cleaner import clean_transcript_speech, clean_academic_sentence
from app.flashcards.generator import FlashcardGenerator
from app.assessment.generator import AssessmentGenerator
from app.services.notes_service import NotesService
from app.tutor.pedagogical_engine import PedagogicalEngine
from app.schemas.rag import SourceCitation


def test_clean_transcript_speech_filters_intros_outros_and_tics():
    raw_transcript = (
        "Hello guys, welcome back to my channel! Um, today we're going to talk about "
        "gradient descent. Gradient descent is a first-order iterative optimization algorithm "
        "for finding a local minimum of a differentiable function. Like basically, you know, "
        "it updates weights in the negative gradient direction. Make sure to like and subscribe!"
    )
    cleaned = clean_transcript_speech(raw_transcript)

    assert "Hello guys" not in cleaned
    assert "welcome back to my channel" not in cleaned
    assert "Um" not in cleaned
    assert "Make sure to like and subscribe" not in cleaned
    assert "Gradient descent is a first-order iterative optimization algorithm" in cleaned
    assert "updates weights in the negative gradient direction" in cleaned


def test_clean_academic_sentence_strips_discourse_connectives():
    sentence = "So, gradient descent calculates the partial derivative of the loss function."
    cleaned = clean_academic_sentence(sentence)
    assert cleaned.startswith("Gradient descent calculates")

    sentence2 = "Well, okay, the learning rate controls the step size in parameter space."
    cleaned2 = clean_academic_sentence(sentence2)
    assert cleaned2.startswith("The learning rate controls")


def test_flashcard_generation_alters_transcript_to_academic_cards():
    mock_chunk = MagicMock()
    mock_chunk.content = (
        "Hey everyone, welcome back. Today we're going to talk about backpropagation. "
        "Backpropagation is an algorithm that computes the gradient of the loss function with respect to weights. "
        "Okay so basically it relies on the mathematical chain rule of calculus. Don't forget to hit the bell button!"
    )
    mock_chunk.topic = "Backpropagation"
    mock_chunk.page_number = None
    mock_chunk.slide_number = None
    mock_chunk.timestamp_start = "02:15"
    mock_chunk.timestamp_end = "03:45"
    mock_chunk.document = MagicMock()
    mock_chunk.document.filename = "Neural_Networks_Lecture.mp4"

    cards = FlashcardGenerator._generate_local_grounded_flashcards(
        chunks=[mock_chunk],
        num_cards=3,
        topic="Backpropagation",
        target_concepts=["Backpropagation"],
        course_name="Deep Learning",
    )

    assert len(cards) == 3
    for card in cards:
        # Verify speech filler is stripped from front, back, and hint
        assert "Hey everyone" not in card["front"]
        assert "Hey everyone" not in card["back"]
        assert "welcome back" not in card["back"]
        assert "hit the bell" not in card["back"]
        assert "Backpropagation" in card["topic"]
        assert "02:15–03:45" in card["citation_label"]
        # Back must state the academic definition
        assert "Backpropagation is an algorithm" in card["back"]


def test_assessment_generation_alters_transcript_and_rotates_options():
    mock_chunk = MagicMock()
    mock_chunk.content = (
        "What's up guys! In this video we will discuss convolutional layers. "
        "A convolutional layer applies a set of learnable filter kernels across receptive fields. "
        "Thanks for watching guys, see you next time!"
    )
    mock_chunk.topic = "Convolutional Layers"
    mock_chunk.page_number = None
    mock_chunk.slide_number = None
    mock_chunk.timestamp_start = "01:00"
    mock_chunk.timestamp_end = "02:30"
    mock_chunk.document = MagicMock()
    mock_chunk.document.filename = "Computer_Vision_Lecture.mp4"

    questions = AssessmentGenerator._generate_local_grounded_questions(
        chunks=[mock_chunk],
        levels=["remember", "understand", "apply", "analyze"],
        difficulty="medium",
        course_name="Computer Vision",
        topic="Convolutional Layers",
    )

    assert len(questions) == 4
    correct_positions = [q["correct_answers"][0] for q in questions]
    # Check that answer positions rotate across A, B, C, D
    assert len(set(correct_positions)) > 1

    for q in questions:
        assert "What's up guys" not in q["question_text"]
        assert "Thanks for watching" not in q["question_text"]
        # Find the correct option text
        correct_opt = next(opt for opt in q["options"] if opt["is_correct"])
        assert "What's up guys" not in correct_opt["text"]
        assert "learnable filter kernels" in correct_opt["text"]


def test_tutor_local_synthesis_does_not_quote_raw_transcript_chatter():
    citation = SourceCitation(
        document_id="doc-1",
        chunk_id="chunk-1",
        document_name="Lecture_Recording.mp4",
        citation_label="[Doc 1: 05:20-06:10]",
        page_number=None,
        slide_number=None,
        timestamp_start="05:20",
        timestamp_end="06:10",
        file_type="video",
        snippet=(
            "Hello everyone, welcome back. Today we will cover eigenvalues. "
            "An eigenvalue is a scalar lambda associated with a linear system of equations. "
            "Please like and subscribe!"
        ),
        score=0.92,
        semantic_score=0.92,
        keyword_score=0.88,
        topic="Eigenvalues",
    )

    reply = PedagogicalEngine._synthesize_local_pedagogical_turn(
        user_message="What is an eigenvalue?",
        mode="socratic",
        citations=[citation],
        history=[],
        course_name="Linear Algebra",
        topic="Eigenvalues",
    )

    assert "Hello everyone" not in reply
    assert "Please like and subscribe" not in reply
    assert "Core Concept:" in reply
    assert "scalar lambda" in reply
