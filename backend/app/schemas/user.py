"""Pydantic schemas for User registration, login, and profile serialization."""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr, Field, ConfigDict


class UserBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=100, description="Full name of student")
    email: EmailStr = Field(..., description="Student email address")
    education_level: Optional[str] = Field("Undergraduate", description="Educational level")
    role: str = Field("student", description="Role: student, instructor, or admin")


class UserRegister(UserBase):
    password: str = Field(..., min_length=6, max_length=100, description="Account password")


class UserLogin(BaseModel):
    email: EmailStr = Field(..., description="Account email")
    password: str = Field(..., min_length=1, description="Account password")


class UserResponse(UserBase):
    id: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class GoogleAuthRequest(BaseModel):
    token: Optional[str] = Field(None, description="Google ID Token from Google Identity Services")
    id_token: Optional[str] = Field(None, description="Google ID Token alias from Google Identity Services")
    email: Optional[EmailStr] = Field(None, description="Google account email")
    name: Optional[str] = Field(None, description="Google account full name")
    picture: Optional[str] = Field(None, description="Google profile picture avatar URL")

