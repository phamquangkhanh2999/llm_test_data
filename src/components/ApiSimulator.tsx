import React, { useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { Server, Play, Zap, CheckCircle2, Table } from 'lucide-react';
import { toast } from '../store/useToastStore';

export interface FieldDiff {
  path: string;
  expected: any;
  actual: any;
  match: boolean;
}

export interface DiffResult {
  status: 'PASS' | 'FAIL' | 'PARTIAL';
  httpStatusMatch: boolean;
  expectedHttpStatus: number;
  actualHttpStatus: number;
  fieldDiffs: FieldDiff[];
  passCount: number;
  failCount: number;
}

// Helper recursive compare for JSON bodies
const diffEngineCompare = (expected: any, actual: any, path: string = ''): FieldDiff[] => {
  let diffs: FieldDiff[] = [];

  if (expected === null || expected === undefined) {
    return diffs;
  }

  if (typeof expected === 'object' && !Array.isArray(expected)) {
    if (typeof actual !== 'object' || actual === null || Array.isArray(actual)) {
      diffs.push({ path: path || 'root', expected: 'Object', actual: typeof actual, match: false });
      return diffs;
    }
    for (const key of Object.keys(expected)) {
      const newPath = path ? `${path}.${key}` : key;
      diffs = diffs.concat(diffEngineCompare(expected[key], actual[key], newPath));
    }
  } else if (Array.isArray(expected)) {
    if (!Array.isArray(actual)) {
      diffs.push({ path: path || 'root', expected: 'Array', actual: typeof actual, match: false });
      return diffs;
    }
    for (let i = 0; i < expected.length; i++) {
      const newPath = `${path}[${i}]`;
      diffs = diffs.concat(diffEngineCompare(expected[i], actual[i], newPath));
    }
  } else {
    if (expected === '(any)' || expected === '*') {
      diffs.push({ path: path || 'root', expected, actual, match: true });
    } else {
      const match = String(expected) === String(actual);
      diffs.push({ path: path || 'root', expected, actual, match });
    }
  }

  return diffs;
};

export const ApiSimulator: React.FC = () => {
  const { optimizedDataset } = useAppStore();
  const [selectedTcId, setSelectedTcId] = useState<string>('');
  const [url, setUrl] = useState<string>('https://jsonplaceholder.typicode.com/posts');
  const [method, setMethod] = useState<'GET' | 'POST' | 'PUT' | 'DELETE'>('POST');
  const [headersStr, setHeadersStr] = useState<string>('{\n  "Content-Type": "application/json"\n}');
  const [expectedStatus, setExpectedStatus] = useState<number>(201);
  const [expectedBodyStr, setExpectedBodyStr] = useState<string>('{\n  "id": "(any)"\n}');
  
  const [isLoading, setIsLoading] = useState(false);
  const [diffResult, setDiffResult] = useState<DiffResult | null>(null);
  const [rawResponse, setRawResponse] = useState<any>(null);

  const dataset = optimizedDataset?.finalResult || [];
  const selectedTestCase = dataset.find(tc => tc.tcId === selectedTcId);
  
  // Map Request variables dynamically based on method
  const requestBodyStr = selectedTestCase && (method === 'POST' || method === 'PUT') 
    ? JSON.stringify(selectedTestCase.values, null, 2) 
    : '{}';

  const queryParams = selectedTestCase && (method === 'GET' || method === 'DELETE')
    ? selectedTestCase.values
    : null;

  const getFinalUrl = () => {
    if (!url) return '';
    if (queryParams) {
      const params = new URLSearchParams();
      Object.entries(queryParams).forEach(([k, v]) => {
        params.append(k, String(v));
      });
      const qs = params.toString();
      return qs ? `${url}?${qs}` : url;
    }
    return url;
  };

  const getResponseMsg = (body: any): string => {
    if (!body) return '-';
    if (typeof body === 'string') return body;
    if (typeof body === 'object') {
      return body.message || body.error || body.detail || body.msg || body.reason || JSON.stringify(body);
    }
    return String(body);
  };

  const handleTestAPI = async () => {
    if (!url) {
      toast.error('Vui lòng nhập URL API');
      return;
    }

    let parsedHeaders = {};
    try {
      parsedHeaders = JSON.parse(headersStr);
    } catch (e) {
      toast.error('Headers phải là một JSON object hợp lệ');
      return;
    }

    let expectedBody = {};
    try {
      if (expectedBodyStr.trim()) {
        expectedBody = JSON.parse(expectedBodyStr);
      }
    } catch (e) {
      toast.error('Expected Body phải là một JSON object hợp lệ');
      return;
    }

    setIsLoading(true);
    setDiffResult(null);
    setRawResponse(null);

    const finalUrl = getFinalUrl();

    try {
      const fetchOptions: RequestInit = {
        method,
        headers: parsedHeaders,
      };

      if (method === 'POST' || method === 'PUT') {
        fetchOptions.body = requestBodyStr;
      }

      const res = await fetch(finalUrl, fetchOptions);
      const actualStatus = res.status;
      let actualBody: any = null;
      
      const textResponse = await res.text();
      try {
        actualBody = JSON.parse(textResponse);
      } catch (e) {
        actualBody = textResponse;
      }

      setRawResponse(actualBody);

      const fieldDiffs = diffEngineCompare(expectedBody, actualBody);
      const httpMatch = actualStatus === expectedStatus;
      
      let passCount = 0;
      let failCount = 0;
      fieldDiffs.forEach(d => d.match ? passCount++ : failCount++);

      let status: DiffResult['status'] = 'PASS';
      if (!httpMatch || failCount > 0) {
        status = 'FAIL';
      }
      if (httpMatch && failCount > 0 && passCount > 0) {
        status = 'PARTIAL';
      }

      setDiffResult({
        status,
        httpStatusMatch: httpMatch,
        expectedHttpStatus: expectedStatus,
        actualHttpStatus: actualStatus,
        fieldDiffs,
        passCount,
        failCount
      });
      
      toast.success('Gọi API và đối chiếu kết quả thành công!');

    } catch (error: any) {
      toast.error(`Lỗi khi gọi API: ${error.message}`);
      setDiffResult({
        status: 'FAIL',
        httpStatusMatch: false,
        expectedHttpStatus: expectedStatus,
        actualHttpStatus: 0,
        fieldDiffs: [],
        passCount: 0,
        failCount: 1
      });
      setRawResponse({ error: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  // Build the comparison table rows for validation summary
  const getValidationRows = () => {
    if (!diffResult) return [];
    
    const rows = [];
    
    // 1. Status Row
    rows.push({
      field: 'HTTP Status',
      expected: String(diffResult.expectedHttpStatus),
      actual: String(diffResult.actualHttpStatus),
      status: diffResult.httpStatusMatch ? 'PASS' : 'FAIL'
    });

    // 2. Expected Result Row
    if (selectedTestCase) {
      const isErrorExpected = (selectedTestCase.expectedResult || '').toLowerCase().includes('lỗi') || 
                              (selectedTestCase.expectedResult || '').toLowerCase().includes('chặn') || 
                              (selectedTestCase.expectedResult || '').toLowerCase().includes('error') ||
                              (selectedTestCase.expectedResult || '').toLowerCase().includes('invalid');
      const isActualError = diffResult.actualHttpStatus >= 400;
      const actualMsg = getResponseMsg(rawResponse);
      
      rows.push({
        field: 'Expected Behavior',
        expected: selectedTestCase.expectedResult || 'Hợp lệ',
        actual: isActualError ? `Error (Msg: ${actualMsg})` : `Success (Msg: ${actualMsg})`,
        status: (isErrorExpected === isActualError) ? 'PASS' : 'FAIL'
      });
    }

    // 3. Body fields Row
    diffResult.fieldDiffs.forEach(diff => {
      rows.push({
        field: `Body.${diff.path}`,
        expected: String(diff.expected),
        actual: String(diff.actual),
        status: diff.match ? 'PASS' : 'FAIL'
      });
    });

    return rows;
  };

  const validationRows = getValidationRows();

  return (
    <div className="glass-card flex flex-col gap-md" style={{ background: 'var(--bg-card)', padding: '24px', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
      <div className="flex align-center gap-sm" style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: '12px', marginBottom: '12px' }}>
        <Server className="text-teal" size={24} style={{ color: 'var(--color-teal)' }} />
        <h2 style={{ fontSize: '18px', fontWeight: 'bold', margin: 0, color: 'var(--text-primary)' }}>
          API Simulator &amp; Live Expected Validation
        </h2>
        <span style={{ marginLeft: 'auto', fontSize: '12px', padding: '4px 8px', background: 'var(--color-violet)', color: '#fff', borderRadius: '4px', fontWeight: 'bold' }}>
          Real-time Sandbox
        </span>
      </div>

      <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
        Tự động nạp dữ liệu từ mảng <code>finalResult[]</code>, tự động chuyển đổi giữa Query Params (GET/DELETE) và Request Body (POST/PUT), rồi so sánh đối chiếu Expected Response vs Actual Response.
      </p>

      <div className="grid-2" style={{ gap: '24px' }}>
        {/* PANEL TRÁI: CẤU HÌNH REQUEST */}
        <div className="flex flex-col gap-sm">
          <div style={{ fontWeight: 'bold', fontSize: '13px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Zap size={16} style={{ color: 'var(--color-yellow)' }} /> Cấu Hình Request
          </div>

          <div>
            <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Test Case Đầu Vào (finalResult)</label>
            <select className="input-field" value={selectedTcId} onChange={(e) => setSelectedTcId(e.target.value)} style={{ padding: '8px', borderRadius: '4px', border: '1px solid var(--border-subtle)', width: '100%' }}>
              <option value="">-- Chọn Test Case --</option>
              {dataset.map(tc => (
                <option key={tc.tcId} value={tc.tcId}>{tc.tcId} - {tc.scenario || 'No scenario'}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <div style={{ width: '100px' }}>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Method</label>
              <select className="input-field" value={method} onChange={e => setMethod(e.target.value as any)} style={{ width: '100%', padding: '8px' }}>
                <option value="GET">GET</option>
                <option value="POST">POST</option>
                <option value="PUT">PUT</option>
                <option value="DELETE">DELETE</option>
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Base URL Endpoint</label>
              <input type="text" className="input-field" value={url} onChange={e => setUrl(e.target.value)} style={{ width: '100%', padding: '8px', fontFamily: 'var(--font-mono)', fontSize: '13px' }} placeholder="https://api.example.com/v1/users" />
            </div>
          </div>

          <div>
            <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Headers (JSON)</label>
            <textarea 
              className="input-field" 
              value={headersStr} 
              onChange={e => setHeadersStr(e.target.value)}
              style={{ width: '100%', padding: '8px', fontFamily: 'var(--font-mono)', fontSize: '12px', minHeight: '60px', resize: 'vertical' }}
            />
          </div>

          {queryParams ? (
            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Query Parameters (GET/DELETE Variables)</label>
              <div style={{ background: 'rgba(0,0,0,0.02)', padding: '8px 12px', borderRadius: '4px', fontFamily: 'var(--font-mono)', fontSize: '11.5px', border: '1px solid var(--border-subtle)' }}>
                {Object.entries(queryParams).map(([k, v]) => (
                  <div key={k} style={{ marginBottom: '2px' }}>
                    <span style={{ color: 'var(--color-teal)' }}>{k}</span> = <span style={{ color: 'var(--text-primary)' }}>{String(v)}</span>
                  </div>
                ))}
              </div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px', fontFamily: 'var(--font-mono)', wordBreak: 'break-all' }}>
                <b>Full URL:</b> {getFinalUrl()}
              </div>
            </div>
          ) : (
            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Request Body (POST/PUT payload)</label>
              <textarea 
                className="input-field" 
                value={requestBodyStr} 
                readOnly
                style={{ width: '100%', padding: '8px', fontFamily: 'var(--font-mono)', fontSize: '12px', minHeight: '100px', resize: 'vertical', background: 'rgba(0,0,0,0.02)', color: 'var(--text-secondary)' }}
              />
            </div>
          )}
        </div>

        {/* PANEL PHẢI: EXPECTATIONS & SIMULATION */}
        <div className="flex flex-col gap-sm">
          <div style={{ fontWeight: 'bold', fontSize: '13px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <CheckCircle2 size={16} style={{ color: 'var(--color-teal)' }} /> Expected Result (Diff Target)
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <div style={{ width: '120px' }}>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Expected Status</label>
              <input type="number" className="input-field" value={expectedStatus} onChange={e => setExpectedStatus(Number(e.target.value))} style={{ width: '100%', padding: '8px' }} />
            </div>
          </div>

          <div>
            <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Expected JSON Body</label>
            <textarea 
              className="input-field" 
              value={expectedBodyStr} 
              onChange={e => setExpectedBodyStr(e.target.value)}
              style={{ width: '100%', padding: '8px', fontFamily: 'var(--font-mono)', fontSize: '12px', minHeight: '100px', resize: 'vertical' }}
            />
          </div>

          <button 
            className="btn btn-primary"
            onClick={handleTestAPI}
            disabled={isLoading}
            style={{ marginTop: 'auto', padding: '12px', width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', fontWeight: 'bold', background: isLoading ? 'var(--text-muted)' : 'var(--color-violet)', border: 'none' }}
          >
            {isLoading ? <div style={{ width: '16px', height: '16px', border: '2px solid #fff', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} /> : <Play size={18} />}
            {isLoading ? 'Đang gửi Request...' : 'Gửi Request & Chạy Diff Engine'}
          </button>
        </div>
      </div>

      {/* KẾT QUẢ VALDAITION & DIFF ENGINE */}
      {diffResult && (
        <div style={{ marginTop: '24px', borderTop: '1px solid var(--border-subtle)', paddingTop: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Table size={18} style={{ color: 'var(--color-teal)' }} />
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 'bold', color: 'var(--text-primary)' }}>
              BẢNG SO SÁNH KẾT QUẢ PHẢN HỒI (EXPECTED VS ACTUAL VALIDATION)
            </h3>
            <span
              style={{
                marginLeft: 'auto',
                padding: '4px 10px',
                borderRadius: '12px',
                fontSize: '12px',
                fontWeight: 'bold',
                background: diffResult.status === 'PASS' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(225, 29, 72, 0.1)',
                color: diffResult.status === 'PASS' ? 'var(--color-teal)' : 'var(--color-rose)'
              }}
            >
              Trạng thái: {diffResult.status}
            </span>
          </div>

          {/* TABLE SCHEMA: Trường | Expected | Actual | PASS/FAIL */}
          <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
            <table style={{ width: '100%', fontSize: '12.5px', textAlign: 'left', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--surface-subtle)', borderBottom: '2px solid var(--border-subtle)' }}>
                  <th style={{ padding: '10px 12px', fontWeight: 'bold' }}>Trường</th>
                  <th style={{ padding: '10px 12px', fontWeight: 'bold' }}>Expected (Mong muốn)</th>
                  <th style={{ padding: '10px 12px', fontWeight: 'bold' }}>Actual (Thực tế)</th>
                  <th style={{ padding: '10px 12px', fontWeight: 'bold', textAlign: 'center', width: '120px' }}>PASS/FAIL</th>
                </tr>
              </thead>
              <tbody>
                {validationRows.map((row, i) => (
                  <tr 
                    key={i} 
                    style={{ 
                      borderBottom: '1px solid var(--border-subtle)', 
                      background: row.status === 'FAIL' ? 'rgba(225, 29, 72, 0.04)' : 'transparent' 
                    }}
                  >
                    <td style={{ padding: '10px 12px', fontWeight: 'bold', fontFamily: 'var(--font-mono)', fontSize: '11.5px' }}>
                      {row.field}
                    </td>
                    <td style={{ padding: '10px 12px', color: 'var(--text-secondary)', fontFamily: row.field.startsWith('Body') ? 'var(--font-mono)' : 'inherit' }}>
                      {row.expected}
                    </td>
                    <td style={{ 
                      padding: '10px 12px', 
                      fontWeight: row.status === 'FAIL' ? 'bold' : 'normal',
                      color: row.status === 'FAIL' ? 'var(--color-rose)' : 'var(--color-teal)',
                      fontFamily: row.field.startsWith('Body') ? 'var(--font-mono)' : 'inherit' 
                    }}>
                      {row.actual}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                      <span
                        style={{
                          padding: '3px 8px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: 'bold',
                          background: row.status === 'PASS' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(225, 29, 72, 0.1)',
                          color: row.status === 'PASS' ? 'var(--color-teal)' : 'var(--color-rose)'
                        }}
                      >
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div>
            <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '8px', color: 'var(--text-muted)' }}>Raw Actual Response Body:</div>
            <pre style={{ background: '#1e293b', color: '#e2e8f0', padding: '12px', borderRadius: '8px', fontSize: '11px', fontFamily: 'var(--font-mono)', overflowX: 'auto', maxHeight: '200px' }}>
              {typeof rawResponse === 'object' ? JSON.stringify(rawResponse, null, 2) : String(rawResponse)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};
