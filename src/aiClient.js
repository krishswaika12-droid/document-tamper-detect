const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const MODEL = 'gemini-2.5-flash';
const URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`;

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export async function analyzeDocument(file) {
  const base64Image = await fileToBase64(file);

  const prompt = `
You are analyzing a scanned document image. First identify what kind of document it is,
then extract fields, then check for logical problems. Return ONLY valid JSON, no markdown,
no commentary, in this exact shape:

{
  "documentType": "string, e.g. Passport / Aadhaar Card / Driving License / Certificate / Academic Transcript",
  "category": "government_id" | "certificate" | "other",
  "fields": {
    "name": "string or null",
    "dateOfBirth": "string or null",
    "issueDate": "string or null",
    "expiryDate": "string or null",
    "idNumber": "string or null",
    "nationality": "string or null",
    "gender": "string or null",
    "passportNumber": "string or null",
    "visaType": "string or null",
    "visaNumber": "string or null",
    "stayDuration": "string or null"
  },
  "extractionConfidence": "high | medium | low — base this on the fraction of fields you could actually read, not just image clarity",
  "visualAnomalies": ["visible inconsistencies: font mismatches, misaligned text, unusual spacing, blurring around text — empty array if none"],
  "consistencyIssues": ["logical problems: dates out of order, impossible dates, malformed ID format for the stated document type — empty array if none"]
}

Rules:
- Only fill fields relevant to the document type; leave others null.
- Set "category" to "government_id" for passports, national IDs, visas, driving licenses, permits.
- Never guess a value you cannot read clearly — use null.
- Do not judge whether the document is forged; only report what you observe.
`.trim();

  const response = await fetch(URL, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: file.type, data: base64Image } }] }],
    generationConfig: { maxOutputTokens: 1500 }, // raised from 600 — was likely truncating
  }),
});

const data = await response.json();
if (!response.ok) {
  throw new Error(`Gemini API error (${response.status}): ${data?.error?.message || 'Unknown error'}`);
}

const rawText = data.candidates[0].content.parts[0].text;
console.log('Raw Gemini response:', rawText); // TEMP — check console next time this happens

const cleaned = rawText.replace(/```json|```/g, '').trim();

try {
  return JSON.parse(cleaned);
} catch (parseErr) {
  console.error('Failed to parse JSON:', cleaned);
  throw new Error('AI response was not valid JSON — it may have been cut off.');
}
}