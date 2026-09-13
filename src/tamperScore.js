export function computeTamperScore({ maxDiff, extractionConfidence, visualAnomalies, consistencyIssues }) {
  let score = 0;
  const reasons = [];

  // Signal 1: ELA pixel deviation — higher deviation is a weak signal of editing
  if (maxDiff > 60) {
    score += 35;
    reasons.push('High pixel-level deviation detected in compression analysis');
  } else if (maxDiff > 30) {
    score += 15;
    reasons.push('Moderate pixel-level deviation detected in compression analysis');
  }

  // Signal 2: AI's own confidence in reading the document
  if (extractionConfidence === 'low') {
    score += 15;
    reasons.push('AI had low confidence reading the document fields clearly');
  } else if (extractionConfidence === 'medium') {
    score += 5;
  }

  // Signal 3: visual anomalies the AI noticed while reading (font mismatch, blur, etc.)
  if (visualAnomalies && visualAnomalies.length > 0) {
    score += visualAnomalies.length * 10;
    reasons.push(`${visualAnomalies.length} visual anomaly(ies) noticed during field extraction`);
  }

  // Signal 4: logical inconsistencies between extracted fields
  if (consistencyIssues && consistencyIssues.length > 0) {
    score += consistencyIssues.length * 15;
    reasons.push(`${consistencyIssues.length} logical inconsistency(ies) found among document fields`);
  }

  score = Math.min(score, 100);

  let verdict = 'Low likelihood of tampering';
  if (score >= 60) verdict = 'High likelihood of tampering';
  else if (score >= 30) verdict = 'Moderate likelihood of tampering';

  return { score, verdict, reasons };
}