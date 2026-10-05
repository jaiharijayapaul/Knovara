"""Authentication API router endpoints."""

from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.config import settings
from app.utils.rate_limit import limiter
from app.schemas.user import UserRegister, UserLogin, UserResponse, TokenResponse, GoogleAuthRequest
from app.services.auth_service import AuthService
from app.auth.dependencies import get_current_user
from app.models.user import User

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post(
    "/register",
    response_model=TokenResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register new student",
    description="Registers a new user account, hashes password, and returns a signed JWT access token.",
)
@limiter.limit(settings.AUTH_RATE_LIMIT)
def register(
    request: Request,
    payload: UserRegister,
    db: Session = Depends(get_db),
):
    """Handle new user registration."""
    return AuthService.register_user(db=db, payload=payload)


@router.post(
    "/login",
    response_model=TokenResponse,
    status_code=status.HTTP_200_OK,
    summary="Student login",
    description="Authenticates email and password credentials, returning a signed JWT access token.",
)
@limiter.limit(settings.AUTH_RATE_LIMIT)
def login(
    request: Request,
    payload: UserLogin,
    db: Session = Depends(get_db),
):
    """Handle user authentication."""
    return AuthService.authenticate_user(db=db, payload=payload)


@router.post(
    "/google",
    response_model=TokenResponse,
    status_code=status.HTTP_200_OK,
    summary="Google Sign-In authentication",
    description="Authenticates via Google OAuth credential or verified profile, returning a signed JWT access token.",
)
def google_login(
    payload: GoogleAuthRequest,
    db: Session = Depends(get_db),
):
    """Handle Google authentication."""
    return AuthService.authenticate_google(db=db, payload=payload)


@router.get(
    "/me",
    response_model=UserResponse,
    status_code=status.HTTP_200_OK,
    summary="Current authenticated user",
    description="Returns profile details for the currently authenticated bearer token.",
)
def get_current_profile(
    current_user: User = Depends(get_current_user),
):
    """Return profile for the bearer token subject."""
    return UserResponse.model_validate(current_user)
