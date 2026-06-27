/**
 * Script chuyển đổi dlieu_mau_data.json sang cấu trúc backend:
 *   { tcId, values: { fieldA, fieldB, ... }, expectedResult, errorDescription,
 *     fitness, finalFitness, llmFitness, origin, categories }
 *
 * Kết quả: src/data/dlieu_mau_data.json (overwrite in-place)
 */
const fs = require('fs');
const path = require('path');

const SRC  = path.join(__dirname, '../src/data/dlieu_mau_data.json');
const DEST = path.join(__dirname, '../src/data/dlieu_mau_data.json');

// Keys cần tách ra khỏi values
const META_KEYS = new Set([
  'Test Code', 'Expected Result', 'Expected Error', 'Fitness', 'Origin',
  'tcId', 'expectedResult', 'errorDescription', 'fitness', 'finalFitness',
  'llmFitness', 'gaFitness', 'hcFitness', 'origin', 'categories', 'values',
  'scenario', 'rationale', 'covers',
]);

/**
 * Chuyển 1 row flat → backend format
 * @param {object} row
 * @param {string} defaultOrigin  'LLM' | 'GA' | 'HC'
 * @param {number} idx  row index
 */
function convertRow(row, defaultOrigin, idx) {
  const values = {};
  let tcId           = row['Test Code']        || row['tcId']           || `TC-${defaultOrigin}-${String(idx + 1).padStart(3, '0')}`;
  let expectedResult = row['Expected Result']  || row['expectedResult'] || '';
  let errorDesc      = row['Expected Error']   || row['errorDescription'] || '';
  let rawFitness     = row['Fitness']          ?? row['fitness']         ?? row['finalFitness'] ?? 0;
  let origin         = row['Origin']           || row['origin']          || defaultOrigin;

  // Normalize fitness to [0,1]
  let fitness = Number(rawFitness);
  if (fitness > 1) fitness = fitness / 100;

  // Tất cả key còn lại → values
  for (const [k, v] of Object.entries(row)) {
    if (!META_KEYS.has(k)) {
      values[k] = v;
    }
  }

  // Phân loại categories
  const lower = String(expectedResult).toLowerCase();
  const isError = lower.includes('error') || lower.includes('fail') || lower.includes('lỗi') || lower.includes('thất bại');
  const categories = isError ? ['negative'] : ['positive'];

  return {
    tcId,
    values,
    expectedResult,
    errorDescription: errorDesc,
    scenario: expectedResult,
    fitness,
    llmFitness: defaultOrigin === 'LLM' ? fitness : (row['llmFitness'] ?? fitness * 0.9),
    gaFitness:  defaultOrigin === 'GA'  ? fitness : (row['gaFitness']  ?? null),
    hcFitness:  defaultOrigin === 'HC'  ? fitness : (row['hcFitness']  ?? null),
    finalFitness: fitness,
    origin,
    categories,
    covers: [],
  };
}

const raw = JSON.parse(fs.readFileSync(SRC, 'utf-8'));

// Preset groups
const PRESET_PREFIXES = ['DangNhap', 'ThemSP', 'SuaSP', 'XoaSP', 'TimKiem'];
const SUFFIX_MAP = {
  '_LLM'      : { dest: 'llmSeeds',  origin: 'LLM' },
  '_LLM_GA'   : { dest: 'gaResult',  origin: 'GA'  },
  '_LLM_GA_HC': { dest: 'hcResult',  origin: 'HC'  },
};

const output = {};

// Copy non-preset keys (đặc tả, Huong_dan)
for (const [k, v] of Object.entries(raw)) {
  const isPreset = PRESET_PREFIXES.some(p => k.startsWith(p));
  if (!isPreset) {
    output[k] = v;
    continue;
  }

  // Xác định prefix và suffix
  let matchedPrefix = PRESET_PREFIXES.find(p => k.startsWith(p));
  let suffix = k.slice(matchedPrefix.length); // '_LLM', '_LLM_GA', '_LLM_GA_HC'
  const mapping = SUFFIX_MAP[suffix];
  if (!mapping) {
    output[k] = v; // giữ nguyên nếu không map được
    continue;
  }

  // v là array rows (bỏ qua row đầu = header row nếu không có tcId/Test Code thực)
  const rows = Array.isArray(v) ? v : [];
  const converted = rows
    .filter(r => r && typeof r === 'object' && (r['Test Code'] || r['tcId'] || r['email'] || r['productName'] || r['fullName']))
    .map((r, i) => convertRow(r, mapping.origin, i));

  output[k] = converted;
}

fs.writeFileSync(DEST, JSON.stringify(output, null, 2), 'utf-8');
console.log(`✅ Converted ${DEST}`);

// In thống kê
for (const prefix of PRESET_PREFIXES) {
  for (const [suf, { dest }] of Object.entries(SUFFIX_MAP)) {
    const key = `${prefix}${suf}`;
    if (output[key]) console.log(`   ${key}: ${output[key].length} entries`);
  }
}
