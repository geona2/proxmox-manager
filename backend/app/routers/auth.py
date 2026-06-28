import os
import logging
import secrets
import hashlib
from typing import Dict, Any, List, Literal, Optional
from fastapi import APIRouter, HTTPException, Depends, Header, status
from pydantic import BaseModel
from sqlalchemy.future import select
from app.database import AsyncSessionLocal, UserTable

router = APIRouter(prefix="/api/auth", tags=["auth"])
logger = logging.getLogger(__name__)

ACTIVE_SESSIONS: Dict[str, Dict[str, Any]] = {} # token -> {username, role}

class LoginPayload(BaseModel):
    username: str
    password: str

class UserCreatePayload(BaseModel):
    username: str
    password: str
    role: Literal["admin", "operator", "reader"]

class UserResponse(BaseModel):
    username: str
    role: str

def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode("utf-8")).hexdigest()

# Security dependency to get the current user
async def get_current_user(authorization: Optional[str] = Header(None)) -> Dict[str, Any]:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid authentication token"
        )
    
    token = authorization.split(" ")[1]
    session = ACTIVE_SESSIONS.get(token)
    if not session:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session expired or invalid"
        )
    return session

# Check role helper dependency
def require_role(roles: List[str]):
    async def dependency(current_user: Dict[str, Any] = Depends(get_current_user)):
        if current_user["role"] not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to perform this action"
            )
        return current_user
    return dependency

@router.post("/login")
async def login(payload: LoginPayload):
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(UserTable).filter_by(username=payload.username))
        user = result.scalar_one_or_none()
        
    pwd_hash = hash_password(payload.password)
    if not user or user.password_hash != pwd_hash:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password"
        )
    
    token = secrets.token_hex(32)
    ACTIVE_SESSIONS[token] = {
        "username": user.username,
        "role": user.role
    }
    
    return {
        "token": token,
        "username": user.username,
        "role": user.role
    }

@router.post("/logout")
async def logout(authorization: Optional[str] = Header(None)):
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ")[1]
        ACTIVE_SESSIONS.pop(token, None)
    return {"status": "success", "message": "Logged out successfully"}

@router.get("/me", response_model=UserResponse)
async def get_me(current_user: Dict[str, Any] = Depends(get_current_user)):
    return current_user

# Admin only user management endpoints
@router.get("/users", response_model=List[UserResponse])
async def list_users(current_user: Dict[str, Any] = Depends(require_role(["admin"]))):
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(UserTable))
        users = result.scalars().all()
    return [{"username": u.username, "role": u.role} for u in users]

@router.post("/users", response_model=UserResponse)
async def create_user(payload: UserCreatePayload, current_user: Dict[str, Any] = Depends(require_role(["admin"]))):
    async with AsyncSessionLocal() as session:
        async with session.begin():
            result = await session.execute(select(UserTable).filter_by(username=payload.username))
            existing = result.scalar_one_or_none()
            if existing:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Username already exists"
                )
            
            new_user = UserTable(
                username=payload.username,
                password_hash=hash_password(payload.password),
                role=payload.role
            )
            session.add(new_user)
            
    return {"username": payload.username, "role": payload.role}

@router.delete("/users/{username}")
async def delete_user(username: str, current_user: Dict[str, Any] = Depends(require_role(["admin"]))):
    if username == current_user["username"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot delete your own account"
        )
        
    async with AsyncSessionLocal() as session:
        async with session.begin():
            result = await session.execute(select(UserTable).filter_by(username=username))
            user = result.scalar_one_or_none()
            if not user:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"User {username} not found"
                )
            await session.delete(user)
            
    # Terminate active sessions for the deleted user
    tokens_to_remove = [t for t, s in ACTIVE_SESSIONS.items() if s["username"] == username]
    for t in tokens_to_remove:
        ACTIVE_SESSIONS.pop(t, None)
    return {"status": "success", "message": f"User {username} deleted successfully"}
