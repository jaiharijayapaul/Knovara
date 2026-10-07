"""Administrative API endpoints for platform management and telemetry."""

from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.auth.dependencies import require_admin
from app.models.user import User
from app.services.admin_service import AdminService
from app.schemas.admin import (
    AdminStatsResponse,
    AdminUserItem,
    AdminRoleUpdateRequest,
    AdminCourseItem,
    AdminActivityItem,
)

router = APIRouter(prefix="/admin", tags=["Admin Control Panel"])


@router.get(
    "/stats",
    response_model=AdminStatsResponse,
    status_code=status.HTTP_200_OK,
    summary="Get platform-wide KPI telemetry and health metrics",
)
def get_admin_stats(
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Retrieve aggregate counts of users, courses, documents, chunks, and system health."""
    return AdminService.get_platform_stats(db=db)


@router.get(
    "/users",
    response_model=List[AdminUserItem],
    status_code=status.HTTP_200_OK,
    summary="List all registered platform users",
)
def list_admin_users(
    search: Optional[str] = Query(None, description="Search by name, email, or role"),
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """List all registered students, instructors, and admins."""
    return AdminService.list_users(db=db, search=search)


@router.patch(
    "/users/{user_id}/role",
    response_model=AdminUserItem,
    status_code=status.HTTP_200_OK,
    summary="Update a user's role (promote/demote)",
)
def update_user_role(
    user_id: str,
    payload: AdminRoleUpdateRequest,
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Change a user's role to student, instructor, or admin."""
    return AdminService.update_user_role(db=db, user_id=user_id, new_role=payload.role)


@router.get(
    "/courses",
    response_model=List[AdminCourseItem],
    status_code=status.HTTP_200_OK,
    summary="List all courses across the platform",
)
def list_admin_courses(
    search: Optional[str] = Query(None, description="Search by course name or subject"),
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Inspect all course workspaces across all users."""
    return AdminService.list_courses(db=db, search=search)


@router.delete(
    "/courses/{course_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Administrative purge of a course workspace",
)
def delete_admin_course(
    course_id: str,
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Purge a course and all associated knowledge assets, chunks, and questions."""
    AdminService.delete_course(db=db, course_id=course_id)
    return None


@router.get(
    "/activity",
    response_model=List[AdminActivityItem],
    status_code=status.HTTP_200_OK,
    summary="Get recent platform activity audit feed",
)
def get_admin_activity(
    limit: int = Query(25, ge=1, le=100, description="Max number of activity events"),
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Get real-time chronological stream of multimodal uploads, courses, and tutor chats."""
    return AdminService.get_audit_activity(db=db, limit=limit)
