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

// Helper: Levenshtein distance for string diversity
function stringDistance(s1: string, s2: string): number {
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
    "../../../../windows/system32"
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
        // extremely long or short emails
        return `a@${'b'.repeat(100)}.com`;
      }
      // valid email
      const names = ['emma', 'liam', 'olivia', 'noah', 'ava', 'will', 'sophia', 'james'];
      const domains = ['gmail.com', 'yahoo.com', 'outlook.com', 'test.io', 'company.vn'];
      return `${names[Math.floor(Math.random() * names.length)]}${Math.floor(Math.random() * 100)}@${domains[Math.floor(Math.random() * domains.length)]}`;

    case 'card':
      if (mode === 'invalid') {
        return '1234-5678-9012'; // formatted but not 16 digits
      }
      if (mode === 'boundary') {
        return '0000000000000000'; // minimum boundary numerical representation
      }
      // valid 16 digits
      let card = '';
      for (let i = 0; i < 16; i++) card += Math.floor(Math.random() * 10);
      return card;

    case 'phone':
      const prefixes = ['03', '05', '07', '08', '09'];
      if (mode === 'invalid') {
        return '0281234567'; // landline prefix
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
      // valid number
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
        // inject some boundaries in characters
        return str.substring(0, str.length - 1) + specialChars[Math.floor(Math.random() * specialChars.length)];
      }
      return str;
  }
}

export class GeneticEngine {
  schema: FieldConstraint[];
  config: GeneticConfig;
  population: { values: Chromosome; fitness: number; origin: string }[] = [];
  generation = 0;

  constructor(schema: FieldConstraint[], config: GeneticConfig) {
    this.schema = schema;
    this.config = config;
  }

  // Initialize F0 and fill popSize
  initialize(seeds: Chromosome[]) {
    this.population = [];
    this.generation = 0;

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

  // Multi-objective Fitness Scoring
  computeFitness(c: Chromosome, currentPop: Chromosome[]): { fitness: number; scoreBreakdown: Record<string, number> } {
    let validationScore = 0;
    let boundaryScore = 0;
    let securityScore = 0;

    this.schema.forEach(field => {
      const val = c[field.name];
      if (val === undefined) return;

      const strVal = String(val);
      let isValid = true;
      let isBoundary = false;
      let isSecurity = false;

      // --- 1. Validation Check ---
      // Required Check
      if (field.required && (val === null || val === undefined || strVal === '')) {
        isValid = false;
      }

      // Type Check
      if (isValid) {
        if (field.type === 'email') {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(strVal)) isValid = false;
        } else if (field.type === 'card') {
          const cardRegex = /^\d{16}$/;
          if (!cardRegex.test(strVal)) isValid = false;
        } else if (field.type === 'phone') {
          const phoneRegex = /^(03|05|07|08|09)\d{8}$/;
          if (!phoneRegex.test(strVal)) isValid = false;
        } else if (field.type === 'number') {
          const num = Number(val);
          if (isNaN(num)) isValid = false;
        }
      }

      // Constraints Check (Length / Range)
      if (isValid) {
        if (field.type === 'number') {
          const num = Number(val);
          if (field.minValue !== undefined && num < field.minValue) isValid = false;
          if (field.maxValue !== undefined && num > field.maxValue) isValid = false;
        } else {
          if (field.minLength !== undefined && strVal.length < field.minLength) isValid = false;
          if (field.maxLength !== undefined && strVal.length > field.maxLength) isValid = false;
        }
      }

      // Allowed Values check
      if (isValid && field.allowedValues && field.allowedValues.length > 0) {
        if (!field.allowedValues.includes(strVal)) isValid = false;
      }

      // Regex Match
      if (isValid && field.regex) {
        try {
          const r = new RegExp(field.regex);
          if (!r.test(strVal)) isValid = false;
        } catch {
          // invalid regex template
        }
      }

      if (isValid) validationScore += 1;

      // --- 2. Boundary Check ---
      if (isValid) {
        if (field.type === 'number') {
          const num = Number(val);
          if (field.minValue !== undefined && num === field.minValue) isBoundary = true;
          if (field.maxValue !== undefined && num === field.maxValue) isBoundary = true;
        } else {
          if (field.minLength !== undefined && strVal.length === field.minLength) isBoundary = true;
          if (field.maxLength !== undefined && strVal.length === field.maxLength) isBoundary = true;
        }
        if (isBoundary) boundaryScore += 1;
      }

      // --- 3. Security Payload Check ---
      // We look for classic attack vector structures inside the string
      const securityKeywords = ["' or", '" or', "'or", '"or', '--', 'union', 'select', 'drop table', '<script', 'onload=', 'onerror=', 'javascript:'];
      const strLower = strVal.toLowerCase();
      if (securityKeywords.some(kw => strLower.includes(kw))) {
        isSecurity = true;
      }
      if (isSecurity) securityScore += 1;
    });

    // Normalize Scores
    const numFields = this.schema.length;
    const vScore = validationScore / numFields;
    const bScore = Math.min(boundaryScore / numFields, 1);
    const sScore = Math.min(securityScore / numFields, 1);

    // --- 4. Diversity Score ---
    // Sample 5 random items from the current population
    const sampleSize = Math.min(5, currentPop.length);
    const sampleSubset: Chromosome[] = [];
    for (let i = 0; i < sampleSize; i++) {
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
    
    // Clamp between 0.01 and 1.0
    fitness = Math.max(0.01, Math.min(fitness, 1.0));

    return {
      fitness,
      scoreBreakdown: { vScore, bScore, sScore, dScore, penalty }
    };
  }

  // Score all chromosomes in population
  evaluatePopulation() {
    const rawPop = this.population.map(p => p.values);
    this.population.forEach(p => {
      const res = this.computeFitness(p.values, rawPop);
      p.fitness = res.fitness;
    });

    // Sort descending by fitness
    this.population.sort((a, b) => b.fitness - a.fitness);
  }

  // Tournament Selection (pick 3, return the best)
  selectParent(): Chromosome {
    const tourSize = 3;
    let best: { values: Chromosome; fitness: number } | null = null;

    for (let i = 0; i < tourSize; i++) {
      const idx = Math.floor(Math.random() * this.population.length);
      const ind = this.population[idx];
      if (best === null || ind.fitness > best.fitness) {
        best = ind;
      }
    }
    return best!.values;
  }

  // Uniform Crossover
  crossover(p1: Chromosome, p2: Chromosome): [Chromosome, Chromosome] {
    const child1: Chromosome = {};
    const child2: Chromosome = {};

    this.schema.forEach(field => {
      const name = field.name;
      if (Math.random() < this.config.crossoverRate) {
        // swap
        child1[name] = p2[name];
        child2[name] = p1[name];
      } else {
        // keep
        child1[name] = p1[name];
        child2[name] = p2[name];
      }
    });

    return [child1, child2];
  }

  // Mutate individual properties
  mutate(c: Chromosome): { values: Chromosome; mutated: boolean } {
    const mutatedRecord = { ...c };
    let mutated = false;

    this.schema.forEach(field => {
      if (Math.random() < this.config.mutationRate) {
        mutated = true;
        const currentVal = mutatedRecord[field.name];
        const valStr = String(currentVal);

        // Randomly pick a mutation mode
        const rand = Math.random();
        
        if (field.type === 'number') {
          const num = Number(currentVal);
          if (isNaN(num)) {
            mutatedRecord[field.name] = generateRandomValue(field, 'valid');
          } else {
            if (rand < 0.3) {
              mutatedRecord[field.name] = num + (Math.random() > 0.5 ? 1 : -1); // micro tweak
            } else if (rand < 0.6) {
              mutatedRecord[field.name] = generateRandomValue(field, 'boundary');
            } else {
              mutatedRecord[field.name] = generateRandomValue(field, 'security'); // huge overflow
            }
          }
        } else if (field.type === 'email' || field.type === 'card' || field.type === 'phone') {
          if (rand < 0.4) {
            // Tweak existing string slightly
            if (valStr.length > 3) {
              const idx = Math.floor(Math.random() * valStr.length);
              mutatedRecord[field.name] = valStr.substring(0, idx) + valStr.substring(idx + 1); // remove char
            } else {
              mutatedRecord[field.name] = generateRandomValue(field, 'valid');
            }
          } else if (rand < 0.7) {
            mutatedRecord[field.name] = generateRandomValue(field, 'boundary');
          } else {
            mutatedRecord[field.name] = generateRandomValue(field, 'security');
          }
        } else {
          // Standard string mutation
          if (rand < 0.3) {
            // character insertion
            const chars = '!@#$%\'"><';
            const char = chars.charAt(Math.floor(Math.random() * chars.length));
            const idx = Math.floor(Math.random() * valStr.length);
            mutatedRecord[field.name] = valStr.substring(0, idx) + char + valStr.substring(idx);
          } else if (rand < 0.6) {
            // lowercase/uppercase swap
            mutatedRecord[field.name] = Math.random() > 0.5 ? valStr.toUpperCase() : valStr.toLowerCase();
          } else if (rand < 0.8) {
            // boundary length givers
            mutatedRecord[field.name] = generateRandomValue(field, 'boundary');
          } else {
            // security injection
            mutatedRecord[field.name] = generateRandomValue(field, 'security');
          }
        }
      }
    });

    return { values: mutatedRecord, mutated };
  }

  // Progress 1 generation
  runGeneration(): PopulationStats {
    this.generation += 1;
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

    // 4. Compute statistics
    const bestFitness = this.population[0].fitness;
    const avgFitness = this.population.reduce((sum, ind) => sum + ind.fitness, 0) / this.population.length;

    // Duplicate Rate calculation
    let dupCount = 0;
    const rawPop = this.population.map(p => p.values);
    for (let i = 0; i < rawPop.length; i++) {
      let isDup = false;
      for (let j = 0; j < i; j++) {
        let match = true;
        for (const k of Object.keys(rawPop[i])) {
          if (String(rawPop[i][k]) === String(rawPop[j][k])) continue;
          match = false;
          break;
        }
        if (match) {
          isDup = true;
          break;
        }
      }
      if (isDup) dupCount++;
    }
    const duplicateRate = dupCount / this.config.popSize;

    // Coverage Score calculation
    // Measured as: (Fraction of fields successfully validated across best chromosomes) + (Fraction of boundary values checked)
    let totalValidFields = 0;
    let boundariesChecked = new Set<string>();
    let securityChecked = new Set<string>();

    const topSubset = this.population.slice(0, Math.min(10, this.population.length));
    
    topSubset.forEach(ind => {
      const c = ind.values;
      this.schema.forEach(field => {
        const val = c[field.name];
        const strVal = String(val);
        
        // Simple validation check
        let valid = true;
        if (field.required && (val === null || val === undefined || strVal === '')) valid = false;
        if (valid && field.minLength !== undefined && strVal.length < field.minLength) valid = false;
        if (valid && field.maxLength !== undefined && strVal.length > field.maxLength) valid = false;

        if (valid) {
          totalValidFields += 1;

          // Boundary check
          if (field.type === 'number') {
            const num = Number(val);
            if (field.minValue !== undefined && num === field.minValue) boundariesChecked.add(`${field.name}_min`);
            if (field.maxValue !== undefined && num === field.maxValue) boundariesChecked.add(`${field.name}_max`);
          } else {
            if (field.minLength !== undefined && strVal.length === field.minLength) boundariesChecked.add(`${field.name}_min`);
            if (field.maxLength !== undefined && strVal.length === field.maxLength) boundariesChecked.add(`${field.name}_max`);
          }
        }

        // Security check
        const securityKeywords = ["' or", '" or', '--', 'union', 'select', '<script'];
        if (securityKeywords.some(kw => strVal.toLowerCase().includes(kw))) {
          securityChecked.add(`${field.name}_security`);
        }
      });
    });

    const maxValidationFields = topSubset.length * this.schema.length;
    const validationFactor = maxValidationFields > 0 ? totalValidFields / maxValidationFields : 0;
    
    const possibleBoundaries = this.schema.length * 2;
    const boundaryFactor = possibleBoundaries > 0 ? boundariesChecked.size / possibleBoundaries : 0;

    const possibleSecurities = this.schema.length;
    const securityFactor = possibleSecurities > 0 ? securityChecked.size / possibleSecurities : 0;

    // Coverage is a composite average of validation coverage (80% weight) and edge case/security discoveries (20%)
    const coverage = Math.min((validationFactor * 0.7) + (boundaryFactor * 0.15) + (securityFactor * 0.15), 1.0);

    return {
      generation: this.generation,
      bestFitness,
      avgFitness,
      coverage,
      duplicateRate,
      chromosomes: this.population.slice(0, 10).map(p => ({
        values: p.values,
        fitness: p.fitness,
        origin: p.origin
      }))
    };
  }
}
