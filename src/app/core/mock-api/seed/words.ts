/**
 * Word lists for the seed data.
 *
 * Every person and company here is invented. Real Malaysian universities,
 * cities and venues are used for realism — they are public places, not people
 * or clients — but no real company name appears, because listing one as a
 * customer would imply a business relationship that does not exist.
 *
 * Company names are assembled from invented prefixes so no combination lands
 * on a well-known real business.
 */

// ---------------------------------------------------------------- employers

export const COMPANY_PREFIXES: readonly string[] = [
  'Meridian',
  'Orkid',
  'Tanjung',
  'Selaras',
  'Nusantara',
  'Bayu',
  'Suria',
  'Amanah Jaya',
  'Cempaka',
  'Delima',
  'Harmoni',
  'Intan',
  'Kirana',
  'Lestari',
  'Mutiara',
  'Perdana Wira',
  'Rimba',
  'Saujana',
  'Teratai',
  'Wangsa',
  'Anggerik',
  'Berjaya Sentosa',
  'Cahaya',
  'Damai',
  'Embun',
  'Gemilang',
  'Hikmah',
  'Iras',
  'Jelita',
  'Kencana Ria',
];

export const INDUSTRIES: readonly string[] = [
  'Banking & Finance',
  'Semiconductor',
  'Oil & Gas',
  'FMCG',
  'Telco',
  'Consulting',
  'Technology',
  'Logistics',
  'Healthcare',
  'Property',
];

/** Industry noun that goes in the middle of a generated company name. */
export const INDUSTRY_NOUNS: Readonly<Record<string, readonly string[]>> = {
  'Banking & Finance': ['Capital', 'Credit', 'Finance', 'Treasury'],
  Semiconductor: ['Semiconductor', 'Microsystems', 'Silicon', 'Wafer'],
  'Oil & Gas': ['Energy', 'Petroleum', 'Offshore', 'Resources'],
  FMCG: ['Consumer', 'Foods', 'Provisions', 'Brands'],
  Telco: ['Telecom', 'Networks', 'Communications', 'Connect'],
  Consulting: ['Advisory', 'Consulting', 'Partners', 'Strategy'],
  Technology: ['Technologies', 'Digital', 'Systems', 'Software'],
  Logistics: ['Logistics', 'Freight', 'Supply Chain', 'Haulage'],
  Healthcare: ['Healthcare', 'Medical', 'Wellness', 'Diagnostics'],
  Property: ['Properties', 'Realty', 'Development', 'Estates'],
};

export const COMPANY_SUFFIXES: readonly string[] = ['Bhd', 'Sdn Bhd', 'Berhad'];

// ---------------------------------------------------------------- people
// A balanced mix of Malay, Chinese, Indian and East Malaysian given names.
// All fictional in combination.

export const GIVEN_NAMES: readonly string[] = [
  'Nur Aisyah',
  'Muhammad Danial',
  'Siti Khadijah',
  'Ahmad Zaki',
  'Nurul Huda',
  'Mohd Irfan',
  'Farah Nabila',
  'Amirul Hakim',
  'Aina Sofea',
  'Haziq Iskandar',
  'Wei Ming',
  'Li Xuan',
  'Jia Hui',
  'Zhi Hao',
  'Mei Ling',
  'Kai Wen',
  'Yan Ting',
  'Cheng Kiat',
  'Xin Yi',
  'Jun Hao',
  'Priya',
  'Ravindran',
  'Kavitha',
  'Suresh',
  'Deepa',
  'Arjun',
  'Shanti',
  'Vikram',
  'Meena',
  'Karthik',
  'Anak Jelani',
  'Dayang Sarah',
  'Awang Faizal',
  'Sylvia',
  'Gregory',
  'Juliana',
  'Roland',
  'Melissa',
  'Clarence',
  'Anastasia',
];

export const FAMILY_NAMES: readonly string[] = [
  'binti Rahman',
  'bin Abdullah',
  'binti Yusof',
  'bin Hashim',
  'binti Ismail',
  'bin Osman',
  'Tan',
  'Lim',
  'Wong',
  'Chan',
  'Lee',
  'Ng',
  'Goh',
  'Chong',
  'Nair',
  'Subramaniam',
  'Rajendran',
  'Pillai',
  'Menon',
  'Krishnan',
  'anak Numpang',
  'Abdullah Sani',
  'Joseph',
  'Gantang',
  'Mojilis',
  'Sim',
];

// ---------------------------------------------------------------- study

export const UNIVERSITIES: readonly string[] = [
  'Universiti Malaya',
  'Universiti Kebangsaan Malaysia',
  'Universiti Putra Malaysia',
  'Universiti Sains Malaysia',
  'Universiti Teknologi Malaysia',
  'Universiti Teknologi MARA',
  'Multimedia University',
  "Taylor's University",
  'Sunway University',
  'Asia Pacific University',
  'UCSI University',
  'Monash University Malaysia',
  'University of Nottingham Malaysia',
];

export const FIELDS_OF_STUDY: readonly string[] = [
  'Computer Science',
  'Software Engineering',
  'Electrical & Electronic Engineering',
  'Mechanical Engineering',
  'Accounting',
  'Finance',
  'Business Administration',
  'Marketing',
  'Data Science',
  'Actuarial Science',
  'Chemical Engineering',
  'Psychology',
];

/** Skills are drawn from the list matching the candidate's field. */
export const SKILLS_BY_FIELD: Readonly<Record<string, readonly string[]>> = {
  'Computer Science': ['Java', 'Python', 'Algorithms', 'SQL', 'Git', 'Linux', 'C++', 'Docker'],
  'Software Engineering': [
    'TypeScript',
    'React',
    'Node.js',
    'REST APIs',
    'Testing',
    'Git',
    'CI/CD',
    'PostgreSQL',
  ],
  'Electrical & Electronic Engineering': [
    'Verilog',
    'PCB Design',
    'MATLAB',
    'Embedded C',
    'Signal Processing',
    'AutoCAD',
    'FPGA',
  ],
  'Mechanical Engineering': [
    'SolidWorks',
    'AutoCAD',
    'Thermodynamics',
    'FEA',
    'CNC',
    'Lean Manufacturing',
    'CATIA',
  ],
  Accounting: ['MFRS', 'Audit', 'Taxation', 'Excel', 'SQL Accounting', 'Bookkeeping', 'ACCA'],
  Finance: [
    'Financial Modelling',
    'Valuation',
    'Excel',
    'Bloomberg',
    'Risk Analysis',
    'Power BI',
  ],
  'Business Administration': [
    'Project Management',
    'Excel',
    'Stakeholder Management',
    'Business Analysis',
    'Presentation',
  ],
  Marketing: ['SEO', 'Content Strategy', 'Google Analytics', 'Copywriting', 'Meta Ads', 'Canva'],
  'Data Science': ['Python', 'Pandas', 'Machine Learning', 'SQL', 'Tableau', 'Statistics', 'R'],
  'Actuarial Science': ['R', 'Excel VBA', 'Probability', 'Life Contingencies', 'SAS', 'Python'],
  'Chemical Engineering': [
    'Aspen HYSYS',
    'Process Design',
    'HAZOP',
    'Thermodynamics',
    'MATLAB',
    'Six Sigma',
  ],
  Psychology: [
    'SPSS',
    'Qualitative Research',
    'Counselling',
    'Report Writing',
    'Survey Design',
    'Statistics',
  ],
};

/** Sentence fragments used to build a candidate headline. */
export const HEADLINE_INTERESTS: readonly string[] = [
  'backend systems',
  'product analytics',
  'embedded hardware',
  'financial reporting',
  'brand strategy',
  'process optimisation',
  'machine learning',
  'risk modelling',
  'supply chain planning',
  'user research',
  'cloud infrastructure',
  'corporate finance',
];
