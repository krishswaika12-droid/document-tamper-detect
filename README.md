# Document Tamper Detector

An AI-assisted web app that analyzes a scanned document image and produces a tamper-likelihood score with a plain-English explanation — combining pixel-level forensics with AI-powered field extraction and consistency checking.

Built as a first-pass screening tool inspired by the challenge of automating identity/travel document verification at scale.

---

## Problem Statement

Manually verifying whether an ID, certificate, or travel document has been digitally altered is slow, requires expertise, and most people have no accessible tool to do a first-pass check. Checkpoints and institutions that process large volumes of documents daily (passports, visas, national IDs, certificates) rely heavily on manual inspection, which is error-prone and doesn't scale.

This project automates a **first-pass tamper check** by combining:
- A real forensic technique (compression-artifact / Error Level Analysis)
- AI-powered structured field reading
- Logical consistency checks over the extracted data

It is explicitly **not** a legal or forensic verification tool — it produces a likelihood signal to assist human review, not a definitive verdict.

---

## Features

- 📤 Upload a scanned document image (JPEG/PNG)
- 🔍 Client-side **Error Level Analysis (ELA)** with a visual heatmap of possible edit regions
- 🤖 AI-based structured field extraction (name, dates, ID number, document type) via Gemini
- 🪪 Dedicated section for government ID fields (passport number, nationality, visa details, etc.)
- ⚠️ AI-flagged visual anomalies (font mismatches, blur, unusual spacing)
- ✅ Logical consistency checks (impossible dates, out-of-order dates, malformed IDs)
- 📊 A combined tamper-likelihood score (0–100%) with a written explanation — scoring logic is deterministic and written by hand, not by the AI, for explainability
- 📄 Downloadable HTML report of the full analysis
- 🔁 One-click reset to scan another document
- 🎨 Clean, soft-toned, responsive UI

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + Vite |
| Styling | Tailwind CSS |
| Forensic analysis | Browser Canvas API (client-side ELA, no server needed) |
| AI field extraction & consistency check | Gemini 2.5 Flash (single merged API call) |
| Scoring logic | Custom, hand-written JS — not AI-generated, for explainability |
| Deployment target | Vercel (or any static host with serverless function support) |

---

## Architecture

```
Upload image
   │
   ├──► Client-side ELA (Canvas API) ──► heatmap + max pixel deviation
   │
   └──► Gemini Vision API (single call) ──► {
          documentType, category,
          fields: { name, dateOfBirth, idNumber, ... },
          extractionConfidence,
          visualAnomalies[],
          consistencyIssues[]
        }
              │
              ▼
     computeTamperScore() — combines ELA + AI signals
              │
              ▼
     Final score, verdict, and reasons shown in UI
```

No backend or database is used in this version — everything runs client-side plus a single external API call.

---

## Getting Started

### Prerequisites
- Node.js 18+
- A Gemini API key ([Google AI Studio](https://aistudio.google.com/app/apikey))

### Setup

```bash
git clone https://github.com/YOUR-GITHUB-USERNAME/tamper-detector.git
cd tamper-detector
npm install
```

Create a `.env.local` file in the project root (see `.env.example`):

```
VITE_GEMINI_API_KEY=your_key_here
```

Run the dev server:

```bash
npm run dev
```

Visit `http://localhost:5173`.

> ⚠️ **Security note:** in this current version, the Gemini API key is used directly from the browser via `import.meta.env`, which is fine for local development but **exposes the key in the client bundle**. Before deploying publicly, move the API call into a serverless function (e.g. a Vercel API route) and keep the key server-side only.

---

## Known Limitations

- **ELA reliability varies by image format** — works best on JPEGs; PNGs or already-recompressed images (screenshots, forwarded images) have no original compression history to compare against, so ELA is a weaker signal there.
- **Scoring thresholds are only lightly calibrated** — based on a small number of manually tested images, not a large labeled dataset. Treat the percentage as directional, not precise.
- **API key is currently client-side** — must be moved to a serverless function before public deployment.
- **No document validation module** (Module 2) yet — extracted fields aren't currently checked against official document format standards via deterministic rules.
- **No face verification module** yet — document-owner-to-photo matching is not implemented.
- **No metadata/EXIF analysis** yet as an additional tampering signal.

See the full project report for a detailed breakdown of what's implemented vs. outstanding relative to the original problem statement.

---
## Disclaimer

This tool provides an automated, first-pass likelihood signal only. It does **not** provide legal or forensic proof of a document's authenticity and should not be used as the sole basis for any decision. Always involve qualified human review for high-stakes verification.

---

