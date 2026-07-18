"""Plan routes. HTTP I/O only — logic lives in PlanService (Rules.md 2)."""

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.security import require_admin
from app.db.session import get_db
from app.repositories.plan_repo import PlanRepository
from app.schemas.plan import PlanCreate, PlanResponse, PlanUpdate
from app.services.plan_service import PlanService

router = APIRouter(prefix="/plans", tags=["plans"])


def get_plan_service(db: Session = Depends(get_db)) -> PlanService:
    return PlanService(PlanRepository(db), db)


@router.post(
    "",
    response_model=PlanResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_admin)],
)
def create_plan(
    payload: PlanCreate, service: PlanService = Depends(get_plan_service)
) -> PlanResponse:
    return service.create_plan(payload)


@router.get("", response_model=list[PlanResponse])
def list_plans(service: PlanService = Depends(get_plan_service)) -> list[PlanResponse]:
    return service.list_plans()


@router.patch(
    "/{plan_id}", response_model=PlanResponse, dependencies=[Depends(require_admin)]
)
def update_plan(
    plan_id: int,
    payload: PlanUpdate,
    service: PlanService = Depends(get_plan_service),
) -> PlanResponse:
    return service.update_plan(plan_id, payload)
