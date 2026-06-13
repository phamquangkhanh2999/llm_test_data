import React, { useState } from 'react';
import type { Chromosome } from '../algorithms/genetic';
import { GeneticEngine } from '../algorithms/genetic';
import type { FieldConstraint } from '../algorithms/presets';
import { Download, FileSpreadsheet, FileJson, History, Database, AlertCircle, Trash2, Clock, ShieldAlert, Zap, Terminal, Code, Shrink, FileCode, Copy, X, Check, Search, ChevronRight } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { toast } from '../store/useToastStore';

const highlightSyntax = (content: string, language: string): string => {
  let escaped = content
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  if (language === 'typescript' || language === 'javascript') {
    escaped = escaped.replace(/\b(import|from|const|let|var|function|return|async|await|test|describe|it|expect|cy|page|forEach|typeof|undefined)\b/g, '<span style="color: #E11D48; font-weight: bold;">$1</span>');
    escaped = escaped.replace(/(['"`])(.*?)\1/g, '<span style="color: #0D9488;">$1$2$1</span>');
    escaped = escaped.replace(/(\/\/.*)/g, '<span style="color: #64748B; font-style: italic;">$1</span>');
    escaped = escaped.replace(/(\/\*\*[\s\S]*?\*\/)/g, '<span style="color: #64748B; font-style: italic;">$1</span>');
  } else if (language === 'sql') {
    escaped = escaped.replace(/\b(CREATE TABLE|IF NOT EXISTS|INTEGER|PRIMARY KEY|AUTOINCREMENT|TEXT|INSERT INTO|VALUES|NULL|SELECT|UNION)\b/g, '<span style="color: #7C3AED; font-weight: bold;">$1</span>');
    escaped = escaped.replace(/(['])(.*?)\1/g, '<span style="color: #0D9488;">$1$2$1</span>');
    escaped = escaped.replace(/(--.*)/g, '<span style="color: #64748B; font-style: italic;">$1</span>');
  } else if (language === 'json') {
    escaped = escaped.replace(/(".*?")(\s*:)/g, '<span style="color: #7C3AED;">$1</span>$2');
    escaped = escaped.replace(/(:\s*)(".*?")/g, '$1<span style="color: #0D9488;">$2</span>');
    escaped = escaped.replace(/(:\s*)(\b\d+\b|true|false|null)/g, '$1<span style="color: #D97706;">$2</span>');
  }
  return escaped;
};

export const HistoryManager: React.FC = () => {
  const {
    optimizedDataset,
    historyRuns,
    handleLoadPastRun: onLoadPastRun,
    handleClearHistory: onClearHistory,
    schemaName,
    parsedSchema,
    selectedSuiteName
  } = useAppStore();
  // Trạng thái (state) hiển thị thông báo đã sao chép chuỗi JSON vào bộ nhớ đệm
  const [copied, setCopied] = useState(false);
  // Trạng thái xem trước mã nguồn chia đôi màn hình
  const [previewCode, setPreviewCode] = useState<{
    title: string;
    filename: string;
    content: string;
    language: string;
  } | null>(null);
  const [codeCopied, setCodeCopied] = useState(false);

  // Trạng thái lọc loại ca kiểm thử trong bảng xem trước
  const [filterType, setFilterType] = useState<'all' | 'happy' | 'boundary' | 'security'>('all');
  // Số lượng bản ghi hiển thị trong bảng (có thể expand thêm)
  const [displayLimit, setDisplayLimit] = useState(30);

  // Trạng thái điều khiển mở/đóng menu xuất dữ liệu và API Sandbox
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [showApiSandbox, setShowApiSandbox] = useState(false);

  // Trạng thái mô phỏng API Validation thời gian thực
  const [selectedRecord, setSelectedRecord] = useState<Chromosome | null>(null);
  const [selectedRecordIdx, setSelectedRecordIdx] = useState<number | null>(null);
  const [apiSimStatus, setApiSimStatus] = useState<'idle' | 'loading' | 'success' | 'validation_error' | 'waf_blocked'>('idle');
  const [apiSimDetails, setApiSimDetails] = useState<any>(null);
  
  // Trạng thái chạy hàng loạt (Batch Run All) nâng cao
  const [batchRunning, setBatchRunning] = useState(false);
  const [batchProgress, setBatchProgress] = useState(0);
  const [batchResults, setBatchResults] = useState<{
    id: string;
    index: number;
    status: 'success' | 'validation_error' | 'waf_blocked';
    details: any;
    record: Chromosome;
  }[]>([]);
  const [batchSummary, setBatchSummary] = useState<{
    total: number;
    passed: number;
    validationErrors: number;
    wafBlocked: number;
  } | null>(null);
  const [batchLogFilter, setBatchLogFilter] = useState<'all' | 'error'>('all');

  // Minimize state
  const [isMinimizing, setIsMinimizing] = useState(false);
  const [minimizeResult, setMinimizeResult] = useState<{ original: number; minimized: number; removed: number; coverage: number } | null>(null);

  const handleMinimize = () => {
    if (optimizedDataset.length === 0) return;
    setIsMinimizing(true);
    setMinimizeResult(null);

    setTimeout(() => {
      try {
        // Tạo engine tạm để chạy minimize (không cần config GA)
        const engine = new GeneticEngine(parsedSchema as FieldConstraint[], {
          generations: 1, popSize: optimizedDataset.length,
          crossoverRate: 0.8, mutationRate: 0.15,
          weights: { validation: 0.5, boundary: 0.2, security: 0.2, diversity: 0.1 }
        });

        const result = engine.minimize(optimizedDataset);
        setMinimizeResult({
          original: optimizedDataset.length,
          minimized: result.minimized.length,
          removed: result.removed,
          coverage: result.finalCoverage
        });

        if (result.removed > 0) {
          // Cập nhật optimizedDataset với dữ liệu đã minimize
          const store = useAppStore.getState();
          store.setOptimizedDataset(result.minimized);
          toast.success(`Đã tối giản bộ test: ${result.removed} case dư thừa bị loại bỏ, còn ${result.minimized.length} case. Coverage: ${(result.finalCoverage * 100).toFixed(0)}%`);
        } else {
          toast.info('Bộ test cases đã tối ưu, không có case dư thừa nào.');
        }
      } catch (e: any) {
        toast.error(`Lỗi khi tối giản: ${e.message}`);
      } finally {
        setIsMinimizing(false);
      }
    }, 100);
  };

  // --- HÀM TRỢ GIÚP: TẠO TỆP TIN VÀ BẮT TRÌNH DUYỆT TẢI XUỐNG ---
  const downloadFile = (content: string, filename: string, contentType: string) => {
    const blob = new Blob([content], { type: contentType });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    
    URL.revokeObjectURL(url);
  };

  // --- HÀM XUẤT FILE CSV/EXCEL (ĐỊNH DẠNG BẢNG BIỂU) ---
  const handleExportCSV = () => {
    if (optimizedDataset.length === 0) return;
    
    const headers = Object.keys(optimizedDataset[0]);
    const csvRows = [headers.join(',')];

    optimizedDataset.forEach(row => {
      const values = headers.map(header => {
        const escaped = ('' + row[header]).replace(/"/g, '\\"');
        return `"${escaped}"`;
      });
      csvRows.push(values.join(','));
    });

    const csvContent = csvRows.join('\n');
    downloadFile(
      csvContent, 
      `${schemaName.toLowerCase().replace(/ /g, '_')}_dataset.csv`, 
      'text/csv;charset=utf-8;'
    );
  };

  // --- HÀM XUẤT FILE JSON ---
  const handleExportJSON = () => {
    if (optimizedDataset.length === 0) return;
    const safeSchemaName = schemaName.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const jsonContent = JSON.stringify(optimizedDataset, null, 2);
    
    setPreviewCode({
      title: 'JSON Dataset Preview',
      filename: `${safeSchemaName}_dataset.json`,
      content: jsonContent,
      language: 'json'
    });
  };

  // --- HÀM SAO CHÉP NHANH CHUỖI JSON ---
  const handleCopyClipboard = () => {
    if (optimizedDataset.length === 0) return;
    
    const jsonContent = JSON.stringify(optimizedDataset, null, 2);
    navigator.clipboard.writeText(jsonContent).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // --- HÀM XUẤT SCRIPT PLAYWRIGHT (.spec.ts) ---
  const handleExportPlaywright = () => {
    if (optimizedDataset.length === 0) return;
    const safeSchemaName = schemaName.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const fields = Object.keys(optimizedDataset[0]);

    const scriptContent = `import { test, expect } from '@playwright/test';

/**
 * Playwright Automation Suite - Generated by Hyperion TestForge
 * Target Business Flow: ${schemaName}
 * Total Test Cases: ${optimizedDataset.length}
 */
test.describe('${schemaName} Automation Form Tests', () => {
  const testCases = ${JSON.stringify(optimizedDataset, null, 2)};

  testCases.forEach((data, index) => {
    test(\`Test Case #\${index + 1} - \${data.policyNumber || data.username || 'Record'} Verification\`, async ({ page }) => {
      // Step 1: Navigate to the target submission form
      await page.goto('https://your-app-domain.com/form-endpoint');
      
      // Step 2: Populate form fields with optimized data
      ${fields.map(field => `
      if (data.${field} !== undefined) {
        await page.fill('input[name="${field}"], #${field}', String(data.${field}));
      }`).join('\n')}

      // Step 3: Trigger the form submission
      await page.click('button[type="submit"], #submit-btn');

      // Step 4: Validate server-side response behavior
      const dataString = JSON.stringify(data);
      const isSecurityPayload = dataString.includes("'") || dataString.includes("<script") || dataString.includes("--");
      
      if (isSecurityPayload) {
        // Assert security protection blocks the submission (WAF blocked)
        const errorAlert = page.locator('.waf-alert, .forbidden, h1:has-text("403")');
        await expect(errorAlert).toBeVisible();
      } else {
        // Assert regular success toast or error validations
        // await expect(page.locator('.success-toast')).toBeVisible();
      }
    });
  });
});
`;
    setPreviewCode({
      title: 'Playwright Script Preview',
      filename: `${safeSchemaName}_playwright.spec.ts`,
      content: scriptContent,
      language: 'typescript'
    });
  };

  // --- HÀM XUẤT SCRIPT CYPRESS (.spec.js) ---
  const handleExportCypress = () => {
    if (optimizedDataset.length === 0) return;
    const safeSchemaName = schemaName.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const fields = Object.keys(optimizedDataset[0]);

    const scriptContent = `/**
 * Cypress Automation Suite - Generated by Hyperion TestForge
 * Target Business Flow: ${schemaName}
 * Total Test Cases: ${optimizedDataset.length}
 */
describe('${schemaName} Automation Form Tests', () => {
  const testCases = ${JSON.stringify(optimizedDataset, null, 2)};

  testCases.forEach((data, index) => {
    it(\`Test Case #\${index + 1} - \${data.policyNumber || data.username || 'Record'} Verification\`, () => {
      // Step 1: Navigate to the target submission form
      cy.visit('/form-endpoint');
      
      // Step 2: Populate form fields with optimized data
      ${fields.map(field => `
      if (data.${field} !== undefined) {
        cy.get('input[name="${field}"], #${field}').clear().type(String(data.${field}));
      }`).join('\n')}

      // Step 3: Trigger form submission
      cy.get('button[type="submit"], #submit-btn').click();

      // Step 4: Validate server-side response behavior
      const dataString = JSON.stringify(data);
      const isSecurityPayload = dataString.includes("'") || dataString.includes("<script") || dataString.includes("--");

      if (isSecurityPayload) {
        cy.contains('403').should('be.visible');
      } else {
        // cy.get('.success-message').should('be.visible');
      }
    });
  });
});
`;
    setPreviewCode({
      title: 'Cypress Script Preview',
      filename: `${safeSchemaName}_cypress.spec.js`,
      content: scriptContent,
      language: 'javascript'
    });
  };

  // --- HÀM XUẤT SQL INSERT ---
  const handleExportSQL = () => {
    if (optimizedDataset.length === 0) return;
    const safeSchemaName = schemaName.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const tableName = safeSchemaName.substring(0, 30) || 'test_data';
    const fields = Object.keys(optimizedDataset[0]);

    const escapeSQL = (val: any): string => {
      if (val === null || val === undefined) return 'NULL';
      if (typeof val === 'number') return String(val);
      const str = String(val).replace(/'/g, "''").replace(/\\/g, '\\\\');
      return `'${str}'`;
    };

    const columns = fields.join(', ');
    const values = optimizedDataset.map(row =>
      `(${fields.map(f => escapeSQL(row[f])).join(', ')})`
    ).join(',\n');

    const sqlContent = `-- Generated by Hyperion TestForge
-- Schema: ${schemaName}
-- Records: ${optimizedDataset.length}
-- Table: ${tableName}

CREATE TABLE IF NOT EXISTS ${tableName} (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
${fields.map(f => `  ${f} TEXT`).join(',\n')}
);

INSERT INTO ${tableName} (${columns}) VALUES
${values};
`;
    setPreviewCode({
      title: 'SQL Insertion Script Preview',
      filename: `${safeSchemaName}_insert.sql`,
      content: sqlContent,
      language: 'sql'
    });
  };

  // --- HÀM XUẤT POSTMAN COLLECTION ---
  const handleExportPostman = () => {
    if (optimizedDataset.length === 0) return;
    const safeSchemaName = schemaName.toLowerCase().replace(/[^a-z0-9]/g, '_');

    const items = optimizedDataset.slice(0, 50).map((row, idx) => ({
      name: `Test Case #${idx + 1}`,
      request: {
        method: 'POST',
        header: [{ key: 'Content-Type', value: 'application/json' }],
        body: { mode: 'raw', raw: JSON.stringify(row, null, 2) },
        url: { raw: '{{base_url}}/api/submit', host: ['{{base_url}}'], path: ['api', 'submit'] },
      },
    }));

    const collection = {
      info: { name: `${schemaName} Test Suite`, schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json' },
      item: items,
    };

    setPreviewCode({
      title: 'Postman Collection Preview',
      filename: `${safeSchemaName}_postman.json`,
      content: JSON.stringify(collection, null, 2),
      language: 'json'
    });
  };

  // --- HÀM HELPER: KIỂM DUYỆT DỮ LIỆU (VALIDATION ENGINE) ---
  const validateRecord = (record: Chromosome) => {
    let isSecurity = false;
    let isValidationError = false;
    const errors: Record<string, string> = {};

    // 1. Security Check (WAF blocks)
    Object.keys(record).forEach(key => {
      const valStr = String(record[key]);
      if (valStr.includes("'") || valStr.includes("<script") || valStr.includes("--")) {
        isSecurity = true;
      }
    });

    if (isSecurity) {
      return {
        status: 'waf_blocked' as const,
        details: {
          status: 403,
          statusText: 'Forbidden',
          message: 'BỊ CHẶN BỞI WAF: Phát hiện dấu hiệu tấn công.',
          wafRule: 'SQLi/XSS-Generic-Shield'
        }
      };
    }

    // 2. Business Validation (Dựa trên schema hoặc heuristics)
    Object.keys(record).forEach(key => {
      const val = record[key];
      const valStr = String(val);

      if ((key === 'email' || key === 'beneficiaryEmail') && (!valStr.includes('@') || !valStr.includes('.'))) {
        isValidationError = true;
        errors[key] = 'Email không hợp lệ.';
      }
      if (key === 'phone' && !/^(03|05|07|08|09)\d{8}$/.test(valStr)) {
        isValidationError = true;
        errors[key] = 'SĐT không hợp lệ.';
      }
      if (key === 'cardNumber' && !/^\d{16}$/.test(valStr)) {
        isValidationError = true;
        errors[key] = 'Số thẻ phải 16 chữ số.';
      }
      if (key === 'cvv' && !/^\d{3}$/.test(valStr)) {
        isValidationError = true;
        errors[key] = 'CVV phải 3 chữ số.';
      }
      if (key === 'policyNumber' && !/^[A-Z]{3}-\d{6}$/.test(valStr)) {
        isValidationError = true;
        errors[key] = 'Sai định dạng POL-123456.';
      }
      if (key === 'age') {
        const n = Number(val);
        if (isNaN(n) || n < 18 || n > 100) {
          isValidationError = true;
          errors[key] = 'Tuổi phải từ 18-100.';
        }
      }
      if (key === 'amount') {
        const n = Number(val);
        if (isNaN(n) || n < 1 || n > 50000) {
          isValidationError = true;
          errors[key] = 'Số tiền 1-50,000 USD.';
        }
      }
      if (key === 'monthlyIncome') {
        const n = Number(val);
        if (isNaN(n) || n < 10000 || n > 1000000) {
          isValidationError = true;
          errors[key] = 'Thu nhập 10k-1M USD.';
        }
      }
      if (key === 'username' && (valStr.length < 5 || valStr.length > 15 || !/^[a-zA-Z0-9]+$/.test(valStr))) {
        isValidationError = true;
        errors[key] = 'Username 5-15 ký tự.';
      }
    });

    if (isValidationError) {
      return {
        status: 'validation_error' as const,
        details: {
          status: 400,
          statusText: 'Bad Request',
          message: 'Lỗi kiểm duyệt dữ liệu.',
          errors
        }
      };
    }

    return {
      status: 'success' as const,
      details: {
        status: 200,
        statusText: 'OK',
        message: 'Dữ liệu hợp lệ.',
        transactionId: `TXN-${Math.random().toString(36).substr(2, 7).toUpperCase()}`
      }
    };
  };

  // --- HÀM CHẠY HÀNG LOẠT (BATCH RUN ALL) ---
  const handleBatchRunAll = async () => {
    if (optimizedDataset.length === 0 || batchRunning) return;
    
    setBatchRunning(true);
    setBatchProgress(0);
    setBatchSummary(null);
    setBatchResults([]);
    setApiSimStatus('idle');
    setSelectedRecord(null);
    
    const total = optimizedDataset.length;
    const results = [];
    let passed = 0;
    let validationErrors = 0;
    let wafBlocked = 0;

    // Chạy tuần tự để tạo hiệu ứng thanh tiến trình
    for (let i = 0; i < total; i++) {
      const record = optimizedDataset[i];
      const validation = validateRecord(record);
      
      const result = {
        id: (record.id || record._id || `TC-${i+1}`).toString(),
        index: i + 1,
        status: validation.status,
        details: validation.details,
        record: record
      };
      
      results.push(result);
      if (validation.status === 'success') passed++;
      else if (validation.status === 'validation_error') validationErrors++;
      else if (validation.status === 'waf_blocked') wafBlocked++;

      // Update UI every 5 records to maintain performance
      if (i % 5 === 0 || i === total - 1) {
        setBatchProgress(Math.round(((i + 1) / total) * 100));
        await new Promise(res => setTimeout(res, 0));
      }
    }

    setBatchResults(results);
    setBatchSummary({ total, passed, validationErrors, wafBlocked });
    setBatchRunning(false);
  };

  // --- HÀM MÔ PHỎNG PHẢN HỒI API (SINGLE TEST) ---
  const handleSimulateAPI = (record: Chromosome, index: number) => {
    setSelectedRecord(record);
    setSelectedRecordIdx(index);
    setApiSimStatus('loading');
    
    setTimeout(() => {
      const validation = validateRecord(record);
      setApiSimStatus(validation.status);
      setApiSimDetails(validation.details);
    }, 600);
  };

  // --- PHÂN LOẠI CA KIỂM THỬ ĐỂ HỖ TRỢ BỘ LỌC CHÍNH XÁC ---
  const getRowCategory = (row: Chromosome): 'happy' | 'boundary' | 'security' => {
    let isSecurity = false;
    const securityKeywords = ["' or", '" or', "'or", '"or', '--', 'union', 'select', 'drop table', '<script', 'onload=', 'onerror=', 'javascript:'];
    
    // 1. Kiểm tra an ninh (Security)
    Object.values(row).forEach(val => {
      const str = String(val).toLowerCase();
      if (securityKeywords.some(kw => str.includes(kw))) {
        isSecurity = true;
      }
    });
    if (isSecurity) return 'security';

    // 2. Kiểm tra biên (Boundary) dựa trên parsedSchema
    let isBoundary = false;
    parsedSchema.forEach(field => {
      const val = row[field.name];
      if (val !== undefined && val !== null) {
        const strVal = String(val);
        if (field.type === 'number') {
          const num = Number(val);
          if (!isNaN(num)) {
            if (field.minValue !== undefined && num === field.minValue) isBoundary = true;
            if (field.maxValue !== undefined && num === field.maxValue) isBoundary = true;
          }
        } else {
          if (field.minLength !== undefined && strVal.length === field.minLength) isBoundary = true;
          if (field.maxLength !== undefined && strVal.length === field.maxLength) isBoundary = true;
        }
      }
    });

    if (isBoundary) return 'boundary';
    return 'happy';
  };

  // Áp dụng phân loại và lọc
  const categorizedDataset = optimizedDataset.map((row, idx) => ({
    row,
    idx,
    category: getRowCategory(row)
  }));

  const filteredDataset = categorizedDataset.filter(item => {
    if (filterType === 'all') return true;
    return item.category === filterType;
  });

  // Đếm số lượng ca test cho từng tab bộ lọc
  const totalCount = optimizedDataset.length;
  const happyCount = categorizedDataset.filter(i => i.category === 'happy').length;
  const boundaryCount = categorizedDataset.filter(i => i.category === 'boundary').length;
  const securityCount = categorizedDataset.filter(i => i.category === 'security').length;

  return (
    <div className="flex flex-col gap-lg" style={{ marginTop: '16px', width: '100%' }}>
      <div className="grid-2" style={{ gap: '20px' }}>
      
      {/* CỘT BÊN TRÁI: KHÔNG GIAN ĐIỀU KHIỂN XUẤT DỮ LIỆU & LỊCH SỬ PHIÊN CHẠY */}
      <div className="glass-card flex flex-col gap-md teal-border" style={{ background: 'var(--bg-card)', minWidth: 0 }}>
        <div className="flex align-center gap-sm" style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: '10px' }}>
          <History className="text-teal" size={22} style={{ color: 'var(--color-teal)' }} />
          <h2 style={{ fontSize: '16px', fontWeight: 'bold', color: 'var(--text-primary)', letterSpacing: '0.03em' }}>TRUNG TÂM XUẤT DỮ LIỆU &amp; LỊCH SỬ</h2>
        </div>

        {selectedSuiteName && (
          <div style={{
            background: 'rgba(13, 148, 136, 0.08)',
            border: '1px solid rgba(13, 148, 136, 0.25)',
            borderRadius: '6px',
            padding: '8px 12px',
            fontSize: '12px',
            color: 'var(--text-primary)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginTop: '4px'
          }}>
            <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: 'var(--color-teal)', boxShadow: '0 0 6px var(--color-teal)' }} />
            <span>Đang cấu hình kịch bản của bộ: <strong style={{ color: 'var(--color-teal)' }}>{selectedSuiteName}</strong></span>
          </div>
        )}

        <p style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: '1.5' }}>
          Tải xuống trực tiếp tập ca kiểm thử tối ưu hóa đã sinh dưới định dạng CSV/Excel hoặc JSON để đưa trực tiếp vào các công cụ tự động hóa như Selenium, Playwright, Postman.
        </p>

        {/* NÚT XUẤT FILE CHỈ HIỂN THỊ KHI ĐÃ CÓ DỮ LIỆU TỐI ƯU HÓA */}
        {optimizedDataset.length > 0 ? (
          <div style={{ position: 'relative', width: '100%', margin: '6px 0' }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button 
                onClick={() => setExportMenuOpen(!exportMenuOpen)}
                className="btn btn-primary" 
                style={{ 
                  flex: 1, 
                  fontSize: '13px', 
                  padding: '11px 16px',
                  background: 'var(--color-teal)', 
                  border: 'none',
                  color: 'var(--bg-space)',
                  fontWeight: '700',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  borderRadius: '8px',
                  boxShadow: '0 4px 12px rgba(13, 148, 136, 0.2)'
                }}
              >
                <Download size={16} /> 
                Tải &amp; Xuất Bộ Dữ Liệu (Export Dataset)
                <span style={{ fontSize: '10px', transition: 'transform 0.2s', transform: exportMenuOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</span>
              </button>
            </div>

            {exportMenuOpen && (
              <div 
                className="glass-card" 
                style={{ 
                  position: 'absolute', 
                  top: '100%', 
                  left: 0, 
                  width: '100%', 
                  zIndex: 200, 
                  marginTop: '8px', 
                  padding: '12px', 
                  background: 'var(--bg-card)', 
                  border: '1px solid var(--color-teal)',
                  boxShadow: '0 10px 40px rgba(0,0,0,0.1)',
                  borderRadius: '10px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                  maxHeight: '400px',
                  overflowY: 'auto',
                  scrollbarWidth: 'thin'
                }}
              >
                {/* NHÓM 1: DỮ LIỆU THÔ */}
                <div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
                    📊 Dữ liệu thô (Raw Data)
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <button 
                      onClick={() => { handleExportCSV(); setExportMenuOpen(false); }}
                      className="btn btn-secondary" 
                      style={{ fontSize: '12px', padding: '8px', justifyContent: 'flex-start', display: 'flex', alignItems: 'center', gap: '6px', width: '100%', background: 'rgba(0,0,0,0.02)' }}
                    >
                      <FileSpreadsheet size={14} style={{ color: 'var(--color-teal)' }} /> CSV / Excel
                    </button>
                    <button 
                      onClick={() => { handleExportJSON(); setExportMenuOpen(false); }}
                      className="btn btn-secondary" 
                      style={{ fontSize: '12px', padding: '8px', justifyContent: 'flex-start', display: 'flex', alignItems: 'center', gap: '6px', width: '100%', background: 'rgba(0,0,0,0.02)' }}
                    >
                      <FileJson size={14} style={{ color: 'var(--color-teal)' }} /> File JSON
                    </button>
                  </div>
                </div>

                {/* NHÓM 2: SCRIPTS AUTOMATION */}
                <div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
                    🤖 Automation Specs
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <button 
                      onClick={() => { handleExportPlaywright(); setExportMenuOpen(false); }}
                      className="btn btn-secondary" 
                      style={{ fontSize: '11px', padding: '8px', justifyContent: 'flex-start', display: 'flex', alignItems: 'center', gap: '6px', width: '100%', background: 'rgba(0,0,0,0.02)' }}
                    >
                      <Terminal size={13} style={{ color: 'var(--color-teal)' }} /> Playwright Spec
                    </button>
                    <button 
                      onClick={() => { handleExportCypress(); setExportMenuOpen(false); }}
                      className="btn btn-secondary" 
                      style={{ fontSize: '11px', padding: '8px', justifyContent: 'flex-start', display: 'flex', alignItems: 'center', gap: '6px', width: '100%', background: 'rgba(0,0,0,0.02)' }}
                    >
                      <Code size={13} style={{ color: 'var(--color-violet)' }} /> Cypress Spec
                    </button>
                  </div>
                </div>

                {/* NHÓM 3: DB & INTEGRATIONS */}
                <div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
                    🌐 Database &amp; API Integration
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <button 
                      onClick={() => { handleExportSQL(); setExportMenuOpen(false); }}
                      className="btn btn-secondary" 
                      style={{ fontSize: '11px', padding: '8px', justifyContent: 'flex-start', display: 'flex', alignItems: 'center', gap: '6px', width: '100%', background: 'rgba(0,0,0,0.02)' }}
                    >
                      <Database size={13} style={{ color: 'var(--color-yellow)' }} /> SQL Script
                    </button>
                    <button 
                      onClick={() => { handleExportPostman(); setExportMenuOpen(false); }}
                      className="btn btn-secondary" 
                      style={{ fontSize: '11px', padding: '8px', justifyContent: 'flex-start', display: 'flex', alignItems: 'center', gap: '6px', width: '100%', background: 'rgba(0,0,0,0.02)' }}
                    >
                      <FileCode size={13} style={{ color: 'var(--color-rose)' }} /> Postman
                    </button>
                  </div>
                </div>

                {/* NHÓM 4: THAO TÁC KHÁC */}
                <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '8px', marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <button 
                    onClick={() => { handleCopyClipboard(); setExportMenuOpen(false); }}
                    className="btn btn-secondary" 
                    style={{ 
                      fontSize: '12px', 
                      padding: '8px 12px', 
                      background: copied ? 'rgba(13, 148, 136, 0.06)' : 'rgba(0,0,0,0.01)',
                      borderColor: copied ? 'var(--color-teal)' : 'var(--border-subtle)',
                      color: copied ? 'var(--color-teal)' : 'var(--text-secondary)',
                      width: '100%',
                      justifyContent: 'center',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <Download size={14} /> 
                    {copied ? 'Đã sao chép chuỗi JSON!' : 'Sao chép chuỗi JSON nhanh'}
                  </button>

                  <button
                    onClick={() => { handleMinimize(); setExportMenuOpen(false); }}
                    disabled={isMinimizing}
                    className="btn btn-secondary"
                    style={{
                      fontSize: '12px',
                      padding: '8px 12px',
                      borderColor: 'rgba(225, 29, 72, 0.2)',
                      color: isMinimizing ? 'var(--text-muted)' : 'var(--color-rose)',
                      background: 'rgba(225, 29, 72, 0.02)',
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px'
                    }}
                  >
                    {isMinimizing ? (
                      <>
                        <div style={{ width: '12px', height: '12px', border: '2px solid rgba(225, 29, 72, 0.2)', borderTopColor: 'var(--color-rose)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                        Đang tối giản...
                      </>
                    ) : (
                      <>
                        <Shrink size={13} />
                        Tối Giản Bộ Test (Minimize)
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Minimize result summary */}
            {minimizeResult && (
              <div style={{
                padding: '10px 14px',
                background: 'linear-gradient(135deg, rgba(225, 29, 72, 0.05) 0%, rgba(225, 29, 72, 0.02) 100%)',
                border: '1px solid rgba(225, 29, 72, 0.15)',
                borderRadius: '10px',
                fontSize: '11.5px',
                color: 'var(--text-secondary)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '12px',
                marginTop: '12px',
                boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.02)'
              }}>
                <div className="flex align-center gap-xs">
                  <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--color-rose)' }} />
                  <span>Hiệu quả: {minimizeResult.original} → <b style={{color:'var(--color-rose)', fontSize: '13px'}}>{minimizeResult.minimized}</b> cases</span>
                </div>
                <div style={{ display: 'flex', gap: '16px' }}>
                  <span>Loại bỏ: <b style={{ fontWeight: '700' }}>{minimizeResult.removed}</b></span>
                  <span>Coverage: <b style={{color:'var(--color-teal)', fontWeight: '700'}}>{(minimizeResult.coverage * 100).toFixed(0)}%</b></span>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex align-center gap-sm" style={{ padding: '24px', background: 'rgba(0,0,0,0.01)', border: '1px dashed var(--border-subtle)', borderRadius: 'var(--radius-md)', color: 'var(--text-muted)', fontSize: '13px', justifyContent: 'center', textAlign: 'center', flexDirection: 'column' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(0,0,0,0.03)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '8px' }}>
              <Download size={20} style={{ opacity: 0.5 }} />
            </div>
            <span>Hãy chạy tối ưu hóa ở Tab "Tối Ưu Hóa Bộ Test" để xuất dữ liệu.</span>
          </div>
        )}

        {/* DANH SÁCH LỊCH SỬ CÁC LƯỢT CHẠY TRONG PHIÊN */}
        <div className="flex flex-col gap-sm" style={{ marginTop: '10px' }}>
          <div className="flex justify-between align-center" style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: '8px' }}>
            <h4 style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Clock size={14} /> Lịch sử các phiên chạy
            </h4>
            {historyRuns.length > 0 && onClearHistory && (
              <button 
                onClick={onClearHistory}
                className="btn btn-secondary flex align-center gap-xs" 
                style={{ padding: '2px 8px', fontSize: '11px', color: 'var(--color-rose)', borderColor: 'rgba(225, 29, 72, 0.1)', background: 'rgba(225, 29, 72, 0.02)' }}
              >
                <Trash2 size={12} /> Xóa sạch
              </button>
            )}
          </div>
          
          <div className="flex flex-col gap-sm" style={{ maxHeight: '220px', overflowY: 'auto', paddingRight: '4px' }}>
            {historyRuns.length === 0 ? (
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center', padding: '32px 0', border: '1px dashed var(--border-subtle)', borderRadius: 'var(--radius-sm)', background: 'rgba(0,0,0,0.01)' }}>
                Chưa có lượt chạy thành công nào được lưu trữ.
              </div>
            ) : (
              historyRuns.map((run, idx) => (
                <div 
                  key={idx} 
                  className="flex justify-between align-center card-hover-animation"
                  style={{ 
                    background: 'var(--bg-card)', 
                    border: '1px solid var(--border-subtle)', 
                    padding: '12px 16px', 
                    borderRadius: '10px',
                    fontSize: '12px',
                    boxShadow: 'var(--shadow-xs)',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <div className="flex flex-col gap-xs">
                    <span style={{ fontWeight: 'bold', color: 'var(--text-primary)', fontSize: '13px' }}>{run.schemaName}</span>
                    <span style={{ fontSize: '10.5px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Clock size={11} /> {run.timestamp}
                    </span>
                  </div>
                  <div className="flex align-center gap-md">
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 'bold', color: 'var(--color-teal)', fontSize: '14px' }}>{(run.coverage * 100).toFixed(0)}%</span>
                      <div style={{ fontSize: '9px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Coverage</div>
                    </div>
                    <button 
                      onClick={() => onLoadPastRun(run.data)}
                      className="btn btn-secondary" 
                      style={{ padding: '6px 12px', fontSize: '11.5px', fontWeight: 'bold', borderColor: 'var(--color-teal)', color: 'var(--color-teal)', background: 'var(--brand-50)' }}
                    >
                      Nạp lại
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
 
      {/* CỘT BÊN PHẢI: BẢNG XEM TRƯỚC BẢN GHI DỮ LIỆU CHI TIẾT HOẶC XEM TRƯỚC CODE */}
      <div className="glass-card flex flex-col gap-md violet-border" style={{ background: 'var(--bg-card)', minHeight: '520px', minWidth: 0 }}>
        {previewCode ? (
          <div className="flex flex-col gap-md" style={{ flex: 1, minHeight: '520px' }}>
            <div className="flex justify-between align-center" style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: '10px' }}>
              <div className="flex align-center gap-sm">
                <Code className="text-violet" size={22} style={{ color: 'var(--color-violet)' }} />
                <div>
                  <h2 style={{ fontSize: '15px', fontWeight: 'bold', color: 'var(--text-primary)', margin: 0 }}>{previewCode.title}</h2>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{previewCode.filename}</span>
                </div>
              </div>
              
              <div className="flex align-center gap-xs">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(previewCode.content).then(() => {
                      setCodeCopied(true);
                      toast.success('Đã sao chép mã nguồn!');
                      setTimeout(() => setCodeCopied(false), 2000);
                    });
                  }}
                  className="btn btn-secondary flex align-center gap-xs"
                  style={{ padding: '6px 10px', fontSize: '12px', background: 'rgba(0,0,0,0.02)' }}
                >
                  {codeCopied ? <Check size={14} style={{ color: 'var(--color-teal)' }} /> : <Copy size={14} />}
                  {codeCopied ? 'Đã sao chép' : 'Sao chép'}
                </button>
                
                <button
                  onClick={() => {
                    let mime = 'application/json';
                    if (previewCode.language === 'typescript') mime = 'application/typescript';
                    if (previewCode.language === 'javascript') mime = 'application/javascript';
                    if (previewCode.language === 'sql') mime = 'text/sql';
                    downloadFile(previewCode.content, previewCode.filename, mime);
                    toast.success(`Đã tải xuống ${previewCode.filename}`);
                  }}
                  className="btn btn-primary flex align-center gap-xs"
                  style={{ 
                    padding: '6px 12px', 
                    fontSize: '12px',
                    background: 'var(--color-teal)', 
                    border: 'none', 
                    color: 'var(--bg-space)', 
                    fontWeight: 'bold'
                  }}
                >
                  <Download size={14} /> Tải về
                </button>

                <button
                  onClick={() => setPreviewCode(null)}
                  className="btn btn-secondary"
                  style={{ padding: '6px', minWidth: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  title="Quay lại danh sách ca test"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* IDE split screen layout */}
            <div style={{ 
              display: 'flex', 
              fontFamily: 'var(--font-mono)', 
              fontSize: '12px', 
              background: '#f8fafc', 
              borderRadius: '8px', 
              border: '1px solid var(--border-subtle)', 
              overflow: 'hidden', 
              flex: 1,
              maxHeight: '420px',
              position: 'relative'
            }}>
              {/* Line numbers gutter */}
              <div style={{ 
                color: 'rgba(0,0,0,0.3)', 
                textAlign: 'right', 
                padding: '12px 8px', 
                background: '#f1f5f9',
                borderRight: '1px solid var(--border-subtle)', 
                userSelect: 'none',
                minWidth: '40px'
              }}>
                {previewCode.content.split('\n').map((_, i) => (
                  <div key={i} style={{ height: '20px', lineHeight: '20px' }}>{i + 1}</div>
                ))}
              </div>
              
              {/* Code window */}
              <pre style={{ 
                margin: 0, 
                padding: '12px', 
                color: 'var(--text-primary)', 
                whiteSpace: 'pre', 
                overflow: 'auto', 
                flex: 1,
                lineHeight: '20px'
              }}>
                <code dangerouslySetInnerHTML={{ __html: highlightSyntax(previewCode.content, previewCode.language) }} />
              </pre>
            </div>
            
            {/* LƯU Ý AN TOÀN */}
            <div className="flex align-center gap-sm" style={{ padding: '8px 12px', background: 'rgba(225, 29, 72, 0.04)', border: '1px solid rgba(225, 29, 72, 0.1)', borderRadius: '6px', fontSize: '11px', color: 'var(--color-rose)', marginTop: 'auto' }}>
              <ShieldAlert size={14} style={{ flexShrink: 0 }} />
              <span><b>Lưu ý an toàn:</b> Script kiểm thử sinh ra chỉ chứa dữ liệu giả lập. Hãy xác minh kỹ lưỡng trước khi đưa vào môi trường kiểm thử thực tế.</span>
            </div>
          </div>
        ) : (
          <>
            <div className="flex justify-between align-center" style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: '10px' }}>
              <div className="flex align-center gap-sm">
                <Database className="text-violet" size={22} style={{ color: 'var(--color-violet)' }} />
                <h2 style={{ fontSize: '16px', fontWeight: 'bold', color: 'var(--text-primary)', letterSpacing: '0.03em' }}>XEM TRƯỚC BỘ CA KIỂM THỬ</h2>
              </div>
              {optimizedDataset.length > 0 && (
                <span style={{ fontSize: '11px', background: 'rgba(124, 58, 237, 0.1)', color: 'var(--color-violet)', padding: '2px 8px', borderRadius: '12px', fontWeight: 'bold' }}>
                  Tổng cộng: {optimizedDataset.length} ca test
                </span>
              )}
            </div>

            {selectedSuiteName && (
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px', marginBottom: '8px', paddingLeft: '28px' }}>
                Đang xem bộ test sinh bởi: <strong style={{ color: 'var(--color-violet)' }}>{selectedSuiteName}</strong>
              </div>
            )}

            {optimizedDataset.length > 0 ? (
              <div className="flex flex-col gap-md" style={{ flex: 1 }}>
                
                {/* THANH BỘ LỌC THÔNG MINH (QA CATEGORY FILTERS) */}
                <div className="flex gap-xs" style={{ flexWrap: 'wrap', background: 'rgba(0,0,0,0.02)', padding: '4px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                  <button 
                    onClick={() => setFilterType('all')}
                    style={{ 
                      flex: 1, minWidth: '80px', padding: '6px 8px', border: 'none', borderRadius: '6px', fontSize: '11.5px', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s',
                      background: filterType === 'all' ? 'rgba(0,0,0,0.05)' : 'transparent',
                      color: filterType === 'all' ? 'var(--text-primary)' : 'var(--text-muted)'
                    }}
                  >
                    Tất cả ({totalCount})
                  </button>
                  <button 
                    onClick={() => setFilterType('happy')}
                    style={{ 
                      flex: 1, minWidth: '95px', padding: '6px 8px', border: 'none', borderRadius: '6px', fontSize: '11.5px', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s',
                      background: filterType === 'happy' ? 'rgba(13, 148, 136, 0.08)' : 'transparent',
                      color: filterType === 'happy' ? 'var(--color-teal)' : 'var(--text-muted)'
                    }}
                  >
                    🟢 Positive ({happyCount})
                  </button>
                  <button 
                    onClick={() => setFilterType('boundary')}
                    style={{ 
                      flex: 1, minWidth: '95px', padding: '6px 8px', border: 'none', borderRadius: '6px', fontSize: '11.5px', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s',
                      background: filterType === 'boundary' ? 'rgba(124, 58, 237, 0.08)' : 'transparent',
                      color: filterType === 'boundary' ? 'var(--color-violet)' : 'var(--text-muted)'
                    }}
                  >
                    🟡 Rìa Biên ({boundaryCount})
                  </button>
                  <button 
                    onClick={() => setFilterType('security')}
                    style={{ 
                      flex: 1, minWidth: '95px', padding: '6px 8px', border: 'none', borderRadius: '6px', fontSize: '11.5px', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s',
                      background: filterType === 'security' ? 'rgba(225, 29, 72, 0.08)' : 'transparent',
                      color: filterType === 'security' ? 'var(--color-rose)' : 'var(--text-muted)'
                    }}
                  >
                    🔴 An Ninh ({securityCount})
                  </button>
                </div>

                {/* BẢNG DỮ LIỆU HIỂN THỊ SAU KHI LỌC */}
                <div style={{ flex: 1, width: '100%', overflowX: 'auto', maxHeight: '400px', border: '1px solid var(--border-subtle)', borderRadius: '8px', position: 'relative' }}>
                  {filteredDataset.length === 0 ? (
                    <div style={{ padding: '48px', color: 'var(--text-muted)', textAlign: 'center', fontSize: '13px' }}>
                      Không tìm thấy ca kiểm thử nào khớp với bộ lọc này.
                    </div>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: '12px', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ background: 'var(--surface-subtle)', position: 'sticky', top: 0, zIndex: 20, boxShadow: '0 1px 0 var(--border-subtle)' }}>
                          <th style={{ padding: '12px', width: '80px', minWidth: '100px', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)', fontWeight: 'bold' }}>
                            <div style={{ minWidth: '100px' }}>Phân Loại</div>
                          </th>
                          {Object.keys(optimizedDataset[0]).map(k => (
                            <th key={k} style={{ padding: '12px', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)', fontWeight: 'bold' }}>
                              <div style={{ minWidth: '120px', maxWidth: '280px', wordBreak: 'break-word', whiteSpace: 'normal' }}>{k}</div>
                            </th>
                          ))}
                          <th style={{ padding: '12px', width: '90px', minWidth: '90px', textAlign: 'center', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)', fontWeight: 'bold' }}>
                            <div style={{ minWidth: '90px' }}>Hành Động</div>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredDataset.slice(0, displayLimit).map(({ row, idx, category }) => {
                          return (
                            <tr 
                              key={idx} 
                              style={{ 
                                background: category === 'security' ? 'rgba(225, 29, 72, 0.02)' : category === 'boundary' ? 'rgba(124, 58, 237, 0.02)' : 'none',
                                transition: 'background 0.2s'
                              }}
                            >
                              {/* Render badge phân loại */}
                              <td style={{ padding: '10px 12px', minWidth: '100px', verticalAlign: 'top', borderBottom: '1px solid var(--border-subtle)' }}>
                                <span 
                                  style={{ 
                                    padding: '2px 6px', 
                                    borderRadius: '4px', 
                                    fontSize: '9.5px', 
                                    fontWeight: 'bold',
                                    background: category === 'security' ? 'rgba(225, 29, 72, 0.1)' : category === 'boundary' ? 'rgba(124, 58, 237, 0.1)' : 'rgba(13, 148, 136, 0.1)',
                                    color: category === 'security' ? 'var(--color-rose)' : category === 'boundary' ? 'var(--color-violet)' : 'var(--color-teal)'
                                  }}
                                >
                                  {category === 'security' ? 'AN NINH' : category === 'boundary' ? 'RÌA BIÊN' : 'POSITIVE'}
                                </span>
                              </td>
                              {Object.keys(row).map(k => {
                                const valStr = String(row[k]);
                                const isSpecial = valStr.includes("'") || valStr.includes("<script") || valStr === "" || valStr === "0";
                                return (
                                  <td 
                                    key={k} 
                                    title={valStr} // Tooltip khi hover xem đầy đủ payload
                                    style={{ 
                                      padding: '10px 12px', 
                                      verticalAlign: 'top',
                                      borderBottom: '1px solid var(--border-subtle)'
                                    }}
                                  >
                                    <div
                                      style={{
                                        fontFamily: 'var(--font-mono)',
                                        color: category === 'security' && (valStr.includes("'") || valStr.includes("<script") || valStr.includes("--")) ? 'var(--color-rose)' : 'inherit',
                                        fontWeight: isSpecial ? 'bold' : 'normal',
                                        minWidth: '120px',
                                        maxWidth: '280px',
                                        maxHeight: '80px',
                                        overflowY: 'auto',
                                        wordBreak: 'break-word',
                                        whiteSpace: 'normal',
                                        paddingRight: '4px'
                                      }}
                                    >
                                      {valStr === '' ? <i style={{ color: 'var(--text-muted)' }}>(Chuỗi rỗng / Empty)</i> : valStr}
                                    </div>
                                  </td>
                                );
                              })}
                              <td style={{ padding: '10px 12px', textAlign: 'center', borderBottom: '1px solid var(--border-subtle)' }}>
                                <button 
                                  onClick={() => handleSimulateAPI(row, idx)}
                                  className="btn btn-secondary"
                                  style={{ 
                                    padding: '4px 8px', 
                                    fontSize: '10.5px', 
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    border: '1px solid',
                                    borderColor: selectedRecordIdx === idx ? 'var(--color-teal)' : 'var(--border-subtle)',
                                    color: selectedRecordIdx === idx ? 'var(--color-teal)' : 'var(--text-secondary)',
                                    background: selectedRecordIdx === idx ? 'rgba(13, 148, 136, 0.08)' : 'rgba(0,0,0,0.01)',
                                    cursor: 'pointer',
                                    borderRadius: '4px',
                                    transition: 'all 0.2s',
                                    fontWeight: '600'
                                  }}
                                >
                                  <Zap size={10} /> Test API
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                  
                  {/* NÚT XEM THÊM / THU GỌN */}
                  {filteredDataset.length > displayLimit ? (
                    <div style={{ textAlign: 'center', padding: '10px', background: 'rgba(0,0,0,0.02)', borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'center', gap: '10px' }}>
                      <button
                        onClick={() => setDisplayLimit(prev => prev + 30)}
                        style={{ fontSize: '11.5px', padding: '6px 16px', background: 'rgba(13, 148, 136, 0.06)', border: '1px solid rgba(13, 148, 136, 0.2)', borderRadius: '6px', color: 'var(--color-teal)', cursor: 'pointer', fontWeight: 'bold' }}
                      >
                        ↓ Xem thêm {Math.min(30, filteredDataset.length - displayLimit)} ca ({filteredDataset.length - displayLimit} còn lại)
                      </button>
                    </div>
                  ) : filteredDataset.length > 30 ? (
                    <div style={{ textAlign: 'center', padding: '10px', background: 'rgba(0,0,0,0.02)', borderTop: '1px solid var(--border-subtle)' }}>
                      <button
                        onClick={() => setDisplayLimit(30)}
                        style={{ fontSize: '11.5px', padding: '6px 16px', background: 'rgba(0,0,0,0.02)', border: '1px solid var(--border-subtle)', borderRadius: '6px', color: 'var(--text-muted)', cursor: 'pointer' }}
                      >
                        ↑ Thu gọn
                      </button>
                    </div>
                  ) : null}
                </div>
                
                {/* LƯU Ý BẢO MẬT DƯỚI ĐÁY */}
                <div className="flex align-center gap-sm" style={{ padding: '8px 12px', background: 'rgba(225, 29, 72, 0.04)', border: '1px solid rgba(225, 29, 72, 0.1)', borderRadius: '6px', fontSize: '11px', color: 'var(--color-rose)', marginTop: 'auto' }}>
                  <ShieldAlert size={14} style={{ flexShrink: 0 }} />
                  <span><b>Lưu ý an toàn:</b> Các chuỗi XSS/SQLi tấn công được sinh ra nhằm mục đích dò quét an ninh phần mềm. Đã mã hóa HTML khi render, tránh dán trực tiếp vào DB sản xuất của bạn.</span>
                </div>
              </div>
            ) : (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px dashed var(--border-subtle)', borderRadius: 'var(--radius-sm)', background: 'rgba(0,0,0,0.01)', padding: '80px 0', color: 'var(--text-muted)' }}>
                Chưa có tập dữ liệu tối ưu hóa nào được sinh ra.
              </div>
            )}
          </>
        )}
      </div>
      </div> {/* CLOSE grid-2 */}

      {/* PHÂN VÙNG MỚI: BỘ MÔ PHỎNG PHẢN HỒI API VALIDATION THỜI GIAN THỰC */}
      {optimizedDataset.length > 0 && (
        <div 
          className="glass-card flex flex-col gap-md"
          style={{ 
            background: 'var(--bg-card)', 
            border: '1px solid var(--border-subtle)',
            boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
            padding: '20px',
            borderRadius: '12px',
            transition: 'all 0.3s ease'
          }}
        >
          {/* TIÊU ĐỀ TRIGGER COLLAPSIBLE */}
          <div 
            onClick={() => setShowApiSandbox(!showApiSandbox)}
            className="flex justify-between align-center" 
            style={{ 
              cursor: 'pointer',
              userSelect: 'none',
              paddingBottom: showApiSandbox ? '16px' : '0',
              borderBottom: showApiSandbox ? '1px solid var(--border-subtle)' : 'none',
              transition: 'all 0.2s ease-in-out'
            }}
          >
            <div className="flex align-center gap-sm">
              <Zap className="text-teal animate-pulse" size={22} style={{ color: 'var(--color-teal)' }} />
              <h2 style={{ fontSize: '15px', fontWeight: 'bold', color: 'var(--text-primary)', letterSpacing: '0.03em' }}>
                ⚡ CHẠY THỬ NGHIỆM API SANDBOX (LIVE API VALIDATION &amp; BATCH RUN)
              </h2>
            </div>
            <div className="flex align-center gap-sm" style={{ color: 'var(--text-muted)', fontSize: '13px', fontWeight: '500' }}>
              <span>{showApiSandbox ? 'Thu gọn ▲' : 'Mở rộng để cấu hình & test ▼'}</span>
            </div>
          </div>

          {showApiSandbox && (
            <div className="flex flex-col gap-md" style={{ marginTop: '16px', animation: 'fadeIn 0.3s ease-out' }}>
              <p style={{ color: 'var(--text-secondary)', fontSize: '13.5px', lineHeight: '1.6', margin: 0 }}>
                Hỗ trợ QA và Developer kiểm thử tích hợp bằng cách mô phỏng gửi dữ liệu ca kiểm thử (JSON payload) trực tiếp lên endpoint API. Hệ thống tích hợp sẵn tường lửa WAF và bộ kiểm duyệt Schema tự động.
              </p>

              <div className="flex justify-between align-center" style={{ flexWrap: 'wrap', gap: '10px', paddingTop: '10px', borderTop: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                  Mô phỏng gửi HTTP POST requests hàng loạt hoặc từng ca.
                </div>
                <div className="flex align-center gap-sm">
                  {selectedRecord && (
                    <span style={{ fontSize: '11.5px', background: 'rgba(0,0,0,0.05)', color: 'var(--text-secondary)', padding: '3px 10px', borderRadius: '12px', fontWeight: '500' }}>
                      Đang chọn: Ca Test #{selectedRecordIdx !== null ? selectedRecordIdx + 1 : ''}
                    </span>
                  )}
                  <button
                    onClick={handleBatchRunAll}
                    disabled={batchRunning}
                    style={{
                      fontSize: '12px',
                      padding: '7px 14px',
                      background: batchRunning ? 'rgba(0,0,0,0.02)' : 'linear-gradient(135deg, rgba(13, 148, 136, 0.15), rgba(13, 148, 136, 0.05))',
                      border: '1px solid',
                      borderColor: batchRunning ? 'var(--border-subtle)' : 'rgba(13, 148, 136, 0.3)',
                      borderRadius: '8px',
                      color: batchRunning ? 'var(--text-muted)' : 'var(--color-teal)',
                      cursor: batchRunning ? 'not-allowed' : 'pointer',
                      fontWeight: 'bold',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      transition: 'all 0.2s',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {batchRunning ? (
                      <>
                        <div style={{ width: '12px', height: '12px', border: '2px solid rgba(13, 148, 136, 0.2)', borderTopColor: 'var(--color-teal)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                        Đang chạy {batchProgress}%...
                      </>
                    ) : (
                      <>
                        <Zap size={13} />
                        ⚡ Chạy Tất Cả ({optimizedDataset.length} ca)
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* THANH TIẾN TRÌNH BATCH RUN */}
              {batchRunning && (
                <div style={{ marginBottom: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                    <span>Đang kiểm duyệt toàn bộ dataset...</span>
                    <span>{batchProgress}%</span>
                  </div>
                  <div style={{ height: '6px', background: 'rgba(0,0,0,0.04)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${batchProgress}%`, background: 'linear-gradient(90deg, var(--color-teal), #0d9488)', borderRadius: '3px', transition: 'width 0.1s' }} />
                  </div>
                </div>
              )}

              {/* KẾT QUẢ BATCH RUN SUMMARY */}
              {batchSummary && !batchRunning && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'md' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '8px' }}>
                    <div style={{ background: 'rgba(13, 148, 136, 0.06)', border: '1px solid rgba(13, 148, 136, 0.2)', borderRadius: '8px', padding: '12px', textAlign: 'center' }}>
                      <div style={{ fontSize: '22px', fontWeight: 'bold', color: 'var(--color-teal)', fontFamily: 'var(--font-mono)' }}>{batchSummary.total}</div>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>TỔNG CA</div>
                    </div>
                    <div style={{ background: 'rgba(13, 148, 136, 0.06)', border: '1px solid rgba(13, 148, 136, 0.2)', borderRadius: '8px', padding: '12px', textAlign: 'center' }}>
                      <div style={{ fontSize: '22px', fontWeight: 'bold', color: 'var(--color-teal)', fontFamily: 'var(--font-mono)' }}>{batchSummary.passed}</div>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>HTTP 200 ✅</div>
                    </div>
                    <div style={{ background: 'rgba(124, 58, 237, 0.06)', border: '1px solid rgba(124, 58, 237, 0.2)', borderRadius: '8px', padding: '12px', textAlign: 'center' }}>
                      <div style={{ fontSize: '22px', fontWeight: 'bold', color: 'var(--color-violet)', fontFamily: 'var(--font-mono)' }}>{batchSummary.validationErrors}</div>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>HTTP 400 ⚠️</div>
                    </div>
                    <div style={{ background: 'rgba(225, 29, 72, 0.06)', border: '1px solid rgba(225, 29, 72, 0.2)', borderRadius: '8px', padding: '12px', textAlign: 'center' }}>
                      <div style={{ fontSize: '22px', fontWeight: 'bold', color: 'var(--color-rose)', fontFamily: 'var(--font-mono)' }}>{batchSummary.wafBlocked}</div>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>HTTP 403 🚫</div>
                    </div>
                  </div>

                  {/* BÁO CÁO CHI TIẾT BATCH RUN */}
                  <div className="glass-card" style={{ padding: '16px', background: 'rgba(0,0,0,0.01)', border: '1px solid var(--border-subtle)', borderRadius: '12px' }}>
                    <div className="flex justify-between align-center" style={{ marginBottom: '12px' }}>
                      <div className="flex align-center gap-sm">
                        <Terminal size={16} className="text-muted" />
                        <h4 style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--text-primary)', margin: 0 }}>CHI TIẾT THỰC THI (BATCH EXECUTION LOG)</h4>
                      </div>
                      <div className="flex gap-xs">
                        <button 
                          onClick={() => setBatchLogFilter('all')}
                          style={{ fontSize: '10.5px', padding: '3px 8px', borderRadius: '4px', border: '1px solid', borderColor: batchLogFilter === 'all' ? 'var(--color-teal)' : 'var(--border-subtle)', background: batchLogFilter === 'all' ? 'rgba(13, 148, 136, 0.08)' : 'transparent', color: batchLogFilter === 'all' ? 'var(--color-teal)' : 'var(--text-muted)', cursor: 'pointer' }}
                        >
                          Tất cả
                        </button>
                        <button 
                          onClick={() => setBatchLogFilter('error')}
                          style={{ fontSize: '10.5px', padding: '3px 8px', borderRadius: '4px', border: '1px solid', borderColor: batchLogFilter === 'error' ? 'var(--color-rose)' : 'var(--border-subtle)', background: batchLogFilter === 'error' ? 'rgba(225, 29, 72, 0.08)' : 'transparent', color: batchLogFilter === 'error' ? 'var(--color-rose)' : 'var(--text-muted)', cursor: 'pointer' }}
                        >
                          Chỉ lỗi
                        </button>
                      </div>
                    </div>

                    <div style={{ maxHeight: '250px', overflowY: 'auto', border: '1px solid var(--border-subtle)', borderRadius: '8px', background: 'white' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11.5px' }}>
                        <thead style={{ position: 'sticky', top: 0, background: '#f8fafc', zIndex: 10, boxShadow: '0 1px 0 var(--border-subtle)' }}>
                          <tr>
                            <th style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 'bold', width: '60px' }}>STT</th>
                            <th style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 'bold', width: '100px' }}>ID</th>
                            <th style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 'bold', width: '120px' }}>Trạng thái</th>
                            <th style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 'bold' }}>Thông điệp phản hồi</th>
                            <th style={{ padding: '8px 12px', textAlign: 'center', color: 'var(--text-muted)', fontWeight: 'bold', width: '80px' }}>Chi tiết</th>
                          </tr>
                        </thead>
                        <tbody>
                          {batchResults
                            .filter(r => batchLogFilter === 'all' || r.status !== 'success')
                            .map((res, i) => (
                            <tr key={i} style={{ borderBottom: '1px solid var(--border-subtle)', background: res.status === 'waf_blocked' ? 'rgba(225, 29, 72, 0.02)' : 'none' }}>
                              <td style={{ padding: '8px 12px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{res.index}</td>
                              <td style={{ padding: '8px 12px', fontWeight: '500' }}>{res.id}</td>
                              <td style={{ padding: '8px 12px' }}>
                                <span style={{ color: res.status === 'success' ? 'var(--color-teal)' : res.status === 'validation_error' ? 'var(--color-violet)' : 'var(--color-rose)', fontWeight: 'bold' }}>
                                  {res.status === 'success' ? 'SUCCESS 200' : res.status === 'validation_error' ? 'BAD REQ 400' : 'FORBIDDEN 403'}
                                </span>
                              </td>
                              <td style={{ padding: '8px 12px', color: 'var(--text-secondary)' }}>
                                {res.details.message}
                                {res.status === 'validation_error' && (
                                  <div style={{ fontSize: '10px', color: 'var(--color-rose)', marginTop: '2px' }}>
                                    Lỗi: {Object.keys(res.details.errors).join(', ')}
                                  </div>
                                )}
                              </td>
                              <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                                <button 
                                  onClick={() => handleSimulateAPI(res.record, res.index - 1)}
                                  style={{ padding: '2px 6px', background: 'none', border: '1px solid var(--border-subtle)', borderRadius: '4px', cursor: 'pointer', fontSize: '10px' }}
                                >
                                  Xem
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {apiSimStatus === 'idle' && !batchSummary ? (
                <div className="flex flex-col align-center justify-center gap-sm" style={{ padding: '40px 20px', color: 'var(--text-muted)', border: '1px dashed var(--border-subtle)', borderRadius: '8px' }}>
                  <Zap size={28} style={{ color: 'rgba(0,0,0,0.1)' }} />
                  <p style={{ fontSize: '13px', textAlign: 'center' }}>
                    Chọn một ca test bất kỳ trong bảng xem trước và bấm <b>"⚡ Test API"</b> để gửi payload giả lập kiểm thử.
                  </p>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px' }}>
                  {/* Cột trái: Payload được gửi lên */}
                  <div className="flex flex-col gap-sm" style={{ minWidth: 0 }}>
                    <span style={{ fontSize: '12.5px', fontWeight: 'bold', color: 'var(--text-secondary)', wordBreak: 'break-word' }}>
                      📥 HTTP Request Payload (POST /api/v1/submit)
                    </span>
                    <pre 
                      style={{ 
                        background: '#f8fafc', 
                        border: '1px solid var(--border-subtle)',
                        padding: '12px', 
                        borderRadius: '8px', 
                        fontSize: '11px', 
                        fontFamily: 'var(--font-mono)', 
                        color: 'var(--text-primary)', 
                        overflow: 'auto',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-all',
                        maxHeight: '180px',
                        margin: 0
                      }}
                    >
                      {(() => {
                        if (!selectedRecord) return '{}';
                        
                        let businessData: Record<string, any> = {};

                        if (parsedSchema && parsedSchema.length > 0) {
                          // Cách 1: Sử dụng schema chính thức nếu có
                          const schemaFields = (parsedSchema as any[]).map(f => f.name);
                          schemaFields.forEach(fieldName => {
                            if (selectedRecord[fieldName] !== undefined) {
                              businessData[fieldName] = selectedRecord[fieldName];
                            }
                          });
                        } 
                        
                        // Cách 2: Nếu schema trống (do refresh trang hoặc load history), tự lọc bỏ metadata
                        if (Object.keys(businessData).length === 0) {
                          const metadataKeys = [
                            'id', 'fitness', 'origin', 'generation', 'ma_action', 
                            'parent_ids', 'local_search_applied', 'improvement', 
                            'coverage', 'test_type', 'test_subtype', 'expectedResult',
                            'fitness_before_ls', 'fitness_after_ls', 'ls_gain'
                          ];
                          
                          Object.keys(selectedRecord).forEach(key => {
                            // Bỏ qua các trường bắt đầu bằng gạch dưới hoặc nằm trong danh sách metadata
                            if (!key.startsWith('_') && !metadataKeys.includes(key)) {
                              businessData[key] = selectedRecord[key];
                            }
                          });
                        }
                        
                        return JSON.stringify(businessData, null, 2);
                      })()}
                    </pre>
                  </div>

                  {/* Cột phải: Response trả về */}
                  <div className="flex flex-col gap-sm" style={{ minWidth: 0 }}>
                    <div className="flex justify-between align-center" style={{ flexWrap: 'wrap', gap: '8px' }}>
                      <span style={{ fontSize: '12.5px', fontWeight: 'bold', color: 'var(--text-secondary)', wordBreak: 'break-word' }}>
                        📤 HTTP Response Status:
                      </span>
                      {apiSimStatus !== 'loading' && apiSimStatus !== 'idle' && (
                        <span 
                          style={{ 
                            padding: '2px 8px', 
                            borderRadius: '4px', 
                            fontSize: '11px', 
                            fontWeight: 'bold',
                            whiteSpace: 'nowrap',
                            background: 
                              apiSimStatus === 'success' ? 'rgba(13, 148, 136, 0.15)' : 
                              apiSimStatus === 'validation_error' ? 'rgba(124, 58, 237, 0.15)' : 
                              'rgba(225, 29, 72, 0.15)',
                            color: 
                              apiSimStatus === 'success' ? 'var(--color-teal)' : 
                              apiSimStatus === 'validation_error' ? 'var(--color-violet)' : 
                              'var(--color-rose)'
                          }}
                        >
                          HTTP {apiSimDetails?.status} {apiSimDetails?.statusText}
                        </span>
                      )}
                    </div>

                    {apiSimStatus === 'loading' ? (
                      <div className="flex align-center justify-center" style={{ flex: 1, minHeight: '120px', background: 'rgba(0,0,0,0.02)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                        <div className="flex flex-col align-center gap-sm">
                          <div style={{ width: '24px', height: '24px', border: '2px solid rgba(0,0,0,0.1)', borderTopColor: 'var(--color-teal)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Đang kiểm duyệt qua WAF &amp; Sandbox API...</span>
                        </div>
                      </div>
                    ) : (
                      <div style={{ position: 'relative', minWidth: 0 }}>
                        <pre 
                          style={{ 
                            background: '#f8fafc', 
                            border: '1px solid',
                            borderColor: 
                              apiSimStatus === 'success' ? 'rgba(13, 148, 136, 0.15)' : 
                              apiSimStatus === 'validation_error' ? 'rgba(124, 58, 237, 0.15)' : 
                              apiSimStatus === 'idle' ? 'var(--border-subtle)' :
                              'rgba(225, 29, 72, 0.2)',
                            padding: '12px', 
                            borderRadius: '8px', 
                            fontSize: '11px', 
                            fontFamily: 'var(--font-mono)', 
                            color: 
                              apiSimStatus === 'success' ? 'var(--color-teal)' : 
                              apiSimStatus === 'validation_error' ? 'var(--color-violet)' : 
                              apiSimStatus === 'idle' ? 'var(--text-muted)' :
                              'var(--color-rose)', 
                            overflow: 'auto',
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-all',
                            maxHeight: '180px',
                            margin: 0
                          }}
                        >
                          {apiSimStatus === 'idle' ? '// Chưa có dữ liệu phản hồi' : JSON.stringify(apiSimDetails, null, 2)}
                        </pre>
                        
                        {/* Cảnh báo WAF nhấp nháy đỏ cực ngầu */}
                        {apiSimStatus === 'waf_blocked' && (
                          <div 
                            style={{ 
                              marginTop: '8px',
                              padding: '8px 12px',
                              background: 'rgba(225, 29, 72, 0.1)',
                              border: '1px solid var(--color-rose)',
                              borderRadius: '6px',
                              fontSize: '11px',
                              color: 'var(--color-rose)',
                              animation: 'pulse 2s infinite',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px'
                            }}
                          >
                            <ShieldAlert size={14} />
                            <span><b>HỆ THỐNG AN NINH CHẶN GIAO DỊCH:</b> Tường lửa WAF đã khóa địa chỉ IP do hành vi injection.</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
      
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};
