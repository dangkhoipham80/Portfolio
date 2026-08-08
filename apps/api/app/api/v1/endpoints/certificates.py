from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.constants import ErrorMessages, SuccessMessages
from app.services.portfolio_service import PortfolioService
from app.schemas.portfolio import Certificate, CertificateCreate, CertificateUpdate

router = APIRouter()

@router.get("/", response_model=List[Certificate])
def get_certificates(db: Session = Depends(get_db)):
    """Get all certificates"""
    service = PortfolioService(db)
    return service.get_certificates()

@router.get("/{certificate_id}", response_model=Certificate)
def get_certificate(certificate_id: int, db: Session = Depends(get_db)):
    """Get a specific certificate by ID"""
    service = PortfolioService(db)
    certificate = service.get_certificate(certificate_id)
    if not certificate:
        raise HTTPException(status_code=404, detail=ErrorMessages.CERTIFICATE_NOT_FOUND)
    return certificate

@router.post("/", response_model=Certificate)
def create_certificate(certificate: CertificateCreate, db: Session = Depends(get_db)):
    """Create a new certificate"""
    service = PortfolioService(db)
    return service.create_certificate(certificate)

@router.put("/{certificate_id}", response_model=Certificate)
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

@router.delete("/{certificate_id}")
def delete_certificate(certificate_id: int, db: Session = Depends(get_db)):
    """Delete a certificate"""
    service = PortfolioService(db)
    success = service.delete_certificate(certificate_id)
    if not success:
        raise HTTPException(status_code=404, detail=ErrorMessages.CERTIFICATE_NOT_FOUND)
    return {"message": SuccessMessages.CERTIFICATE_DELETED}