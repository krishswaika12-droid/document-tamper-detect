import { useState } from 'react';
import { computeELA } from './ela';
import { analyzeDocument } from './aiClient';
import { computeTamperScore } from './tamperScore';


const GENERAL_LABELS = { name: 'Name', dateOfBirth: 'Date of Birth', issueDate: 'Issue Date', expiryDate: 'Expiry Date', idNumber: 'ID Number' };
const GOV_LABELS = { nationality: 'Nationality', gender: 'Gender', passportNumber: 'Passport Number', visaType: 'Visa Type', visaNumber: 'Visa Number', stayDuration: 'Stay Duration' };

function FieldRow({ label, value }) {
  return (
    <div className="flex justify-between items-center py-2 px-3 rounded-lg odd:bg-slate-50">
      <span className="text-sm text-slate-500">{label}</span>
      <span className={`text-sm font-medium ${value ? 'text-slate-800' : 'text-slate-300 italic'}`}>
        {value || 'Not detected'}
      </span>
    </div>
  );
}

function App() {
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [elaUrl, setElaUrl] = useState(null);
  const [maxDiff, setMaxDiff] = useState(null);
  const [loading, setLoading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [extractedData, setExtractedData] = useState(null);
  const [tamperResult, setTamperResult] = useState(null);
  const [error, setError] = useState(null);

  async function handleFileChange(e) {
    const selected = e.target.files[0];
    if (!selected) return;

    setFile(selected);
    setPreviewUrl(URL.createObjectURL(selected));
    setElaUrl(null);
    setExtractedData(null);
    setTamperResult(null);
    setError(null);
    setLoading(true);

    const result = await computeELA(selected);
    setElaUrl(result.elaUrl);
    setMaxDiff(result.maxDiff);
    setLoading(false);
  }

  async function handleExtract() {
    setExtracting(true);
    setError(null);
    setTamperResult(null);
    try {
      const data = await analyzeDocument(file);
      setExtractedData(data);

      const result = computeTamperScore({
        maxDiff,
        extractionConfidence: data.extractionConfidence,
        visualAnomalies: data.visualAnomalies,
        consistencyIssues: data.consistencyIssues,
      });
      setTamperResult(result);
    } catch (err) {
      console.error(err);
      setError('Something went wrong analyzing this document. Please try again.');
    }
    setExtracting(false);
  }
  function handleReset() {
    setFile(null);
    setPreviewUrl(null);
    setElaUrl(null);
    setMaxDiff(null);
    setExtractedData(null);
    setTamperResult(null);
    setError(null);
  }

  function handleDownloadReport() {
    const reportHtml = `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Document Tamper Analysis Report</title>
<style>
  body { font-family: Arial, sans-serif; max-width: 700px; margin: 40px auto; color: #334155; }
  h1 { color: #0f172a; font-size: 22px; }
  h2 { font-size: 14px; color: #475569; margin-top: 28px; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; }
  .row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px; }
  .label { color: #64748b; }
  .value { font-weight: 600; }
  .score { font-size: 32px; font-weight: bold; }
  .verdict { font-weight: 600; margin-top: 4px; }
  ul { font-size: 13px; color: #475569; }
  .disclaimer { font-size: 11px; color: #94a3b8; margin-top: 30px; border-top: 1px solid #e2e8f0; padding-top: 10px; }
</style>
</head>
<body>
  <h1>Document Tamper Analysis Report</h1>
  <p style="font-size:12px; color:#94a3b8;">Generated on ${new Date().toLocaleString()}</p>

  <h2>Document Details (${extractedData.documentType || 'Unknown type'})</h2>
  ${Object.entries(GENERAL_LABELS).map(([key, label]) =>
      `<div class="row"><span class="label">${label}</span><span class="value">${extractedData.fields[key] || 'Not detected'}</span></div>`
    ).join('')}

  ${isGovId ? `
  <h2>Government ID Details</h2>
  ${Object.entries(GOV_LABELS).filter(([key]) => extractedData.fields[key]).map(([key, label]) =>
      `<div class="row"><span class="label">${label}</span><span class="value">${extractedData.fields[key]}</span></div>`
    ).join('')}
  ` : ''}

  <h2>Consistency Check</h2>
  ${extractedData.consistencyIssues?.length
        ? `<ul>${extractedData.consistencyIssues.map(i => `<li>${i}</li>`).join('')}</ul>`
        : '<p>No issues found.</p>'}

  <h2>Overall Assessment</h2>
  <div class="score">${tamperResult.score}%</div>
  <div class="verdict">${tamperResult.verdict}</div>
  <ul>${tamperResult.reasons.map(r => `<li>${r}</li>`).join('')}</ul>

  <p class="disclaimer">
    This report reflects an automated first-pass likelihood assessment and is not a legal
    or forensic verification of document authenticity.
  </p>
</body>
</html>`.trim();

    const blob = new Blob([reportHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tamper-report-${Date.now()}.html`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const isGovId = extractedData?.category === 'government_id';

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 via-white to-indigo-50 font-sans">
      <div className="max-w-3xl mx-auto px-5 py-10">
        <header className="text-center mb-8">
          <h1 className="text-3xl font-bold text-slate-800">Document Tamper Detector</h1>
          <p className="text-slate-400 mt-2 text-sm">
            Upload a scanned document to check for signs of digital editing
          </p>
          <p className="text-xs text-slate-300 mt-3 max-w-md mx-auto">
            This tool flags likelihood of tampering as a first-pass signal — it does not
            provide legal proof of authenticity.
          </p>
        </header>

        <label className="flex items-center justify-center border-2 border-dashed border-sky-200 rounded-2xl p-10 bg-white/70 backdrop-blur text-slate-400 text-sm cursor-pointer hover:border-sky-400 hover:bg-sky-50 transition-all duration-200">
          <input type="file" accept="image/*" onChange={handleFileChange} hidden />
          <span>Click to upload an image</span>
        </label>

        {loading && <p className="text-center text-sky-500 font-medium mt-5 animate-pulse">Analyzing image...</p>}

        {(previewUrl || elaUrl) && (
          <div className="flex flex-wrap justify-center gap-5 mt-8">
            {previewUrl && (
              <div className="bg-white rounded-2xl shadow-sm hover:shadow-md transition-shadow p-4 flex-1 min-w-[280px] max-w-[380px] text-center">
                <h3 className="text-sm font-semibold text-slate-600 mb-2">Original</h3>
                <img src={previewUrl} alt="original" className="w-full rounded-xl border border-slate-100" />
              </div>
            )}
            {elaUrl && (
              <div className="bg-white rounded-2xl shadow-sm hover:shadow-md transition-shadow p-4 flex-1 min-w-[280px] max-w-[380px] text-center">
                <h3 className="text-sm font-semibold text-slate-600 mb-2">ELA Heatmap</h3>
                <img src={elaUrl} alt="ela heatmap" className="w-full rounded-xl border border-slate-100" />
                <p className="text-xs text-slate-400 mt-2">Max pixel deviation: {maxDiff.toFixed(1)} / 255</p>
              </div>
            )}
          </div>
        )}
        {extracting && (
          <div className="flex flex-col items-center gap-3 mt-8">
            <div className="w-10 h-10 border-4 border-sky-100 border-t-sky-500 rounded-full animate-spin"></div>
            <p className="text-sky-500 text-sm font-medium animate-pulse">Analyzing document, please wait...</p>
          </div>
        )}

        {file && !loading && (
          <div className="text-center mt-8">
            <button
              onClick={handleExtract}
              disabled={extracting}
              className="bg-sky-500 text-white px-6 py-2.5 rounded-xl font-medium hover:bg-sky-600 active:scale-95 transition-all duration-150 disabled:opacity-50 shadow-sm"
            >
              {extracting ? 'Analyzing document...' : 'Extract Document Fields'}
            </button>
          </div>
        )}

        {error && (
          <div className="bg-rose-50 border border-rose-100 text-rose-600 text-sm rounded-xl p-4 mt-6 text-center">
            {error}
          </div>
        )}

        {extractedData && (
          <div className="bg-white rounded-2xl shadow-sm p-6 mt-8">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-sm font-semibold text-slate-600">Document Details</h3>
              <span className="text-xs bg-sky-50 text-sky-600 px-3 py-1 rounded-full">
                {extractedData.documentType || 'Unknown type'}
              </span>
            </div>
            <div className="rounded-xl overflow-hidden">
              {Object.entries(GENERAL_LABELS).map(([key, label]) => (
                <FieldRow key={key} label={label} value={extractedData.fields[key]} />
              ))}
            </div>
          </div>
        )}

        {isGovId && (
          <div className="bg-amber-50/60 border border-amber-100 rounded-2xl shadow-sm p-6 mt-5">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-2 h-2 rounded-full bg-amber-400"></span>
              <h3 className="text-sm font-semibold text-amber-700">Government ID Details</h3>
            </div>
            <div className="rounded-xl overflow-hidden">
              {Object.entries(GOV_LABELS)
                .filter(([key]) => extractedData.fields[key])
                .map(([key, label]) => (
                  <FieldRow key={key} label={label} value={extractedData.fields[key]} />
                ))}
              {Object.keys(GOV_LABELS).every((key) => !extractedData.fields[key]) && (
                <p className="text-sm text-amber-600/70 italic px-3 py-2">No ID-specific fields detected.</p>
              )}
            </div>
          </div>
        )}

        {extractedData && (
          <div className="bg-white rounded-2xl shadow-sm p-6 mt-5">
            <h3 className="text-sm font-semibold text-slate-600 mb-3">Consistency Check</h3>
            {extractedData.consistencyIssues?.length ? (
              <ul className="space-y-1.5 text-sm text-rose-500">
                {extractedData.consistencyIssues.map((issue, i) => (
                  <li key={i} className="flex gap-2"><span>•</span>{issue}</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm font-medium text-emerald-500">No issues found</p>
            )}
          </div>
        )}

        {tamperResult && (
          <div className="bg-white rounded-2xl shadow-sm p-6 mt-5 border border-slate-100">
            <h3 className="text-sm font-semibold text-slate-600 mb-3">Overall Assessment</h3>
            <div className="flex items-center gap-4">
              <p className="text-3xl font-bold text-slate-800">{tamperResult.score}%</p>
              <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${tamperResult.score >= 60 ? 'bg-rose-400' : tamperResult.score >= 30 ? 'bg-amber-400' : 'bg-emerald-400'
                    }`}
                  style={{ width: `${tamperResult.score}%` }}
                />
              </div>
            </div>
            <p className={`text-sm font-medium mt-2 ${tamperResult.score >= 60 ? 'text-rose-500' : tamperResult.score >= 30 ? 'text-amber-500' : 'text-emerald-500'
              }`}>
              {tamperResult.verdict}
            </p>
            {tamperResult.reasons.length > 0 && (
              <ul className="text-sm text-slate-500 mt-3 space-y-1">
                {tamperResult.reasons.map((reason, i) => (
                  <li key={i} className="flex gap-2"><span>•</span>{reason}</li>
                ))}
              </ul>

            )}

            <div className="flex gap-3 mt-5">
              <button
                onClick={handleDownloadReport}
                className="flex-1 bg-sky-500 text-white py-2.5 rounded-xl font-medium hover:bg-sky-600 active:scale-95 transition-all duration-150 shadow-sm"
              >
                Download Report
              </button>
              <button
                onClick={handleReset}
                className="flex-1 bg-slate-100 text-slate-600 py-2.5 rounded-xl font-medium hover:bg-slate-200 active:scale-95 transition-all duration-150"
              >
                Scan Another Document
              </button>
            </div>
          </div>
        )}
                       <footer className="mt-16 pt-6 border-t border-slate-200 text-center">
  <p className="text-sm text-slate-500 font-medium">
    Built by Krish Swaika
  </p>

  <div className="flex justify-center gap-5 mt-3">
    <a
      href="https://www.linkedin.com/in/krish-swaika-796709379/"
      target="_blank"
      rel="noopener noreferrer"
      className="text-slate-400 hover:text-sky-500 transition-colors duration-150 text-sm flex items-center gap-1.5"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 1 1 0-4.124 2.062 2.062 0 0 1 0 4.124zM7.114 20.452H3.558V9h3.556v11.452z" />
      </svg>
      LinkedIn
    </a>

    <a
      href="https://github.com/krishswaika12-droid"
      target="_blank"
      rel="noopener noreferrer"
      className="text-slate-400 hover:text-slate-700 transition-colors duration-150 text-sm flex items-center gap-1.5"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.385-1.333-1.755-1.333-1.755-1.09-.745.083-.729.083-.729 1.205.084 1.84 1.237 1.84 1.237 1.07 1.834 2.807 1.304 3.492.997.108-.775.418-1.305.762-1.605-2.665-.303-5.466-1.334-5.466-5.93 0-1.31.467-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.955-.266 1.98-.399 3-.405 1.02.006 2.045.14 3.003.405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
      </svg>
      GitHub
    </a>
  </div>
</footer>

      </div>
    </div>
  );
}

export default App;
              