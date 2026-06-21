import React, { useState } from 'react';
import { Download, FileSpreadsheet, FileJson, History, Database, Trash2, ShieldAlert, Zap, Terminal, Code, FileCode, Copy, X, Check } from 'lucide-react';
import { OptimizationResultTables } from './OptimizationResultTables';
import { ApiSimulator } from './ApiSimulator';
import { useAppStore } from '../store/useAppStore';
import type { TestCase, OptimizationSnapshot } from '../types/testcase';
import { toast } from '../store/useToastStore';
import * as XLSX from 'xlsx';

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

  const dataset = optimizedDataset?.finalResult || [];

  const [copied, setCopied] = useState(false);
  const [previewCode, setPreviewCode] = useState<{
    title: string;
    filename: string;
    content: string;
    language: string;
  } | null>(null);
  const [codeCopied, setCodeCopied] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [showApiSandbox, setShowApiSandbox] = useState(false);

  const downloadFile = (content: string, filename: string, contentType: string) => {
    const blob = new Blob([content], { type: contentType });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    
    URL.revokeObjectURL(url);
  };

  const handleExportCSV = () => {
    if (dataset.length === 0) {
      toast.error('Chưa có dữ liệu để xuất.');
      return;
    }
    const safeSchemaName = schemaName.toLowerCase().replace(/[^a-z0-9]/g, '_');
    
    // Determine columns
    const dataFields = dataset.length > 0 ? Object.keys(dataset[0].values || {}) : [];
    const metaFields = ["tcId", "scenario", "expectedResult", "errorDescription", "rationale", "categories", "origin", "finalFitness"];
    const headers = [...metaFields, ...dataFields];
    
    const csvRows = [headers.join(",")];
    
    dataset.forEach((tc) => {
      const rowValues = headers.map((header) => {
         let val = "";
         if (metaFields.includes(header)) {
           const rawVal = (tc as any)[header];
           if (header === "categories" && Array.isArray(rawVal)) {
             val = rawVal.join("; ");
           } else {
             val = rawVal !== undefined ? String(rawVal) : "";
           }
         } else {
           const rawVal = tc.values ? tc.values[header] : "";
           val = rawVal !== undefined ? String(rawVal) : "";
         }
         const escaped = val.replace(/"/g, '""');
         return escaped.includes(",") || escaped.includes("\n") || escaped.includes('"')
           ? `"${escaped}"`
           : escaped;
      });
      csvRows.push(rowValues.join(","));
    });
    
    const csvContent = csvRows.join('\n');
    downloadFile(
      csvContent, 
      `${safeSchemaName}_dataset.csv`, 
      'text/csv;charset=utf-8;'
    );
    toast.success('Đã xuất file CSV thành công!');
  };

  const handleExportExcel = () => {
    if (dataset.length === 0) {
      toast.error('Chưa có dữ liệu để xuất.');
      return;
    }
    try {
      const wb = XLSX.utils.book_new();
      
      const dataFields = Object.keys(dataset[0].values || {});
      const flattenedData = dataset.map((tc) => {
        const flatRow: Record<string, any> = {
          "Mã test data": tc.tcId,
          "Kịch bản": tc.scenario,
          "Kết quả mong đợi": tc.expectedResult,
          "Mô tả lỗi": tc.errorDescription,
          "Lý do sinh TC": tc.rationale || "",
          "Phân loại": (tc.categories || []).join(", "),
          "Origin": tc.origin,
          "Fitness Final": (tc.finalFitness / 100).toFixed(3),
        };
        dataFields.forEach((field) => {
          flatRow[field] = tc.values ? tc.values[field] : "";
        });
        return flatRow;
      });
      
      const wsData = XLSX.utils.json_to_sheet(flattenedData);
      XLSX.utils.book_append_sheet(wb, wsData, "Test Cases");
      
      if (optimizedDataset?.comparisonData && optimizedDataset.comparisonData.length > 0) {
        const compData = optimizedDataset.comparisonData.map((d) => {
          return {
            "Mã test data": d.tcId,
            "Fitness LLM": ((d.llm?.llmFitness ?? 0) / 100).toFixed(3),
            "Fitness GA": ((d.ga?.gaFitness ?? 0) / 100).toFixed(3),
            "Fitness HC": ((d.hc?.hcFitness ?? 0) / 100).toFixed(3),
            "Fitness Final": ((d.final?.finalFitness ?? 0) / 100).toFixed(3),
            "Origin": d.final?.origin,
            "Số lượng thay đổi": d.changes ? d.changes.length : 0,
          };
        });
        const wsComp = XLSX.utils.json_to_sheet(compData);
        XLSX.utils.book_append_sheet(wb, wsComp, "So sánh Tiến hóa");
      }
      
      const safeSchemaName = schemaName.toLowerCase().replace(/[^a-z0-9]/g, '_');
      XLSX.writeFile(wb, `${safeSchemaName}_dataset.xlsx`);
      toast.success('Đã xuất file Excel thành công!');
    } catch (e: any) {
      toast.error(`Lỗi khi xuất Excel: ${e.message}`);
    }
  };

  const handleExportJSON = () => {
    if (dataset.length === 0) {
      toast.error('Chưa có dữ liệu để xuất.');
      return;
    }
    const safeSchemaName = schemaName.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const jsonContent = JSON.stringify(dataset, null, 2);
    
    setPreviewCode({
      title: 'JSON Dataset Preview',
      filename: `${safeSchemaName}_dataset.json`,
      content: jsonContent,
      language: 'json'
    });
  };

  const handleCopyClipboard = () => {
    if (dataset.length === 0) return;
    
    const jsonContent = JSON.stringify(dataset, null, 2);
    navigator.clipboard.writeText(jsonContent).then(() => {
      setCopied(true);
      toast.success('Đã sao chép mảng JSON vào Clipboard!');
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleExportPlaywright = () => {
    if (dataset.length === 0) return;
    const safeSchemaName = schemaName.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const dataFields = Object.keys(dataset[0]?.values || {});

    const scriptContent = `import { test, expect } from '@playwright/test';

/**
 * Playwright Automation Suite - Generated by Hyperion TestForge
 * Target Business Flow: ${schemaName}
 * Total Test Cases: ${dataset.length}
 */
test.describe('${schemaName} Automation Form Tests', () => {
  const testCases = ${JSON.stringify(dataset, null, 2)};

  testCases.forEach((data, index) => {
    test(\`Test Case \${data.tcId} - \${data.scenario}\`, async ({ page }) => {
      // Step 1: Navigate to the target submission form
      await page.goto('https://your-app-domain.com/form-endpoint');
      
      // Step 2: Populate form fields with optimized data
      ${dataFields.map(field => `
      if (data.values.${field} !== undefined) {
        await page.fill('input[name="${field}"], #${field}', String(data.values.${field}));
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

  const handleExportCypress = () => {
    if (dataset.length === 0) return;
    const safeSchemaName = schemaName.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const dataFields = Object.keys(dataset[0]?.values || {});

    const scriptContent = `/**
 * Cypress Automation Suite - Generated by Hyperion TestForge
 * Target Business Flow: ${schemaName}
 * Total Test Cases: ${dataset.length}
 */
describe('${schemaName} Automation Form Tests', () => {
  const testCases = ${JSON.stringify(dataset, null, 2)};

  testCases.forEach((data, index) => {
    it(\`Test Case \${data.tcId} - \${data.scenario}\`, () => {
      // Step 1: Navigate to the target submission form
      cy.visit('/form-endpoint');
      
      // Step 2: Populate form fields with optimized data
      ${dataFields.map(field => `
      if (data.values.${field} !== undefined) {
        cy.get('input[name="${field}"], #${field}').clear().type(String(data.values.${field}));
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

  const handleExportSQL = () => {
    if (dataset.length === 0) return;
    const safeSchemaName = schemaName.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const tableName = safeSchemaName.substring(0, 30) || 'test_data';
    const dataFields = Object.keys(dataset[0]?.values || {});
    const metaFields = ['tcId', 'scenario', 'expectedResult'];
    const fields = [...metaFields, ...dataFields];

    const escapeSQL = (val: any): string => {
      if (val === null || val === undefined) return 'NULL';
      if (typeof val === 'number') return String(val);
      const str = String(val).replace(/'/g, "''").replace(/\\/g, '\\\\');
      return `'${str}'`;
    };

    const columns = fields.join(', ');
    const values = dataset.map((row: TestCase) =>
      `(${fields.map(f => escapeSQL(metaFields.includes(f) ? (row as any)[f] : row.values[f])).join(', ')})`
    ).join(',\n');

    const sqlContent = `-- Generated by Hyperion TestForge
-- Schema: ${schemaName}
-- Records: ${dataset.length}
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

  const handleExportPostman = () => {
    if (dataset.length === 0) return;
    const safeSchemaName = schemaName.toLowerCase().replace(/[^a-z0-9]/g, '_');

    const items = dataset.slice(0, 50).map((row: TestCase, idx: number) => ({
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

  return (
    <div className="flex flex-col gap-lg" style={{ marginTop: '16px', width: '100%', gap: '24px' }}>
      
      {/* SECTION 1: RUN HISTORY TABLE */}
      <div className="glass-card teal-border" style={{ background: 'var(--bg-card)', padding: '20px', borderRadius: '12px' }}>
        <div className="flex justify-between align-center" style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: '12px', marginBottom: '16px' }}>
          <div className="flex align-center gap-sm">
            <History className="text-teal" size={22} style={{ color: 'var(--color-teal)' }} />
            <h2 style={{ fontSize: '16px', fontWeight: 'bold', color: 'var(--text-primary)', margin: 0 }}>LỊCH SỬ CÁC PHIÊN CHẠY TỐI ƯU (RUN HISTORY)</h2>
          </div>
          {historyRuns.length > 0 && onClearHistory && (
            <button 
              onClick={onClearHistory}
              className="btn btn-secondary flex align-center gap-xs" 
              style={{ padding: '6px 12px', fontSize: '12px', color: 'var(--color-rose)', borderColor: 'rgba(225, 29, 72, 0.1)', background: 'rgba(225, 29, 72, 0.02)' }}
            >
              <Trash2 size={14} /> Xóa sạch lịch sử
            </button>
          )}
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
                <th style={{ padding: '10px 8px', fontWeight: 'bold' }}>Run ID</th>
                <th style={{ padding: '10px 8px', fontWeight: 'bold' }}>Đặc tả</th>
                <th style={{ padding: '10px 8px', fontWeight: 'bold' }}>Thời gian</th>
                <th style={{ padding: '10px 8px', fontWeight: 'bold', textAlign: 'center' }}>Tổng TC</th>
                <th style={{ padding: '10px 8px', fontWeight: 'bold', textAlign: 'center' }}>Improved</th>
                <th style={{ padding: '10px 8px', fontWeight: 'bold', textAlign: 'center' }}>Fallback</th>
                <th style={{ padding: '10px 8px', fontWeight: 'bold', textAlign: 'right' }}>Avg Fitness</th>
                <th style={{ padding: '10px 8px', fontWeight: 'bold', textAlign: 'right' }}>Best Fitness</th>
                <th style={{ padding: '10px 8px', fontWeight: 'bold', textAlign: 'right' }}>Worst Fitness</th>
                <th style={{ padding: '10px 8px', fontWeight: 'bold', textAlign: 'center' }}>Hành động</th>
              </tr>
            </thead>
            <tbody>
              {historyRuns.length === 0 ? (
                <tr>
                  <td colSpan={10} style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    Chưa có lượt chạy tối ưu nào được ghi nhận. Hãy thiết lập đặc tả và chạy tối ưu hóa.
                  </td>
                </tr>
              ) : (
                historyRuns.map((run: any, idx: number) => {
                  const snap = run.snapshot;
                  const runIdStr = snap?.runId ? (snap.runId.length > 8 ? snap.runId.slice(0, 8) : snap.runId) : `RUN-${String(idx+1).padStart(3, '0')}`;
                  const specName = snap?.specificationName || run.schemaName || '-';
                  const timestampStr = snap?.createdAt ? new Date(snap.createdAt).toLocaleString() : run.timestamp;
                  const totalTc = snap?.summary?.total ?? run.size ?? 0;
                  const improvedCount = snap?.summary?.improved ?? '-';
                  const fallbackCount = snap?.summary?.fallback ?? '-';

                  let avgF = 0;
                  let bestF = 0;
                  let worstF = 0;
                  
                  if (snap?.finalResult && snap.finalResult.length > 0) {
                    const fits = snap.finalResult.map((tc: any) => tc.finalFitness ?? 0);
                    avgF = fits.reduce((a: number, b: number) => a + b, 0) / fits.length;
                    bestF = Math.max(...fits);
                    worstF = Math.min(...fits);
                  } else {
                    avgF = (run.bestFitness ?? 0) * 100;
                    bestF = (run.bestFitness ?? 0) * 100;
                    worstF = (run.bestFitness ?? 0) * 100;
                  }

                  const isCurrent = optimizedDataset?.runId === snap?.runId;

                  return (
                    <tr 
                      key={idx} 
                      style={{ 
                        borderBottom: '1px solid var(--border-subtle)',
                        background: isCurrent ? 'rgba(13, 148, 136, 0.04)' : 'transparent',
                        fontWeight: isCurrent ? '500' : 'normal'
                      }}
                    >
                      <td style={{ padding: '12px 8px', fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-teal)', fontWeight: 'bold' }}>
                        {runIdStr}
                      </td>
                      <td style={{ padding: '12px 8px', color: 'var(--text-primary)' }}>{specName}</td>
                      <td style={{ padding: '12px 8px', color: 'var(--text-secondary)', fontSize: '11.5px' }}>{timestampStr}</td>
                      <td style={{ padding: '12px 8px', textAlign: 'center', fontFamily: 'var(--font-mono)' }}>{totalTc}</td>
                      <td style={{ padding: '12px 8px', textAlign: 'center', color: 'var(--color-rose)', fontWeight: 'bold' }}>{improvedCount}</td>
                      <td style={{ padding: '12px 8px', textAlign: 'center', color: '#f59e0b', fontWeight: 'bold' }}>{fallbackCount}</td>
                      <td style={{ padding: '12px 8px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                        {(avgF / 100).toFixed(3)}
                      </td>
                      <td style={{ padding: '12px 8px', textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--color-rose)', fontWeight: 'bold' }}>
                        {(bestF / 100).toFixed(3)}
                      </td>
                      <td style={{ padding: '12px 8px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                        {(worstF / 100).toFixed(3)}
                      </td>
                      <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                        <button 
                          onClick={() => onLoadPastRun(snap)}
                          className="btn btn-secondary" 
                          style={{ 
                            padding: '4px 8px', 
                            fontSize: '11.5px', 
                            fontWeight: 'bold', 
                            borderColor: isCurrent ? 'var(--color-teal)' : 'var(--border-subtle)', 
                            color: isCurrent ? 'var(--color-teal)' : 'var(--text-secondary)', 
                            background: isCurrent ? 'rgba(13, 148, 136, 0.08)' : 'transparent',
                            cursor: 'pointer'
                          }}
                        >
                          {isCurrent ? 'Đang chọn' : 'Nạp lại'}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* SECTION 2: EXPORT WORKSPACE */}
      <div className="glass-card flex flex-col gap-md teal-border" style={{ background: 'var(--bg-card)', minWidth: 0 }}>
        <div className="flex align-center gap-sm" style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: '10px' }}>
          <Download className="text-teal" size={22} style={{ color: 'var(--color-teal)' }} />
          <h2 style={{ fontSize: '16px', fontWeight: 'bold', color: 'var(--text-primary)', letterSpacing: '0.03em' }}>TRUNG TÂM XUẤT DỮ LIỆU (EXPORT CENTER)</h2>
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
            <span>Kịch bản hiện tại: <strong style={{ color: 'var(--color-teal)' }}>{selectedSuiteName}</strong></span>
          </div>
        )}

        <p style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: '1.5' }}>
          Tải xuống trực tiếp tập ca kiểm thử tối ưu hóa đã sinh dưới định dạng CSV/Excel hoặc JSON để đưa trực tiếp vào các công cụ tự động hóa như Selenium, Playwright, Postman.
        </p>

        {dataset.length > 0 ? (
          <div style={{ width: '100%', marginTop: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
              
              {/* NHÓM 1: DỮ LIỆU THÔ */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
                  📊 Dữ Liệu Thô
                </div>
                <button 
                  onClick={handleExportCSV}
                  className="btn btn-secondary" 
                  style={{ fontSize: '12px', padding: '8px', justifyContent: 'flex-start', display: 'flex', alignItems: 'center', gap: '6px', width: '100%', background: 'rgba(0,0,0,0.02)' }}
                >
                  <FileSpreadsheet size={14} style={{ color: 'var(--color-teal)' }} /> Xuất CSV
                </button>
                <button 
                  onClick={handleExportExcel}
                  className="btn btn-secondary" 
                  style={{ fontSize: '12px', padding: '8px', justifyContent: 'flex-start', display: 'flex', alignItems: 'center', gap: '6px', width: '100%', background: 'rgba(16, 185, 129, 0.08)' }}
                >
                  <FileSpreadsheet size={14} style={{ color: '#10b981' }} /> Xuất Excel
                </button>
                <button 
                  onClick={handleExportJSON}
                  className="btn btn-secondary" 
                  style={{ fontSize: '12px', padding: '8px', justifyContent: 'flex-start', display: 'flex', alignItems: 'center', gap: '6px', width: '100%', background: 'rgba(0,0,0,0.02)' }}
                >
                  <FileJson size={14} style={{ color: 'var(--color-teal)' }} /> Tải File JSON
                </button>
              </div>

              {/* NHÓM 2: SCRIPTS AUTOMATION */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
                  🤖 Code Tự Động Hóa
                </div>
                <button 
                  onClick={handleExportPlaywright}
                  className="btn btn-secondary" 
                  style={{ fontSize: '12px', padding: '8px', justifyContent: 'flex-start', display: 'flex', alignItems: 'center', gap: '6px', width: '100%', background: 'rgba(0,0,0,0.02)' }}
                >
                  <Terminal size={14} style={{ color: 'var(--color-teal)' }} /> Playwright Spec
                </button>
                <button 
                  onClick={handleExportCypress}
                  className="btn btn-secondary" 
                  style={{ fontSize: '12px', padding: '8px', justifyContent: 'flex-start', display: 'flex', alignItems: 'center', gap: '6px', width: '100%', background: 'rgba(0,0,0,0.02)' }}
                >
                  <Code size={14} style={{ color: 'var(--color-violet)' }} /> Cypress Spec
                </button>
              </div>

              {/* NHÓM 3: DB & INTEGRATIONS */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
                  🌐 Database & API
                </div>
                <button 
                  onClick={handleExportSQL}
                  className="btn btn-secondary" 
                  style={{ fontSize: '12px', padding: '8px', justifyContent: 'flex-start', display: 'flex', alignItems: 'center', gap: '6px', width: '100%', background: 'rgba(0,0,0,0.02)' }}
                >
                  <Database size={14} style={{ color: 'var(--color-yellow)' }} /> SQL Script
                </button>
                <button 
                  onClick={handleExportPostman}
                  className="btn btn-secondary" 
                  style={{ fontSize: '12px', padding: '8px', justifyContent: 'flex-start', display: 'flex', alignItems: 'center', gap: '6px', width: '100%', background: 'rgba(0,0,0,0.02)' }}
                >
                  <FileCode size={14} style={{ color: 'var(--color-rose)' }} /> Postman
                </button>
              </div>

              {/* NHÓM 4: THAO TÁC NHANH */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
                  ⚡ Thao Tác Nhanh
                </div>
                <button 
                  onClick={handleCopyClipboard}
                  className="btn btn-primary" 
                  style={{ 
                    fontSize: '13px', 
                    padding: '10px 12px', 
                    background: copied ? 'var(--color-teal)' : 'var(--color-violet)',
                    border: 'none',
                    color: '#fff',
                    fontWeight: 'bold',
                    width: '100%',
                    justifyContent: 'center',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                  }}
                >
                  <Check size={16} style={{ display: copied ? 'inline-block' : 'none' }} />
                  <Copy size={16} style={{ display: copied ? 'none' : 'inline-block' }} />
                  {copied ? 'Đã copy JSON!' : 'Copy nhanh JSON'}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex align-center gap-sm" style={{ padding: '24px', background: 'rgba(0,0,0,0.01)', border: '1px dashed var(--border-subtle)', borderRadius: 'var(--radius-md)', color: 'var(--text-muted)', fontSize: '13px', justifyContent: 'center', textAlign: 'center', flexDirection: 'column' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(0,0,0,0.03)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '8px' }}>
              <Download size={20} style={{ opacity: 0.5 }} />
            </div>
            <span>Hãy chạy tối ưu hóa ở Tab "Tối Ưu Hóa Bộ Test" để xuất dữ liệu.</span>
          </div>
        )}
      </div>
 
      {/* SECTION 3: PREVIEW CODE OR TEST CASES */}
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
              {dataset.length > 0 && (
                <span style={{ fontSize: '11px', background: 'rgba(124, 58, 237, 0.1)', color: 'var(--color-violet)', padding: '2px 8px', borderRadius: '12px', fontWeight: 'bold' }}>
                  Tổng cộng: {dataset.length} ca test
                </span>
              )}
            </div>

            {selectedSuiteName && (
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px', marginBottom: '8px', paddingLeft: '28px' }}>
                Đang xem bộ test sinh bởi: <strong style={{ color: 'var(--color-violet)' }}>{selectedSuiteName}</strong>
              </div>
            )}

            {dataset.length > 0 ? (
              <div className="flex flex-col gap-md" style={{ flex: 1 }}>
                <OptimizationResultTables snapshot={optimizedDataset as OptimizationSnapshot} schema={parsedSchema as any[]} />
                
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

      {/* SECTION 4: LIVE API VALIDATION & BATCH RUN */}
      {dataset.length > 0 && (
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
              <ApiSimulator />
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
