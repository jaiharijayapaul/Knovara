"""Database repository for Flashcards, Decks, and Spaced Repetition (SRS)."""

from datetime import datetime, timezone
from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models.flashcard import Flashcard, FlashcardDeck


class FlashcardRepository:
    """Data access operations for flashcards and decks."""

    @staticmethod
    def create_deck(
        db: Session,
        course_id: str,
        user_id: str,
        title: str,
        description: Optional[str] = None,
    ) -> FlashcardDeck:
        deck = FlashcardDeck(
            course_id=course_id,
            user_id=user_id,
            title=title,
            description=description,
        )
        db.add(deck)
        db.commit()
        db.refresh(deck)
        return deck

    @staticmethod
    def get_deck(
        db: Session,
        deck_id: str,
        course_id: str,
        user_id: str,
    ) -> Optional[FlashcardDeck]:
        return (
            db.query(FlashcardDeck)
            .filter_by(id=deck_id, course_id=course_id, user_id=user_id)
            .first()
        )

    @staticmethod
    def list_decks(
        db: Session,
        course_id: str,
        user_id: str,
    ) -> List[FlashcardDeck]:
        return (
            db.query(FlashcardDeck)
            .filter_by(course_id=course_id, user_id=user_id)
            .order_by(FlashcardDeck.created_at.desc())
            .all()
        )

    @staticmethod
    def delete_deck(db: Session, deck: FlashcardDeck) -> None:
        db.delete(deck)
        db.commit()

    @staticmethod
    def create_flashcard(
        db: Session,
        course_id: str,
        user_id: str,
        front: str,
        back: str,
        hint: Optional[str] = None,
        topic: Optional[str] = None,
        bloom_level: str = "remember",
        deck_id: Optional[str] = None,
        citation_label: Optional[str] = None,
        document_name: Optional[str] = None,
        page_number: Optional[int] = None,
        slide_number: Optional[int] = None,
        timestamp_start: Optional[str] = None,
        timestamp_end: Optional[str] = None,
        source_snippet: Optional[str] = None,
        initial_next_review_at: Optional[datetime] = None,
    ) -> Flashcard:
        card = Flashcard(
            course_id=course_id,
            user_id=user_id,
            front=front,
            back=back,
            hint=hint,
            topic=topic,
            bloom_level=bloom_level,
            deck_id=deck_id,
            citation_label=citation_label,
            document_name=document_name,
            page_number=page_number,
            slide_number=slide_number,
            timestamp_start=timestamp_start,
            timestamp_end=timestamp_end,
            source_snippet=source_snippet,
            next_review_at=initial_next_review_at or datetime.now(timezone.utc),
        )
        db.add(card)
        db.commit()
        db.refresh(card)
        return card

    @staticmethod
    def get_flashcard(
        db: Session,
        card_id: str,
        course_id: str,
        user_id: str,
    ) -> Optional[Flashcard]:
        return (
            db.query(Flashcard)
            .filter_by(id=card_id, course_id=course_id, user_id=user_id)
            .first()
        )

    @staticmethod
    def list_flashcards(
        db: Session,
        course_id: str,
        user_id: str,
        deck_id: Optional[str] = None,
        topic: Optional[str] = None,
        due_only: bool = False,
        now: Optional[datetime] = None,
    ) -> List[Flashcard]:
        query = db.query(Flashcard).filter_by(course_id=course_id, user_id=user_id)
        if deck_id:
            query = query.filter_by(deck_id=deck_id)
        if topic:
            query = query.filter(func.lower(Flashcard.topic).contains(topic.lower()))
        if due_only:
            ref_time = now or datetime.now(timezone.utc)
            query = query.filter(Flashcard.next_review_at <= ref_time)
        return query.order_by(Flashcard.next_review_at.asc()).all()

    @staticmethod
    def update_sm2_state(
        db: Session,
        card: Flashcard,
        repetitions: int,
        interval_days: float,
        ease_factor: float,
        next_review_at: datetime,
        quality: int,
    ) -> Flashcard:
        now = datetime.now(timezone.utc)
        card.repetitions = repetitions
        card.interval_days = interval_days
        card.ease_factor = ease_factor
        card.next_review_at = next_review_at
        card.last_reviewed_at = now
        card.total_reviews += 1
        if quality < 3:
            card.lapses += 1

        db.commit()
        db.refresh(card)
        return card

    @staticmethod
    def delete_flashcard(db: Session, card: Flashcard) -> None:
        db.delete(card)
        db.commit()

    @staticmethod
    def get_stats(
        db: Session,
        course_id: str,
        user_id: str,
        now: Optional[datetime] = None,
    ) -> Dict[str, Any]:
        ref_time = now or datetime.now(timezone.utc)
        cards = db.query(Flashcard).filter_by(course_id=course_id, user_id=user_id).all()

        total = len(cards)
        due_today = 0
        learning = 0
        reviewing = 0
        mastered = 0
        total_reviews = 0
        lapses = 0
        due_by_topic: Dict[str, int] = {}

        for c in cards:
            total_reviews += c.total_reviews
            lapses += c.lapses

            # Compare timezone-aware or naive safely
            next_rev = c.next_review_at
            if next_rev.tzinfo is None:
                next_rev = next_rev.replace(tzinfo=timezone.utc)

            is_due = next_rev <= ref_time
            if is_due:
                due_today += 1
                t = c.topic or "General"
                due_by_topic[t] = due_by_topic.get(t, 0) + 1

            if c.repetitions < 2:
                learning += 1
            elif c.repetitions < 4:
                reviewing += 1
            else:
                mastered += 1

        successful_reviews = total_reviews - lapses
        retention = (successful_reviews / total_reviews * 100.0) if total_reviews > 0 else 100.0
        total_ef = sum((c.ease_factor or 2.5) for c in cards) if cards else 0.0
        avg_ef = round(total_ef / total, 2) if total > 0 else 2.50

        return {
            "total_cards": total,
            "cards_due_today": due_today,
            "cards_learning": learning,
            "cards_reviewing": reviewing,
            "cards_mastered": mastered,
            "average_ease_factor": avg_ef,
            "retention_rate": round(retention, 1),
            "total_reviews_completed": total_reviews,
            "streak_days": 1 if total_reviews > 0 else 0,
            "due_by_topic": due_by_topic,
        }
