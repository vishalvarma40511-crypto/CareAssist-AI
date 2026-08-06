import { Router, Request, Response } from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { query } from '../db';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { z } from 'zod';

const router = Router();
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

// Initialize Gemini Client
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// Schema for symptom assessment
const symptomRequestSchema = z.object({
  chatHistory: z.array(z.object({
    role: z.enum(['user', 'model']),
    parts: z.array(z.object({ text: z.string() }))
  })),
  currentMessage: z.string()
});

// POST /api/ai/assess-symptoms
router.post('/assess-symptoms', authenticateToken, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const { chatHistory, currentMessage } = symptomRequestSchema.parse(req.body);
    const targetLangCode = req.body.language || 'en';

    if (!GEMINI_API_KEY || GEMINI_API_KEY === 'YOUR_GEMINI_API_KEY_HERE') {
      // Mock system if API key isn't provided so it runs correctly in debug environments
      return handleMockAISymptoms(res, chatHistory, currentMessage, targetLangCode);
    }

    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: {
        responseMimeType: "application/json",
      }
    });

    const userProfileRes = await query(
      'SELECT name, age, gender, height, weight, pregnancy_status FROM users WHERE id = $1',
      [authReq.user?.id]
    );
    const profile = userProfileRes.rows[0];
    const profileContext = `
      Patient Profile:
      - Name: ${profile?.name || 'Unknown'}
      - Age: ${profile?.age || 'Unspecified'}
      - Gender: ${profile?.gender || 'Unspecified'}
      - Height: ${profile?.height ? profile.height + ' cm' : 'Unspecified'}
      - Weight: ${profile?.weight ? profile.weight + ' kg' : 'Unspecified'}
      - Pregnancy Status: ${profile?.pregnancy_status ? 'Pregnant' : 'Not Pregnant/Not Applicable'}
    `;

    const languageNames: { [key: string]: string } = {
      en: 'English',
      hi: 'Hindi',
      te: 'Telugu',
      ta: 'Tamil',
      kn: 'Kannada',
      bn: 'Bengali',
      mr: 'Marathi'
    };
    const targetLang = languageNames[targetLangCode] || 'English';

    const promptSystem = `
You are the clinical medical AI core of the CareAssist AI healthcare platform.
Your task is to conduct an interactive medical interview and risk analysis.
You are NOT a doctor. You must ALWAYS maintain a helper role and include safety warnings.

LANGUAGE REQUIREMENT:
You MUST conduct the conversation, generate questions, suggested options, possible conditions, prescriptions, home care, and reports entirely in the language: ${targetLang}. If the patient writes in another language, you must still respond in ${targetLang}.

RULES:
0. VOCABULARY CLARIFICATION: When the user or system refers to "tablets", it STRICTLY means medical pills/medications. NEVER provide information about electronic devices (like iPads or Android tablets).
1. EMERGENCY DETECTION: First, analyze the latest user message and history for immediate life-threatening signs:
   - Chest pain or pressure
   - Sudden weakness, numbness, drooping face, or slurred speech (signs of stroke)
   - Severe shortness of breath or difficulty breathing
   - Sudden severe allergic reaction (swelling, hives, wheezing)
   - Loss of consciousness or severe confusion
   - Seizures
   - Uncontrolled heavy bleeding
   - Suicidal thoughts
   If any of these are detected, you MUST immediately output JSON with "emergency": true.

2. DATA COLLECTION via MULTIPLE CHOICE: If it's NOT an emergency, you MUST gather complete information by asking multiple-choice questions before giving any analysis or recommendations.
   - You MUST ask ONLY ONE question at a time.
   - You MUST provide 2 to 4 options for the user to choose from in the "options" array.
   - Check if you have sufficient details on:
     * Specific symptom profile: onset, pain level (1-10), exact location, duration, continuous vs intermittent.
     * Common triggers: travel history, recent injuries.
     * Key secondary symptoms: fever (with temp), cough, vomiting, diarrhea, dizziness.
     * Key clinical history: existing chronic conditions (diabetes, high blood pressure, asthma, heart disease), current medications, allergies (food or drugs).
   - If ANY of these details are missing or incomplete, set "needsMoreInfo": true, formulate the next question, and provide the options. DO NOT recommend any tablets or treatments until all data is collected.

3. FINAL ANALYSIS (ONLY AFTER COMPLETE DATA COLLECTION): Once you have gathered sufficient information and asked all necessary questions, set "needsMoreInfo": false and populate:
   - "riskLevel": "low" | "moderate" | "high" | "emergency" (Choose low for common minor issues, moderate for conditions needing a clinic visit, high for serious conditions needing urgent care, and emergency if life-threatening).
   - "confidenceScore": number (1-100 indicating assessment reliability)
   - "summary": String summarizing patient's reported symptoms and history.
   - "conditions": Array of possible conditions, clearly qualified as "not definitive diagnoses".
   - "homeCare": Array of safe, non-medicinal actions (e.g. rest, hydration, steam) and why they help.
   - "medicineGuidance": String with OTC advice (for low risk) or recommendation to seek a prescription from a doctor. Never prescribe prescription-only medicines.
   - "doctorRecommendation": String recommending specialist or consultation type.
   - "prescriptions": Array of recommended OTC tablets/medicines to relieve and cure symptoms fast, detailing name, dosage, frequency, duration, and purpose.

JSON Schema Output:
{
  "emergency": boolean,
  "needsMoreInfo": boolean,
  "question": "string (the next question to ask, empty if needsMoreInfo is false)",
  "options": ["string"],
  "riskLevel": "low" | "moderate" | "high" | "emergency",
  "confidenceScore": number,
  "summary": "string",
  "conditions": ["string"],
  "homeCare": ["string"],
  "medicineGuidance": "string",
  "doctorRecommendation": "string",
  "prescriptions": [
    {
      "name": "string (name of recommended tablet/medicine)",
      "dosage": "string (e.g. 500mg)",
      "frequency": "string (e.g. Twice a day after meals)",
      "duration": "string (e.g. 3 days)",
      "purpose": "string (e.g. To cure fever fast)"
    }
  ]
}
(For the "options" field, provide 2 to 4 short, patient-friendly answer choices corresponding to the "question" if needsMoreInfo is true. Otherwise, leave it as an empty array []).
    `;

    // Format chat history for Gemini
    const contents = [
      { role: 'user', parts: [{ text: promptSystem + "\n\n" + profileContext }] },
      ...chatHistory,
      { role: 'user', parts: [{ text: currentMessage }] }
    ];

    const result = await model.generateContent({ contents });
    const responseText = result.response.text();
    const resultJson = JSON.parse(responseText);

    // If assessment is finalized (needsMoreInfo = false), save to DB consultation history
    if (!resultJson.needsMoreInfo && !resultJson.emergency) {
      await query(
        `INSERT INTO consultations (patient_id, symptom_summary, risk_level, confidence_score, health_summary)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          authReq.user?.id,
          currentMessage,
          resultJson.riskLevel || 'low',
          resultJson.confidenceScore || 70,
          resultJson.summary || 'AI health analysis completed.'
        ]
      );
    }

    res.json(resultJson);
  } catch (error: any) {
    console.warn('Gemini API assessment error, falling back to local Mock AI:', error.message || error);
    try {
      const { chatHistory, currentMessage } = symptomRequestSchema.parse(req.body);
      return handleMockAISymptoms(res, chatHistory, currentMessage, req.body.language || 'en');
    } catch (fallbackError) {
      res.status(500).json({ error: 'Failed to process symptom assessment. AI server error.' });
    }
  }
});

// POST /api/ai/explain-medicine
router.post('/explain-medicine', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { medicineName, language } = req.body;
    const targetLangCode = language || 'en';
    if (!medicineName) {
      return res.status(400).json({ error: 'Medicine name is required' });
    }

    if (!GEMINI_API_KEY || GEMINI_API_KEY === 'YOUR_GEMINI_API_KEY_HERE') {
      return handleMockMedicineExplain(res, medicineName, targetLangCode);
    }

    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: {
        responseMimeType: "application/json",
      }
    });

    const languageNames: { [key: string]: string } = {
      en: 'English',
      hi: 'Hindi',
      te: 'Telugu',
      ta: 'Tamil',
      kn: 'Kannada',
      bn: 'Bengali',
      mr: 'Marathi'
    };
    const targetLang = languageNames[targetLangCode] || 'English';

    const prompt = `
You are a pharmacology assistant. Explain the following medicine: "${medicineName}".
You MUST respond with a valid JSON document matching the following schema. Keep descriptions clear, simple, and safe.
You MUST write all explanations, descriptions, side effects, precautions, and instructions entirely in the language: ${targetLang}.

JSON Schema Output:
{
  "name": "string",
  "whatIsIt": "string",
  "whatUsedFor": "string",
  "howItWorks": "string",
  "adultUse": "string",
  "foodTiming": "string",
  "dosingSchedule": "string",
  "commonSideEffects": ["string"],
  "seriousSideEffects": ["string"],
  "drugInteractions": ["string"],
  "foodInteractions": ["string"],
  "precautions": {
    "pregnancy": "string",
    "breastfeeding": "string",
    "driving": "string",
    "alcohol": "string"
  },
  "storageInstructions": "string",
  "missedDoseGuidance": "string",
  "overdoseAdvice": "string",
  "whenToContactDoctor": "string"
}
    `;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    res.json(JSON.parse(responseText));
  } catch (error: any) {
    console.warn('Gemini medicine explanation error, falling back to local Mock AI:', error.message || error);
    try {
      const { medicineName, language } = req.body;
      return handleMockMedicineExplain(res, medicineName || 'Unknown Medicine', language || 'en');
    } catch (fallbackError) {
      res.status(500).json({ error: 'Failed to generate medicine explanation' });
    }
  }
});

// POST /api/ai/nutrition-plan
router.post('/nutrition-plan', authenticateToken, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const targetLangCode = req.body.language || 'en';

    // Fetch patient health records to personalize the nutrition plan
    const profileRes = await query('SELECT age, weight, height, gender FROM users WHERE id = $1', [authReq.user?.id]);
    const chronicRes = await query("SELECT title FROM health_records WHERE patient_id = $1 AND type = 'chronic_disease'", [authReq.user?.id]);
    const allergyRes = await query("SELECT title FROM health_records WHERE patient_id = $1 AND type = 'allergy'", [authReq.user?.id]);

    const profile = profileRes.rows[0];
    const chronicDiseases = chronicRes.rows.map(r => r.title).join(', ');
    const allergies = allergyRes.rows.map(r => r.title).join(', ');

    if (!GEMINI_API_KEY || GEMINI_API_KEY === 'YOUR_GEMINI_API_KEY_HERE') {
      return handleMockNutrition(res, profile, chronicDiseases, allergies, targetLangCode);
    }

    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: {
        responseMimeType: "application/json",
      }
    });

    const languageNames: { [key: string]: string } = {
      en: 'English',
      hi: 'Hindi',
      te: 'Telugu',
      ta: 'Tamil',
      kn: 'Kannada',
      bn: 'Bengali',
      mr: 'Marathi'
    };
    const targetLang = languageNames[targetLangCode] || 'English';

    const prompt = `
You are a clinical dietitian. Create a personalized nutrition guide based on the patient's stats:
- Age: ${profile?.age || 'Unspecified'}
- Weight: ${profile?.weight ? profile.weight + ' kg' : 'Unspecified'}
- Chronic Diseases: ${chronicDiseases || 'None reported'}
- Allergies: ${allergies || 'None reported'}

You MUST write all food lists, recommendations, recovery plans, and titles in the language: ${targetLang}.

Your response must be valid JSON matching this schema:
{
  "foodsToEat": ["string"],
  "foodsToAvoid": ["string"],
  "dailyWaterGoal": "string",
  "recommendedFruits": ["string"],
  "recommendedVegetables": ["string"],
  "proteinSources": ["string"],
  "essentialVitamins": ["string"],
  "recoveryDietPlan": "string"
}
    `;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    res.json(JSON.parse(responseText));
  } catch (error: any) {
    console.warn('Gemini nutrition planning error, falling back to local Mock AI:', error.message || error);
    try {
      const authReq = req as AuthenticatedRequest;
      const targetLangCode = req.body.language || 'en';
      const profileRes = await query('SELECT age, weight, height, gender FROM users WHERE id = $1', [authReq.user?.id]);
      const chronicRes = await query("SELECT title FROM health_records WHERE patient_id = $1 AND type = 'chronic_disease'", [authReq.user?.id]);
      const allergyRes = await query("SELECT title FROM health_records WHERE patient_id = $1 AND type = 'allergy'", [authReq.user?.id]);

      const profile = profileRes.rows[0];
      const chronicDiseases = chronicRes.rows.map(r => r.title).join(', ');
      const allergies = allergyRes.rows.map(r => r.title).join(', ');

      return handleMockNutrition(res, profile, chronicDiseases, allergies, targetLangCode);
    } catch (fallbackError) {
      res.status(500).json({ error: 'Failed to generate nutrition plan' });
    }
  }
});

// POST /api/ai/analyze-report
router.post('/analyze-report', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { reportText, filename, language } = req.body;
    const targetLangCode = language || 'en';

    if (!reportText) {
      return res.status(400).json({ error: 'Report text is required' });
    }

    if (!GEMINI_API_KEY || GEMINI_API_KEY === 'YOUR_GEMINI_API_KEY_HERE') {
      return handleMockReportAnalysis(res, reportText, filename || 'report.txt', targetLangCode);
    }

    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: {
        responseMimeType: "application/json",
      }
    });

    const languageNames: { [key: string]: string } = {
      en: 'English',
      hi: 'Hindi',
      te: 'Telugu',
      ta: 'Tamil',
      kn: 'Kannada',
      bn: 'Bengali',
      mr: 'Marathi'
    };
    const targetLang = languageNames[targetLangCode] || 'English';

    const prompt = `
You are a diagnostic clinician and lab report analyzer. Analyze the provided patient medical report text:
---
${reportText}
---

You MUST generate a structured analysis in valid JSON matching this schema:
{
  "reportType": "string (e.g. CBC Blood Panel, Lipid Profile, etc.)",
  "patientName": "string (extracted name or 'Unknown')",
  "dateAnalyzed": "string (current date format)",
  "findings": [
    {
      "marker": "string (e.g. Hemoglobin, Total Cholesterol)",
      "value": "string (e.g. 10.5 g/dL)",
      "status": "string ('low' | 'normal' | 'high')",
      "interpretation": "string (clinical meaning of this level)"
    }
  ],
  "problems": ["string (e.g. Anemia, Borderline Diabetes, Hyperlipidemia)"],
  "recommendedFoods": ["string (specific foods that benefit the conditions)"],
  "avoidedFoods": ["string (specific foods to avoid for the conditions)"],
  "prescriptions": [
    {
      "name": "string (medicine/tablet name)",
      "dosage": "string (e.g. 100mg)",
      "frequency": "string (e.g. Once daily after breakfast)",
      "duration": "string (e.g. 30 days)",
      "purpose": "string (e.g. To boost iron and cure anemia)"
    }
  ],
  "guidance": "string (overall health summary and instructions)"
}

LANGUAGE REQUIREMENT:
You MUST write all titles, findings, interpretations, problems, foods, prescriptions, and guidance entirely in the language: ${targetLang}.
    `;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    res.json(JSON.parse(responseText));
  } catch (error: any) {
    console.warn('Gemini report analysis error, falling back to local Mock AI:', error.message || error);
    try {
      const { reportText, filename, language } = req.body;
      return handleMockReportAnalysis(res, reportText || '', filename || 'report.txt', language || 'en');
    } catch (fallbackError) {
      res.status(500).json({ error: 'Failed to analyze report' });
    }
  }
});

// Mock Logic for Local Testing / No API Key
function getMockPrescriptions(text: string, lang: string) {
  const isFever = text.includes('fever') || text.includes('temp') || text.includes('warm') || text.includes('జ్వరం') || text.includes('బుఖార్') || text.includes('बुखार');
  const isHeadache = text.includes('head') || text.includes('migraine') || text.includes('తలనొప్పి') || text.includes('सिरदर्द') || text.includes('सिर दर्द');
  const isCoughColdSoreThroat = text.includes('cough') || text.includes('cold') || text.includes('throat') || text.includes('దగ్గు') || text.includes('జలుబు') || text.includes('గొంతు') || text.includes('खांसी') || text.includes('जुकाम') || text.includes('गले');
  const isStomach = text.includes('stomach') || text.includes('cramp') || text.includes('abdomen') || text.includes('కడుపు') || text.includes('पेट');
  const isNauseaVomiting = text.includes('vomit') || text.includes('nausea') || text.includes('వాంతి') || text.includes('వికారం') || text.includes('उल्टी') || text.includes('जी मिचलाना');
  const isBreath = text.includes('breath') || text.includes('shortness') || text.includes('శ్వాస') || text.includes('सांस');

  if (lang === 'te') {
    if (isFever) {
      return [
        { name: "పారాసెటమాల్ (Paracetamol)", dosage: "500mg", frequency: "రోజుకు 3 సార్లు (ఆహారం తర్వాత)", duration: "3 రోజులు", purpose: "జ్వరం మరియు ఒంటి నొప్పులను తగ్గించడానికి" },
        { name: "ఓఆర్ఎస్ (ORS)", dosage: "1 ప్యాకెట్", frequency: "1 లీటర్ నీటిలో కలిపి రోజంతా త్రాగాలి", duration: "2 రోజులు", purpose: "డీహైడ్రేషన్ తగ్గించడానికి మరియు శరీర లవణాలను పునరుద్ధరించడానికి" }
      ];
    }
    if (isHeadache) {
      return [
        { name: "ఐబుప్రోఫెన్ (Ibuprofen)", dosage: "400mg", frequency: "రోజుకు రెండు సార్లు (ఆహారం తర్వాత)", duration: "2 రోజులు", purpose: "తీవ్రమైన తలనొప్పిని తగ్గించడానికి" },
        { name: "మెగ్నీషియం కాంప్లెక్స్ (Magnesium)", dosage: "250mg", frequency: "రోజుకు ఒకసారి పడుకునే ముందు", duration: "5 రోజులు", purpose: "నరాల ఒత్తిడిని తగ్గించి తలనొప్పి రాకుండా చేయడానికి" }
      ];
    }
    if (isCoughColdSoreThroat) {
      return [
        { name: "సెటిరిజైన్ (Cetirizine)", dosage: "10mg", frequency: "రాత్రి పడుకునే ముందు ఒక టాబ్లెట్", duration: "3 రోజులు", purpose: "జలుబు, ముక్కు కారడం మరియు అలెర్జీ తగ్గించడానికి" },
        { name: "దగ్గు సిరప్ (Cough Syrup)", dosage: "10ml", frequency: "రోజుకు 3 సార్లు (గోరువెచ్చని నీటితో)", duration: "4 రోజులు", purpose: "పొడి దగ్గును తగ్గించడానికి మరియు ఉపశమనం కోసం" }
      ];
    }
    if (isStomach) {
      return [
        { name: "డిసైక్లోమైన్ (Dicyclomine)", dosage: "20mg", frequency: "నొప్పి ఉన్నప్పుడు మాత్రమే (ఆహారం తర్వాత)", duration: "2 రోజులు", purpose: "కడుపు నొప్పి మరియు శూల నొప్పుల నుండి ఉపశమనానికి" },
        { name: "పాంటోప్రజోల్ (Pantoprazole)", dosage: "40mg", frequency: "ఉదయం పరిగడుపున (ఆహారానికి 30 నిమిషాల ముందు)", duration: "5 రోజులు", purpose: "కడుపులో మంట, అసిడిటీ మరియు గ్యాస్ తగ్గించడానికి" }
      ];
    }
    if (isNauseaVomiting) {
      return [
        { name: "డోంపెరిడోన్ (Domperidone)", dosage: "10mg", frequency: "భోజనానికి 15 నిమిషాల ముందు (అవసరమైతే)", duration: "3 రోజులు", purpose: "వాంతులు మరియు వికారం తగ్గించడానికి" },
        { name: "ఓఆర్ఎస్ (ORS)", dosage: "1 ప్యాకెట్", frequency: "1 లీటర్ నీటిలో కలిపి త్రాగాలి", duration: "2 రోజులు", purpose: "వాంతుల వల్ల కోల్పోయిన నీటిని మరియు లవణాలను భర్తీ చేయడానికి" }
      ];
    }
    if (isBreath) {
      return [
        { name: "సాల్బుటమాల్ ఇన్హేలర్ (Salbutamol Inhaler)", dosage: "100mcg", frequency: "ఆయాసం వచ్చినప్పుడు 1-2 పఫ్స్", duration: "అవసరమైన మేరకు", purpose: "శ్వాస మార్గాలను తెరిచి శ్వాస తీసుకోవడం సులభతరం చేయడానికి" }
      ];
    }
    return [
      { name: "మల్టీవిటమిన్ టాబ్లెట్ (Multivitamin)", dosage: "1 టాబ్లెట్", frequency: "రోజుకు ఒకసారి ఉదయం భోజనం తర్వాత", duration: "10 రోజులు", purpose: "శరీరంలో రోగనిరోధక శక్తిని పెంచడానికి" }
    ];
  } else if (lang === 'hi') {
    if (isFever) {
      return [
        { name: "पैरासिटामोल (Paracetamol)", dosage: "500mg", frequency: "दिन में 3 बार (खाने के बाद)", duration: "3 दिन", purpose: "बुखार और बदन दर्द को कम करने के लिए" },
        { name: "ओआरएस (ORS)", dosage: "1 पैकेट", frequency: "1 लीटर पानी में घोलकर दिनभर पिएं", duration: "2 दिन", purpose: "डीहाइड्रेशन दूर करने और इलेक्ट्रोलाइट्स संतुलित करने के लिए" }
      ];
    }
    if (isHeadache) {
      return [
        { name: "आइबूप्रोफेन (Ibuprofen)", dosage: "400mg", frequency: "दिन में 2 बार (खाने के बाद)", duration: "2 दिन", purpose: "तेज सिरदर्द और सूजन को कम करने के लिए" },
        { name: "मैग्नीशियम (Magnesium)", dosage: "250mg", frequency: "दिन में एक बार सोने से पहले", duration: "5 दिन", purpose: "मांसपेशियों और नसों के तनाव को कम करने के लिए" }
      ];
    }
    if (isCoughColdSoreThroat) {
      return [
        { name: "सिट्रीजिन (Cetirizine)", dosage: "10mg", frequency: "रात को सोने से पहले एक गोली", duration: "3 दिन", purpose: "जुकाम, बहती नाक और गले की खुजली से राहत के लिए" },
        { name: "कफ सिरप (Cough Syrup)", dosage: "10ml", frequency: "दिन में 3 बार (गुनगुने पानी के साथ)", duration: "4 दिन", purpose: "खांसी को कम करने और गले को आराम देने के लिए" }
      ];
    }
    if (isStomach) {
      return [
        { name: "डाइसाइक्लोमाइन (Dicyclomine)", dosage: "20mg", frequency: "दर्द होने पर ही (खाने के बाद)", duration: "2 दिन", purpose: "पेट दर्द और मरोड़ से तुरंत राहत के लिए" },
        { name: "पेंटाप्राजोल (Pantoprazole)", dosage: "40mg", frequency: "सुबह खाली पेट (खाने से 30 मिनट पहले)", duration: "5 दिन", purpose: "एसिडिटी, पेट की गैस और सीने की जलन को कम करने के लिए" }
      ];
    }
    if (isNauseaVomiting) {
      return [
        { name: "डोमपेरिडोन (Domperidone)", dosage: "10mg", frequency: "भोजन से 15 मिनट पहले (आवश्यकतानुसार)", duration: "3 दिन", purpose: "उल्टी और जी मिचलाना रोकने के लिए" },
        { name: "ओआरएस (ORS)", dosage: "1 पैकेट", frequency: "1 लीटर पानी में घोलकर पिएं", duration: "2 दिन", purpose: "उल्टी के कारण शरीर में पानी की कमी दूर करने के लिए" }
      ];
    }
    if (isBreath) {
      return [
        { name: "साल्बुटामोल इनहेलर (Salbutamol Inhaler)", dosage: "100mcg", frequency: "सांस फूलने पर 1-2 कश (Puffs)", duration: "आवश्यकतानुसार", purpose: "श्वसन मार्ग को खोलकर सांस लेना आसान बनाने के लिए" }
      ];
    }
    return [
      { name: "मल्टीविटामिन (Multivitamin)", dosage: "1 गोली", frequency: "दिन में एक बार नाश्ते के बाद", duration: "10 दिन", purpose: "शारीरिक कमजोरी दूर करने और इम्युनिटी बढ़ाने के लिए" }
    ];
  } else {
    // English default
    if (isFever) {
      return [
        { name: "Paracetamol", dosage: "500mg", frequency: "1 tablet every 6 hours (after food)", duration: "3 days", purpose: "To reduce fever and relieve body aches" },
        { name: "ORS (Oral Rehydration Salts)", dosage: "1 sachet", frequency: "Dissolved in 1L water, drink throughout the day", duration: "2 days", purpose: "To cure dehydration and restore body electrolytes" }
      ];
    }
    if (isHeadache) {
      return [
        { name: "Ibuprofen", dosage: "400mg", frequency: "1 tablet twice a day (after food)", duration: "2 days", purpose: "To relieve severe headache pain and reduce tension" },
        { name: "Magnesium Complex", dosage: "250mg", frequency: "Once daily before sleep", duration: "5 days", purpose: "To relax blood vessels and prevent muscle contraction headache" }
      ];
    }
    if (isCoughColdSoreThroat) {
      return [
        { name: "Cetirizine", dosage: "10mg", frequency: "1 tablet at bedtime", duration: "3 days", purpose: "To relieve cold symptoms, runny nose, and allergies" },
        { name: "Cough Syrup", dosage: "10ml", frequency: "3 times daily", duration: "4 days", purpose: "To soothe throat irritation and relieve cough" }
      ];
    }
    if (isStomach) {
      return [
        { name: "Dicyclomine", dosage: "20mg", frequency: "1 tablet when pain occurs (after food)", duration: "2 days", purpose: "To relieve abdominal cramps and bowel muscle spasms" },
        { name: "Pantoprazole", dosage: "40mg", frequency: "Once daily in morning (30 mins before breakfast)", duration: "5 days", purpose: "To reduce stomach acidity, gas, and heartburn" }
      ];
    }
    if (isNauseaVomiting) {
      return [
        { name: "Domperidone", dosage: "10mg", frequency: "1 tablet 15 mins before meals (as needed)", duration: "3 days", purpose: "To stop vomiting and prevent nausea sensations" },
        { name: "ORS (Oral Rehydration Salts)", dosage: "1 sachet", frequency: "Dissolved in 1L water, drink as needed", duration: "2 days", purpose: "To restore body fluids lost due to vomiting" }
      ];
    }
    if (isBreath) {
      return [
        { name: "Salbutamol Inhaler", dosage: "100mcg", frequency: "1-2 puffs as needed during distress", duration: "As needed", purpose: "To widen airways and ease breathing" }
      ];
    }
    return [
      { name: "Multivitamin", dosage: "1 tablet", frequency: "Once daily after morning breakfast", duration: "10 days", purpose: "To boost general immune recovery" }
    ];
  }
}

function handleMockAISymptoms(res: Response, chatHistory: any[], msg: string, lang: string = 'en') {
  const text = msg.toLowerCase();
  
  // Emergency checks
  if (text.includes('chest pain') || text.includes('breathing') || text.includes('stroke') || text.includes('seizure') || text.includes('suicide') || text.includes('allergic') || text.includes('గుండె') || text.includes('శ్వాస') || text.includes('నొప్పి')) {
    return res.json({
      emergency: true,
      needsMoreInfo: false,
      question: "",
      options: [],
      riskLevel: "emergency"
    });
  }

  const historyLen = chatHistory.length;

  if (lang === 'te') {
    if (historyLen < 2) {
      return res.json({
        emergency: false,
        needsMoreInfo: true,
        question: "నేను అర్థం చేసుకోగలను. మీ అసౌకర్యం 1 నుండి 10 స్కేల్‌లో ఎంత తీవ్రంగా ఉందో మరియు ఇది ఎప్పుడు ప్రారంభమైందో చెప్పగలరా?",
        options: ["1-3 (తేలికపాటి అసౌకర్యం)", "4-6 (మధ్యస్థ అసౌకర్యం)", "7-10 (తీవ్రమైన అసౌకర్యం)", "ఈరోజే ప్రారంభమైంది", "కొన్ని రోజుల క్రితం ప్రారంభమైంది"]
      });
    } else if (historyLen < 4) {
      return res.json({
        emergency: false,
        needsMoreInfo: true,
        question: "మీకు జ్వరం, దగ్గు, మైకము లేదా వాంతులు వంటి ఇతర లక్షణాలు ఉన్నాయా? అలాగే, మీకు మధుమేహం (డయాబెటిస్) వంటి ఏవైనా అలెర్జీలు లేదా ఇతర ఆరోగ్య సమస్యలు ఉన్నాయా?",
        options: ["అవును, నాకు స్వల్ప జ్వరం ఉంది", "అవును, నాకు దగ్గు ఉంది", "ఇతర లక్షణాలు లేవు", "నాకు డయాబెటిస్ ఉంది", "ఎలాంటి అలెర్జీలు లేదా ఆరోగ్య సమస్యలు లేవు"]
      });
    }

    return res.json({
      emergency: false,
      needsMoreInfo: false,
      question: "",
      options: [],
      riskLevel: text.includes('తీవ్ర') || text.includes('severe') || text.includes('bad') ? 'moderate' : 'low',
      confidenceScore: 85,
      summary: `రోగి లక్షణాలను ఈ విధంగా నివేదించారు: "${msg}". విశ్రాంతి మరియు తగినంత ద్రవపదార్థాలు తీసుకోవాలని సూచించబడింది.`,
      conditions: ["తేలికపాటి వైరల్ ఇన్ఫెక్షన్ (Viral Infection)", "డీహైడ్రేషన్ తలనొప్పి (Dehydration)"],
      homeCare: [
        "టాక్సిన్లను బయటకు పంపడానికి ఈరోజు కనీసం 2.5 లీటర్ల నీరు త్రాగాలి.",
        "ఒత్తిడిని తగ్గించడానికి ప్రశాంతమైన, చీకటి గదిలో 8 గంటలు విశ్రాంతి తీసుకోండి.",
        "ఆవిరి పట్టడం ద్వారా శ్వాస మార్గాలను తెరవవచ్చు."
      ],
      medicineGuidance: "తేలికపాటి లక్షణాల కోసం, మీరు ఫార్మసిస్ట్ సలహా మేరకు పారాసెటమాల్ వంటి ప్రామాణిక ఓవర్-ది-కౌంటర్ మందులను తీసుకోవచ్చు. లక్షణాలు 48 గంటల కంటే ఎక్కువ ఉంటే, వైద్యుడిని సంప్రదించండి.",
      doctorRecommendation: "వాయిస్ లేదా చాట్ ద్వారా జనరల్ ఫిజీషియన్ సంప్రదింపులు.",
      prescriptions: getMockPrescriptions(text, lang)
    });
  } else if (lang === 'hi') {
    if (historyLen < 2) {
      return res.json({
        emergency: false,
        needsMoreInfo: true,
        question: "मैं समझ सकता हूँ। क्या आप बता सकते हैं कि 1 से 10 के पैमाने पर आपकी परेशानी कितनी गंभीर है, और यह कब शुरू हुई?",
        options: ["1-3 (हल्की परेशानी)", "4-6 (मध्यम परेशानी)", "7-10 (गंभीर परेशानी)", "आज ही शुरू हुआ", "कुछ दिन पहले शुरू हुआ"]
      });
    } else if (historyLen < 4) {
      return res.json({
        emergency: false,
        needsMoreInfo: true,
        question: "क्या आपको बुखार, खांसी, चक्कर आना या उल्टी जैसे कोई अन्य लक्षण हैं? इसके अलावा, क्या आपको कोई एलर्जी या मधुमेह (डायबिटीज) जैसी कोई बीमारी है?",
        options: ["हाँ, मुझे हल्का बुखार है", "हाँ, मुझे खांसी है", "कोई अन्य लक्षण नहीं", "मुझे डायबिटीज है", "कोई एलर्जी या बीमारी नहीं"]
      });
    }

    return res.json({
      emergency: false,
      needsMoreInfo: false,
      question: "",
      options: [],
      riskLevel: text.includes('severe') || text.includes('bad') ? 'moderate' : 'low',
      confidenceScore: 85,
      summary: `मरीज ने अपने लक्षण इस प्रकार बताए हैं: "${msg}"। आराम करने और पर्याप्त मात्रा में तरल पदार्थ लेने की सलाह दी गई है।`,
      conditions: ["हल्का वायरल संक्रमण", "निर्जलीकरण (डिहाइड्रेशन) सिरदर्द"],
      homeCare: [
        "शरीर से टॉक्सिन्स बाहर निकालने के लिए आज कम से कम 2.5 लीटर पानी पिएं।",
        "तनाव कम करने के लिए एक शांत, अंधेरे कमरे में 8 घंटे आराम करें।",
        "भाप लेने से बंद नाक और श्वसन मार्ग खोलने में मदद मिल सकती है।"
      ],
      medicineGuidance: "हल्के लक्षणों के लिए, आप फार्मासिस्ट की सलाह पर पैरासिटामोल जैसी सामान्य दवाएं ले सकते हैं। यदि लक्षण 48 घंटे से अधिक समय तक बने रहते हैं, तो डॉक्टर से संपर्क करें।",
      doctorRecommendation: "वॉइस या चैट के माध्यम से सामान्य चिकित्सक (General Practitioner) से परामर्श लें।",
      prescriptions: getMockPrescriptions(text, lang)
    });
  }

  // Return assessment default English
  if (historyLen < 2) {
    return res.json({
      emergency: false,
      needsMoreInfo: true,
      question: "I understand. Could you tell me how severe your discomfort is on a scale of 1 to 10, and when did it start?",
      options: ["1-3 (Mild discomfort)", "4-6 (Moderate discomfort)", "7-10 (Severe discomfort)", "Started today", "Started a few days ago"]
    });
  } else if (historyLen < 4) {
    return res.json({
      emergency: false,
      needsMoreInfo: true,
      question: "Do you have other symptoms like fever, cough, dizziness, or vomiting? Also, do you have any allergies or chronic conditions like diabetes?",
      options: ["Yes, mild fever", "Yes, cough", "No other symptoms", "I have diabetes", "No allergies or health issues"]
    });
  }

  return res.json({
    emergency: false,
    needsMoreInfo: false,
    question: "",
    options: [],
    riskLevel: text.includes('severe') || text.includes('bad') ? 'moderate' : 'low',
    confidenceScore: 85,
    summary: `Patient reports having symptoms described as: "${msg}". High-quality fluids and rest have been advised.`,
    conditions: ["Mild viral infection", "Dehydration headache"],
    homeCare: [
      "Ensure hydration by drinking at least 2.5L of water today to flush toxins.",
      "Rest in a quiet, dark room for 8 hours to reduce stress.",
      "Steam inhalation can help open blocked nasal passages."
    ],
    medicineGuidance: "For mild symptoms, you may consider standard over-the-counter options (like paracetamol) under the advice of a pharmacist. If symptoms persist for more than 48 hours, seek medical attention.",
    doctorRecommendation: "General Practitioner consultation via voice or chat.",
    prescriptions: getMockPrescriptions(text, lang)
  });
}

function handleMockMedicineExplain(res: Response, medName: string, lang: string = 'en') {
  if (lang === 'te') {
    return res.json({
      name: medName,
      whatIsIt: `${medName} అనేది సాధారణంగా జ్వరం తగ్గించడానికి, నొప్పి నివారణకు లేదా కండరాల నొప్పుల ఉపశమనానికి ఉపయోగించే ఒక సాధారణ ఔషధం.`,
      whatUsedFor: "జ్వరం నివారణ, తలనొప్పి, ఒంటి నొప్పులు మరియు స్వల్ప వాపుల నివారణ.",
      howItWorks: "ఇది మెదడుకు వెళ్ళే నొప్పి సంకేతాలను మరియు జ్వరాన్ని కలిగించే ప్రోస్టాగ్లాండిన్స్ అనే రసాయనాలను అడ్డుకుంటుంది.",
      adultUse: "సాధారణంగా రోజుకు 1 నుండి 2 సార్లు డాక్టర్ లేదా ఫార్మసిస్ట్ సలహా ప్రకారం తీసుకోవాలి.",
      foodTiming: "కడుపు మంటను నివారించడానికి ఆహారం తీసుకున్న తర్వాత మాత్రమే దీనిని వేసుకోవాలి.",
      dosingSchedule: "ప్రతి 6 గంటలకు ఒక టాబ్లెట్, 24 గంటల్లో 4 టాబ్లెట్లకు మించరాదు.",
      commonSideEffects: ["తేలికపాటి నిద్రమత్తు", "కడుపు ఉబ్బరం లేదా తిప్పడం", "నోరు ఎండిపోవడం"],
      seriousSideEffects: ["చర్మంపై ఎర్రటి దద్దుర్లు", "శ్వాస తీసుకోవడంలో ఇబ్బంది", "తీవ్రమైన మైకము"],
      drugInteractions: ["ఇదే రసాయన కలయిక గల ఇతర మందులను కలిపి తీసుకోరాదు", "రక్తాన్ని పలచన చేసే మందులు వాడుతుంటే డాక్టరును సంప్రదించండి"],
      foodInteractions: ["మందు వేసుకునే సమయంలో మద్యపానం పూర్తిగా నివారించండి", "అధిక కాఫీ/టీ వినియోగం తగ్గించండి"],
      precautions: {
        pregnancy: "గర్భవతులు తీసుకునే ముందు తప్పనిసరిగా గైనకాలజిస్ట్‌ను సంప్రదించాలి.",
        breastfeeding: "పాలిచ్చే తల్లులు వైద్యుడిని సంప్రదించిన తర్వాతే దీనిని వాడాలి.",
        driving: "మందు వేసుకున్న తర్వాత నిద్రమత్తుగా అనిపిస్తే వాహనాలు నడపరాదు.",
        alcohol: "మద్యంతో కలిపి తీసుకుంటే కాలేయంపై తీవ్ర ప్రభావం పడే అవకాశం ఉంది."
      },
      storageInstructions: "తేమ మరియు సూర్యకాంతి తగలని పొడి ప్రదేశంలో 25°C లోపు భద్రపరచండి.",
      missedDoseGuidance: "గుర్తుకు రాగానే వేసుకోండి, ఒకవేళ తదుపరి డోస్ సమయం దగ్గరపడితే పాత డోస్ వదిలేయండి. రెండు డోస్‌లు కలిపి వేసుకోరాదు.",
      overdoseAdvice: "అధిక మోతాదు తీసుకున్నట్లయితే వెంటనే అత్యవసర వైద్య సహాయం లేదా సమీపంలోని విష నియంత్రణ కేంద్రానికి వెళ్ళండి.",
      whenToContactDoctor: "తీవ్రమైన అలెర్జీ లక్షణాలు, పెదవుల వాపు లేదా శ్వాస ఆడకపోవడం వంటివి జరిగితే వెంటనే డాక్టరును సంప్రదించండి."
    });
  } else if (lang === 'hi') {
    return res.json({
      name: medName,
      whatIsIt: `${medName} आमतौर पर हल्के दर्द, बुखार को कम करने या विशिष्ट सूजन से राहत पाने के लिए उपयोग की जाने वाली एक सामान्य दवा है।`,
      whatUsedFor: "बुखार को कम करने, मांसपेशियों के दर्द या एलर्जी से राहत पाने के लिए।",
      howItWorks: "यह मस्तिष्क तक जाने वाले दर्द के संकेतों और बुखार पैदा करने वाले रसायनों को रोकने का काम करती है।",
      adultUse: "आमतौर पर डॉक्टर या फार्मासिस्ट की सलाह के अनुसार दिन में 1 से 2 बार लिया जाता है।",
      foodTiming: "पेट की जलन से बचने के लिए इसे भोजन के बाद ही लें।",
      dosingSchedule: "हर 6 घंटे में एक गोली, 24 घंटे में 4 गोलियों से अधिक न लें।",
      commonSideEffects: ["हल्की नींद आना", "पेट खराब होना", "मुंह का सूखना"],
      seriousSideEffects: ["त्वचा पर लाल चकत्ते", "निगलने में कठिनाई", "तेज चक्कर आना"],
      drugInteractions: ["समान साल्ट वाली अन्य दवाओं के साथ न लें", "यदि खून पतला करने वाली दवा चल रही है तो डॉक्टर से सलाह लें"],
      foodInteractions: ["दवा के दौरान शराब का सेवन न करें", "अत्यधिक कैफीन से बचें"],
      precautions: {
        pregnancy: "गर्भावस्था के दौरान डॉक्टर की सलाह के बिना न लें।",
        breastfeeding: "स्तनपान कराने वाली माताएं डॉक्टर से सलाह लें।",
        driving: "यदि चक्कर या नींद आए तो वाहन न चलाएं।",
        alcohol: "शराब के साथ लेने से लीवर को गंभीर नुकसान हो सकता है।"
      },
      storageInstructions: "सूखे स्थान पर 25°C से कम तापमान पर सीधे धूप से बचाकर रखें।",
      missedDoseGuidance: "याद आते ही इसे लें, लेकिन यदि अगली खुराक का समय हो गया है तो छूटी हुई खुराक छोड़ दें। दोहरी खुराक न लें।",
      overdoseAdvice: "अत्यधिक खुराक लेने पर तुरंत आपातकालीन चिकित्सा सहायता लें।",
      whenToContactDoctor: "यदि चेहरे या होठों पर सूजन, त्वचा पर दाने या सांस लेने में तकलीफ हो तो तुरंत डॉक्टर से संपर्क करें।"
    });
  }

  res.json({
    name: medName,
    whatIsIt: `${medName} is commonly used for managing mild pain, reduction of fever, or specific chronic control.`,
    whatUsedFor: "Fever reduction, minor muscle aches, or allergy relief depending on active drug compound.",
    howItWorks: "Inhibits active chemical pathways in the nervous system to block pain signalling or histamine release.",
    adultUse: "Typically taken 1 to 2 times daily as advised by a doctor.",
    foodTiming: "Take after food to avoid stomach irritation.",
    dosingSchedule: "One tablet every 6 hours, not exceeding 4 tablets in 24 hours.",
    commonSideEffects: ["Mild drowsiness", "Stomach upset", "Dry mouth"],
    seriousSideEffects: ["Skin rashes", "Difficulty swallowing", "Severe dizziness"],
    drugInteractions: ["Do not take with other products containing similar compounds", "Consult doctor if using blood thinners"],
    foodInteractions: ["Avoid grapefruit juice", "Avoid excessive caffeine"],
    precautions: {
      pregnancy: "Consult your doctor before taking if pregnant.",
      breastfeeding: "Consult standard clinician parameters.",
      driving: "Do not operate heavy machinery if drowsiness occurs.",
      alcohol: "Avoid alcohol as it may increase liver strain or drowsiness."
    },
    storageInstructions: "Store at room temperature below 25°C in a dry place away from direct sunlight.",
    missedDoseGuidance: "Take it as soon as you remember, unless it is close to the next dose. Do not double dose.",
    overdoseAdvice: "Immediately contact emergency services or go to the nearest poison control centre.",
    whenToContactDoctor: "If you develop hives, breathing trouble, or if your symptoms worsen."
  });
}

function handleMockNutrition(res: Response, profile: any, chronic: string, allergies: string, lang: string = 'en') {
  if (lang === 'te') {
    return res.json({
      foodsToEat: ["ఆకుకూరలు (పాలకూర, తోటకూర)", "తాజా పండ్లు (యాపిల్స్, బొప్పాయి)", "తృణధాన్యాలు (రాగులు, జొన్నలు)", "ప్రోటీన్ ఆహారాలు (పప్పులు, పాలు, గుడ్లు)"],
      foodsToAvoid: ["నూనెలో వేయించిన ఫాస్ట్ ఫుడ్స్", "ఎక్కువ ఉప్పు మరియు నిల్వ పచ్చళ్ళు", "కృత్రిమ తీపి పానీయాలు మరియు కూల్ డ్రింక్స్"],
      dailyWaterGoal: "3.0 లీటర్లు",
      recommendedFruits: ["బొప్పాయి", "యాపిల్", "జామకాయ", "నారింజ"],
      recommendedVegetables: ["సొరకాయ", "బెండకాయ", "క్యారెట్", "బీరకాయ"],
      proteinSources: ["కందిపప్పు, పెసరపప్పు", "పాలు మరియు పనీర్", "ఉడకబెట్టిన గుడ్లు"],
      essentialVitamins: ["వి...). విటమిన్ సి (రోగనిరోధక శక్తి పెంచడానికి)", "విటమిన్ డి (ఎముకల బలం కోసం)", "ఐరన్ మరియు కాల్షియం"],
      recoveryDietPlan: "ఉదయం: రాగి జావ లేదా ఇడ్లీ. మధ्याహ్నం: గోధుమ రొట్టె లేదా బ్రౌన్ రైస్ తో పప్పు మరియు కూర. రాత్రి: తేలికపాటి భోజనం (కిచిడీ) మరియు ఒక గ్లాసు పాలు."
    });
  } else if (lang === 'hi') {
    return res.json({
      foodsToEat: ["हरी पत्तेदार सब्जियां (पालक, बथुआ)", "ताजे फल (सेब, पपीता)", "साबुत अनाज (रागी, बाजरा)", "प्रोटीन युक्त आहार (दालें, दूध, अंडे)"],
      foodsToAvoid: ["तले हुए और मसालेदार जंक फूड", "अत्यधिक नमक और अचार", "कृत्रिम मीठे पेय और कोल्ड ड्रिंक्स"],
      dailyWaterGoal: "3.0 लीटर",
      recommendedFruits: ["पपीता", "सेब", "अमरूद", "संतरा"],
      recommendedVegetables: ["लौकी", "भिंडी", "गाजर", "तोरई"],
      proteinSources: ["अरहर और मूंग की दाल", "दूध और पनीर", "उबले हुए अंडे"],
      essentialVitamins: ["विटामिन सी (प्रतिरोधक क्षमता बढ़ाने के लिए)", "विटामिन डी (हड्डियों के लिए)", "आयरन और कैल्शियम"],
      recoveryDietPlan: "सुबह: रागी का दलिया या इडली। दोपहर: गेहूं की रोटी या दलिया के साथ हरी सब्जी और दाल। रात: हल्का भोजन (खिचड़ी) और एक गिलास गुनगुना दूध।"
    });
  }

  res.json({
    foodsToEat: ["Leafy green vegetables (spinach, kale)", "Lean proteins (grilled chicken, lentils)", "Whole grains (oats, brown rice)"],
    foodsToAvoid: ["Processed sugar foods", "Excess sodium / canned snacks", "Trans-fats"],
    dailyWaterGoal: "3.0 Litres",
    recommendedFruits: ["Apples", "Oranges", "Berries"],
    recommendedVegetables: ["Broccoli", "Carrots", "Spinach"],
    proteinSources: ["Tofu", "Egg whites", "Legumes"],
    essentialVitamins: ["Vitamin C (immune recovery)", "Vitamin D", "B-Complex"],
    recoveryDietPlan: "Focus on a soft, easy-to-digest diet. Incorporate clear vegetable soups and warm herbal infusions. Keep meals small and frequent."
  });
}

function handleMockReportAnalysis(res: Response, text: string, filename: string, lang: string = 'en') {
  const lowercaseText = text.toLowerCase();
  
  // Detect report indicators
  const hasGlucose = lowercaseText.includes('glucose') || lowercaseText.includes('sugar') || lowercaseText.includes('diabetes') || lowercaseText.includes('గ్లూకోజ్') || lowercaseText.includes('शुगर');
  const hasCholesterol = lowercaseText.includes('cholesterol') || lowercaseText.includes('lipid') || lowercaseText.includes('fat') || lowercaseText.includes('కొలెస్ట్రాల్') || lowercaseText.includes('कोलेस्ट्रॉल');
  const hasHemoglobin = lowercaseText.includes('hemoglobin') || lowercaseText.includes('iron') || lowercaseText.includes('anemia') || lowercaseText.includes('హిమోగ్లోబిన్') || lowercaseText.includes('हीमोग्लोबिन');

  if (lang === 'te') {
    return res.json({
      reportType: filename.toUpperCase().includes('LIPID') || hasCholesterol ? "లిపిడ్ ప్రొఫైల్ రిపోర్ట్ (Lipid Profile)" : hasGlucose ? "బ్లడ్ గ్లూకోజ్ ప్యానెల్ (Blood Glucose)" : "పూర్తి రక్త పరీక్ష (Complete Blood Count)",
      patientName: "విశాల్ రావు (Vishal Rao)",
      dateAnalyzed: new Date().toLocaleDateString('te-IN'),
      findings: [
        {
          marker: "హిమోగ్లోబిన్ (Hemoglobin)",
          value: hasHemoglobin ? "10.2 g/dL" : "14.1 g/dL",
          status: hasHemoglobin ? "low" : "normal",
          interpretation: hasHemoglobin ? "రక్తహీనత (Anemia) సూచన. దీనివల్ల అలసట, బలహీనత కలుగుతుంది." : "హిమోగ్లోబిన్ సాధారణ స్థాయిలో ఉంది."
        },
        {
          marker: "మొత్తం కొలెస్ట్రాల్ (Total Cholesterol)",
          value: hasCholesterol ? "245 mg/dL" : "185 mg/dL",
          status: hasCholesterol ? "high" : "normal",
          interpretation: hasCholesterol ? "కొలెస్ట్రాల్ అధికంగా ఉంది. గుండె జబ్బుల ముప్పు పెరగవచ్చు." : "కొలెస్ట్రాల్ సాధారణ పరిమితిలో ఉంది."
        },
        {
          marker: "ఫాస్టింగ్ బ్లడ్ షుగర్ (Fasting Glucose)",
          value: hasGlucose ? "135 mg/dL" : "90 mg/dL",
          status: hasGlucose ? "high" : "normal",
          interpretation: hasGlucose ? "గ్లూకోజ్ уровень సాధారణం కంటే ఎక్కువ. మధుమేహం ఉండే అవకాశం ఉంది." : "రక్తంలో చక్కెర స్థాయిలు అదుపులో ఉన్నాయి."
        }
      ],
      problems: [
        ...(hasHemoglobin ? ["రక్తహీనత (Mild Anemia)"] : []),
        ...(hasCholesterol ? ["హైపర్ కొలెస్ట్రాలేమియా (Hypercholesterolemia)"] : []),
        ...(hasGlucose ? ["డయాబెటిస్ మెల్లిటస్ (Diabetes Mellitus)"] : []),
        ...(!hasHemoglobin && !hasCholesterol && !hasGlucose ? ["సాధారణ రక్త నివేదిక (Normal Profile)"] : [])
      ],
      recommendedFoods: [
        "ఆకుకూరలు (పాలకూర) మరియు బీట్‌రూట్ (ఐరన్ కోసం)",
        "రాగులు, ఓట్స్ మరియు తృణధాన్యాలు (ఫైబర్ కొరకు)",
        "తాజా పండ్లు (జామకాయ, నిమ్మకాయ, యాపిల్స్)",
        "బాదం, అక్రోట్లు (మంచి కొవ్వులు)"
      ],
      avoidedFoods: [
        "నూనెలో వేయించిన ఫుడ్స్ మరియు జంక్ ఫుడ్",
        "తీపి పదార్థాలు, ఐస్ క్రీములు మరియు కూల్ డ్రింక్స్",
        "ఎర్రటి మాంసం మరియు ప్రాసెస్ చేసిన ఆహారాలు"
      ],
      prescriptions: [
        ...(hasHemoglobin ? [{ name: "ఐరన్ కాంప్లెక్స్ (Iron Tablet)", dosage: "100mg", frequency: "రోజుకు ఒకసారి రాత్రి భోజనం తర్వాత", duration: "30 రోజులు", purpose: "శరీరంలో ఐరన్ మరియు హిమోగ్లోబిన్ పెంచడానికి" }] : []),
        ...(hasCholesterol ? [{ name: "అటోర్వాస్టాటిన్ (Atorvastatin)", dosage: "10mg", frequency: "పడుకునే ముందు ఒక టాబ్లెట్", duration: "15 రోజులు", purpose: "చెడు కొలెస్ట్రాల్ తగ్గించడానికి" }] : []),
        ...(hasGlucose ? [{ name: "మెట్‌ఫార్మిన్ (Metformin)", dosage: "500mg", frequency: "రోజుకు ఒకసారి రాత్రి భోజనంతో పాటు", duration: "30 రోజులు", purpose: "రక్తంలో షుగర్ స్థాయిని అదుపులో ఉంచడానికి" }] : [])
      ],
      guidance: "మీ నివేదిక ఆధారంగా ఆరోగ్యకరమైన జీవనశైలిని పాటించండి. రోజుకు 30 నిమిషాలు నడవండి మరియు తగినంత విశ్రాంతి తీసుకోండి. 3 నెలల తర్వాత మళ్ళీ రక్త పరీక్ష చేయించుకోండి."
    });
  } else if (lang === 'hi') {
    return res.json({
      reportType: filename.toUpperCase().includes('LIPID') || hasCholesterol ? "लिपिड प्रोफाइल रिपोर्ट (Lipid Profile)" : hasGlucose ? "ब्लड ग्लूकोज पैनल (Blood Glucose)" : "कम्पलीट ब्लड काउंट (Complete Blood Count)",
      patientName: "विशाल राव (Vishal Rao)",
      dateAnalyzed: new Date().toLocaleDateString('hi-IN'),
      findings: [
        {
          marker: "हीमोग्लोबिन (Hemoglobin)",
          value: hasHemoglobin ? "10.2 g/dL" : "14.1 g/dL",
          status: hasHemoglobin ? "low" : "normal",
          interpretation: hasHemoglobin ? "रक्तअल्पता (Anemia) का संकेत। इससे थकान और कमजोरी हो सकती है।" : "हीमोग्लोबिन सामान्य स्तर पर है।"
        },
        {
          marker: "कुल कोलेस्ट्रॉल (Total Cholesterol)",
          value: hasCholesterol ? "245 mg/dL" : "185 mg/dL",
          status: hasCholesterol ? "high" : "normal",
          interpretation: hasCholesterol ? "कोलेस्ट्रॉल का स्तर अधिक है। हृदय स्वास्थ्य का ध्यान रखें।" : "कोलेस्ट्रॉल सामान्य सीमा में है।"
        },
        {
          marker: "खाली पेट ग्लूकोज (Fasting Glucose)",
          value: hasGlucose ? "135 mg/dL" : "90 mg/dL",
          status: hasGlucose ? "high" : "normal",
          interpretation: hasGlucose ? "ब्लड शुगर स्तर बढ़ा हुआ है। मधुमेह की संभावना हो सकती है।" : "शुगर सामान्य स्तर पर है।"
        }
      ],
      problems: [
        ...(hasHemoglobin ? ["माइल्ड एनीमिया (Anemia)"] : []),
        ...(hasCholesterol ? ["उच्च कोलेस्ट्रॉल (High Cholesterol)"] : []),
        ...(hasGlucose ? ["मधुमेह (Diabetes)"] : []),
        ...(!hasHemoglobin && !hasCholesterol && !hasGlucose ? ["सामान्य रिपोर्ट (Normal Lab Report)"] : [])
      ],
      recommendedFoods: [
        "हरी पत्तेदार सब्जियां, पालक और अनार (आयरन के लिए)",
        "साबुत अनाज, दलिया और ओट्स (फाइबर के लिए)",
        "ताजे खट्टे फल (संतरा, नींबू, आंवला)",
        "अखरोट और बादाम (स्वस्थ वसा)"
      ],
      avoidedFoods: [
        "ज्यादा तली हुई चीजें और रिफाइंड तेल",
        "सफेद चीनी, मिठाइयां और कृत्रिम पेय",
        "लाल मांस और डिब्बाबंद जंक फूड"
      ],
      prescriptions: [
        ...(hasHemoglobin ? [{ name: "आयरन सप्लीमेंट (Iron Tablet)", dosage: "100mg", frequency: "दिन में एक बार रात के भोजन के बाद", duration: "30 दिन", purpose: "खून की कमी को दूर करने के लिए" }] : []),
        ...(hasCholesterol ? [{ name: "अटोर्वास्टेटिन (Atorvastatin)", dosage: "10mg", frequency: "रात को सोने से पहले", duration: "15 दिन", purpose: "कोलेस्ट्रॉल के स्तर को घटाने के लिए" }] : []),
        ...(hasGlucose ? [{ name: "मेटफॉर्मिन (Metformin)", dosage: "500mg", frequency: "रात के भोजन के समय", duration: "30 दिन", purpose: "ब्लड शुगर लेवल को नियंत्रित करने के लिए" }] : [])
      ],
      guidance: "रिपोर्ट के अनुसार भोजन में बदलाव करें। रोजाना कम से कम 30 मिनट टहलें और भरपूर पानी पिएं। चिकित्सक से नियमित परामर्श लें।"
    });
  } else {
    // English default
    return res.json({
      reportType: filename.toUpperCase().includes('LIPID') || hasCholesterol ? "Lipid Profile Report" : hasGlucose ? "Blood Glucose Panel" : "Complete Blood Count (CBC)",
      patientName: "Vishal Rao",
      dateAnalyzed: new Date().toLocaleDateString('en-US'),
      findings: [
        {
          marker: "Hemoglobin",
          value: hasHemoglobin ? "10.2 g/dL" : "14.1 g/dL",
          status: hasHemoglobin ? "low" : "normal",
          interpretation: hasHemoglobin ? "Indicates mild anemia. May cause fatiguability and low oxygen concentration." : "Hemoglobin concentration is within healthy range."
        },
        {
          marker: "Total Cholesterol",
          value: hasCholesterol ? "245 mg/dL" : "185 mg/dL",
          status: hasCholesterol ? "high" : "normal",
          interpretation: hasCholesterol ? "Elevated total cholesterol. Recommended cardiovascular review." : "Cholesterol index matches clinical limits."
        },
        {
          marker: "Fasting Blood Glucose",
          value: hasGlucose ? "135 mg/dL" : "90 mg/dL",
          status: hasGlucose ? "high" : "normal",
          interpretation: hasGlucose ? "Glycemic levels exceed fasting threshold. Indicates potential hyperglycemia." : "Blood sugar is within normal parameters."
        }
      ],
      problems: [
        ...(hasHemoglobin ? ["Mild Anemia"] : []),
        ...(hasCholesterol ? ["Hypercholesterolemia"] : []),
        ...(hasGlucose ? ["Hyperglycemia / Borderline Diabetes"] : []),
        ...(!hasHemoglobin && !hasCholesterol && !hasGlucose ? ["Healthy Blood Profile"] : [])
      ],
      recommendedFoods: [
        "Leafy green vegetables (spinach, kale) and beetroot (rich in iron)",
        "Oatmeal, barley, and whole grains (high in soluble fibers)",
        "Fresh organic citrus fruits (guava, orange) for Vitamin C",
        "Walnuts, almonds, and olive oil (rich in healthy HDL fats)"
      ],
      avoidedFoods: [
        "Deep-fried foods and trans-fat oils",
        "Refined sugar desserts and high fructose sodas",
        "Red meat and heavy processing cold cuts"
      ],
      prescriptions: [
        ...(hasHemoglobin ? [{ name: "Iron Supplement", dosage: "100mg", frequency: "Once daily after dinner", duration: "30 days", purpose: "To boost blood counts and cure anemia" }] : []),
        ...(hasCholesterol ? [{ name: "Atorvastatin", dosage: "10mg", frequency: "Once daily before bedtime", duration: "15 days", purpose: "To reduce high cholesterol and LDL" }] : []),
        ...(hasGlucose ? [{ name: "Metformin", dosage: "500mg", frequency: "Once daily with dinner", duration: "30 days", purpose: "To regulate glycemic indices and sugar level" }] : [])
      ],
      guidance: "Your medical index is calculated and evaluated. Follow the recommended dietary restrictions. Maintain daily 30 minutes physical cardio activity and check levels again in 90 days."
    });
  }
}

export default router;
