import React, { createContext, useContext, useState } from 'react';

export type LanguageCode = 'en' | 'hi' | 'te' | 'ta' | 'kn' | 'bn' | 'mr';

interface Translations {
  [key: string]: {
    [lang in LanguageCode]: string;
  };
}

export const translations: Translations = {
  appName: {
    en: "CareAssist AI",
    hi: "केयरअसिस्ट एआई",
    te: "కేర్అసిస్ట్ AI",
    ta: "கேர்அசிஸ்ட் AI",
    kn: "ಕೇರ್ಅಸಿಸ್ಟ್ AI",
    bn: "কেয়ারঅ্যাসিস্ট এআই",
    mr: "केअरअसिस्ट एआय"
  },
  slogan: {
    en: "Your Intelligent Healthcare Companion",
    hi: "आपका बुद्धिमान स्वास्थ्य साथी",
    te: "మీ తెలివైన ఆరోగ్య సహచరుడు",
    ta: "உங்கள் புத்திசாலித்தனமான சுகாதார துணை",
    kn: "ನಿಮ್ಮ ಬುದ್ಧಿವಂತ ಆರೋಗ್ಯ ಒಡನಾಡಿ",
    bn: "আপনার বুদ্ধিমান স্বাস্থ্য সঙ্গী",
    mr: "तुमचा बुद्धिमान आरोग्य सोबती"
  },
  dashboard: {
    en: "Dashboard",
    hi: "डैशबोर्ड",
    te: "డాష్‌బోర్డ్",
    ta: "டாஷ்போர்டு",
    kn: "ಡ್ಯಾಶ್ಬೋರ್ಡ್",
    bn: "ড্যাশবোর্ড",
    mr: "डॅशबोर्ड"
  },
  symptomChecker: {
    en: "Symptom Assessment",
    hi: "लक्षण मूल्यांकन",
    te: "లక్షణాల అంచనా",
    ta: "அறிகுறி மதிப்பீடு",
    kn: "ರೋಗಲಕ್ಷಣದ ಮೌಲ್ಯಮಾಪನ",
    bn: "উপসর্গ মূল্যায়ন",
    mr: "लक्षण मूल्यमापन"
  },
  medGuide: {
    en: "Medicine Information",
    hi: "दवा की जानकारी",
    te: "ఔషధ సమాచారం",
    ta: "மருந்து தகவல்",
    kn: "ಔಷಧ ಮಾಹಿತಿ",
    bn: "ওষুধের তথ্য",
    mr: "औषध माहिती"
  },
  nutrition: {
    en: "Nutrition Planner",
    hi: "पोषण योजनाकार",
    te: "న్యూట్రిషన్ ప్లానర్",
    ta: "ஊட்டச்சத்து திட்டமிடுபவர்",
    kn: "ಪೌಷ್ಟಿಕಾಂಶ ಯೋಜಕ",
    bn: "পুষ্টি পরিকল্পনাকারী",
    mr: "पोषण नियोजक"
  },
  reminders: {
    en: "Medication Reminders",
    hi: "दवा अनुस्मारक",
    te: "మందుల రిమైండర్లు",
    ta: "மருந்து நினைவூட்டல்கள்",
    kn: "ಔಷಧಿ ಜ್ಞಾಪನೆಗಳು",
    bn: "ওষুধের অনুস্মারক",
    mr: "औषध स्मरणपत्रे"
  },
  healthRecords: {
    en: "Health Records",
    hi: "स्वास्थ्य रिकॉर्ड",
    te: "ఆరోగ్య రికార్డులు",
    ta: "சுகாதார பதிவுகள்",
    kn: "ಆರೋಗ್ಯ ದಾಖలు",
    bn: "স্বাস্থ্য রেকর্ড",
    mr: "आरोग्य नोंदी"
  },
  reportAnalyzer: {
    en: "AI Report Lab",
    hi: "एआई रिपोर्ट लैब",
    te: "AI రిపోర్ట్ ల్యాబ్",
    ta: "AI அறிக்கை ஆய்வगम",
    kn: "AI ವರದಿ ಲ್ಯಾಬ್",
    bn: "এআই রিপোর্ট ল্যাব",
    mr: "एआय रिपोर्ट लॅब"
  },
  reportScannerTitle: {
    en: "Upload & Scan Medical Report",
    hi: "मेडिकल रिपोर्ट अपलोड और स्कैन करें",
    te: "వైద్య నివేదికను అప్‌లోడ్ చేయండి & స్కాన్ చేయండి",
    ta: "மருத்துவ அறிக்கையை பதிவேற்றி ஸ்கேன் செய்யவும்",
    kn: "ವೈದ್ಯಕೀಯ ವರದಿಯನ್ನು ಅಪ್‌ಲೋಡ್ ಮಾಡಿ మరియు స్క్వాన్ మాడి",
    bn: "মেডিকেল রিপোর্ট আপলোড এবং স্ক্যান করুন",
    mr: "वैद्यकीय अहवाल अपलोड आणि स्कॅन करा"
  },
  dropzoneText: {
    en: "Drag & drop your medical report (TXT, PDF, PNG) here, or click to browse",
    hi: "अपनी मेडिकल रिपोर्ट (TXT, PDF, PNG) यहाँ खींचें और छोड़ें, या ब्राउज़ करने के लिए क्लिक करें",
    te: "మీ వైద్య నివేదికను (TXT, PDF, PNG) ఇక్కడ డ్రాగ్ అండ్ డ్రాప్ చేయండి, లేదా బ్రౌజ్ చేయడానికి క్లిక్ చేయండి",
    ta: "உங்கள் மருத்துவ அறிக்கையை இங்கே இழுத்து விடுங்கள் அல்லது உலாவ கிளிக் செய்யவும்",
    kn: "ನಿಮ್ಮ ವೈದ್ಯಕೀಯ ವರದಿಯನ್ನು ಇಲ್ಲಿ ಎಳೆಯಿರಿ ಮತ್ತು ಬಿಡಿ, లేదా బ్రౌజ్ చేయడానికి క్లిక్ చేయండి",
    bn: "আপনার মেডিকেল রিপোর্ট এখানে ড্র্যাগ এবং ড্রপ করুন, বা ব্রাউজ করতে ক্লিক করুন",
    mr: "तुमचा वैद्यकीय अहवाल येथे ड्रॅग आणि ड्रॉप करा, किंवा ब्राउझ करण्यासाठी क्लिक करा"
  },
  scanReportBtn: {
    en: "Scan Report",
    hi: "रिपोर्ट स्कैन करें",
    te: "రిపోర్ట్ స్కాన్ చేయండి",
    ta: "அறிக்கையை ஸ்கேன் செய்க",
    kn: "ವರದಿ ಸ್ಕ್ಯಾನ್ ಮಾಡಿ",
    bn: "রিপোর্ট स्कैन करें",
    mr: "अहवाल स्कॅन करा"
  },
  logout: {
    en: "Log Out",
    hi: "लॉग आउट",
    te: "లాగ్ అవుట్",
    ta: "வெளியேறு",
    kn: "ಲಾಗ್ ಔಟ್",
    bn: "লগ আউট",
    mr: "लॉग आउट"
  },
  emergencyTitle: {
    en: "EMERGENCY DETECTED",
    hi: "आपातकाल का पता चला",
    te: "అత్యవసర పరిస్థితి గుర్తించబడింది",
    ta: "அவசரநிலை கண்டறியப்பட்டது",
    kn: "ತುರ್ತು ಪರಿಸ್ಥಿತಿ ಪತ್ತೆಯಾಗಿದೆ",
    bn: "জরুরী অবস্থা সনাক্ত করা হয়েছে",
    mr: "आणीबाणी आढळली"
  },
  emergencyWarning: {
    en: "This may be a medical emergency. Seek immediate professional care.",
    hi: "यह एक चिकित्सा आपातकाल हो सकता है। तुरंत चिकित्सा सहायता लें।",
    te: "ఇది వైద్య అత్యవసర పరిస్థితి కావచ్చు. వెంటనే వైద్య సహాయం పొందండి.",
    ta: "இது மருத்துவ அவசரநிலையாக இருக்கலாம். உடனடியாக மருத்துவ சிகிச்சை பெறவும்.",
    kn: "ಇದು ವೈದ್ಯಕೀಯ ತುರ್ತು ಪರಿಸ್ಥಿತಿಯಾಗಿರಬಹುದು. ತಕ್ಷಣ ವೈದ್ಯಕೀಯ ಚಿಕಿತ್ಸೆ ಪಡೆಯಿರಿ.",
    bn: "এটি একটি চিকিৎসা জরুরী অবস্থা হতে পারে। অবিলম্বে চিকিৎসা সহায়তা নিন।",
    mr: "ही वैद्यकीय आणीबाणी असू शकते. त्वरित वैद्यकीय मदत घ्या."
  },
  voiceMode: {
    en: "Voice Assistant Mode",
    hi: "आवाज सहायक मोड",
    te: "వాయిస్ అసిస్టెంట్ మోడ్",
    ta: "குரல் உதவியாளர் பயன்முறை",
    kn: "ಧ್ವನಿ ಸಹಾಯಕ ಮೋಡ್",
    bn: "ভয়েস অ্যাসিস্ট্যান্ট মোড",
    mr: "व्हॉइस असिस्टंट मोड"
  },
  contrastMode: {
    en: "High Contrast Mode",
    hi: "उच्च कंट्रास्ट मोड",
    te: "హై కాంట్రాస్ట్ మోడ్",
    ta: "அதிக மாறுபட்ட பயன்முறை",
    kn: "ಹೆಚ್ಚಿನ ಕಾಂಟ್ರಾಸ್ಟ್ ಮೋಡ್",
    bn: "উচ্চ বৈপরীত্য মোড",
    mr: "उच्च कॉन्ट्रास्ट मोड"
  },
  largeFontMode: {
    en: "Elderly Font Size",
    hi: "बड़ा फ़ॉन्ट आकार",
    te: "పెద్ద ఫాంట్ సైజు",
    ta: "பெரிய எழுத்துரு அளவு",
    kn: "ದೊಡ್ಡ ಫಾಂಟ್ ಗಾತ್ರ",
    bn: "বড় ফন্ট সাইজ",
    mr: "मोठा फॉन्ट आकार"
  }
};

interface LanguageContextType {
  language: LanguageCode;
  setLanguage: (lang: LanguageCode) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<LanguageCode>(() => {
    const saved = localStorage.getItem('careassist_lang');
    return (saved as LanguageCode) || 'en';
  });

  const setLanguage = (lang: LanguageCode) => {
    setLanguageState(lang);
    localStorage.setItem('careassist_lang', lang);
  };

  const t = (key: string): string => {
    const term = translations[key];
    if (!term) return key;
    return term[language] || term['en'] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
