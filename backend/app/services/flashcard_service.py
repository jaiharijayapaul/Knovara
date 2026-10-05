"""
Flashcard Service.
Orchestrates grounded flashcard synthesis, SuperMemo SM-2 spaced repetition reviews,
and bidirectional synchronization with Bayesian Knowledge Tracing concept mastery.
"""

from datetime import datetime, timezone
import logging
from typing import List, Optional
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.models.course import Course
from app.models.flashcard import Flashcard, FlashcardDeck
from app.repositories.flashcard_repository import FlashcardRepository
from app.repositories.document_repository import DocumentRepository
from app.repositories.mastery_repository import MasteryRepository
from app.flashcards.generator import FlashcardGenerator
from app.srs.sm2 import SM2Engine, DEFAULT_EASE_FACTOR
from app.bkt import BKTEngine, BKTParams
from app.schemas.flashcard import (
    FlashcardCreate,
    FlashcardResponse,
    FlashcardReviewRequest,
    FlashcardReviewResponse,
    FlashcardGenerateRequest,
    FlashcardDeckCreate,
    FlashcardDeckResponse,
    SRSStatsResponse,
)

logger = logging.getLogger("knovara.flashcard_service")


def _to_card_response(card: Flashcard, now: Optional[datetime] = None) -> FlashcardResponse:
    ref_time = now or datetime.now(timezone.utc)
    next_rev = card.next_review_at
    if next_rev.tzinfo is None:
        next_rev = next_rev.replace(tzinfo=timezone.utc)

    return FlashcardResponse(
        id=card.id,
        deck_id=card.deck_id,
        course_id=card.course_id,
        user_id=card.user_id,
        topic=card.topic,
        front=card.front,
        back=card.back,
        hint=card.hint,
        bloom_level=card.bloom_level,
        citation_label=card.citation_label,
        document_name=card.document_name,
        page_number=card.page_number,
        slide_number=card.slide_number,
        timestamp_start=card.timestamp_start,
        timestamp_end=card.timestamp_end,
        source_snippet=card.source_snippet,
        repetitions=card.repetitions,
        interval_days=card.interval_days,
        ease_factor=card.ease_factor,
        next_review_at=card.next_review_at,
        last_reviewed_at=card.last_reviewed_at,
        total_reviews=card.total_reviews,
        lapses=card.lapses,
        is_due=next_rev <= ref_time,
        created_at=card.created_at,
        updated_at=card.updated_at,
    )


class FlashcardService:
    """Service layer for Spaced Repetition flashcards."""

    @classmethod
    def _verify_course_ownership(cls, db: Session, course_id: str, user_id: str) -> Course:
        course = db.query(Course).filter_by(id=course_id, user_id=user_id).first()
        if not course:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Course workspace not found or access denied.",
            )
        return course

    @classmethod
    def create_card(
        cls,
        db: Session,
        course_id: str,
        user_id: str,
        payload: FlashcardCreate,
    ) -> FlashcardResponse:
        cls._verify_course_ownership(db, course_id, user_id)
        card = FlashcardRepository.create_flashcard(
            db=db,
            course_id=course_id,
            user_id=user_id,
            front=payload.front,
            back=payload.back,
            hint=payload.hint,
            topic=payload.topic,
            bloom_level=payload.bloom_level or "remember",
            deck_id=payload.deck_id,
            citation_label=payload.citation_label,
            document_name=payload.document_name,
            page_number=payload.page_number,
            slide_number=payload.slide_number,
            timestamp_start=payload.timestamp_start,
            timestamp_end=payload.timestamp_end,
            source_snippet=payload.source_snippet,
        )
        return _to_card_response(card)

    @classmethod
    async def generate_cards(
        cls,
        db: Session,
        course_id: str,
        user_id: str,
        payload: FlashcardGenerateRequest,
    ) -> List[FlashcardResponse]:
        """
        Synthesize grounded flashcards from course documents.
        Prioritizes weak BKT concepts when target_weak_concepts is enabled.
        """
        course = cls._verify_course_ownership(db, course_id, user_id)

        # 1. Check for weak concepts via BKT Mastery Model
        target_concepts = []
        if payload.target_weak_concepts:
            try:
                from app.services.mastery_service import MasteryService
                recs = MasteryService.get_adaptive_recommendations(
                    db=db, course_id=course_id, user_id=user_id, top_n=payload.num_cards
                )
                if recs.recommendations:
                    target_concepts = [r.concept_label for r in recs.recommendations]
            except Exception as e:
                logger.warning(f"Could not load BKT recommendations for flashcards: {e}")

        # 2. Gather document chunks
        docs = DocumentRepository.list_by_course(db, course_id)
        chunks = []
        for d in docs:
            chunks.extend(d.chunks)

        # 3. Create optional deck if specified
        deck_id = None
        if payload.deck_title:
            deck = FlashcardRepository.create_deck(
                db=db,
                course_id=course_id,
                user_id=user_id,
                title=payload.deck_title,
                description=f"Generated deck focusing on {payload.topic or course.name}",
            )
            deck_id = deck.id

        # 4. Synthesize cards
        synthesized_data = await FlashcardGenerator.generate_flashcards(
            chunks=chunks,
            num_cards=payload.num_cards,
            topic=payload.topic,
            target_concepts=target_concepts if target_concepts else None,
            course_name=course.name,
        )

        # 5. Persist cards
        created_cards = []
        for card_data in synthesized_data:
            c = FlashcardRepository.create_flashcard(
                db=db,
                course_id=course_id,
                user_id=user_id,
                front=card_data["front"],
                back=card_data["back"],
                hint=card_data.get("hint"),
                topic=card_data.get("topic", payload.topic),
                bloom_level=card_data.get("bloom_level", "remember"),
                deck_id=deck_id,
                citation_label=card_data.get("citation_label"),
                document_name=card_data.get("document_name"),
                page_number=card_data.get("page_number"),
                slide_number=card_data.get("slide_number"),
                timestamp_start=card_data.get("timestamp_start"),
                timestamp_end=card_data.get("timestamp_end"),
                source_snippet=card_data.get("source_snippet"),
            )
            created_cards.append(_to_card_response(c))

        return created_cards

    @classmethod
    def list_cards(
        cls,
        db: Session,
        course_id: str,
        user_id: str,
        deck_id: Optional[str] = None,
        topic: Optional[str] = None,
        due_only: bool = False,
    ) -> List[FlashcardResponse]:
        cls._verify_course_ownership(db, course_id, user_id)
        cards = FlashcardRepository.list_flashcards(
            db=db,
            course_id=course_id,
            user_id=user_id,
            deck_id=deck_id,
            topic=topic,
            due_only=due_only,
        )
        return [_to_card_response(c) for c in cards]

    @classmethod
    def review_card(
        cls,
        db: Session,
        course_id: str,
        user_id: str,
        card_id: str,
        payload: FlashcardReviewRequest,
    ) -> FlashcardReviewResponse:
        """
        Record a student recall rating (0-5) on a flashcard.
        Updates SM-2 intervals and synchronizes with BKT concept mastery.
        """
        cls._verify_course_ownership(db, course_id, user_id)
        card = FlashcardRepository.get_flashcard(db, card_id, course_id, user_id)
        if not card:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Flashcard not found.",
            )

        prev_interval = card.interval_days
        now = datetime.now(timezone.utc)

        # 1. Execute SuperMemo SM-2 calculation
        sm2_res = SM2Engine.calculate(
            quality=payload.quality,
            repetitions=card.repetitions,
            interval_days=card.interval_days,
            ease_factor=card.ease_factor,
            now=now,
        )

        # 2. Persist updated SRS state
        updated_card = FlashcardRepository.update_sm2_state(
            db=db,
            card=card,
            repetitions=sm2_res.repetitions,
            interval_days=sm2_res.interval_days,
            ease_factor=sm2_res.ease_factor,
            next_review_at=sm2_res.next_review_at,
            quality=sm2_res.quality,
        )

        # 3. Synchronize with Bayesian Knowledge Tracing (BKT)
        bkt_synced = False
        concept_label = card.topic
        if concept_label:
            try:
                record = MasteryRepository.get_or_create(
                    db=db,
                    user_id=user_id,
                    course_id=course_id,
                    concept_label=concept_label,
                )
                params = BKTParams(
                    p_know=record.p_know,
                    p_learn=record.p_learn,
                    p_guess=record.p_guess,
                    p_slip=record.p_slip,
                    mastery_threshold=record.mastery_threshold,
                )
                bkt_res = BKTEngine.update(
                    p_know=record.p_know,
                    is_correct=sm2_res.is_successful,
                    params=params,
                )
                MasteryRepository.update_bkt_state(
                    db=db,
                    record=record,
                    new_p_know=bkt_res.p_know_next,
                    is_correct=sm2_res.is_successful,
                )
                db.commit()
                bkt_synced = True
            except Exception as e:
                logger.warning(f"BKT synchronization from flashcard review skipped: {e}")

        return FlashcardReviewResponse(
            card_id=card.id,
            repetitions=sm2_res.repetitions,
            interval_days=sm2_res.interval_days,
            ease_factor=sm2_res.ease_factor,
            next_review_at=sm2_res.next_review_at,
            quality=sm2_res.quality,
            is_successful=sm2_res.is_successful,
            bkt_synced=bkt_synced,
            card=_to_card_response(updated_card, now=now),
        )

    @classmethod
    def get_stats(cls, db: Session, course_id: str, user_id: str) -> SRSStatsResponse:
        cls._verify_course_ownership(db, course_id, user_id)
        stats_dict = FlashcardRepository.get_stats(db, course_id, user_id)
        return SRSStatsResponse(**stats_dict)

    @classmethod
    def delete_card(cls, db: Session, course_id: str, user_id: str, card_id: str) -> None:
        cls._verify_course_ownership(db, course_id, user_id)
        card = FlashcardRepository.get_flashcard(db, card_id, course_id, user_id)
        if not card:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Flashcard not found.",
            )
        FlashcardRepository.delete_flashcard(db, card)

    @classmethod
    def list_decks(cls, db: Session, course_id: str, user_id: str) -> List[FlashcardDeckResponse]:
        cls._verify_course_ownership(db, course_id, user_id)
        decks = FlashcardRepository.list_decks(db, course_id, user_id)
        now = datetime.now(timezone.utc)
        results = []
        for d in decks:
            cards = d.cards
            total = len(cards)
            due = sum(1 for c in cards if (c.next_review_at.replace(tzinfo=timezone.utc) if c.next_review_at.tzinfo is None else c.next_review_at) <= now)
            results.append(FlashcardDeckResponse(
                id=d.id,
                course_id=d.course_id,
                user_id=d.user_id,
                title=d.title,
                description=d.description,
                cards_count=total,
                cards_due_count=due,
                created_at=d.created_at,
                updated_at=d.updated_at,
            ))
        return results

    @classmethod
    def create_deck(cls, db: Session, course_id: str, user_id: str, payload: FlashcardDeckCreate) -> FlashcardDeckResponse:
        cls._verify_course_ownership(db, course_id, user_id)
        deck = FlashcardRepository.create_deck(
            db=db,
            course_id=course_id,
            user_id=user_id,
            title=payload.title,
            description=payload.description,
        )
        return FlashcardDeckResponse(
            id=deck.id,
            course_id=deck.course_id,
            user_id=deck.user_id,
            title=deck.title,
            description=deck.description,
            cards_count=0,
            cards_due_count=0,
            created_at=deck.created_at,
            updated_at=deck.updated_at,
        )
