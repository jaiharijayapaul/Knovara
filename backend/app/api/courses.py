"""Course Management API router endpoints with workspace isolation."""

from typing import List
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.auth.dependencies import get_current_user
from app.models.user import User
from app.schemas.course import (
    CourseCreate,
    CourseUpdate,
    CourseResponse,
    CourseDetailResponse,
    TopicCreate,
    TopicResponse,
)
from app.services.course_service import CourseService

router = APIRouter(prefix="/courses", tags=["Courses"])


@router.get(
    "",
    response_model=List[CourseResponse],
    status_code=status.HTTP_200_OK,
    summary="List student courses",
    description="Returns all course learning workspaces belonging to the authenticated student.",
)
def list_courses(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retrieve isolated courses for active user."""
    return CourseService.list_courses(db=db, user_id=current_user.id)


@router.post(
    "",
    response_model=CourseDetailResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new course workspace",
    description="Initializes a new course workspace with an isolated knowledge base.",
)
def create_course(
    payload: CourseCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a new course workspace."""
    return CourseService.create_course(db=db, user_id=current_user.id, payload=payload)


@router.post(
    "/seed-demo",
    response_model=CourseDetailResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Seed hackathon demo course",
    description="Seeds the standard Track D demo course 'Machine Learning' with 6 foundational curriculum topics.",
)
def seed_demo_course(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Seed sample Machine Learning course."""
    return CourseService.seed_demo_course(db=db, user_id=current_user.id)


@router.get(
    "/{course_id}",
    response_model=CourseDetailResponse,
    status_code=status.HTTP_200_OK,
    summary="Get course workspace detail",
    description="Retrieves course details, topics, and knowledge base metadata with strict access validation.",
)
def get_course(
    course_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get single course workspace."""
    return CourseService.get_course_detail(db=db, course_id=course_id, user_id=current_user.id)


@router.get(
    "/{course_id}/study-notes",
    status_code=status.HTTP_200_OK,
    summary="Get unified AI Study Notes for the whole course workspace",
)
async def get_course_study_notes(
    course_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retrieve or synthesize master study notes across all course documents."""
    from fastapi import HTTPException
    from app.services.notes_service import NotesService
    from app.repositories.course_repository import CourseRepository

    course = CourseRepository.get_by_id(db, course_id, user_id=current_user.id)
    if not course:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course workspace not found.")

    if not course.study_notes:
        course.study_notes = await NotesService.generate_course_study_notes(db, course_id, current_user.id)

    docs_notes = []
    for d in course.documents:
        docs_notes.append({
            "document_id": d.id,
            "filename": d.filename,
            "file_type": d.file_type,
            "ai_notes": d.ai_notes,
        })

    return {
        "course_id": course.id,
        "course_name": course.name,
        "subject": course.subject,
        "study_notes": course.study_notes,
        "document_notes": docs_notes,
    }


@router.put(
    "/{course_id}",
    response_model=CourseResponse,
    status_code=status.HTTP_200_OK,
    summary="Update course workspace",
)
def update_course(
    course_id: str,
    payload: CourseUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update course attributes."""
    return CourseService.update_course(
        db=db, course_id=course_id, user_id=current_user.id, payload=payload
    )


@router.delete(
    "/{course_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete course workspace",
)
def delete_course(
    course_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete course and associated knowledge assets."""
    CourseService.delete_course(db=db, course_id=course_id, user_id=current_user.id)
    return None


@router.post(
    "/{course_id}/topics",
    response_model=TopicResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Add topic to course",
)
def add_topic(
    course_id: str,
    payload: TopicCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Add curriculum topic to course workspace."""
    return CourseService.add_topic_to_course(
        db=db, course_id=course_id, user_id=current_user.id, payload=payload
    )


@router.post(
    "/{course_id}/seed-scenario",
    status_code=status.HTTP_201_CREATED,
    summary="Seed full-lifecycle presentation demo scenario",
    description="Populates multimodal documents, BKT mastery calibration, diagnostic attempts with error traps, flashcards, and tutor dialogues for evaluation demonstrations.",
)
def seed_scenario(
    course_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Seed comprehensive presentation demo scenario."""
    from app.services.scenario_service import seed_full_course_scenario
    return seed_full_course_scenario(db=db, course_id=course_id, user_id=current_user.id)


@router.post(
    "/{course_id}/synthesize-materials",
    status_code=status.HTTP_200_OK,
    summary="Synthesize syllabus topics and materials from live uploaded documents",
    description="Extracts topics, seeds BKT mastery tracking, and generates flashcards & diagnostic assessment from live course files.",
)
async def synthesize_course_materials(
    course_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Synthesize live study workspace from uploaded files."""
    from app.services.synthesis_service import SynthesisService
    return await SynthesisService.synthesize_workspace(
        db=db, course_id=course_id, user_id=current_user.id
    )


@router.get(
    "/{course_id}/flow-map",
    status_code=status.HTTP_200_OK,
    summary="Get curriculum prerequisite flow map and DAG",
    description="Returns topics DAG with prerequisite relationships and student BKT mastery levels.",
)
def get_course_flow_map(
    course_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retrieve curriculum flow map."""
    return CourseService.get_course_flow_map(
        db=db, course_id=course_id, user_id=current_user.id
    )


@router.get(
    "/{course_id}/study-schedule",
    status_code=status.HTTP_200_OK,
    summary="Get Ebbinghaus spaced-repetition study schedule",
    description="Generates an adaptive revision calendar based on memory retention decay R = e^(-t/S) and BKT mastery.",
)
def get_study_schedule(
    course_id: str,
    target_exam_date: str = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retrieve spaced repetition revision calendar."""
    return CourseService.get_study_schedule(
        db=db,
        course_id=course_id,
        user_id=current_user.id,
        target_exam_date=target_exam_date,
    )

