// api/src/utils/i18n.js
//
// Message catalogue for text the server generates for people: notifications
// (and therefore e-mail/SMS) and the certificate PDF. Languages: English (en)
// and Hindi (hi). Add a language by adding one object here and its code to
// SUPPORTED. Text typed by users (reasons, query bodies) is never translated.
//
// Each notification entry is a function of its parameters returning
// { title, message }; missing Hindi entries fall back to English.

const SUPPORTED = ['en', 'hi'];
const DEFAULT_LANGUAGE = 'en';

const normaliseLanguage = (lang) => (SUPPORTED.includes(lang) ? lang : DEFAULT_LANGUAGE);

const OFFENCE_LABEL = {
  en: {
    NONE: 'no offence', UNVERIFIED_INSTRUMENT: 'unverified instrument', EXPIRED_CERTIFICATE: 'expired certificate',
    UNSTAMPED_INSTRUMENT: 'unstamped instrument', SEAL_TAMPERING: 'seal tampering',
    FALSE_WEIGHT_OR_MEASURE: 'false weight or measure', OTHER: 'other offence',
  },
  hi: {
    NONE: 'कोई उल्लंघन नहीं', UNVERIFIED_INSTRUMENT: 'असत्यापित उपकरण', EXPIRED_CERTIFICATE: 'वैधता समाप्त प्रमाणपत्र',
    UNSTAMPED_INSTRUMENT: 'बिना मुहर का उपकरण', SEAL_TAMPERING: 'मुहर से छेड़छाड़',
    FALSE_WEIGHT_OR_MEASURE: 'गलत तौल या माप', OTHER: 'अन्य उल्लंघन',
  },
};

const CASE_STATUS_LABEL = {
  en: { OPEN: 'open', NOTICE_ISSUED: 'notice issued', PENALTY_IMPOSED: 'penalty imposed', RESOLVED: 'resolved', DISMISSED: 'dismissed' },
  hi: { OPEN: 'खुला', NOTICE_ISSUED: 'नोटिस जारी', PENALTY_IMPOSED: 'दंड लगाया गया', RESOLVED: 'निस्तारित', DISMISSED: 'खारिज' },
};

const INSTRUMENT_ACTION = {
  en: { deactivated: 'deactivated', reactivated: 'reactivated', decommissioned: 'decommissioned' },
  hi: { deactivated: 'निष्क्रिय किया गया', reactivated: 'पुनः सक्रिय किया गया', decommissioned: 'सेवा से हटाया गया' },
};

const NAMEPLATE_OUTCOME = {
  en: {
    CONFIRMED_MATCH: 'the details agree with the registered record',
    CONFIRMED_MISMATCH: 'the details do not match the registered record - please contact the department',
    UNREADABLE: 'the photo could not be read - please upload a clearer, straight-on photo',
  },
  hi: {
    CONFIRMED_MATCH: 'विवरण पंजीकृत अभिलेख से मेल खाता है',
    CONFIRMED_MISMATCH: 'विवरण पंजीकृत अभिलेख से मेल नहीं खाता - कृपया विभाग से संपर्क करें',
    UNREADABLE: 'फ़ोटो पढ़ी नहीं जा सकी - कृपया अधिक स्पष्ट, सामने से ली गई फ़ोटो अपलोड करें',
  },
};

const enWhen = (d) => (d === 0 ? 'today' : d === 1 ? 'tomorrow' : `in ${d} days`);
const hiWhen = (d) => (d === 0 ? 'आज' : d === 1 ? 'कल' : `${d} दिन में`);

const MESSAGES = {
  en: {
    'certificate.expiring': (p) => ({
      title: 'Verification certificate expiring soon',
      message: `Certificate ${p.number} for ${p.instrument} expires ${enWhen(p.days)} (${p.date}). Apply for re-verification to avoid a lapse.`,
    }),
    'certificate.expired': (p) => ({
      title: 'Certificate expired',
      message: p.instrument
        ? `Certificate ${p.number} for ${p.instrument} has expired. Apply for re-verification to continue using the instrument.`
        : `Certificate ${p.number} has expired. Apply for re-verification.`,
    }),
    'certificate.issued': (p) => ({
      title: 'Verification certificate issued',
      message: `Certificate ${p.number} for ${p.instrument} is valid until ${p.validUntil}.`,
    }),
    'certificate.revoked': (p) => ({
      title: 'Certificate revoked',
      message: `Certificate ${p.number} has been revoked. Reason: ${p.reason}`,
    }),
    'assignment.new': (p) => ({
      title: 'New verification assigned',
      message: `Application ${p.applicationNumber} has been assigned to you.`,
    }),
    'payment.verified': (p) => ({
      title: 'Payment verified',
      message: `Your payment (challan ${p.challan}) for application ${p.applicationNumber} has been verified.`,
    }),
    'verification.passed': (p) => ({
      title: 'Verification passed',
      message: `Your instrument passed verification for application ${p.applicationNumber}. The certificate will be issued shortly.`,
    }),
    'verification.failed': (p) => ({
      title: 'Verification failed',
      message: `Your instrument did not pass verification for application ${p.applicationNumber}. You may apply again after correcting the issues.`,
    }),
    'nameplate.result': (p) => ({
      title: 'Nameplate check reviewed',
      message: `The nameplate of your instrument ${p.name} (${p.serial}) was reviewed: ${NAMEPLATE_OUTCOME.en[p.decision] || p.decision}.${p.note ? ` Note: ${p.note}` : ''}`,
    }),
    'instrument.status': (p) => ({
      title: `Instrument ${INSTRUMENT_ACTION.en[p.action] || p.action}`,
      message: `Your instrument ${p.name} (${p.serial}) was ${INSTRUMENT_ACTION.en[p.action] || p.action} by the department.${p.reason ? ` Reason: ${p.reason}` : ''}`,
    }),
    'enforcement.registered': (p) => ({
      title: `Enforcement case ${p.caseNumber} registered`,
      message: `An inspection recorded: ${OFFENCE_LABEL.en[p.offence] || p.offence}. The department will contact you about next steps.`,
    }),
    'enforcement.status': (p) => ({
      title: `Case ${p.caseNumber}: ${CASE_STATUS_LABEL.en[p.status] || p.status}`,
      message: p.penaltyAmount ? `A penalty of ${p.penaltyAmount} has been imposed.` : p.note || 'The status of your case changed.',
    }),
    'enforcement.offender': (p) => ({
      title: `${p.flag === 'HABITUAL' ? 'Habitual' : 'Repeat'} offender: ${p.name}`,
      message: `${p.offences} offences in the last 12 months (latest case ${p.caseNumber}).`,
    }),
  },

  hi: {
    'certificate.expiring': (p) => ({
      title: 'सत्यापन प्रमाणपत्र की वैधता जल्द समाप्त हो रही है',
      message: `प्रमाणपत्र ${p.number} (${p.instrument}) की वैधता ${hiWhen(p.days)} (${p.date}) समाप्त हो रही है। वैधता समाप्त होने से बचने के लिए पुनः सत्यापन हेतु आवेदन करें।`,
    }),
    'certificate.expired': (p) => ({
      title: 'प्रमाणपत्र की वैधता समाप्त',
      message: p.instrument
        ? `प्रमाणपत्र ${p.number} (${p.instrument}) की वैधता समाप्त हो गई है। उपकरण का उपयोग जारी रखने के लिए पुनः सत्यापन हेतु आवेदन करें।`
        : `प्रमाणपत्र ${p.number} की वैधता समाप्त हो गई है। पुनः सत्यापन हेतु आवेदन करें।`,
    }),
    'certificate.issued': (p) => ({
      title: 'सत्यापन प्रमाणपत्र जारी किया गया',
      message: `प्रमाणपत्र ${p.number} (${p.instrument}) ${p.validUntil} तक वैध है।`,
    }),
    'certificate.revoked': (p) => ({
      title: 'प्रमाणपत्र रद्द किया गया',
      message: `प्रमाणपत्र ${p.number} रद्द कर दिया गया है। कारण: ${p.reason}`,
    }),
    'assignment.new': (p) => ({
      title: 'नया सत्यापन आपको सौंपा गया',
      message: `आवेदन ${p.applicationNumber} आपको सौंपा गया है।`,
    }),
    'payment.verified': (p) => ({
      title: 'भुगतान सत्यापित',
      message: `आवेदन ${p.applicationNumber} के लिए आपका भुगतान (चालान ${p.challan}) सत्यापित कर लिया गया है।`,
    }),
    'verification.passed': (p) => ({
      title: 'सत्यापन सफल',
      message: `आवेदन ${p.applicationNumber} के लिए आपका उपकरण सत्यापन में उत्तीर्ण हुआ। प्रमाणपत्र शीघ्र जारी किया जाएगा।`,
    }),
    'verification.failed': (p) => ({
      title: 'सत्यापन असफल',
      message: `आवेदन ${p.applicationNumber} के लिए आपका उपकरण सत्यापन में उत्तीर्ण नहीं हुआ। कमियाँ दूर करने के बाद आप पुनः आवेदन कर सकते हैं।`,
    }),
    'nameplate.result': (p) => ({
      title: 'नेमप्लेट जाँच की समीक्षा हुई',
      message: `आपके उपकरण ${p.name} (${p.serial}) की नेमप्लेट की समीक्षा हुई: ${NAMEPLATE_OUTCOME.hi[p.decision] || p.decision}।${p.note ? ` टिप्पणी: ${p.note}` : ''}`,
    }),
    'instrument.status': (p) => ({
      title: `उपकरण ${INSTRUMENT_ACTION.hi[p.action] || p.action}`,
      message: `आपका उपकरण ${p.name} (${p.serial}) विभाग द्वारा ${INSTRUMENT_ACTION.hi[p.action] || p.action}।${p.reason ? ` कारण: ${p.reason}` : ''}`,
    }),
    'enforcement.registered': (p) => ({
      title: `प्रवर्तन प्रकरण ${p.caseNumber} दर्ज`,
      message: `निरीक्षण में पाया गया: ${OFFENCE_LABEL.hi[p.offence] || p.offence}। आगे की कार्रवाई के लिए विभाग आपसे संपर्क करेगा।`,
    }),
    'enforcement.status': (p) => ({
      title: `प्रकरण ${p.caseNumber}: ${CASE_STATUS_LABEL.hi[p.status] || p.status}`,
      message: p.penaltyAmount ? `₹${p.penaltyAmount} का दंड लगाया गया है।` : p.note || 'आपके प्रकरण की स्थिति बदल गई है।',
    }),
    'enforcement.offender': (p) => ({
      title: `${p.flag === 'HABITUAL' ? 'आदतन उल्लंघनकर्ता' : 'बार-बार उल्लंघन करने वाला'}: ${p.name}`,
      message: `पिछले 12 महीनों में ${p.offences} उल्लंघन (नवीनतम प्रकरण ${p.caseNumber})।`,
    }),
  },
};

// Renders { title, message } for a key in a language (English if missing).
function render(lang, key, params = {}) {
  const entry = (MESSAGES[normaliseLanguage(lang)] || {})[key] || MESSAGES.en[key];
  if (!entry) throw new Error(`Unknown message key: ${key}`);
  return entry(params);
}

// Labels printed on the certificate PDF.
const PDF_LABELS = {
  en: {
    department: 'DEPARTMENT OF CONSUMER AFFAIRS',
    title: 'CERTIFICATE OF VERIFICATION',
    subtitle: 'Legal Metrology — Weighing & Measuring Instruments',
    certificateNo: 'Certificate No: ',
    statement:
      'This is to certify that the weighing/measuring instrument described below has been examined and verified in accordance with the applicable Legal Metrology standards, and found to conform to the prescribed requirements of accuracy.',
    instrument: 'Instrument', manufacturer: 'Manufacturer', model: 'Model', serialNo: 'Serial No.',
    validFrom: 'Valid From', validUntil: 'Valid Until',
    scanToVerify: 'Scan to verify authenticity',
    signatory: 'Authorised Signatory',
    issuedOn: 'Issued on: ',
    fingerprint: 'Record fingerprint (SHA-256): ',
    fingerprintTitle: 'RECORD FINGERPRINT (SHA-256, 64 characters)',
    fingerprintNote:
      'A fingerprint of the details recorded for this certificate, used to detect any change. It is not a digital signature. The digital signature, where present, is embedded in this PDF file and is checked separately.',
    footer: 'This certificate is system-generated and can be verified online using the QR code or certificate number above.',
    locale: 'en-IN',
    notAvailable: 'N/A',
  },
  hi: {
    department: 'उपभोक्ता मामले विभाग',
    title: 'सत्यापन प्रमाणपत्र',
    subtitle: 'वैध माप विज्ञान — तौल एवं माप उपकरण',
    certificateNo: 'प्रमाणपत्र संख्या: ',
    statement:
      'प्रमाणित किया जाता है कि नीचे वर्णित तौल/माप उपकरण की जाँच एवं सत्यापन लागू वैध माप विज्ञान मानकों के अनुसार किया गया है और वह सटीकता की निर्धारित आवश्यकताओं के अनुरूप पाया गया है।',
    instrument: 'उपकरण', manufacturer: 'निर्माता', model: 'मॉडल', serialNo: 'क्रम संख्या',
    validFrom: 'वैधता प्रारंभ', validUntil: 'वैधता समाप्ति',
    scanToVerify: 'प्रामाणिकता जाँचने के लिए स्कैन करें',
    signatory: 'अधिकृत हस्ताक्षरकर्ता',
    issuedOn: 'जारी करने की तिथि: ',
    fingerprint: 'अभिलेख फ़िंगरप्रिंट (SHA-256): ',
    fingerprintTitle: 'अभिलेख फ़िंगरप्रिंट (SHA-256, 64 अक्षर)',
    fingerprintNote:
      'यह इस प्रमाणपत्र में दर्ज विवरणों का फ़िंगरप्रिंट है, जिससे किसी भी बदलाव का पता चलता है। यह डिजिटल हस्ताक्षर नहीं है। डिजिटल हस्ताक्षर, जहाँ मौजूद हो, इसी PDF फ़ाइल में जुड़ा होता है और अलग से जाँचा जाता है।',
    footer: 'यह प्रमाणपत्र प्रणाली द्वारा तैयार किया गया है और ऊपर दिए गए QR कोड या प्रमाणपत्र संख्या से ऑनलाइन सत्यापित किया जा सकता है।',
    locale: 'hi-IN',
    notAvailable: 'उपलब्ध नहीं',
  },
};

module.exports = { SUPPORTED, DEFAULT_LANGUAGE, normaliseLanguage, render, PDF_LABELS, OFFENCE_LABEL };
