import type { FieldConstraint } from './presets';

export type Chromosome = Record<string, any>;

export interface PopulationStats {
  generation: number;
  bestFitness: number;
  avgFitness: number;
  coverage: number;
  duplicateRate: number;
  chromosomes: { values: Chromosome; fitness: number; origin: string }[];
}

export interface GeneticConfig {
  generations: number;
  popSize: number;
  crossoverRate: number;
  mutationRate: number;
  weights: {
    validation: number;
    boundary: number;
    security: number;
    diversity: number;
  };
}

function stringDistance(s1: string, s2: string): number {
  s1 = s1.substring(0, 25);
  s2 = s2.substring(0, 25);
  if (s1 === s2) return 0;
  if (s1.length === 0) return s2.length;
  if (s2.length === 0) return s1.length;

  const track = Array(s2.length + 1).fill(null).map(() => Array(s1.length + 1).fill(null));
  for (let i = 0; i <= s1.length; i += 1) track[0][i] = i;
  for (let j = 0; j <= s2.length; j += 1) track[j][0] = j;
  for (let j = 1; j <= s2.length; j += 1) {
    for (let i = 1; i <= s1.length; i += 1) {
      const indicator = s1[i - 1] === s2[j - 1] ? 0 : 1;
      track[j][i] = Math.min(
        track[j][i - 1] + 1, // deletion
        track[j - 1][i] + 1, // insertion
        track[j - 1][i - 1] + indicator // substitution
      );
    }
  }
  return track[s2.length][s1.length];
}

// Helper: General diversity score between one chromosome and a subset of population
function calculateDiversity(c: Chromosome, subset: Chromosome[]): number {
  if (subset.length === 0) return 1;
  let totalDist = 0;
  subset.forEach(other => {
    let diffs = 0;
    const keys = Object.keys(c);
    keys.forEach(k => {
      const v1 = String(c[k]);
      const v2 = String(other[k]);
      if (v1 !== v2) {
        const len = Math.max(v1.length, v2.length, 1);
        diffs += stringDistance(v1, v2) / len;
      }
    });
    totalDist += diffs / keys.length;
  });
  return Math.min(totalDist / subset.length, 1);
}

// Helper: Generate random value according to constraints
export function generateRandomValue(field: FieldConstraint, mode: 'valid' | 'invalid' | 'boundary' | 'security' = 'valid'): any {
  const specialChars = ['!', '@', '#', '$', '%', '^', '&', '*', '(', ')', '_', '+', '=', '-', '{', '}', '[', ']', '|', '\\', ':', ';', '"', '<', '>', ',', '.', '?', '/'];
  const securityPayloads = [
    "' OR '1'='1",
    "' OR 1=1 --",
    "admin' --",
    "admin' #",
    "' UNION SELECT NULL, NULL --",
    "<script>alert(1)</script>",
    "<svg/onload=alert(1)>",
    "javascript:alert(1)",
    "\" onerror=\"alert(1)",
    "../etc/passwd",
    "1; DROP TABLE users; --",
    "../../../../windows/system32",
    "') OR ('1'='1",
    "' OR 'a'='a",
    "<img src=x onerror=alert(1)>",
    "${7*7}",
    "|| 1=1 --",
  ];

  if (mode === 'security') {
    if (field.type === 'string' || field.type === 'email') {
      return securityPayloads[Math.floor(Math.random() * securityPayloads.length)];
    }
    if (field.type === 'number') {
      return 999999; // overflow/out-of-bounds
    }
  }

  switch (field.type) {
    case 'email':
      if (mode === 'invalid') {
        const badEmails = ['invalid-email', 'name@', '@domain.com', 'name.domain.com', 'name@domain.'];
        return badEmails[Math.floor(Math.random() * badEmails.length)];
      }
      if (mode === 'boundary') {
        return `a@${'b'.repeat(100)}.com`;
      }
      const names = ['emma', 'liam', 'olivia', 'noah', 'ava', 'will', 'sophia', 'james'];
      const domains = ['gmail.com', 'yahoo.com', 'outlook.com', 'test.io', 'company.vn'];
      return `${names[Math.floor(Math.random() * names.length)]}${Math.floor(Math.random() * 100)}@${domains[Math.floor(Math.random() * domains.length)]}`;

    case 'card':
      if (mode === 'invalid') {
        return '1234-5678-9012';
      }
      if (mode === 'boundary') {
        return '0000000000000000';
      }
      let card = '';
      for (let i = 0; i < 16; i++) card += Math.floor(Math.random() * 10);
      return card;

    case 'phone':
      const prefixes = ['03', '05', '07', '08', '09'];
      if (mode === 'invalid') {
        return '0281234567';
      }
      if (mode === 'boundary') {
        return '0900000000';
      }
      let phone = prefixes[Math.floor(Math.random() * prefixes.length)];
      for (let i = 0; i < 8; i++) phone += Math.floor(Math.random() * 10);
      return phone;

    case 'number':
      const min = field.minValue !== undefined ? field.minValue : 0;
      const max = field.maxValue !== undefined ? field.maxValue : 1000;

      if (mode === 'invalid') {
        return Math.random() > 0.5 ? min - 5 : max + 5;
      }
      if (mode === 'boundary') {
        return Math.random() > 0.5 ? min : max;
      }
      return Math.floor(Math.random() * (max - min + 1)) + min;

    case 'string':
    default:
      if (field.allowedValues && field.allowedValues.length > 0) {
        if (mode === 'invalid') return 'INVALID_VAL';
        return field.allowedValues[Math.floor(Math.random() * field.allowedValues.length)];
      }

      const minLen = field.minLength !== undefined ? field.minLength : 3;
      const maxLen = field.maxLength !== undefined ? field.maxLength : 20;

      let len = Math.floor(Math.random() * (maxLen - minLen + 1)) + minLen;
      if (mode === 'invalid') {
        len = Math.random() > 0.5 ? Math.max(0, minLen - 2) : maxLen + 5;
      } else if (mode === 'boundary') {
        len = Math.random() > 0.5 ? minLen : maxLen;
      }

      if (len === 0) return '';

      let str = '';
      const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      for (let i = 0; i < len; i++) {
        str += chars.charAt(Math.floor(Math.random() * chars.length));
      }

      if (mode === 'boundary' && Math.random() > 0.7) {
        return str.substring(0, str.length - 1) + specialChars[Math.floor(Math.random() * specialChars.length)];
      }
      return str;
  }
}

// Helper: Gaussian random number (Box-Muller)
function gaussRandom(mean: number = 0, stdev: number = 1): number {
  let u = 1 - Math.random();
  let v = Math.random();
  let z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  return z * stdev + mean;
}

export class GeneticEngine {
  schema: FieldConstraint[];
  config: GeneticConfig;
  population: { values: Chromosome; fitness: number; origin: string }[] = [];
  generation = 0;

  // TIER 1 UPGRADES: adaptive rates, crowding, HoF, stagnation detection
  private maxGenerations: number;
  private initialMutationRate: number;
  private minMutationRate: number = 0.02;
  private initialCrossoverRate: number;
  private minCrossoverRate: number = 0.45;
  private bestFitnessHistory: number[] = [];
  private stagnationThreshold: number = 8;
  hallOfFame: { values: Chromosome; fitness: number; origin: string }[] = [];
  private maxHofSize: number = 20;

  // Static evaluations cache (caching validation, boundary, security scores)
  private staticCache: Map<string, { vScore: number; bScore: number; sScore: number }> = new Map();

  constructor(schema: FieldConstraint[], config: GeneticConfig) {
    this.schema = schema;
    this.config = config;
    this.maxGenerations = config.generations;
    this.initialMutationRate = config.mutationRate;
    this.initialCrossoverRate = config.crossoverRate;
  }

  // ═══════════════════════════════════════════════
  // ADAPTIVE RATE HELPERS
  // ═══════════════════════════════════════════════

  private progressRatio(): number {
    if (this.maxGenerations <= 1) return 0;
    return Math.min(this.generation / (this.maxGenerations - 1), 1);
  }

  getAdaptiveMutationRate(): number {
    const p = this.progressRatio();
    return this.initialMutationRate - (this.initialMutationRate - this.minMutationRate) * (p * p);
  }

  getAdaptiveCrossoverRate(): number {
    const p = this.progressRatio();
    return this.initialCrossoverRate - (this.initialCrossoverRate - this.minCrossoverRate) * Math.pow(p, 1.5);
  }

  // ═══════════════════════════════════════════════
  // INITIALIZATION
  // ═══════════════════════════════════════════════

  initialize(seeds: Chromosome[]) {
    this.population = [];
    this.generation = 0;
    this.hallOfFame = [];
    this.bestFitnessHistory = [];
    this.staticCache.clear();

    // 1. Process Seeds
    seeds.forEach(s => {
      const cleanedSeed: Chromosome = {};
      this.schema.forEach(field => {
        cleanedSeed[field.name] = field.name in s ? s[field.name] : generateRandomValue(field, 'valid');
      });
      this.population.push({
        values: cleanedSeed,
        fitness: 0,
        origin: 'Seed'
      });
    });

    // 2. Expand with variations to hit popSize
    const modes: ('valid' | 'invalid' | 'boundary' | 'security')[] = ['valid', 'boundary', 'security', 'valid'];
    while (this.population.length < this.config.popSize) {
      const record: Chromosome = {};
      const mode = modes[this.population.length % modes.length];
      this.schema.forEach(field => {
        record[field.name] = generateRandomValue(field, mode);
      });
      this.population.push({
        values: record,
        fitness: 0,
        origin: `Init_${mode.toUpperCase()}`
      });
    }

    this.evaluatePopulation();
  }

  // ═══════════════════════════════════════════════
  // WARM START
  // ═══════════════════════════════════════════════

  warmStart(savedPopulation: { values: Chromosome; fitness: number; origin: string }[], generation: number = 0) {
    this.population = [];
    this.generation = generation;

    // Load saved individuals
    savedPopulation.forEach(ind => {
      const cleanedTc: Chromosome = {};
      this.schema.forEach(field => {
        cleanedTc[field.name] = ind.values?.[field.name] ?? generateRandomValue(field, 'valid');
      });
      this.population.push({
        values: cleanedTc,
        fitness: ind.fitness ?? 0,
        origin: ind.origin ?? 'WarmStart'
      });
    });

    // Expand if below popSize
    const modes: ('valid' | 'invalid' | 'boundary' | 'security')[] = ['valid', 'boundary', 'security', 'valid'];
    while (this.population.length < this.config.popSize) {
      const record: Chromosome = {};
      const mode = modes[this.population.length % modes.length];
      this.schema.forEach(field => {
        record[field.name] = generateRandomValue(field, mode);
      });
      this.population.push({ values: record, fitness: 0, origin: 'WarmStart_Expanded' });
    }

    this.evaluatePopulation();
  }

  exportState() {
    return {
      generation: this.generation,
      population: this.population.map(ind => ({
        values: { ...ind.values },
        fitness: ind.fitness,
        origin: ind.origin,
      })),
      hallOfFame: this.hallOfFame.map(hof => ({
        values: { ...hof.values },
        fitness: hof.fitness,
        origin: hof.origin,
      })),
    };
  }

  // ═══════════════════════════════════════════════
  // FITNESS FUNCTION (with near-boundary credit)
  // ═══════════════════════════════════════════════

  computeFitness(c: Chromosome, currentPop: Chromosome[]): { fitness: number; scoreBreakdown: Record<string, number> } {
    let vScore = 0;
    let bScore = 0;
    let sScore = 0;

    // Generate unique key for caching
    const tcKey = JSON.stringify(Object.entries(c).sort());

    if (this.staticCache.has(tcKey)) {
      const cached = this.staticCache.get(tcKey)!;
      vScore = cached.vScore;
      bScore = cached.bScore;
      sScore = cached.sScore;
    } else {
      let validationScore = 0;
      let boundaryScore = 0;
      let securityScore = 0;

      this.schema.forEach(field => {
        const val = c[field.name];
        if (val === undefined) return;

        const strVal = String(val);
        let isBoundary = false;
        let isNearBoundary = false;
        let isSecurity = false;

        let hardPassed = true;
        let softPassed = true;

        // --- 1. Hard Constraints ---
        // Required check
        if (field.required && (val === null || val === undefined || strVal.trim() === '')) {
          hardPassed = false;
        }

        // Data type structure checks
        if (hardPassed && val !== null && val !== undefined && strVal.trim() !== '') {
          if (field.type === 'email') {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(strVal)) hardPassed = false;
          } else if (field.type === 'card') {
            const cardRegex = /^\d{16}$/;
            if (!cardRegex.test(strVal)) hardPassed = false;
          } else if (field.type === 'phone') {
            const phoneRegex = /^(03|05|07|08|09)\d{8}$/;
            if (!phoneRegex.test(strVal)) hardPassed = false;
          } else if (field.type === 'number') {
            const num = Number(val);
            if (isNaN(num)) hardPassed = false;
          }

          // allowedValues (enum checks)
          if (hardPassed && field.allowedValues && field.allowedValues.length > 0) {
            if (!field.allowedValues.map(String).includes(strVal)) {
              hardPassed = false;
            }
          }
        }

        // --- 2. Soft Constraints ---
        if (hardPassed && val !== null && val !== undefined && strVal.trim() !== '') {
          // Ranges
          if (field.type === 'number') {
            const num = Number(val);
            if (field.minValue !== undefined && num < field.minValue) softPassed = false;
            if (field.maxValue !== undefined && num > field.maxValue) softPassed = false;
          } else {
            // minLength / maxLength
            if (field.minLength !== undefined && strVal.length < field.minLength) softPassed = false;
            if (field.maxLength !== undefined && strVal.length > field.maxLength) softPassed = false;
          }

          // Regex Match
          if (softPassed && field.regex) {
            try {
              const r = new RegExp(field.regex);
              if (!r.test(strVal)) softPassed = false;
            } catch {
              // invalid regex template
            }
          }
        }

        // Calculate validation score for this field
        let fieldValScore = 0;
        if (!hardPassed) {
          fieldValScore = 0.0;
        } else if (!softPassed) {
          fieldValScore = 0.70;
        } else {
          fieldValScore = 1.00;
        }

        validationScore += fieldValScore;

        // --- 3. Boundary Check (only for structurally correct fieldValScore == 1.0) ---
        if (fieldValScore === 1.0) {
          if (field.type === 'number') {
            const num = Number(val);
            if (field.minValue !== undefined && num === field.minValue) isBoundary = true;
            if (field.maxValue !== undefined && num === field.maxValue) isBoundary = true;
            if (field.minValue !== undefined && num === field.minValue + 1) isNearBoundary = true;
            if (field.maxValue !== undefined && num === field.maxValue - 1) isNearBoundary = true;
          } else {
            if (field.minLength !== undefined && strVal.length === field.minLength) isBoundary = true;
            if (field.maxLength !== undefined && strVal.length === field.maxLength) isBoundary = true;
            if (field.minLength !== undefined && strVal.length === field.minLength + 1) isNearBoundary = true;
            if (field.maxLength !== undefined && strVal.length === field.maxLength - 1) isNearBoundary = true;
          }
          if (isBoundary) boundaryScore += 1;
          else if (isNearBoundary) boundaryScore += 0.5;
        }

        // --- 4. Security Payload Check ---
        const securityKeywords = ["' or", '" or', "'or", '"or', '--', 'union', 'select', 'drop table', '<script', 'onload=', 'onerror=', 'javascript:'];
        const strLower = strVal.toLowerCase();
        if (securityKeywords.some(kw => strLower.includes(kw))) {
          isSecurity = true;
        }
        if (isSecurity) securityScore += 1;
      });

      // Normalize Scores
      const numFields = this.schema.length;
      vScore = validationScore / numFields;
      bScore = Math.min(boundaryScore / numFields, 1);
      sScore = Math.min(securityScore / numFields, 1);

      // Save to staticCache
      this.staticCache.set(tcKey, { vScore, bScore, sScore });
    }

    // --- 4. Diversity Score (larger sample) ---
    const sampleSize = Math.min(20, Math.max(5, Math.floor(currentPop.length / 2)));
    const sampleSubset: Chromosome[] = [];
    for (let i = 0; i < sampleSize && i < currentPop.length; i++) {
      const randIdx = Math.floor(Math.random() * currentPop.length);
      sampleSubset.push(currentPop[randIdx]);
    }
    const dScore = calculateDiversity(c, sampleSubset);

    // --- 5. Duplicate Penalty ---
    let dupCount = 0;
    currentPop.forEach(other => {
      let match = true;
      for (const k of Object.keys(c)) {
        if (String(c[k]) !== String(other[k])) {
          match = false;
          break;
        }
      }
      if (match) dupCount++;
    });

    const penalty = dupCount > 1 ? Math.min(0.15 * (dupCount - 1), 0.6) : 0;

    // Weighted Fitness Calculation
    const w = this.config.weights;
    let fitness = (w.validation * vScore) + (w.boundary * bScore) + (w.security * sScore) + (w.diversity * dScore) - penalty;
    fitness = Math.max(0.01, Math.min(fitness, 1.0));

    return {
      fitness,
      scoreBreakdown: { vScore, bScore, sScore, dScore, penalty }
    };
  }

  // ═══════════════════════════════════════════════
  // POPULATION EVALUATION + HALL OF FAME
  // ═══════════════════════════════════════════════

  evaluatePopulation() {
    const rawPop = this.population.map(p => p.values);
    this.population.forEach(p => {
      const res = this.computeFitness(p.values, rawPop);
      p.fitness = res.fitness;
    });

    this.population.sort((a, b) => b.fitness - a.fitness);
    this.updateHallOfFame();
  }

  private updateHallOfFame() {
    for (let i = 0; i < Math.min(5, this.population.length); i++) {
      const ind = this.population[i];
      const tcStr = JSON.stringify(Object.entries(ind.values).sort());
      if (!this.hallOfFame.some(hof => JSON.stringify(Object.entries(hof.values).sort()) === tcStr)) {
        this.hallOfFame.push({
          values: { ...ind.values },
          fitness: ind.fitness,
          origin: `HoF_Gen${this.generation}`
        });
      }
    }
    this.hallOfFame.sort((a, b) => b.fitness - a.fitness);
    if (this.hallOfFame.length > this.maxHofSize) {
      this.hallOfFame = this.hallOfFame.slice(0, this.maxHofSize);
    }
  }

  // ═══════════════════════════════════════════════
  // NICHE DENSITY DISTANCE
  // ═══════════════════════════════════════════════

  private nicheDensityDistance(individual: { values: Chromosome; fitness: number }): number {
    const sample = [];
    const popLen = this.population.length;
    // Sample up to 10 random individuals
    for (let i = 0; i < Math.min(10, popLen); i++) {
      sample.push(this.population[Math.floor(Math.random() * popLen)]);
    }
    if (sample.length < 2) return 0;

    const distances: number[] = [];
    const indValues = individual.values;

    for (const other of sample) {
      if (other === individual) continue;
      let dist = 0;
      const keys = Object.keys(indValues);
      for (const k of keys) {
        const v1 = String(indValues[k] ?? '');
        const v2 = String(other.values[k] ?? '');
        if (v1 !== v2) {
          const maxLen = Math.max(v1.length, v2.length, 1);
          dist += stringDistance(v1, v2) / maxLen;
        }
      }
      distances.push(keys.length > 0 ? dist / keys.length : 0);
    }

    if (distances.length === 0) return 0;
    distances.sort((a, b) => b - a);
    const topK = distances.slice(0, 3);
    return topK.reduce((s, d) => s + d, 0) / topK.length;
  }

  // ═══════════════════════════════════════════════
  // SELECTION (with Niche Density tiebreaker)
  // ═══════════════════════════════════════════════

  selectParent(): Chromosome {
    const tourSize = 3;
    const candidates = [];
    for (let i = 0; i < tourSize; i++) {
      const idx = Math.floor(Math.random() * this.population.length);
      candidates.push(this.population[idx]);
    }
    // Sort by fitness descending, then niche density distance descending
    candidates.sort((a, b) => {
      if (b.fitness !== a.fitness) return b.fitness - a.fitness;
      return this.nicheDensityDistance(b) - this.nicheDensityDistance(a);
    });
    return candidates[0].values;
  }

  // ═══════════════════════════════════════════════
  // CROSSOVER (adaptive rate)
  // ═══════════════════════════════════════════════

  // [START: GENETIC_CROSSOVER]
  /**
   * CƠ CHẾ LAI GHÉP (CROSSOVER)
   * Tạo ra cá thể con bằng cách kết hợp DNA (các trường dữ liệu) của bố và mẹ.
   * Sử dụng kỹ thuật lai ghép 1 điểm (Single-point crossover) để giữ lại các cụm logic dữ liệu.
   */
  crossover(p1: Chromosome, p2: Chromosome): [Chromosome, Chromosome] {
    const child1: Chromosome = {};
    const child2: Chromosome = {};
    const rate = this.getAdaptiveCrossoverRate();

    this.schema.forEach(field => {
      const name = field.name;
      if (Math.random() < rate) {
        child1[name] = p2[name];
        child2[name] = p1[name];
      } else {
        child1[name] = p1[name];
        child2[name] = p2[name];
      }
    });

    return [child1, child2];
  }
  // [END: GENETIC_CROSSOVER]

  // [START: GENETIC_MUTATION]
  /**
   * CƠ CHẾ ĐỘT BIẾN (MUTATION)
   * Giúp thuật toán duy trì sự đa dạng di truyền và tránh rơi vào tối ưu cục bộ.
   */
  mutate(c: Chromosome): { values: Chromosome; mutated: boolean } {
    const mutatedRecord = { ...c };
    let mutated = false;
    const rate = this.getAdaptiveMutationRate();

    this.schema.forEach(field => {
      if (Math.random() < rate) {
        mutated = true;
        const currentVal = mutatedRecord[field.name];
        const valStr = String(currentVal);
        const rand = Math.random();

        if (field.type === 'number') {
          const num = Number(currentVal);
          if (isNaN(num)) {
            mutatedRecord[field.name] = generateRandomValue(field, 'valid');
          } else {
            if (rand < 0.35) {
              // Gaussian perturbation
              const sigma = Math.max(0.5, (this.maxGenerations - this.generation) / this.maxGenerations * 5);
              let newVal = num + gaussRandom(0, sigma);
              if (field.minValue !== undefined) newVal = Math.max(field.minValue - 2, newVal);
              if (field.maxValue !== undefined) newVal = Math.min(field.maxValue + 2, newVal);
              mutatedRecord[field.name] = newVal;
            } else if (rand < 0.65) {
              mutatedRecord[field.name] = generateRandomValue(field, 'boundary');
            } else {
              mutatedRecord[field.name] = generateRandomValue(field, 'security');
            }
          }
        } else if (field.type === 'email' || field.type === 'card' || field.type === 'phone') {
          if (rand < 0.4) {
            if (valStr.length > 3) {
              const idx = Math.floor(Math.random() * valStr.length);
              mutatedRecord[field.name] = valStr.substring(0, idx) + valStr.substring(idx + 1);
            } else {
              mutatedRecord[field.name] = generateRandomValue(field, 'valid');
            }
          } else if (rand < 0.7) {
            mutatedRecord[field.name] = generateRandomValue(field, 'boundary');
          } else {
            mutatedRecord[field.name] = generateRandomValue(field, 'security');
          }
        } else {
          // ENUM-AWARE: mutate within allowedValues if present
          if (field.allowedValues && field.allowedValues.length > 1) {
            const allowed = field.allowedValues.map(String);
            if (allowed.includes(valStr)) {
              const others = allowed.filter(v => v !== valStr);
              mutatedRecord[field.name] = others[Math.floor(Math.random() * others.length)];
            } else {
              mutatedRecord[field.name] = allowed[Math.floor(Math.random() * allowed.length)];
            }
          } else if (rand < 0.3) {
            const chars = '!@#$%\'"><';
            const char = chars.charAt(Math.floor(Math.random() * chars.length));
            const idx = Math.floor(Math.random() * valStr.length);
            mutatedRecord[field.name] = valStr.substring(0, idx) + char + valStr.substring(idx);
          } else if (rand < 0.6) {
            mutatedRecord[field.name] = Math.random() > 0.5 ? valStr.toUpperCase() : valStr.toLowerCase();
          } else if (rand < 0.8) {
            mutatedRecord[field.name] = generateRandomValue(field, 'boundary');
          } else {
            mutatedRecord[field.name] = generateRandomValue(field, 'security');
          }
        }
      }
    });

    return { values: mutatedRecord, mutated };
  }
  // [END: GENETIC_MUTATION]

  // ═══════════════════════════════════════════════
  // STAGNATION DETECTION
  // ═══════════════════════════════════════════════

  private isStagnated(): boolean {
    if (this.bestFitnessHistory.length < this.stagnationThreshold) return false;
    const recent = this.bestFitnessHistory.slice(-this.stagnationThreshold);
    return Math.max(...recent) - Math.min(...recent) < 0.005;
  }

  private restartPopulation() {
    const preserveCount = Math.max(1, Math.floor(this.config.popSize * 0.2));
    const preserved = this.population.slice(0, preserveCount);

    const modes: ('valid' | 'invalid' | 'boundary' | 'security')[] = ['valid', 'boundary', 'security', 'valid'];
    const newIndividuals: typeof this.population = [];
    while (newIndividuals.length < (this.config.popSize - preserveCount)) {
      const record: Chromosome = {};
      const mode = modes[newIndividuals.length % modes.length];
      this.schema.forEach(field => {
        record[field.name] = generateRandomValue(field, mode);
      });
      newIndividuals.push({ values: record, fitness: 0, origin: 'Restart' });
    }

    this.population = [...preserved, ...newIndividuals];
  }

  // ═══════════════════════════════════════════════
  // GENERATION LOOP
  // ═══════════════════════════════════════════════

  runGeneration(): PopulationStats {
    this.generation += 1;

    // Stagnation detection
    if (this.isStagnated()) {
      this.restartPopulation();
      this.bestFitnessHistory = [];
      this.evaluatePopulation();
    }

    const nextPopulation: { values: Chromosome; fitness: number; origin: string }[] = [];

    // 1. Elitism: Keep top 5% chromosomes exactly
    const eliteSize = Math.max(1, Math.floor(this.config.popSize * 0.05));
    for (let i = 0; i < eliteSize; i++) {
      nextPopulation.push({
        values: { ...this.population[i].values },
        fitness: this.population[i].fitness,
        origin: 'Elite'
      });
    }

    // 2. Generate remaining population using Selection, Crossover, and Mutation
    while (nextPopulation.length < this.config.popSize) {
      const parent1 = this.selectParent();
      const parent2 = this.selectParent();

      let [child1, child2] = this.crossover(parent1, parent2);

      const m1 = this.mutate(child1);
      const m2 = this.mutate(child2);

      nextPopulation.push({
        values: m1.values,
        fitness: 0,
        origin: m1.mutated ? 'Mutation' : 'Crossover'
      });

      if (nextPopulation.length < this.config.popSize) {
        nextPopulation.push({
          values: m2.values,
          fitness: 0,
          origin: m2.mutated ? 'Mutation' : 'Crossover'
        });
      }
    }

    // 3. Update active population and evaluate fitness
    this.population = nextPopulation;
    this.evaluatePopulation();

    // Track best fitness for stagnation detection
    const bestFitness = this.population[0].fitness;
    this.bestFitnessHistory.push(bestFitness);
    if (this.bestFitnessHistory.length > 50) {
      this.bestFitnessHistory = this.bestFitnessHistory.slice(-50);
    }

    const avgFitness = this.population.reduce((sum, ind) => sum + ind.fitness, 0) / this.population.length;

    // 4. Compute statistics
    const duplicateRate = this.computeDuplicateRate();
    const coverage = this.computeFullCoverage();

    return {
      generation: this.generation,
      bestFitness,
      avgFitness,
      coverage,
      duplicateRate,
      chromosomes: this.population.map(p => ({
        values: p.values,
        fitness: p.fitness,
        origin: p.origin
      }))
    };
  }

  // ═══════════════════════════════════════════════
  // COVERAGE CALCULATION (full population + pairwise)
  // ═══════════════════════════════════════════════

  computeDuplicateRate(): number {
    let dupCount = 0;
    const rawPop = this.population.map(p => p.values);
    for (let i = 0; i < rawPop.length; i++) {
      for (let j = 0; j < i; j++) {
        let match = true;
        for (const k of Object.keys(rawPop[i])) {
          if (String(rawPop[i][k]) !== String(rawPop[j][k])) {
            match = false;
            break;
          }
        }
        if (match) {
          dupCount++;
          break;
        }
      }
    }
    return dupCount / this.config.popSize;
  }

  private computeFullCoverage(): number {
    const rawValues = this.population.map(p => p.values);

    // --- Individual field coverage (full population) ---
    let totalValid = 0;
    const boundariesChecked = new Set<string>();
    const securityChecked = new Set<string>();

    for (const tc of rawValues) {
      for (const field of this.schema) {
        const name = field.name;
        const val = tc[name];
        const valStr = String(val);

        let isOk = true;
        if (field.required && (val === null || val === undefined || valStr === '')) {
          isOk = false;
        }

        if (isOk) {
          totalValid += 1;

          // Boundary check (exact + near)
          if (field.type === 'number') {
            const num = Number(val);
            if (!isNaN(num)) {
              if (field.minValue !== undefined && num === field.minValue) boundariesChecked.add(`${name}_min`);
              if (field.maxValue !== undefined && num === field.maxValue) boundariesChecked.add(`${name}_max`);
              if (field.minValue !== undefined && num === field.minValue + 1) boundariesChecked.add(`${name}_min_near`);
              if (field.maxValue !== undefined && num === field.maxValue - 1) boundariesChecked.add(`${name}_max_near`);
            }
          } else {
            if (field.minLength !== undefined && valStr.length === field.minLength) boundariesChecked.add(`${name}_min`);
            if (field.maxLength !== undefined && valStr.length === field.maxLength) boundariesChecked.add(`${name}_max`);
            if (field.minLength !== undefined && valStr.length === field.minLength + 1) boundariesChecked.add(`${name}_min_near`);
            if (field.maxLength !== undefined && valStr.length === field.maxLength - 1) boundariesChecked.add(`${name}_max_near`);
          }
        }

        // Security check
        const securityKeywords = ["' or", '" or', '--', 'union', 'select', '<script'];
        if (securityKeywords.some(kw => valStr.toLowerCase().includes(kw))) {
          securityChecked.add(`${name}_security`);
        }
      }
    }

    const totalCases = rawValues.length;
    const maxValid = totalCases * this.schema.length;
    const valFactor = maxValid > 0 ? totalValid / maxValid : 0;

    const possibleBounds = this.schema.length * 4; // 2 exact + 2 near per field
    const boundFactor = possibleBounds > 0 ? boundariesChecked.size / possibleBounds : 0;

    const possibleSec = this.schema.length;
    const secFactor = possibleSec > 0 ? securityChecked.size / possibleSec : 0;

    // Pairwise coverage
    const pairwise = this.computePairwiseCoverage(rawValues);

    // Composite: 55% validation + 15% boundary + 10% security + 20% pairwise
    let coverage = Math.min(
      (valFactor * 0.55) + (boundFactor * 0.15) + (secFactor * 0.10) + (pairwise * 0.20),
      1.0
    );

    // Discount by duplicate rate
    const dupRate = this.computeDuplicateRate();
    if (dupRate > 0.3) {
      coverage *= (1.0 - (dupRate - 0.3) * 0.5);
    }

    return Math.max(coverage, 0.01);
  }

  private computePairwiseCoverage(rawValues: Chromosome[]): number {
    if (this.schema.length < 2) return 1.0;

    const categorizeValue = (field: FieldConstraint, val: any): string => {
      const valStr = String(val);
      if (valStr === '') return 'empty';
      if (valStr.toLowerCase().startsWith("' or") || valStr.toLowerCase().startsWith("'or")) return 'sqli';
      if (valStr.toLowerCase().includes('<script') || valStr.toLowerCase().includes('onload')) return 'xss';
      if (field.type === 'number') {
        const num = Number(val);
        if (isNaN(num)) return 'invalid';
        if (field.minValue !== undefined && num === field.minValue) return 'boundary_min';
        if (field.maxValue !== undefined && num === field.maxValue) return 'boundary_max';
        if (field.minValue !== undefined && num < field.minValue) return 'invalid_low';
        if (field.maxValue !== undefined && num > field.maxValue) return 'invalid_high';
        return 'valid';
      }
      const sLen = valStr.length;
      if (field.minLength !== undefined && sLen === field.minLength) return 'boundary_min';
      if (field.maxLength !== undefined && sLen === field.maxLength) return 'boundary_max';
      if (field.minLength !== undefined && sLen < field.minLength) return 'invalid_short';
      if (field.maxLength !== undefined && sLen > field.maxLength) return 'invalid_long';
      return 'valid';
    };

    const getPossibleCategories = (field: FieldConstraint): string[] => {
      const cats = ['empty', 'valid', 'sqli', 'xss'];
      if (field.type === 'number') {
        cats.push('invalid');
        if (field.minValue !== undefined) {
          cats.push('boundary_min', 'invalid_low');
        }
        if (field.maxValue !== undefined) {
          cats.push('boundary_max', 'invalid_high');
        }
      } else {
        if (field.minLength !== undefined) {
          cats.push('boundary_min', 'invalid_short');
        }
        if (field.maxLength !== undefined) {
          cats.push('boundary_max', 'invalid_long');
        }
      }
      return cats;
    };

    const coveredPairs = new Set<string>();

    for (let i = 0; i < this.schema.length; i++) {
      for (let j = i + 1; j < this.schema.length; j++) {
        const fi = this.schema[i];
        const fj = this.schema[j];
        for (const tc of rawValues) {
          const catI = categorizeValue(fi, tc[fi.name]);
          const catJ = categorizeValue(fj, tc[fj.name]);
          coveredPairs.add(`${fi.name}:${catI}|${fj.name}:${catJ}`);
        }
      }
    }

    let totalPossible = 0;
    for (let i = 0; i < this.schema.length; i++) {
      for (let j = i + 1; j < this.schema.length; j++) {
        const catsI = getPossibleCategories(this.schema[i]);
        const catsJ = getPossibleCategories(this.schema[j]);
        totalPossible += catsI.length * catsJ.length;
      }
    }

    return Math.min(coveredPairs.size / Math.max(totalPossible, 1), 1.0);
  }

  // ═══════════════════════════════════════════════
  // TEST CASE MINIMIZATION
  // ═══════════════════════════════════════════════

  /**
   * Minimize a set of test cases by greedily selecting those that
   * add the most new coverage. Removes redundant cases while
   * preserving boundary, security, and pairwise coverage.
   *
   * @returns Minimized array + stats about what was removed
   */
  minimize(testCases: Chromosome[]): { minimized: Chromosome[]; removed: number; finalCoverage: number } {
    if (testCases.length <= 1) {
      return { minimized: [...testCases], removed: 0, finalCoverage: 1.0 };
    }

    // Categorize each test case
    const categorized = testCases.map((tc, idx) => ({
      tc,
      idx,
      category: this.categorizeTestCase(tc),
      coverageValue: 0, // will be computed
    }));

    // Priority order: security > boundary > negative > positive
    const priorityOrder: Record<string, number> = {
      'security': 0,
      'boundary': 1,
      'negative': 2,
      'positive': 3,
      'happy': 3,
    };

    // Sort by priority (keep essential cases first)
    categorized.sort((a, b) =>
      (priorityOrder[a.category] ?? 4) - (priorityOrder[b.category] ?? 4)
    );

    // Greedy selection: add cases that contribute new coverage
    const selected: Chromosome[] = [];
    const selectedIndices = new Set<number>();
    const uniqueFingerprints = new Set<string>();

    // First pass: ensure we have at least one from each category
    for (const cat of ['security', 'boundary', 'negative', 'positive', 'happy']) {
      const match = categorized.find(c => c.category === cat && !selectedIndices.has(c.idx));
      if (match) {
        const fp = JSON.stringify(Object.entries(match.tc).sort());
        if (!uniqueFingerprints.has(fp)) {
          uniqueFingerprints.add(fp);
          selected.push(match.tc);
          selectedIndices.add(match.idx);
        }
      }
    }

    // Second pass: greedy by unique contribution
    for (const item of categorized) {
      if (selectedIndices.has(item.idx)) continue;

      const fp = JSON.stringify(Object.entries(item.tc).sort());
      if (uniqueFingerprints.has(fp)) continue; // absolute duplicate

      // Check if this adds new boundary/security coverage
      let addsCoverage = false;
      for (const field of this.schema) {
        const val = item.tc[field.name];
        const valStr = String(val);

        // Check if this value hits a boundary not already covered
        if (field.type === 'number') {
          const num = Number(val);
          if (!isNaN(num)) {
            if (field.minValue !== undefined && num === field.minValue) {
              if (!selected.some(s => {
                const sv = Number(s[field.name]);
                return !isNaN(sv) && field.minValue !== undefined && sv === field.minValue;
              })) addsCoverage = true;
            }
            if (field.maxValue !== undefined && num === field.maxValue) {
              if (!selected.some(s => {
                const sv = Number(s[field.name]);
                return !isNaN(sv) && field.maxValue !== undefined && sv === field.maxValue;
              })) addsCoverage = true;
            }
          }
        } else {
          if (field.minLength !== undefined && valStr.length === field.minLength) {
            if (!selected.some(s => {
              const sv = String(s[field.name]);
              return field.minLength !== undefined && sv.length === field.minLength;
            })) addsCoverage = true;
          }
          if (field.maxLength !== undefined && valStr.length === field.maxLength) {
            if (!selected.some(s => {
              const sv = String(s[field.name]);
              return field.maxLength !== undefined && sv.length === field.maxLength;
            })) addsCoverage = true;
          }
        }

        // Check security
        const secKW = ["' or", '" or', '--', 'union', '<script'];
        if (secKW.some(kw => valStr.toLowerCase().includes(kw))) {
          if (!selected.some(s => {
            const sv = String(s[field.name]);
            return secKW.some(kw => sv.toLowerCase().includes(kw));
          })) addsCoverage = true;
        }
      }

      if (addsCoverage) {
        uniqueFingerprints.add(fp);
        selected.push(item.tc);
        selectedIndices.add(item.idx);
      }
    }

    // Third pass: fill with diverse cases until we hit target coverage
    // or keep up to ~50% of original (max compactness)
    const maxKeep = Math.max(5, Math.ceil(testCases.length * 0.5));
    for (const item of categorized) {
      if (selectedIndices.has(item.idx)) continue;
      if (selected.length >= maxKeep) break;

      const fp = JSON.stringify(Object.entries(item.tc).sort());
      if (!uniqueFingerprints.has(fp)) {
        uniqueFingerprints.add(fp);
        selected.push(item.tc);
        selectedIndices.add(item.idx);
      }
    }

    const finalCoverage = selected.length > 0
      ? this.computeFullCoverageForSet(selected)
      : 0;

    return {
      minimized: selected,
      removed: testCases.length - selected.length,
      finalCoverage,
    };
  }

  private categorizeTestCase(tc: Chromosome): string {
    let isSecurity = false;
    const securityKeywords = ["' or", '" or', "'or", '"or', '--', 'union', 'select', 'drop table', '<script', 'onload=', 'onerror=', 'javascript:'];

    for (const val of Object.values(tc)) {
      const str = String(val).toLowerCase();
      if (securityKeywords.some(kw => str.includes(kw))) {
        isSecurity = true;
      }
    }
    if (isSecurity) return 'security';

    let hasInvalid = false;
    let hasBoundary = false;

    for (const field of this.schema) {
      const val = tc[field.name];
      if (val === undefined || val === null) {
        if (field.required) hasInvalid = true;
        continue;
      }

      const strVal = String(val);
      let fieldValid = true;

      if (field.required && strVal === '') fieldValid = false;

      if (fieldValid && field.type === 'email') {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(strVal)) fieldValid = false;
      } else if (fieldValid && field.type === 'card') {
        if (!/^\d{16}$/.test(strVal)) fieldValid = false;
      } else if (fieldValid && field.type === 'phone') {
        if (!/^(03|05|07|08|09)\d{8}$/.test(strVal)) fieldValid = false;
      } else if (fieldValid && field.type === 'number') {
        const num = Number(val);
        if (isNaN(num)) fieldValid = false;
        else {
          if (field.minValue !== undefined && num < field.minValue) fieldValid = false;
          if (field.maxValue !== undefined && num > field.maxValue) fieldValid = false;
          if (fieldValid) {
            if (field.minValue !== undefined && num === field.minValue) hasBoundary = true;
            if (field.maxValue !== undefined && num === field.maxValue) hasBoundary = true;
          }
        }
      }

      if (fieldValid && field.type !== 'number') {
        if (field.minLength !== undefined && strVal.length < field.minLength) fieldValid = false;
        if (field.maxLength !== undefined && strVal.length > field.maxLength) fieldValid = false;
        if (fieldValid) {
          if (field.minLength !== undefined && strVal.length === field.minLength) hasBoundary = true;
          if (field.maxLength !== undefined && strVal.length === field.maxLength) hasBoundary = true;
        }
      }

      if (!fieldValid) hasInvalid = true;
    }

    if (hasInvalid) return 'negative';
    if (hasBoundary) return 'boundary';
    return 'positive';
  }

  private computeFullCoverageForSet(testCases: Chromosome[]): number {
    const rawValues = testCases;
    let totalValid = 0;
    const boundariesChecked = new Set<string>();
    const securityChecked = new Set<string>();

    for (const tc of rawValues) {
      for (const field of this.schema) {
        const name = field.name;
        const val = tc[name];
        const valStr = String(val);

        let isOk = true;
        if (field.required && (val === null || val === undefined || valStr === '')) isOk = false;

        if (isOk) {
          totalValid += 1;
          if (field.type === 'number') {
            const num = Number(val);
            if (!isNaN(num)) {
              if (field.minValue !== undefined && num === field.minValue) boundariesChecked.add(`${name}_min`);
              if (field.maxValue !== undefined && num === field.maxValue) boundariesChecked.add(`${name}_max`);
            }
          } else {
            if (field.minLength !== undefined && valStr.length === field.minLength) boundariesChecked.add(`${name}_min`);
            if (field.maxLength !== undefined && valStr.length === field.maxLength) boundariesChecked.add(`${name}_max`);
          }
        }

        const securityKeywords = ["' or", '" or', '--', 'union', 'select', '<script'];
        if (securityKeywords.some(kw => valStr.toLowerCase().includes(kw))) {
          securityChecked.add(`${name}_security`);
        }
      }
    }

    const totalCases = rawValues.length;
    const maxValid = totalCases * this.schema.length;
    const valFactor = maxValid > 0 ? totalValid / maxValid : 0;

    const possibleBounds = this.schema.length * 2;
    const boundFactor = possibleBounds > 0 ? boundariesChecked.size / possibleBounds : 0;

    const possibleSec = this.schema.length;
    const secFactor = possibleSec > 0 ? securityChecked.size / possibleSec : 0;

    return Math.min((valFactor * 0.6) + (boundFactor * 0.25) + (secFactor * 0.15), 1.0);
  }
}
