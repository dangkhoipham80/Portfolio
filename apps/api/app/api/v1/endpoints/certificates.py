from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api.v1.dependencies import get_optional_admin, require_admin
from app.core.constants import ErrorMessages, SuccessMessages
from app.core.database import get_db
from app.schemas.portfolio import Certificate, CertificateCreate, CertificateUpdate
from app.services.portfolio_service import PortfolioService

router = APIRouter()

@router.get("/", response_model=List[Certificate])
def get_certificates(
    category: str = Query(None, description="Filter certificates by category"),
    db: Session = Depends(get_db),
    viewer = Depends(get_optional_admin)
):
    """Get published certificates; admins also see drafts"""
    service = PortfolioService(db)
    return service.get_certificates(
        category=category,
        include_unpublished=viewer is not None,
    )

@router.get("/slug/{slug}", response_model=Certificate)
def get_certificate_by_slug(
    slug: str,
    db: Session = Depends(get_db),
    viewer = Depends(get_optional_admin)
):
    """Get a specific certificate by slug"""
    service = PortfolioService(db)
    certificate = service.get_certificate_by_slug(
        slug, include_unpublished=viewer is not None
    )
    if not certificate:
        raise HTTPException(status_code=404, detail=ErrorMessages.CERTIFICATE_NOT_FOUND)
    return certificate

@router.get("/{certificate_id}", response_model=Certificate)
def get_certificate(
    certificate_id: int,
    db: Session = Depends(get_db),
    viewer = Depends(get_optional_admin)
):
    """Get a specific certificate by ID"""
    service = PortfolioService(db)
    certificate = service.get_certificate(
        certificate_id, include_unpublished=viewer is not None
    )
    if not certificate:
        raise HTTPException(status_code=404, detail=ErrorMessages.CERTIFICATE_NOT_FOUND)
    return certificate

@router.post("/", response_model=Certificate, dependencies=[Depends(require_admin)])
def create_certificate(certificate: CertificateCreate, db: Session = Depends(get_db)):
    """Create a new certificate"""
    service = PortfolioService(db)
    return service.create_certificate(certificate)

@router.put("/{certificate_id}", response_model=Certificate, dependencies=[Depends(require_admin)])
def update_certificate(
    certificate_id: int,
    certificate: CertificateUpdate,
    db: Session = Depends(get_db)
):
    """Update an existing certificate"""
    service = PortfolioService(db)
    updated_certificate = service.update_certificate(certificate_id, certificate)
    if not updated_certificate:
        raise HTTPException(status_code=404, detail=ErrorMessages.CERTIFICATE_NOT_FOUND)
    return updated_certificate

@router.delete("/{certificate_id}", dependencies=[Depends(require_admin)])
def delete_certificate(certificate_id: int, db: Session = Depends(get_db)):
    """Delete a certificate"""
    service = PortfolioService(db)
    success = service.delete_certificate(certificate_id)
    if not success:
        raise HTTPException(status_code=404, detail=ErrorMessages.CERTIFICATE_NOT_FOUND)
    return {"message": SuccessMessages.CERTIFICATE_DELETED}
