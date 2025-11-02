
from fastapi import APIRouter

router = APIRouter(
    prefix="/groups",  
    tags=["groups"]
)

@router.get("/")
def list_groups():
    return {"message": "Groups endpoint working!"}
