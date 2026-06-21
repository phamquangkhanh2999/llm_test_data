import random


def validate_and_repair_enum_fields(test_case: dict, schema: list) -> tuple[dict, int]:
    """
    Post-mutation Enum Constraint Validator.
    Chạy SAU mỗi bước GA mutation hoặc HC tweak để đảm bảo:
    - Nếu field có allowedValues (Enum), giá trị phải thuộc tập đó.
    - Nếu phát hiện vi phạm -> chọn ngẫu nhiên một giá trị hợp lệ từ enum_list.

    Returns:
        (repaired_test_case, num_violations_fixed)
    """
    repaired = {**test_case}
    violations_fixed = 0

    for field in schema:
        name = field.get("name")
        allowed = field.get("allowedValues")

        if not allowed or not name:
            continue

        current_val = repaired.get(name)
        allowed_strs = [str(v) for v in allowed]

        if current_val is None or str(current_val) not in allowed_strs:
            repaired[name] = random.choice(allowed_strs)
            violations_fixed += 1

    return repaired, violations_fixed


def validate_enum_fields_strict(test_case: dict, schema: list) -> list[str]:
    """
    Kiểm tra (không sửa) và trả về danh sách tên các trường Enum bị vi phạm.
    Dùng để logging/reporting.
    """
    violations = []
    for field in schema:
        name = field.get("name")
        allowed = field.get("allowedValues")
        if not allowed or not name:
            continue
        current_val = test_case.get(name)
        allowed_strs = [str(v) for v in allowed]
        if current_val is None or str(current_val) not in allowed_strs:
            violations.append(name)
    return violations


def repair_population_enums(population: list, schema: list) -> tuple[list, int]:
    """
    Áp dụng validate_and_repair_enum_fields cho toàn bộ quần thể.
    Dùng sau mỗi thế hệ GA để đảm bảo tính hợp lệ enum toàn cục.

    Args:
        population: list of {"values": dict, "fitness": float, ...}
        schema: list of field definitions

    Returns:
        (repaired_population, total_violations_fixed)
    """
    total_fixed = 0
    repaired_pop = []

    for individual in population:
        values = individual.get("values", {})
        repaired_values, fixed = validate_and_repair_enum_fields(values, schema)
        repaired_individual = {**individual, "values": repaired_values}
        total_fixed += fixed
        repaired_pop.append(repaired_individual)

    return repaired_pop, total_fixed
