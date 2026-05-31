import sys
import os
sys.path.append(os.getcwd())
from backend.app.services.ai_parser import evaluate_test_quality_with_ai

evaluate_test_quality_with_ai([], [], "random", "test", "AIzaFakeKey")
