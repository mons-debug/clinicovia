import uuid
from pydantic import BaseModel, EmailStr, Field


# ── Request schemas ──────────────────────────────────────────────

class RegisterRequest(BaseModel):
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    clinic_name: str = Field(min_length=1, max_length=255)
    clinic_type: str | None = None
    phone: str | None = None
    country: str | None = None
    city: str | None = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(min_length=8, max_length=128)


# ── Response schemas ─────────────────────────────────────────────

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    id: uuid.UUID
    email: str
    first_name: str
    last_name: str
    phone: str | None = None
    avatar_url: str | None = None
    is_active: bool
    is_verified: bool
    is_super_admin: bool
    specialty: str | None = None

    model_config = {"from_attributes": True}


class MembershipResponse(BaseModel):
    id: uuid.UUID
    clinic_id: uuid.UUID
    clinic_name: str
    role: str
    is_active: bool


class AuthResponse(BaseModel):
    user: UserResponse
    tokens: TokenResponse
    memberships: list[MembershipResponse]


class MessageResponse(BaseModel):
    message: str
