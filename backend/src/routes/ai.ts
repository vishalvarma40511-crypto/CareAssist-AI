import { Router, Request, Response } from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { query } from '../db';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { z } from 'zod';

const router = Router();
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

// Initialize Gemini Client
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// Helper function to call Gemini API with model fallbacks to bypass quota constraints on specific models
async function generateContentWithFallback(
  promptOrContents: any,
  responseMimeType?: string
) {
  const models = ['gemini-3.5-flash', 'gemini-2.5-flash', 'gemini-flash-latest', 'gemini-2.0-flash'];
  let lastError = null;

  for (const modelName of models) {
    try {
      console.log(`Attempting generation with model: ${modelName}`);
      const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: responseMimeType ? { responseMimeType } : undefined
      });
      const result = await model.generateContent(promptOrContents);
      console.log(`Success with model: ${modelName}`);
      return result;
    } catch (err: any) {
      console.warn(`Failed with model ${modelName}:`, err.message || err);
      lastError = err;
    }
  }
  throw lastError;
}


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
0b. TABLET/MEDICINE INFO REQUEST: If the user is asking for general information, details, dosage, usage, side effects, or explanation about a specific tablet or medication (e.g. "what is paracetamol", "tell me about amoxicillin tablet", "what does metformin do", "how to take pan-d"), you MUST bypass the symptom assessment. Immediately set "needsMoreInfo": false, write a comprehensive explanation of the tablet in "medicineGuidance" or "summary", and populate "prescriptions" with details of that tablet (dosage, frequency, purpose, etc.).
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

2. DATA COLLECTION via MULTIPLE CHOICE: If it's NOT an emergency and NOT a direct tablet/medicine information request, you MUST gather complete information by asking multiple-choice questions before giving any analysis or recommendations.
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

    const result = await generateContentWithFallback({ contents }, 'application/json');
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

    const result = await generateContentWithFallback(prompt, 'application/json');
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

    const result = await generateContentWithFallback(prompt, 'application/json');
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

// POST /api/ai/diet-plan
router.post('/diet-plan', authenticateToken, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const { goal, dietType, budget, language } = req.body;
    const targetLangCode = language || 'en';

    const profileRes = await query('SELECT age, weight, height, gender FROM users WHERE id = $1', [authReq.user?.id]);
    const profile = profileRes.rows[0] || {};

    const languageNames: { [key: string]: string } = {
      en: 'English',
      hi: 'Hindi',
      te: 'Telugu',
      ta: 'Tamil',
      kn: 'Kannada',
      ml: 'Malayalam'
    };
    const targetLang = languageNames[targetLangCode] || 'English';

    if (!GEMINI_API_KEY || GEMINI_API_KEY === 'YOUR_GEMINI_API_KEY_HERE') {
      throw new Error('API key unconfigured');
    }

    const prompt = `
You are a professional healthcare clinical dietitian. Generate a personalized 1-day meal plan for a patient based on these parameters:
- Target Goal: ${goal}
- Dietary Type: ${dietType}
- Budget Category: ${budget}
- Patient Vitals: Age ${profile.age || 'Unspecified'}, Weight ${profile.weight || 'Unspecified'} kg, Height ${profile.height || 'Unspecified'} cm, Gender ${profile.gender || 'Unspecified'}.

You MUST write all meal descriptions and text fields in the language: ${targetLang}.

Your response must be a single, valid JSON object matching exactly this schema:
{
  "breakfast": "Detailed breakfast recommendation with specific items",
  "lunch": "Detailed lunch recommendation with specific items",
  "dinner": "Detailed dinner recommendation with specific items",
  "snacks": "Healthy snack suggestions",
  "calories": 1800,
  "protein": 80,
  "carbs": 200,
  "fat": 60,
  "waterIntake": 3.0,
  "goals": "Short summary phrase of targets, e.g. Low Sodium Weight Loss"
}
`;

    const result = await generateContentWithFallback(prompt, 'application/json');
    const responseText = result.response.text();
    const parsed = JSON.parse(responseText);
    res.json(parsed);
  } catch (error: any) {
    console.warn('Gemini diet planning error, falling back to local fallback generator:', error.message || error);
    const { goal, dietType, budget } = req.body;
    let breakfast = "Oatmeal with chia seeds, banana slices, and almond milk.";
    let lunch = "Quinoa salad with mixed greens, cherry tomatoes, cucumbers, and boiled chickpeas.";
    let dinner = "Brown rice with steamed broccoli, grilled tofu, and low-sodium soy sauce.";
    let snacks = "Mixed unsalted nuts (walnuts & almonds) and a green apple.";
    let calories = 1600;
    let protein = 70;
    let carbs = 220;
    let fat = 50;
    let water = 3.0;

    if (goal === 'muscle_gain') {
      breakfast = "Scrambled tofu or eggs with whole wheat toast, avocado, and spinach.";
      lunch = "High protein lentil curry with brown rice, broccoli, and yogurt.";
      dinner = "Paneer or grilled fish with sweet potato mash and green beans.";
      snacks = "Protein shake with peanut butter and hemp seeds.";
      calories = 2500;
      protein = 130;
      carbs = 310;
      fat = 75;
      water = 3.5;
    } else if (goal === 'diabetes') {
      breakfast = "Chia seed pudding made with unsweetened almond milk and fresh blueberries.";
      lunch = "Spinach and kale salad with avocado, pumpkin seeds, and grilled tofu.";
      dinner = "Steamed cauliflower mash with baked salmon or paneer and asparagus.";
      snacks = "Cucumber slices with hummus.";
      calories = 1400;
      protein = 85;
      carbs = 110;
      fat = 65;
      water = 3.0;
    }

    if (dietType === 'non_vegetarian') {
      if (goal === 'muscle_gain') {
        lunch = "Grilled chicken breast with wild brown rice, sautéed spinach, and green peas.";
        dinner = "Baked salmon fillet with sweet potato chunks and grilled zucchini.";
      } else {
        lunch = "Light tuna salad sandwich on multi-grain bread with lettuce and tomatoes.";
        dinner = "Baked turkey breast with roasted bell peppers and quinoa.";
      }
    }

    res.json({
      breakfast,
      lunch,
      dinner,
      snacks,
      calories,
      protein,
      carbs,
      fat,
      waterIntake: water,
      goals: `${dietType.toUpperCase()} - ${goal.toUpperCase()} (${budget.toUpperCase()} BUDGET)`
    });
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

    const result = await generateContentWithFallback(prompt, 'application/json');
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
  const isFever = text.includes('fever') || text.includes('temp') || text.includes('warm') || text.includes('bukhar');
  const isHeadache = text.includes('head') || text.includes('migraine') || text.includes('sir') || text.includes('dard');
  const isCoughColdSoreThroat = text.includes('cough') || text.includes('cold') || text.includes('throat') || text.includes('cough') || text.includes('sardi');
  const isStomach = text.includes('stomach') || text.includes('cramp') || text.includes('abdomen') || text.includes('pet');
  const isNauseaVomiting = text.includes('vomit') || text.includes('nausea') || text.includes('ulti');
  const isBreath = text.includes('breath') || text.includes('shortness');

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

function handleMockAISymptoms(res: Response, chatHistory: any[], msg: string, lang: string = 'en') {
  const text = msg.toLowerCase();

  // Check if it's a query about a tablet/medicine
  const isTabletQuery = text.includes('tablet') || text.includes('medicine') || text.includes('pill') || 
                        text.includes('paracetamol') || text.includes('amoxicillin') || text.includes('metformin') || 
                        text.includes('cetirizine') || text.includes('pantoprazole') || text.includes('dolo') || 
                        text.includes('crocin') || text.includes('ibuprofen') || text.includes('aspirin');

  if (isTabletQuery) {
    // Extract medicine name from msg
    let detectedMed = "Medicine";
    if (text.includes('paracetamol') || text.includes('dolo') || text.includes('crocin')) detectedMed = "Paracetamol";
    else if (text.includes('amoxicillin')) detectedMed = "Amoxicillin";
    else if (text.includes('metformin')) detectedMed = "Metformin";
    else if (text.includes('cetirizine')) detectedMed = "Cetirizine";
    else if (text.includes('pantoprazole') || text.includes('pan-d')) detectedMed = "Pantoprazole";
    else if (text.includes('ibuprofen')) detectedMed = "Ibuprofen";
    else if (text.includes('aspirin')) detectedMed = "Aspirin";
    else {
      const words = msg.split(/\s+/);
      const tabletIdx = words.findIndex(w => w.toLowerCase().includes('tablet') || w.toLowerCase().includes('medicine'));
      if (tabletIdx > 0) {
        detectedMed = words[tabletIdx - 1];
      } else if (words.length > 0) {
        detectedMed = words[words.length - 1].replace(/[?.!]/g, '');
      }
    }
    
    // Capitalize first letter
    detectedMed = detectedMed.charAt(0).toUpperCase() + detectedMed.slice(1);

    const prescs = getMockPrescriptions(text, lang);
    const summaryText = "Here is the information about the " + detectedMed + " tablet.";
    const guidanceText = detectedMed + " is a commonly used medication. Please check with your doctor for exact dosage and instructions.";

    return res.json({
      emergency: false,
      needsMoreInfo: false,
      question: "",
      options: [],
      riskLevel: "low",
      confidenceScore: 90,
      summary: summaryText,
      conditions: [detectedMed],
      homeCare: [
        "Always take medications under medical supervision.",
        "Take the tablet after meals to avoid gastric irritation."
      ],
      medicineGuidance: guidanceText,
      doctorRecommendation: "Consult standard physician",
      prescriptions: prescs
    });
  }

  // Emergency checks
  if (text.includes('chest pain') || text.includes('breathing') || text.includes('stroke') || text.includes('seizure') || text.includes('suicide') || text.includes('allergic')) {
    return res.json({
      emergency: true,
      needsMoreInfo: false,
      question: "",
      options: [],
      riskLevel: "emergency"
    });
  }

  const historyLen = chatHistory.length;

  if (historyLen < 2) {
    return res.json({
      emergency: false,
      needsMoreInfo: true,
      question: "I understand. Can you tell me how severe your discomfort is on a scale of 1 to 10, and when it started?",
      options: ["1-3 (Mild discomfort)", "4-6 (Moderate discomfort)", "7-10 (Severe discomfort)", "Started today", "Started a few days ago"]
    });
  } else if (historyLen < 4) {
    return res.json({
      emergency: false,
      needsMoreInfo: true,
      question: "Do you have any other symptoms like fever, cough, dizziness, or vomiting? Also, do you have any allergies or existing conditions like diabetes?",
      options: ["Yes, mild fever", "Yes, cough", "No other symptoms", "I have diabetes", "No allergies or conditions"]
    });
  }

  return res.json({
    emergency: false,
    needsMoreInfo: false,
    question: "",
    options: [],
    riskLevel: text.includes('severe') || text.includes('bad') ? 'moderate' : 'low',
    confidenceScore: 85,
    summary: "Patient reported symptoms: " + msg + ". Rest and hydration advised.",
    conditions: ["Mild viral infection", "Dehydration headache"],
    homeCare: [
      "Drink at least 2.5L of water today to stay hydrated.",
      "Get 8 hours of rest in a quiet, dark room.",
      "Inhale steam to help open up airways."
    ],
    medicineGuidance: "For mild symptoms, you may take standard over-the-counter medications like Paracetamol. If symptoms persist for more than 48 hours, consult a physician.",
    doctorRecommendation: "General physician consultation via voice or chat.",
    prescriptions: getMockPrescriptions(text, lang)
  });
}


function handleMockMedicineExplain(res: Response, medName: string, lang: string = 'en') {
  const nameLower = medName.toLowerCase();
  let medKey: 'paracetamol' | 'amoxicillin' | 'metformin' | 'cetirizine' | 'pantoprazole' | null = null;

  if (nameLower.includes('paracetamol') || nameLower.includes('dolo') || nameLower.includes('crocin') || nameLower.includes('acetaminophen')) {
    medKey = 'paracetamol';
  } else if (nameLower.includes('amoxicillin') || nameLower.includes('mox')) {
    medKey = 'amoxicillin';
  } else if (nameLower.includes('metformin') || nameLower.includes('glycomet') || nameLower.includes('glucophage')) {
    medKey = 'metformin';
  } else if (nameLower.includes('cetirizine') || nameLower.includes('okacet') || nameLower.includes('zyrtec')) {
    medKey = 'cetirizine';
  } else if (nameLower.includes('pantoprazole') || nameLower.includes('pantocid') || nameLower.includes('pantoc') || nameLower.includes('pan-d')) {
    medKey = 'pantoprazole';
  }

  let details = {
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
  };

  if (medKey === 'paracetamol') {
    details = {
      name: medName,
      whatIsIt: "Paracetamol (Acetaminophen) is a widely used over-the-counter pain reliever (analgesic) and fever reducer (antipyretic).",
      whatUsedFor: "Fever reduction, headache, toothache, muscle aches, and mild arthritis pain.",
      howItWorks: "It blocks chemical messengers (prostaglandins) in the brain that signal pain and regulate body temperature.",
      adultUse: "500mg to 1000mg every 4 to 6 hours as needed.",
      foodTiming: "Can be taken with or without food.",
      dosingSchedule: "Maximum 4000mg (4g) in 24 hours to prevent liver damage.",
      commonSideEffects: ["Mild nausea", "Constipation", "Headache"],
      seriousSideEffects: ["Dark urine", "Yellowing eyes/skin (jaundice)", "Severe skin rash"],
      drugInteractions: ["Do not use with other products containing paracetamol/acetaminophen", "Alcohol increases liver toxicity"],
      foodInteractions: ["Avoid alcohol while using this medicine"],
      precautions: {
        pregnancy: "Generally considered safe, but use the lowest effective dose for the shortest time.",
        breastfeeding: "Considered compatible with breastfeeding in standard doses.",
        driving: "Does not cause drowsiness; safe to drive.",
        alcohol: "Avoid alcohol as the combination significantly increases the risk of severe liver damage."
      },
      storageInstructions: "Store below 25°C in a dry place away from direct sunlight.",
      missedDoseGuidance: "Take as soon as you remember. If it is almost time for your next dose, skip the missed dose. Do not double dose.",
      overdoseAdvice: "Immediately seek emergency medical attention. Paracetamol overdose can cause fatal liver failure.",
      whenToContactDoctor: "If you develop signs of an allergic reaction (swelling of face/lips/throat, difficulty breathing) or skin peeling."
    };
  } else if (medKey === 'amoxicillin') {
    details = {
      name: medName,
      whatIsIt: "Amoxicillin is a penicillin-type antibiotic used to treat a wide variety of bacterial infections.",
      whatUsedFor: "Bacterial infections of the ear, nose, throat, urinary tract, lungs (pneumonia), and skin.",
      howItWorks: "It stops the growth of bacteria by preventing them from forming their protective cell walls.",
      adultUse: "Typically 250mg to 500mg every 8 hours, or 500mg to 875mg every 12 hours as prescribed by a doctor.",
      foodTiming: "Can be taken with or without food, but food helps reduce stomach irritation.",
      dosingSchedule: "Take at evenly spaced intervals and finish the entire prescribed course, even if symptoms resolve.",
      commonSideEffects: ["Diarrhea", "Nausea", "Vomiting", "Mild skin rash"],
      seriousSideEffects: ["Severe watery or bloody diarrhea", "Anaphylaxis (swelling of lips/tongue, shortness of breath)", "Easy bruising"],
      drugInteractions: ["May reduce the effectiveness of oral contraceptives", "Allopurinol may increase rash risk"],
      foodInteractions: ["Probiotic foods like yogurt can help restore gut bacteria and prevent diarrhea"],
      precautions: {
        pregnancy: "Considered safe during pregnancy, but consult your obstetrician first.",
        breastfeeding: "Passes into breast milk in small amounts; consult a pediatrician.",
        driving: "Safe to drive unless you experience severe dizziness or fatigue.",
        alcohol: "Avoid alcohol, as it can weaken your immune system and delay recovery."
      },
      storageInstructions: "Store capsules/tablets at room temperature. Liquid suspensions should be kept in a refrigerator.",
      missedDoseGuidance: "Take it as soon as you remember. If it is close to your next dose, skip it. Do not double dose.",
      overdoseAdvice: "Contact a poison control center or emergency room immediately if an overdose occurs.",
      whenToContactDoctor: "Stop taking and contact your doctor immediately if you develop a skin rash, fever, joint pain, or severe diarrhea."
    };
  } else if (medKey === 'metformin') {
    details = {
      name: medName,
      whatIsIt: "Metformin is an oral anti-diabetic medication that helps control blood sugar levels for people with type 2 diabetes.",
      whatUsedFor: "Management of type 2 diabetes mellitus, improving insulin sensitivity and lowering glucose levels.",
      howItWorks: "It decreases glucose production in the liver, delays glucose absorption in the intestines, and increases insulin sensitivity.",
      adultUse: "Usually started at 500mg once or twice daily with meals, adjusted gradually by your doctor.",
      foodTiming: "Must be taken with meals to minimize stomach upset and digestive side effects.",
      dosingSchedule: "Take consistently at the same times every day as directed by your physician.",
      commonSideEffects: ["Nausea", "Diarrhea", "Stomach ache", "Metallic taste in the mouth"],
      seriousSideEffects: ["Lactic acidosis (rare but life-threatening build-up of acid in the blood - symptoms include breathing trouble, muscle pain)"],
      drugInteractions: ["Cimetidine, diuretics, and iodinated contrast media (used for X-rays) can increase risks"],
      foodInteractions: ["Avoid excessive alcohol consumption (significantly increases the risk of lactic acidosis)"],
      precautions: {
        pregnancy: "Insulin is typically preferred during pregnancy; consult your doctor to discuss options.",
        breastfeeding: "Consult your doctor; metformin passes into breast milk in low concentrations.",
        driving: "Safe to drive. Does not cause low blood sugar (hypoglycemia) when used alone.",
        alcohol: "Strictly avoid alcohol due to the high risk of developing lactic acidosis."
      },
      storageInstructions: "Store at room temperature away from moisture and heat.",
      missedDoseGuidance: "Take with food as soon as you remember. If it is almost time for the next dose, skip it. Do not double dose.",
      overdoseAdvice: "Seek emergency medical care immediately. Symptoms of overdose can include severe low blood sugar and lactic acidosis.",
      whenToContactDoctor: "Contact your physician immediately if you experience unusual muscle pain, cold feeling, trouble breathing, or severe fatigue."
    };
  } else if (medKey === 'cetirizine') {
    details = {
      name: medName,
      whatIsIt: "Cetirizine is a second-generation antihistamine used to relieve allergy symptoms without causing heavy drowsiness.",
      whatUsedFor: "Runny nose, sneezing, itchy or watery eyes, and allergic skin hives/itching.",
      howItWorks: "It blocks histamine, a natural substance the body produces during an allergic response.",
      adultUse: "Typically 5mg to 10mg once daily depending on symptom severity.",
      foodTiming: "Can be taken with or without food.",
      dosingSchedule: "Once daily, preferably in the evening if it causes mild drowsiness.",
      commonSideEffects: ["Mild drowsiness", "Dry mouth", "Fatigue", "Headache"],
      seriousSideEffects: ["Difficulty urinating", "Rapid heart rate", "Blurred vision"],
      drugInteractions: ["Avoid using with sedatives, sleeping pills, or muscle relaxants as drowsiness will worsen"],
      foodInteractions: ["Avoid taking with large amounts of caffeine"],
      precautions: {
        pregnancy: "Consult your doctor; generally avoided unless clearly needed.",
        breastfeeding: "Passes into breast milk; not recommended while breastfeeding.",
        driving: "Be careful. Can cause mild drowsiness in some individuals; do not drive if affected.",
        alcohol: "Avoid alcohol as it will significantly increase drowsiness and impair alertness."
      },
      storageInstructions: "Store at room temperature below 25°C in a dry place.",
      missedDoseGuidance: "Take it as soon as you remember. If the next dose is due within a few hours, skip the missed dose.",
      overdoseAdvice: "An overdose can cause extreme drowsiness in adults, or agitation and restlessness in children. Contact emergency department.",
      whenToContactDoctor: "Seek immediate medical attention if you experience severe dizziness, swelling of lips/tongue, or difficulty urinating."
    };
  } else if (medKey === 'pantoprazole') {
    details = {
      name: medName,
      whatIsIt: "Pantoprazole is a proton pump inhibitor (PPI) that decreases the amount of acid produced in the stomach.",
      whatUsedFor: "Acid reflux, gastroesophageal reflux disease (GERD), heartburn, and stomach ulcers.",
      howItWorks: "It shuts down the acid-producing proton pumps in the stomach wall to allow healing.",
      adultUse: "Typically 40mg once daily taken in the morning.",
      foodTiming: "Must be taken 30 to 60 minutes before breakfast (on an empty stomach) for best efficacy.",
      dosingSchedule: "Once daily in the morning as prescribed, usually for a course of 4 to 8 weeks.",
      commonSideEffects: ["Headache", "Mild diarrhea", "Stomach gas or bloating", "Nausea"],
      seriousSideEffects: ["Kidney problems (interstitial nephritis)", "Severe joint pain", "Chronic use may cause Vitamin B12 deficiency"],
      drugInteractions: ["Reduces absorption of drugs requiring acid (like ketoconazole)", "May increase methotrexate levels"],
      foodInteractions: ["Avoid spicy, acidic, fatty, or caffeinated foods that trigger acid reflux"],
      precautions: {
        pregnancy: "Use only if clearly needed and prescribed by your obstetrician.",
        breastfeeding: "Passes into breast milk; consult your physician before using.",
        driving: "Safe to drive; does not affect alertness.",
        alcohol: "Avoid alcohol as it stimulates acid production and worsens reflux symptoms."
      },
      storageInstructions: "Store at room temperature in a dry place.",
      missedDoseGuidance: "Take it if you remember before eating. If you've already eaten, skip it and take the next dose the following morning.",
      overdoseAdvice: "Overdose is rarely serious, but consult a doctor if you experience any severe symptoms.",
      whenToContactDoctor: "Contact your doctor if you experience severe watery diarrhea, new or worsening joint pain, or signs of kidney trouble."
    };
  }

  return res.json(details);
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
