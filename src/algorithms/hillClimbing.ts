import type { FieldConstraint } from './presets';
import type { Chromosome } from './genetic';

export interface HillClimbStats {
  originalFitness: number;
  optimizedFitness: number;
  tweaksCount: number;
  edgeCasesDiscovered: number;
  details: string[];
}

export function runHillClimbing(
  chromosome: Chromosome,
  schema: FieldConstraint[],
  fitnessEvaluator: (c: Chromosome) => number,
  maxIterations = 15
): { optimized: Chromosome; stats: HillClimbStats } {
  const optimized = { ...chromosome };
  let currentFitness = fitnessEvaluator(optimized);
  const originalFitness = currentFitness;
  
  let tweaksCount = 0;
  let edgeCasesDiscovered = 0;
  const details: string[] = [];

  const specialChars = ['!', '@', '#', '$', '%', '^', '&', '*', "'", '"', '<', '>', '/', '\\', ';', '-', ' '];
  const securityTags = ["' OR 1=1 --", "<script>alert(1)</script>", "<svg/onload=alert(1)>"];

  details.push(`Khởi động leo đồi với điểm thích nghi ban đầu: ${originalFitness.toFixed(4)}`);

  let iteration = 0;
  let improved = true;

  while (iteration < maxIterations && improved) {
    improved = false;
    iteration++;

    // Try tweaking each field one by one
    for (const field of schema) {
      const currentVal = optimized[field.name];
      const neighbors: any[] = [];

      // --- Generate Neighborhood based on Field Type ---
      if (field.type === 'number') {
        const num = Number(currentVal);
        if (!isNaN(num)) {
          // Micro steps
          neighbors.push(num + 1);
          neighbors.push(num - 1);
          neighbors.push(num + 0.1);
          neighbors.push(num - 0.1);
          // Zero & bounds
          neighbors.push(0);
          if (field.minValue !== undefined) {
            neighbors.push(field.minValue);
            neighbors.push(field.minValue - 1); // invalid boundary
          }
          if (field.maxValue !== undefined) {
            neighbors.push(field.maxValue);
            neighbors.push(field.maxValue + 1); // invalid boundary
          }
        }
      } else {
        // String and other pattern-based fields
        const str = String(currentVal);

        // 1. Appending / Prepended Tweaks
        specialChars.forEach(char => {
          neighbors.push(str + char);
          neighbors.push(char + str);
        });

        // 2. Character Deletions
        if (str.length > 0) {
          neighbors.push(str.substring(0, str.length - 1));
          neighbors.push(str.substring(1));
          neighbors.push(''); // empty string boundary
        }

        // 3. Security Payload Injections
        securityTags.forEach(payload => {
          neighbors.push(str + payload);
          neighbors.push(payload);
        });

        // 4. Boundary Length modifiers
        if (field.minLength !== undefined) {
          neighbors.push(str.substring(0, field.minLength)); // exact min length
        }
        if (field.maxLength !== undefined) {
          neighbors.push(str.padEnd(field.maxLength, 'A')); // exact max length
          neighbors.push(str.padEnd(field.maxLength + 1, 'X')); // overflow length
        }
      }

      // --- Evaluate Neighbors ---
      let bestNeighbor: any = null;
      let bestNeighborFitness = currentFitness;

      for (const neighborVal of neighbors) {
        const candidate = { ...optimized, [field.name]: neighborVal };
        const score = fitnessEvaluator(candidate);

        if (score > bestNeighborFitness) {
          bestNeighbor = neighborVal;
          bestNeighborFitness = score;
        }
      }

      // --- Accept Steepest Ascent Neighbor ---
      if (bestNeighbor !== null) {
        const prevVal = optimized[field.name];
        optimized[field.name] = bestNeighbor;
        currentFitness = bestNeighborFitness;
        tweaksCount++;
        improved = true;

        // Log the local discovery
        const prevStr = String(prevVal).substring(0, 15) + (String(prevVal).length > 15 ? '...' : '');
        const newStr = String(bestNeighbor).substring(0, 15) + (String(bestNeighbor).length > 15 ? '...' : '');
        
        details.push(
          `Tweaked [${field.name}] từ "${prevStr}" -> "${newStr}" (Fitness tăng: ${bestNeighborFitness.toFixed(4)})`
        );

        // Check if this tweak was an edge case or security discovery
        const isSecurity = securityTags.some(tag => String(bestNeighbor).toLowerCase().includes(tag.toLowerCase()));
        const isBoundary = field.type === 'number' 
          ? (Number(bestNeighbor) === field.minValue || Number(bestNeighbor) === field.maxValue)
          : (field.minLength !== undefined && String(bestNeighbor).length === field.minLength || field.maxLength !== undefined && String(bestNeighbor).length === field.maxLength);

        if (isSecurity || isBoundary || String(bestNeighbor) === '') {
          edgeCasesDiscovered++;
        }
      }
    }
  }

  details.push(`Kết thúc leo đồi. Điểm tối ưu cuối cùng: ${currentFitness.toFixed(4)}. Tổng số lượt tinh chỉnh: ${tweaksCount}`);

  return {
    optimized,
    stats: {
      originalFitness,
      optimizedFitness: currentFitness,
      tweaksCount,
      edgeCasesDiscovered,
      details
    }
  };
}
