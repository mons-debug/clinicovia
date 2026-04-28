import uuid
import re

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.user import User
from app.models.clinic import Clinic, ClinicMembership, Role
from app.schemas.auth import (
    RegisterRequest,
    LoginRequest,
    RefreshRequest,
    ForgotPasswordRequest,
    ResetPasswordRequest,
    AuthResponse,
    TokenResponse,
    UserResponse,
    MembershipResponse,
    MessageResponse,
)
from app.utils.security import (
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
    create_verification_token,
    create_reset_token,
    decode_token,
)
from app.middleware.auth import get_current_user

router = APIRouter()


def _slugify(name: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return f"{slug}-{uuid.uuid4().hex[:6]}"


def _build_memberships(user: User) -> list[MembershipResponse]:
    return [
        MembershipResponse(
            id=m.id,
            clinic_id=m.clinic_id,
            clinic_name=m.clinic.name if m.clinic else "",
            role=m.role.value,
            is_active=m.is_active,
        )
        for m in user.memberships
    ]


@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
async def register(body: RegisterRequest, db: AsyncSession = Depends(get_db)):
    """Register a new clinic + owner user."""
    # Check email uniqueness
    exists = await db.execute(select(User).where(User.email == body.email))
    if exists.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    # Create user
    user = User(
        email=body.email,
        password_hash=hash_password(body.password),
        first_name=body.first_name,
        last_name=body.last_name,
        phone=body.phone,
    )
    db.add(user)
    await db.flush()

    # Create clinic
    clinic = Clinic(
        name=body.clinic_name,
        slug=_slugify(body.clinic_name),
        clinic_type=body.clinic_type,
        city=body.city,
        country=body.country,
    )
    db.add(clinic)
    await db.flush()

    # Create membership (owner)
    membership = ClinicMembership(
        user_id=user.id,
        clinic_id=clinic.id,
        role=Role.CLINIC_OWNER,
    )
    db.add(membership)
    await db.commit()

    # Reload with relationships
    result = await db.execute(
        select(User)
        .options(selectinload(User.memberships).selectinload(ClinicMembership.clinic))
        .where(User.id == user.id)
    )
    user = result.scalar_one()

    tokens = TokenResponse(
        access_token=create_access_token(user.id, clinic.id, Role.CLINIC_OWNER.value),
        refresh_token=create_refresh_token(user.id),
    )

    # TODO: Send verification email with create_verification_token(user.id)

    return AuthResponse(
        user=UserResponse.model_validate(user),
        tokens=tokens,
        memberships=_build_memberships(user),
    )


@router.post("/login", response_model=AuthResponse)
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)):
    """Authenticate user and return JWT tokens."""
    result = await db.execute(
        select(User)
        .options(selectinload(User.memberships).selectinload(ClinicMembership.clinic))
        .where(User.email == body.email)
    )
    user = result.scalar_one_or_none()

    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")

    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is disabled")

    # Pick the first active membership for the default token context
    active_membership = next((m for m in user.memberships if m.is_active), None)
    clinic_id = active_membership.clinic_id if active_membership else None
    role = active_membership.role.value if active_membership else None

    tokens = TokenResponse(
        access_token=create_access_token(user.id, clinic_id, role),
        refresh_token=create_refresh_token(user.id),
    )

    return AuthResponse(
        user=UserResponse.model_validate(user),
        tokens=tokens,
        memberships=_build_memberships(user),
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(body: RefreshRequest, db: AsyncSession = Depends(get_db)):
    """Refresh access token using refresh token."""
    payload = decode_token(body.refresh_token)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

    user_id = uuid.UUID(payload["sub"])
    result = await db.execute(
        select(User)
        .options(selectinload(User.memberships).selectinload(ClinicMembership.clinic))
        .where(User.id == user_id, User.is_active == True)  # noqa: E712
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    active_membership = next((m for m in user.memberships if m.is_active), None)
    clinic_id = active_membership.clinic_id if active_membership else None
    role = active_membership.role.value if active_membership else None

    return TokenResponse(
        access_token=create_access_token(user.id, clinic_id, role),
        refresh_token=create_refresh_token(user.id),
    )


@router.post("/forgot-password", response_model=MessageResponse)
async def forgot_password(body: ForgotPasswordRequest, db: AsyncSession = Depends(get_db)):
    """Send password reset email."""
    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()

    # Always return success to prevent email enumeration
    if user:
        _reset_token = create_reset_token(user.id)
        # TODO: Send email with reset link containing _reset_token

    return MessageResponse(message="If an account with that email exists, a reset link has been sent.")


@router.post("/reset-password", response_model=MessageResponse)
async def reset_password(body: ResetPasswordRequest, db: AsyncSession = Depends(get_db)):
    """Reset password with token."""
    payload = decode_token(body.token)
    if not payload or payload.get("type") != "password_reset":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired reset token")

    user_id = uuid.UUID(payload["sub"])
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    user.password_hash = hash_password(body.new_password)
    await db.commit()

    return MessageResponse(message="Password has been reset successfully.")


@router.get("/verify-email/{token}", response_model=MessageResponse)
async def verify_email(token: str, db: AsyncSession = Depends(get_db)):
    """Verify email address."""
    payload = decode_token(token)
    if not payload or payload.get("type") != "email_verify":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired verification token")

    user_id = uuid.UUID(payload["sub"])
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    user.is_verified = True
    await db.commit()

    return MessageResponse(message="Email verified successfully.")


@router.post("/dev-seed", response_model=AuthResponse)
async def dev_seed(db: AsyncSession = Depends(get_db)):
    """Create or re-use a dev user for local development. DO NOT deploy to production."""
    dev_email = "admin@clinicovia.com"
    result = await db.execute(
        select(User)
        .options(selectinload(User.memberships).selectinload(ClinicMembership.clinic))
        .where(User.email == dev_email)
    )
    user = result.scalar_one_or_none()

    if not user:
        user = User(
            email=dev_email,
            password_hash=hash_password("admin123"),
            first_name="Ahmad",
            last_name="Al-Rashid",
            is_verified=True,
            is_super_admin=True,
        )
        db.add(user)
        await db.flush()

        clinic = Clinic(
            name="Dubai Aesthetic Clinic",
            slug=_slugify("Dubai Aesthetic Clinic"),
            clinic_type="Aesthetic/Cosmetic",
            city="Dubai",
            country="UAE",
        )
        db.add(clinic)
        await db.flush()

        membership = ClinicMembership(
            user_id=user.id,
            clinic_id=clinic.id,
            role=Role.CLINIC_OWNER,
        )
        db.add(membership)
        await db.commit()

        result = await db.execute(
            select(User)
            .options(selectinload(User.memberships).selectinload(ClinicMembership.clinic))
            .where(User.id == user.id)
        )
        user = result.scalar_one()

    active_membership = next((m for m in user.memberships if m.is_active), None)
    clinic_id = active_membership.clinic_id if active_membership else None
    role_val = active_membership.role.value if active_membership else None

    tokens = TokenResponse(
        access_token=create_access_token(user.id, clinic_id, role_val),
        refresh_token=create_refresh_token(user.id),
    )

    return AuthResponse(
        user=UserResponse.model_validate(user),
        tokens=tokens,
        memberships=_build_memberships(user),
    )


@router.get("/me", response_model=AuthResponse)
async def get_me(user: User = Depends(get_current_user)):
    """Get current authenticated user info with memberships."""
    active_membership = next((m for m in user.memberships if m.is_active), None)
    clinic_id = active_membership.clinic_id if active_membership else None
    role = active_membership.role.value if active_membership else None

    tokens = TokenResponse(
        access_token=create_access_token(user.id, clinic_id, role),
        refresh_token=create_refresh_token(user.id),
    )

    return AuthResponse(
        user=UserResponse.model_validate(user),
        tokens=tokens,
        memberships=_build_memberships(user),
    )
