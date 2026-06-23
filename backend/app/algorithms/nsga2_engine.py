import math

class NSGA2Engine:
    @staticmethod
    def fast_nondominated_sort(population):
        fronts = [[]]
        for p in population:
            p["domination_count"] = 0
            p["dominated_solutions"] = []
            
            for q in population:
                if NSGA2Engine.dominates(p.get("fitness_vector", {}), q.get("fitness_vector", {})):
                    p["dominated_solutions"].append(q)
                elif NSGA2Engine.dominates(q.get("fitness_vector", {}), p.get("fitness_vector", {})):
                    p["domination_count"] += 1
                    
            if p["domination_count"] == 0:
                p["rank"] = 0
                fronts[0].append(p)
                
        i = 0
        while len(fronts[i]) > 0:
            next_front = []
            for p in fronts[i]:
                for q in p["dominated_solutions"]:
                    q["domination_count"] -= 1
                    if q["domination_count"] == 0:
                        q["rank"] = i + 1
                        next_front.append(q)
            i += 1
            if len(next_front) > 0:
                fronts.append(next_front)
            else:
                break
                
        return fronts

    @staticmethod
    def dominates(fitness1, fitness2):
        # V6 Lexicographic Constrained Pareto
        r1, r2 = fitness1.get("rule", 0), fitness2.get("rule", 0)
        # If Rule score is significantly better, it dominates outright
        if r1 > r2 + 0.05: return True
        if r2 > r1 + 0.05: return False
        
        b1, b2 = fitness1.get("boundary", 0), fitness2.get("boundary", 0)
        s1, s2 = fitness1.get("security", 0), fitness2.get("security", 0)
        o1, o2 = fitness1.get("oracle", 0), fitness2.get("oracle", 0)
        
        # If Rule is roughly equal, apply standard Pareto on the remaining objectives
        better_or_equal = (b1 >= b2 and s1 >= s2 and o1 >= o2)
        strictly_better = (b1 > b2 or s1 > s2 or o1 > o2)
        return better_or_equal and strictly_better

    @staticmethod
    def calculate_crowding_distance(front):
        l = len(front)
        if l == 0:
            return
            
        for p in front:
            p["crowding_distance"] = 0.0
            
        if l <= 2:
            for p in front:
                p["crowding_distance"] = float("inf")
            return
            
        keys = list(front[0].get("fitness_vector", {}).keys())
        if not keys: return
        for m in keys:
            front.sort(key=lambda x: x.get("fitness_vector", {}).get(m, 0))
            front[0]["crowding_distance"] = float("inf")
            front[-1]["crowding_distance"] = float("inf")
            
            m_min = front[0].get("fitness_vector", {}).get(m, 0)
            m_max = front[-1].get("fitness_vector", {}).get(m, 0)
            if m_max - m_min == 0:
                continue
                
            for i in range(1, l - 1):
                if front[i]["crowding_distance"] != float("inf"):
                    front[i]["crowding_distance"] += (front[i+1].get("fitness_vector", {}).get(m, 0) - front[i-1].get("fitness_vector", {}).get(m, 0)) / (m_max - m_min)

    @staticmethod
    def select_next_generation(population, pop_size):
        fronts = NSGA2Engine.fast_nondominated_sort(population)
        
        next_gen = []
        for front in fronts:
            NSGA2Engine.calculate_crowding_distance(front)
            
            if len(next_gen) + len(front) <= pop_size:
                next_gen.extend(front)
            else:
                # Sort front by crowding distance descending
                front.sort(key=lambda x: x["crowding_distance"], reverse=True)
                next_gen.extend(front[:pop_size - len(next_gen)])
                break
                
        return next_gen, fronts
