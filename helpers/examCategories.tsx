export interface Exam {
  id: string;
  name: string;
  fullName: string;
  description?: string;
  category: string;
}

export interface ExamCategory {
  id: string;
  name: string;
  exams: Omit<Exam, "category">[];
}

export const examCategories: ExamCategory[] = [
  {
    id: "ssc-exams",
    name: "SSC Exams",
    exams: [
      {
        id: "ssc-cgl",
        name: "SSC CGL",
        fullName: "Staff Selection Commission Combined Graduate Level",
        description:
          "A national-level exam for recruitment to Group B and C posts in various ministries and government departments.",
      },
      {
        id: "ssc-chsl",
        name: "SSC CHSL",
        fullName: "Staff Selection Commission Combined Higher Secondary Level",
        description:
          "Recruits Lower Divisional Clerks, Junior Secretariat Assistants, Postal Assistants, and Data Entry Operators.",
      },
      {
        id: "ssc-je",
        name: "SSC JE",
        fullName: "Staff Selection Commission Junior Engineer",
        description:
          "For recruiting Junior Engineers in Civil, Mechanical, Electrical, and Quantity Surveying & Contracts disciplines.",
      },
      {
        id: "ssc-mts",
        name: "SSC MTS",
        fullName: "Staff Selection Commission Multi-Tasking Staff",
        description:
          "A national-level exam for non-technical Group C posts in central government offices.",
      },
      {
        id: "ssc-cpo",
        name: "SSC CPO",
        fullName: "Staff Selection Commission Central Police Organization",
        description:
          "Recruits Sub-Inspectors in Delhi Police and Central Armed Police Forces (CAPFs).",
      },
      {
        id: "ssc-gd",
        name: "SSC GD",
        fullName: "Staff Selection Commission General Duty Constable",
        description:
          "For recruitment of Constables (General Duty) in BSF, CISF, ITBP, CRPF, and Rifleman in AR.",
      },
    ],
  },
  {
    id: "banking-exams",
    name: "Banking Exams",
    exams: [
      {
        id: "sbi-po",
        name: "SBI PO",
        fullName: "State Bank of India Probationary Officer",
        description:
          "A highly competitive exam for the position of Probationary Officer in the State Bank of India.",
      },
      {
        id: "sbi-clerk",
        name: "SBI Clerk",
        fullName: "State Bank of India Clerk (Junior Associate)",
        description:
          "Recruits for clerical cadre posts (Junior Associates) in various branches of SBI across the country.",
      },
      {
        id: "ibps-po",
        name: "IBPS PO",
        fullName: "Institute of Banking Personnel Selection Probationary Officer",
        description:
          "A common written examination for the recruitment of Probationary Officers in multiple public sector banks.",
      },
      {
        id: "ibps-clerk",
        name: "IBPS Clerk",
        fullName: "Institute of Banking Personnel Selection Clerk",
        description:
          "A common recruitment process for clerical positions in participating public sector banks.",
      },
      {
        id: "ibps-rrb",
        name: "IBPS RRB",
        fullName: "Institute of Banking Personnel Selection Regional Rural Banks",
        description:
          "Recruits officers and office assistants for various Regional Rural Banks (RRBs) in India.",
      },
      {
        id: "rbi-grade-b",
        name: "RBI Grade B",
        fullName: "Reserve Bank of India Grade B Officer",
        description:
          "A prestigious exam for direct recruitment of officers in the Reserve Bank of India.",
      },
    ],
  },
  {
    id: "railway-exams",
    name: "Railway Exams",
    exams: [
      {
        id: "rrb-ntpc",
        name: "RRB NTPC",
        fullName: "Railway Recruitment Board Non-Technical Popular Categories",
        description:
          "Recruits for various non-technical posts like Junior Clerk, Accounts Clerk, Goods Guard, Station Master, etc.",
      },
      {
        id: "rrb-je",
        name: "RRB JE",
        fullName: "Railway Recruitment Board Junior Engineer",
        description:
          "For the recruitment of Junior Engineers, Depot Material Superintendent, and Chemical & Metallurgical Assistant.",
      },
      {
        id: "rrb-alp",
        name: "RRB ALP",
        fullName: "Railway Recruitment Board Assistant Loco Pilot",
        description:
          "Recruits Assistant Loco Pilots and Technicians for various railway zones.",
      },
      {
        id: "rrb-group-d",
        name: "RRB Group D",
        fullName: "Railway Recruitment Board Group D",
        description:
          "For recruitment to various Level 1 posts in the Indian Railways.",
      },
    ],
  },
  {
    id: "civil-services-exams",
    name: "Civil Services",
    exams: [
      {
        id: "upsc-cse",
        name: "UPSC CSE",
        fullName: "Union Public Service Commission Civil Services Examination",
        description:
          "The premier examination for recruitment to top civil services of India like IAS, IPS, IFS, and IRS.",
      },
      {
        id: "upsc-cds",
        name: "UPSC CDS",
        fullName: "Union Public Service Commission Combined Defence Services",
        description:
          "For recruitment into the Indian Military Academy, Officers Training Academy, Indian Naval Academy, and Indian Air Force Academy.",
      },
      {
        id: "upsc-capf",
        name: "UPSC CAPF",
        fullName:
          "Union Public Service Commission Central Armed Police Forces",
        description:
          "Recruits Assistant Commandants (Group A) in the Central Armed Police Forces (CAPF).",
      },
      {
        id: "state-psc",
        name: "State PSC",
        fullName: "State Public Service Commission",
        description:
          "State-level civil services examinations conducted by respective state public service commissions.",
      },
    ],
  },
  {
    id: "teaching-exams",
    name: "Teaching Exams",
    exams: [
      {
        id: "ctet",
        name: "CTET",
        fullName: "Central Teacher Eligibility Test",
        description:
          "A national-level eligibility test to determine eligibility for appointment as a teacher for classes 1 to 8.",
      },
      {
        id: "ugc-net",
        name: "UGC NET",
        fullName: "University Grants Commission National Eligibility Test",
        description:
          "Determines eligibility for 'Assistant Professor' and 'Junior Research Fellowship' in Indian universities and colleges.",
      },
      {
        id: "kvs",
        name: "KVS",
        fullName: "Kendriya Vidyalaya Sangathan",
        description:
          "Recruitment exams for teaching (PGT, TGT, PRT) and non-teaching posts in Kendriya Vidyalayas.",
      },
      {
        id: "dsssb",
        name: "DSSSB",
        fullName: "Delhi Subordinate Services Selection Board",
        description:
          "Conducts recruitment for various teaching and non-teaching posts under the Govt. of NCT of Delhi.",
      },
    ],
  },
  {
    id: "engineering-recruitment-exams",
    name: "Engineering",
    exams: [
      {
        id: "gate",
        name: "GATE",
        fullName: "Graduate Aptitude Test in Engineering",
        description:
          "An all-India examination that primarily tests the comprehensive understanding of various undergraduate subjects in engineering and science.",
      },
      {
        id: "ese",
        name: "ESE",
        fullName: "Engineering Services Examination",
        description:
          "A national-level examination for recruitment into the engineering services of the Government of India.",
      },
      {
        id: "isro",
        name: "ISRO",
        fullName: "Indian Space Research Organisation Recruitment",
        description:
          "Recruitment exam for scientists and engineers in various disciplines at ISRO.",
      },
    ],
  },
  {
    id: "other-popular-exams",
    name: "Other Exams",
    exams: [
      {
        id: "jee-main",
        name: "JEE Main",
        fullName: "Joint Entrance Examination Main",
        description:
          "A national level undergraduate engineering entrance examination for admission to various engineering colleges in India.",
      },
      {
        id: "jee-advanced",
        name: "JEE Advanced",
        fullName: "Joint Entrance Examination Advanced",
        description:
          "The second stage of the JEE, for admission to the prestigious Indian Institutes of Technology (IITs).",
      },
      {
        id: "neet",
        name: "NEET",
        fullName: "National Eligibility cum Entrance Test",
        description:
          "The sole entrance test for admission to undergraduate medical and dental courses in India.",
      },
      {
        id: "clat",
        name: "CLAT",
        fullName: "Common Law Admission Test",
        description:
          "A centralized national level entrance test for admissions to 22 National Law Universities in India.",
      },
      {
        id: "cat",
        name: "CAT",
        fullName: "Common Admission Test",
        description:
          "A computer-based test for admission into graduate management programs at Indian Institutes of Management (IIMs) and other top business schools.",
      },
    ],
  },
];