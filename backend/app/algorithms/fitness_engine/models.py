from typing import List, Dict, Any, Optional
from pydantic import BaseModel
from enum import Enum

class InvalidType(str, Enum):
    INVALID_BOUNDARY = "INVALID_BOUNDARY"
    INVALID_FORMAT = "INVALID_FORMAT"
    INVALID_TYPE = "INVALID_TYPE"
    INVALID_REQUIRED = "INVALID_REQUIRED"
    INVALID_ENUM = "INVALID_ENUM"
    INVALID_SEMANTIC = "INVALID_SEMANTIC"
    VALID = "VALID"

class SemanticQuality(BaseModel):
    type_score: float = 1.0
    format_score: float = 1.0
    semantic_score: float = 1.0
    boundary_score: float = 1.0
    required_score: float = 1.0

class FieldQualityStatus(BaseModel):
    status: InvalidType
    quality: SemanticQuality


class FieldAnalysis(BaseModel):
    field: str
    value: Any
    target: Any
    distance: float
    score: float
    status: str

class FitnessBreakdown(BaseModel):
    schema_score: float
    coverage: float
    boundary: float
    diversity: float
    semantic: float
    error_path_score: float = 0.0
    business_rule_score: float = 0.0
    penalty: float
    raw_fitness: float

class FitnessResult(BaseModel):
    fitness: float
    breakdown: FitnessBreakdown
    field_analysis: List[FieldAnalysis]
    missing_rules: List[str]
    invalid_reason: Optional[str] = None
    weak_points: List[Dict[str, Any]]
    improvements: List[str]

    def dict(self, **kwargs):
        return super().model_dump(**kwargs) if hasattr(super(), "model_dump") else super().dict(**kwargs)
