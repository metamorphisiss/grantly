export const STATES: Record<string, string[]> = {
  AP: ["andhra pradesh"],
  AR: ["arunachal pradesh"],
  AS: ["assam"],
  BR: ["bihar"],
  CG: ["chhattisgarh"],
  GA: ["goa"],
  GJ: ["gujarat"],
  HR: ["haryana"],
  HP: ["himachal pradesh"],
  JH: ["jharkhand"],
  KA: ["karnataka"],
  KL: ["kerala"],
  MP: ["madhya pradesh"],
  MH: ["maharashtra"],
  MN: ["manipur"],
  ML: ["meghalaya"],
  MZ: ["mizoram"],
  NL: ["nagaland"],
  OD: ["odisha", "orissa"],
  PB: ["punjab"],
  RJ: ["rajasthan"],
  SK: ["sikkim"],
  TN: ["tamil nadu"],
  TS: ["telangana"],
  TR: ["tripura"],
  UP: ["uttar pradesh"],
  UK: ["uttarakhand"],
  WB: ["west bengal"],
  AN: ["andaman and nicobar"],
  CH: ["chandigarh"],
  DN: ["dadra and nagar haveli", "daman and diu"],
  DL: ["delhi", "nct of delhi"],
  JK: ["jammu and kashmir"],
  LA: ["ladakh"],
  LD: ["lakshadweep"],
  PY: ["puducherry", "pondicherry"],
};

export const CATEGORIES: Record<string, string[]> = {
  SC: ["sc", "scheduled caste", "scheduled castes"],
  ST: ["st", "scheduled tribe", "scheduled tribes"],
  OBC: ["obc", "other backward class", "other backward classes"],
  EWS: ["ews", "economically weaker section", "economically weaker sections"],
  GEN: ["general category", "open category", "unreserved"],
};

export const MINORITIES: Record<string, string[]> = {
  muslim: ["muslim", "muslims"],
  christian: ["christian", "christians"],
  sikh: ["sikh", "sikhs"],
  buddhist: ["buddhist", "buddhists"],
  jain: ["jain", "jains"],
  parsi: ["parsi", "parsis", "zoroastrian"],
};

export const COURSE_LEVELS: Record<string, string[]> = {
  school_11_12: ["class 11", "class 12", "class xi", "class xii", "higher secondary", "11th", "12th"],
  diploma: ["diploma", "polytechnic"],
  iti: ["iti", "industrial training institute"],
  ug: ["undergraduate", "graduation", "bachelor", "b.tech", "b.e.", "be ", "b.sc", "bsc", "b.com", "bcom", "b.a.", "mbbs", "bba", "bca"],
  pg: ["postgraduate", "post graduate", "post-graduate", "master", "m.tech", "m.sc", "msc", "mba", "m.a.", "m.com", "mca", "llm"],
  phd: ["phd", "ph.d", "doctoral", "doctorate"],
};

export const STREAMS: Record<string, string[]> = {
  engineering: ["engineering", "b.tech", "b.e.", "m.tech", "technology"],
  medical: ["medical", "mbbs", "bds", "nursing", "pharmacy"],
  science: ["science", "b.sc", "m.sc"],
  commerce: ["commerce", "b.com", "m.com"],
  arts: ["arts", "humanities", "b.a.", "m.a."],
  law: ["law", "llb", "llm"],
  management: ["management", "mba", "bba"],
  computer_applications: ["bca", "mca", "computer applications"],
};

export const DOC_TYPES: Record<string, { label: string; synonyms: string[]; validityMonths?: number }> = {
  marksheet: { label: "Marksheet", synonyms: ["marksheet", "mark sheet", "marks card", "grade card", "transcript"] },
  income_certificate: { label: "Income certificate", synonyms: ["income certificate", "income proof", "income declaration"], validityMonths: 12 },
  category_certificate: { label: "Caste / category certificate", synonyms: ["caste certificate", "category certificate", "community certificate"] },
  domicile_certificate: { label: "Domicile certificate", synonyms: ["domicile certificate", "residence certificate", "domicile"] },
  bonafide_certificate: { label: "Bonafide certificate", synonyms: ["bonafide certificate", "bonafide", "student certificate"], validityMonths: 12 },
  fee_receipt: { label: "Fee receipt", synonyms: ["fee receipt", "fee structure", "fees receipt"] },
  admission_letter: { label: "Admission letter", synonyms: ["admission letter", "offer letter", "admission proof"] },
  id_proof: { label: "ID proof", synonyms: ["aadhaar", "aadhar", "identity proof", "id proof", "pan card", "passport"] },
  bank_details: { label: "Bank passbook / cancelled cheque", synonyms: ["bank passbook", "cancelled cheque", "bank account details"] },
  photo: { label: "Passport-size photo", synonyms: ["photograph", "passport size photo", "passport-size photo"] },
  disability_certificate: { label: "Disability certificate", synonyms: ["disability certificate", "udid", "pwd certificate"] },
  recommendation_letter: { label: "Recommendation letter", synonyms: ["recommendation letter", "letter of recommendation", "reference letter", "lor"] },
  sop: { label: "Statement of purpose", synonyms: ["statement of purpose", "sop", "personal statement", "essay"] },
  test_score: { label: "English test score report", synonyms: ["ielts", "toefl", "pte", "test score"] },
  resume: { label: "CV / resume", synonyms: ["cv", "resume", "curriculum vitae"] },
};

export const COUNTRIES: Record<string, string[]> = {
  IN: ["india", "indian"],
  UK: ["united kingdom", "uk", "britain", "british"],
  US: ["united states", "usa", "u.s.", "america"],
  DE: ["germany", "german"],
  FR: ["france", "french"],
  AU: ["australia", "australian"],
  CA: ["canada", "canadian"],
  JP: ["japan", "japanese"],
  NL: ["netherlands", "dutch"],
  IE: ["ireland", "irish"],
  SG: ["singapore"],
  NZ: ["new zealand"],
  EU: ["european union", "europe"],
};

export function matchVocab(text: string, vocab: Record<string, string[]>): string[] {
  const t = ` ${text.toLowerCase().replace(/[^a-z0-9.\s]/g, " ").replace(/\s+/g, " ")} `;
  const hits: string[] = [];
  for (const [code, words] of Object.entries(vocab)) {
    if (words.some((w) => t.includes(` ${w.trim()} `) || t.includes(` ${w.trim()}.`) || t.includes(` ${w.trim()},`))) hits.push(code);
  }
  return hits;
}

export function matchDocTypes(text: string): string[] {
  const map: Record<string, string[]> = {};
  for (const [k, v] of Object.entries(DOC_TYPES)) map[k] = v.synonyms;
  return matchVocab(text, map);
}
