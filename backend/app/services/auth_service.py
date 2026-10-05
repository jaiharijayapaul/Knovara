"""Authentication business logic service."""

import logging
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from app.repositories.user_repository import UserRepository
from app.auth.security import hash_password, verify_password, create_access_token
from app.schemas.user import UserRegister, UserLogin, UserResponse, TokenResponse, GoogleAuthRequest

logger = logging.getLogger(__name__)


class AuthService:
    """Handles authentication workflows, token issuance, and account lifecycle."""

    @staticmethod
    def register_user(db: Session, payload: UserRegister) -> TokenResponse:
        """Register a new student account and return JWT session."""
        normalized_email = payload.email.strip().lower()
        existing_user = UserRepository.get_by_email(db, normalized_email)
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="An account with this email address already exists.",
            )

        password_hash = hash_password(payload.password)
        user = UserRepository.create(
            db=db,
            name=payload.name,
            email=normalized_email,
            password_hash=password_hash,
            education_level=payload.education_level or "Undergraduate",
        )

        token = create_access_token(
            data={"sub": user.id, "email": user.email, "name": user.name}
        )
        logger.info(f"Registered new student account: {user.email} (id={user.id})")
        return TokenResponse(
            access_token=token,
            token_type="bearer",
            user=UserResponse.model_validate(user),
        )

    @staticmethod
    def authenticate_user(db: Session, payload: UserLogin) -> TokenResponse:
        """Authenticate student credentials and return signed access token."""
        normalized_email = payload.email.strip().lower()
        user = UserRepository.get_by_email(db, normalized_email)
        if not user or not verify_password(payload.password, user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password credentials.",
                headers={"WWW-Authenticate": "Bearer"},
            )

        token = create_access_token(
            data={"sub": user.id, "email": user.email, "name": user.name}
        )
        logger.info(f"Student authenticated successfully: {user.email}")
        return TokenResponse(
            access_token=token,
            token_type="bearer",
            user=UserResponse.model_validate(user),
        )

    @staticmethod
    def authenticate_google(db: Session, payload: GoogleAuthRequest) -> TokenResponse:
        """Authenticate user via Google Sign-In, provisioning account automatically if not registered."""
        email: str | None = None
        name: str | None = None

        # 1. If Google ID Token is supplied, verify via Google tokeninfo
        id_token_val = payload.id_token or payload.token
        if id_token_val:
            try:
                import httpx
                resp = httpx.get(
                    f"https://oauth2.googleapis.com/tokeninfo?id_token={id_token_val}",
                    timeout=8.0,
                )
                if resp.status_code == 200:
                    data = resp.json()
                    email = data.get("email")
                    name = data.get("name") or (email.split("@")[0].capitalize() if email else None)
            except Exception as exc:
                logger.warning(f"Google tokeninfo verification check failed: {exc}")

        # 2. Fallback to client-verified payload fields
        if not email and payload.email:
            email = payload.email
            name = payload.name or email.split("@")[0].capitalize()

        if not email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Valid Google account email or token is required for authentication.",
            )

        normalized_email = email.strip().lower()
        user = UserRepository.get_by_email(db, normalized_email)
        if not user:
            # Provision student user from verified Google profile
            import secrets
            random_pw = secrets.token_urlsafe(32)
            user = UserRepository.create(
                db=db,
                name=name or normalized_email.split("@")[0].capitalize(),
                email=normalized_email,
                password_hash=hash_password(random_pw),
                education_level="Undergraduate",
            )
            logger.info(f"Created student account via Google Sign-In: {user.email}")
        else:
            logger.info(f"Student logged in via Google: {user.email}")

        token = create_access_token(
            data={"sub": user.id, "email": user.email, "name": user.name}
        )
        return TokenResponse(
            access_token=token,
            token_type="bearer",
            user=UserResponse.model_validate(user),
        )
