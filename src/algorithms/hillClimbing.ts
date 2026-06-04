import type { FieldConstraint } from './presets';
import type { Chromosome } from './genetic';

export interface HillClimbStats {
  originalFitness: number;
  optimizedFitness: number;
  tweaksCount: number;
  edgeCasesDiscovered: number;
  details: string[];
  restartsCount: number;
}

// Box-Muller Gaussian random
function gaussRandom(mean: number = 0, stdev: number = 1): number {
  let u = 1 - Math.random();
  let v = Math.random();
  let z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  return z * stdev + mean;
}

/**
 * TIER 1 UPGRADE: Hill Climbing with:
 * - Random Restarts (8 runs from different starting points)
 * - Simulated Annealing (accepts worse moves with exp(-delta/T))
 * - Tabu Search (short-term memory to avoid oscillation)
 * - Adaptive step sizes for numeric fields
 */
export function runHillClimbing(
  chromosome: Chromosome,
  schema: FieldConstraint[],
  fitnessEvaluator: (c: Chromosome) => number,
  maxIterations: number = 15
): { optimized: Chromosome; stats: HillClimbStats } {
  const numRestarts = 8;
  let bestOverallOptimized: Chromosome | null = null;
  let bestOverallStats: HillClimbStats | null = null;
  let bestOverallFitness = -Infinity;

  for (let restartIdx = 0; restartIdx < numRestarts; restartIdx++) {
    // Generate varied starting point
    const startingPoint = restartIdx === 0
      ? { ...chromosome }
      : generateRestartPoint(chromosome, schema, restartIdx);

    const { optimized, stats } = simulatedAnnealingHC(
      startingPoint, schema, fitnessEvaluator, maxIterations, restartIdx
    );

    if (stats.optimizedFitness > bestOverallFitness) {
      bestOverallFitness = stats.optimizedFitness;
      bestOverallOptimized = optimized;
      bestOverallStats = stats;
    }
  }

  bestOverallStats!.restartsCount = numRestarts;
  bestOverallStats!.details.unshift(
    `=== HC Multi-Restart: ${numRestarts} lần chạy, giữ kết quả tốt nhất ===`
  );

  return { optimized: bestOverallOptimized!, stats: bestOverallStats! };
}

function generateRestartPoint(original: Chromosome, schema: FieldConstraint[], restartIdx: number): Chromosome {
  const point = { ...original };

  for (const field of schema) {
    const name = field.name;
    const val = point[name];

    if (field.type === 'number') {
      const num = Number(val);
      if (!isNaN(num)) {
        if (restartIdx % 3 === 0) {
          if (field.minValue !== undefined) point[name] = field.minValue;
        } else if (restartIdx % 3 === 1) {
          if (field.maxValue !== undefined) point[name] = field.maxValue;
        } else {
          const sigma = (restartIdx + 1) * 2;
          point[name] = num + gaussRandom(0, sigma);
        }
      }
    } else {
      if (restartIdx % 4 === 0 && field.minLength !== undefined) {
        point[name] = 'A'.repeat(field.minLength);
      } else if (restartIdx % 4 === 1 && field.maxLength !== undefined) {
        point[name] = 'X'.repeat(field.maxLength);
      } else if (restartIdx % 4 === 2) {
        point[name] = '';
      }
    }
  }

  return point;
}

function simulatedAnnealingHC(
  testCase: Chromosome,
  schema: FieldConstraint[],
  fitnessEvaluator: (c: Chromosome) => number,
  maxIterations: number,
  restartIdx: number
): { optimized: Chromosome; stats: HillClimbStats } {
  const optimized = { ...testCase };
  let currentFitness = fitnessEvaluator(optimized);
  const originalFitness = currentFitness;

  let tweaksCount = 0;
  let edgeCasesDiscovered = 0;
  const details: string[] = [];

  // SA parameters
  const initialTemperature = 0.15;
  const alpha = 0.85;
  let temperature = initialTemperature;

  // Tabu search: list of (fieldName, valueHash)
  const tabuList: [string, string][] = [];
  const tabuTenure = 5;

  const specialChars = ['!', '@', '#', '$', '%', '^', '&', '*', "'", '"', '<', '>', '/', '\\', ';', '-', ' '];
  const securityTags = ["' OR 1=1 --", "<script>alert(1)</script>", "<svg/onload=alert(1)>"];

  if (restartIdx === 0) {
    details.push(`Khởi động tối ưu hóa biên SA+Tabu (điểm gốc): ${originalFitness.toFixed(4)}`);
  } else {
    details.push(`Restart #${restartIdx}: bắt đầu với fitness=${originalFitness.toFixed(4)}, T=${temperature.toFixed(4)}`);
  }

  let iteration = 0;
  let improvedGlobal = true;

  while (iteration < maxIterations && (improvedGlobal || temperature > 0.001)) {
    improvedGlobal = false;
    iteration++;

    temperature = initialTemperature * Math.pow(alpha, iteration);

    for (const field of schema) {
      const fieldName = field.name;
      const fieldType = field.type;
      const currentVal = optimized[fieldName];
      const neighbors: any[] = [];

      // --- Generate Neighborhood ---
      if (fieldType === 'number') {
        const num = Number(currentVal);
        if (!isNaN(num)) {
          const minV = field.minValue ?? 0;
          const maxV = field.maxValue ?? 1000;
          const fieldRange = Math.max(Math.abs(maxV - minV), 1);

          // Small steps
          neighbors.push(num + 1, num - 1);
          // Medium steps
          const mediumStep = Math.max(1, Math.floor(fieldRange * 0.1));
          neighbors.push(num + mediumStep, num - mediumStep);
          // Large steps
          const largeStep = Math.max(1, Math.floor(fieldRange * 0.5));
          neighbors.push(num + largeStep, num - largeStep);
          // Gaussian perturbation
          const sigma = fieldRange * 0.05;
          neighbors.push(num + gaussRandom(0, sigma));
          // Boundary values
          neighbors.push(0);
          if (field.minValue !== undefined) neighbors.push(field.minValue, field.minValue - 1);
          if (field.maxValue !== undefined) neighbors.push(field.maxValue, field.maxValue + 1);
        }
      } else {
        const strVal = String(currentVal);

        // Character tweaks (subset to limit neighbor count)
        for (const char of specialChars.slice(0, 8)) {
          neighbors.push(strVal + char, char + strVal);
        }

        // Deletions
        if (strVal.length > 0) {
          neighbors.push(strVal.substring(0, strVal.length - 1));
          neighbors.push(strVal.substring(1));
          neighbors.push('');
        }

        // Security injections
        for (const tag of securityTags.slice(0, 2)) {
          neighbors.push(strVal + tag, tag);
        }

        // Length boundary tweaks
        if (field.minLength !== undefined) {
          const target = field.minLength;
          if (strVal.length > target) {
            neighbors.push(strVal.substring(0, target));
          } else {
            neighbors.push(strVal.padEnd(target, 'A'));
          }
        }
        if (field.maxLength !== undefined) {
          const target = field.maxLength;
          if (strVal.length < target) {
            neighbors.push(strVal.padEnd(target, 'A'));
          }
          neighbors.push(strVal.padEnd(target + 1, 'X'));
        }
      }

      // --- Evaluate Neighbors (with Tabu filtering) ---
      let bestNeighbor: any = null;
      let bestNeighborFitness = -Infinity;

      for (const candidateVal of neighbors) {
        // Convert float->int if integer
        const finalVal = (typeof candidateVal === 'number' && Number.isInteger(candidateVal))
          ? candidateVal : candidateVal;

        // Tabu check
        const valHash = String(finalVal).substring(0, 50);
        if (tabuList.some(([fn, vh]) => fn === fieldName && vh === valHash)) {
          continue;
        }

        const candidate = { ...optimized, [fieldName]: finalVal };
        const score = fitnessEvaluator(candidate);

        if (score > bestNeighborFitness) {
          bestNeighbor = finalVal;
          bestNeighborFitness = score;
        }
      }

      // --- Accept Move (SA or Steepest Ascent) ---
      if (bestNeighbor !== null) {
        const delta = bestNeighborFitness - currentFitness;
        let acceptMove = false;

        if (delta > 0) {
          acceptMove = true;
        } else if (temperature > 0.001) {
          const saProb = Math.exp(-Math.abs(delta) / temperature);
          if (Math.random() < saProb) {
            acceptMove = true;
            details.push(`  [SA] Chấp nhận bước xấu (delta=${delta.toFixed(4)}, T=${temperature.toFixed(4)}, P=${saProb.toFixed(3)})`);
          }
        }

        if (acceptMove) {
          const prevVal = optimized[fieldName];
          optimized[fieldName] = bestNeighbor;
          currentFitness = bestNeighborFitness;
          tweaksCount++;
          improvedGlobal = true;

          // Add to tabu list
          tabuList.push([fieldName, String(bestNeighbor).substring(0, 50)]);
          if (tabuList.length > tabuTenure * schema.length) {
            tabuList.splice(0, tabuList.length - tabuTenure * schema.length);
          }

          // Log
          const prevStr = String(prevVal).substring(0, 15) + (String(prevVal).length > 15 ? '...' : '');
          const newStr = String(bestNeighbor).substring(0, 15) + (String(bestNeighbor).length > 15 ? '...' : '');
          const direction = delta > 0 ? '↑' : '↓';
          details.push(
            `Tinh chỉnh [${fieldName}] '${prevStr}' -> '${newStr}' ${direction}${Math.abs(delta).toFixed(4)} (T=${temperature.toFixed(3)})`
          );

          // Edge case discovery
          const isSec = securityTags.some(tag => String(bestNeighbor).toLowerCase().includes(tag.toLowerCase()));
          let isBound = false;
          if (fieldType === 'number') {
            try {
              isBound = Number(bestNeighbor) === field.minValue || Number(bestNeighbor) === field.maxValue;
            } catch { /* not a number */ }
          } else {
            isBound = (field.minLength !== undefined && String(bestNeighbor).length === field.minLength) ||
              (field.maxLength !== undefined && String(bestNeighbor).length === field.maxLength);
          }

          if (isSec || isBound || String(bestNeighbor) === '') {
            edgeCasesDiscovered++;
          }
        }
      }
    }
  }

  if (!improvedGlobal) {
    details.push(`HC dừng: không thể cải thiện thêm (T_final=${temperature.toFixed(6)})`);
  }

  details.push(
    `Kết thúc HC. Fitness: ${originalFitness.toFixed(4)} → ${currentFitness.toFixed(4)}. ` +
    `Tinh chỉnh: ${tweaksCount}, Edge cases: ${edgeCasesDiscovered}`
  );

  return {
    optimized,
    stats: {
      originalFitness,
      optimizedFitness: currentFitness,
      tweaksCount,
      edgeCasesDiscovered,
      details,
      restartsCount: 1, // Will be overwritten by outer function
    }
  };
}
