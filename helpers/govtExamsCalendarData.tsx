/*
 * Content for /govt-exams-calendar, copied from the editorial brief
 * (Govt-Exams-Calendar-Wireframe-and-Content.md). The brief is the source of truth:
 * change rows here only from an official notice, then move GEC_LAST_UPDATED and add
 * a line to GEC_UPDATE_LOG. `months` drive the month filter and list every month a
 * row's dates touch; `deadline` is the ISO last date that drives the red chip.
 */

export const GEC_PATH = "/govt-exams-calendar";

/** Shown in the hero and sent as WebPage dateModified. Change on every edit. */
export const GEC_LAST_UPDATED = { iso: "2026-11-02", label: "2 Nov 2026" };

export const GEC_SEO = {
  title: "Govt Exams Calendar 2026-27: UPSC, SSC, Bank, RRB Dates",
  description:
    "Upcoming government exam dates for 2026-27: UPSC 2027, SSC, IBPS, RRB and state exams, with last dates to apply. Updated 2 November 2026.",
};

export const GEC_H1 = "Government Exams Calendar 2026-27: Upcoming Sarkari Exam Dates";

export const GEC_OVERVIEW = [
  "One page for the government exam dates that matter in 2026-27: UPSC 2027, SSC, IBPS banking, RRB railway and state commission exams, plus the recruitments that are open for application right now.",
  "Start with the next-30-days table, then jump to your exam body. Every row shows a status, and dates can change, so confirm on the official website before you apply or travel to an exam centre.",
];

export type GecCategory = "upsc" | "ssc" | "banking" | "railway" | "state" | "central";

export const GEC_CATEGORIES: { value: GecCategory; label: string }[] = [
  { value: "upsc", label: "UPSC" },
  { value: "ssc", label: "SSC" },
  { value: "banking", label: "Banking" },
  { value: "railway", label: "Railway" },
  { value: "state", label: "State exams" },
  { value: "central", label: "Other central bodies" },
];

export type GecStatusTone = "open" | "upcoming" | "progress" | "concluded" | "awaited";

export interface GecStatus {
  label: string;
  tone: GecStatusTone;
}

const status = (label: string, tone: GecStatusTone): GecStatus => ({ label, tone });
const UPCOMING = status("Upcoming", "upcoming");
const IN_PROGRESS = status("In progress", "progress");
const CONCLUDED = status("Concluded", "concluded");
const APPLICATIONS_OPEN = status("Applications open", "open");

export type GecSectionId =
  | "next-30-days"
  | "exam-bodies"
  | "upsc-2027"
  | "ssc-2026-27"
  | "banking-ibps"
  | "railway-rrb"
  | "state-exams"
  | "open-applications"
  | "recently-concluded"
  | "exam-cycle"
  | "faqs"
  | "sources";

export interface GecRow {
  cells: string[];
  months: string[];
  category?: GecCategory;
  status?: GecStatus;
  keywords?: string;
  deadline?: string;
}

export interface GecTable {
  id: GecSectionId;
  title: string;
  intro?: string;
  note?: string;
  columns: string[];
  /** Applies to every row unless the row sets its own. */
  category?: GecCategory;
  /** Extra search terms for every row, so "rrb" finds rows that only say "Railway". */
  searchPrefix?: string;
  rows: GecRow[];
}

export const GEC_NEXT_30: GecTable = {
  id: "next-30-days",
  title: "Government exams in the next 30 days (3 November – 2 December 2026)",
  intro:
    "These exams fall between 3 November and 2 December 2026. Admit cards normally appear a few days before each exam, so keep your registration number and date of birth ready.",
  note: "CBE and CBT both mean computer-based examination or test.",
  columns: ["Date", "Exam", "Stage", "Conducting body", "Status"],
  rows: [
    {
      cells: ["2–6 Nov 2026", "SSC Junior Engineer (Civil, Mechanical, Electrical) 2026", "Paper-I (CBE)", "SSC"],
      status: IN_PROGRESS,
      category: "ssc",
      months: ["2026-11"],
      keywords: "ssc je",
    },
    {
      cells: ["3–5 Nov 2026", "RRB Assistant Loco Pilot (CEN 01/2026)", "CBT 1", "RRB"],
      status: UPCOMING,
      category: "railway",
      months: ["2026-11"],
      keywords: "rrb alp railway",
    },
    {
      cells: [
        "From 14 Nov 2026 (4 days, tentative)",
        "TNPSC Combined Technical Services (interview posts)",
        "Written exam",
        "TNPSC",
      ],
      status: UPCOMING,
      category: "state",
      months: ["2026-11"],
    },
    {
      cells: ["20–28 Nov 2026", "SSC Sub-Inspector in Delhi Police and CAPFs 2026", "Paper-I (CBE)", "SSC"],
      status: UPCOMING,
      category: "ssc",
      months: ["2026-11"],
      keywords: "ssc si cpo",
    },
    {
      cells: ["21–22 Nov 2026", "IBPS RRB Officer Scale I", "Prelims", "IBPS"],
      status: UPCOMING,
      category: "banking",
      months: ["2026-11"],
      keywords: "ibps rrb po bank",
    },
    {
      cells: [
        "22 Nov 2026",
        "UPSSSC Platoon Commander / Block Organiser and Havildar Instructor",
        "Written (Main)",
        "UPSSSC",
      ],
      status: UPCOMING,
      category: "state",
      months: ["2026-11"],
    },
    {
      cells: ["29 Nov 2026", "UPSSSC Sugarcane Supervisor and Mohrir", "Written (Main)", "UPSSSC"],
      status: UPCOMING,
      category: "state",
      months: ["2026-11"],
    },
    {
      cells: ["30 Nov – 31 Dec 2026", "SSC Combined Higher Secondary Level (CHSL) 2026", "Tier-I (CBE)", "SSC"],
      status: UPCOMING,
      category: "ssc",
      months: ["2026-11", "2026-12"],
      keywords: "ssc chsl",
    },
  ],
};

export interface GecBody {
  name: string;
  exams: string;
  stages: string;
  website: string;
}

export const GEC_BODIES: GecBody[] = [
  {
    name: "UPSC",
    exams:
      "Civil Services, Indian Forest Service, NDA & NA, CDS, CAPF (AC), Engineering Services, Combined Medical Services",
    stages: "Written exam, then interview, personality test or SSB, depending on the exam",
    website: "upsc.gov.in",
  },
  {
    name: "SSC",
    exams: "CGL, CHSL, MTS, JE, GD Constable, Sub-Inspector (CPO), Stenographer",
    stages: "Tier-based computer exams, plus skill or physical tests for some posts",
    website: "ssc.gov.in",
  },
  {
    name: "IBPS",
    exams: "PO/MT, Clerk, SO, and Regional Rural Banks (Officer Scale I–III, Office Assistant)",
    stages: "Prelims, Mains and interview, depending on the post",
    website: "ibps.in",
  },
  {
    name: "SBI",
    exams: "PO, Clerk, SO",
    stages: "Prelims and Mains, with an interview for officer posts",
    website: "sbi.bank.in",
  },
  {
    name: "RRB",
    exams: "NTPC, Group D, ALP and Technician, JE, Section Controller",
    stages: "Computer-based tests, plus skill test, aptitude test or document check by post",
    website: "Regional RRB websites",
  },
  {
    name: "State commissions",
    exams: "State civil services, teaching, police, clerical and technical posts",
    stages: "Varies by state",
    website: "Respective commission websites",
  },
];

export const GEC_UPSC: GecTable = {
  id: "upsc-2027",
  title: "UPSC exam calendar 2027",
  intro:
    "UPSC released its 2027 annual calendar on 20 May 2026. The commission states that dates may change if circumstances require, so treat a date as final only once the exam notice is out.",
  note: "The next UPSC notification due is NDA & NA (I) and CDS (I) 2027, on 2 December 2026.",
  columns: ["Exam", "Notification", "Last date to apply", "Exam date"],
  category: "upsc",
  searchPrefix: "upsc",
  rows: [
    {
      cells: [
        "Civil Services (Preliminary) 2027, including IFS (Preliminary)",
        "13 Jan 2027",
        "2 Feb 2027",
        "23 May 2027 (Sunday)",
      ],
      months: ["2027-01", "2027-02", "2027-05"],
      keywords: "cse ias prelims",
    },
    {
      cells: ["Civil Services (Main) 2027", "–", "–", "From 20 Aug 2027 (5 days)"],
      months: ["2027-08"],
      keywords: "cse ias mains",
    },
    {
      cells: ["NDA & NA (I) and CDS (I) 2027", "2 Dec 2026", "22 Dec 2026", "11 Apr 2027"],
      months: ["2026-12", "2027-04"],
    },
    {
      cells: ["NDA & NA (II) and CDS (II) 2027", "12 May 2027", "1 Jun 2027", "19 Sep 2027"],
      months: ["2027-05", "2027-06", "2027-09"],
    },
    {
      cells: ["Central Armed Police Forces (AC) 2027", "17 Feb 2027", "9 Mar 2027", "4 Jul 2027"],
      months: ["2027-02", "2027-03", "2027-07"],
      keywords: "capf",
    },
    {
      cells: ["Combined Medical Services 2027", "3 Mar 2027", "23 Mar 2027", "18 Jul 2027"],
      months: ["2027-03", "2027-07"],
      keywords: "cms",
    },
    {
      cells: ["Indian Forest Service (Main) 2027", "–", "–", "21 Nov 2027 (7 days)"],
      months: ["2027-11"],
      keywords: "ifs mains",
    },
  ],
};

export const GEC_SSC: GecTable = {
  id: "ssc-2026-27",
  title: "SSC exam calendar 2026-27",
  intro:
    "Most SSC exams are computer-based and held in tiers. Months shown as tentative can shift once SSC publishes the detailed notice.",
  columns: ["Exam", "Tier / phase", "Application window", "Exam date", "Status"],
  category: "ssc",
  searchPrefix: "ssc",
  rows: [
    {
      cells: ["Combined Graduate Level (CGL) 2026", "Tier-I", "21 May – 22 Jun 2026", "30 Sep – 30 Oct 2026"],
      status: CONCLUDED,
      months: ["2026-05", "2026-06", "2026-09", "2026-10"],
    },
    {
      cells: ["Junior Engineer (Civil, Mechanical, Electrical) 2026", "Paper-I", "2 – 22 Sep 2026", "2 – 6 Nov 2026"],
      status: IN_PROGRESS,
      months: ["2026-09", "2026-11"],
      keywords: "je",
    },
    {
      cells: ["Sub-Inspector in Delhi Police and CAPFs 2026", "Paper-I", "10 – 30 Sep 2026", "20 – 28 Nov 2026"],
      status: UPCOMING,
      months: ["2026-09", "2026-11"],
      keywords: "si cpo",
    },
    {
      cells: ["Combined Higher Secondary Level (CHSL) 2026", "Tier-I", "7 Sep – 7 Oct 2026", "30 Nov – 31 Dec 2026"],
      status: UPCOMING,
      months: ["2026-09", "2026-10", "2026-11", "2026-12"],
    },
    {
      cells: [
        "Constable (GD) in CAPFs, NIA, SSF and Rifleman (GD) in Assam Rifles 2027",
        "CBE",
        "Sep – Oct 2026 (tentative)",
        "Jan – Mar 2027 (tentative)",
      ],
      status: status("Check ssc.gov.in", "awaited"),
      months: ["2026-09", "2026-10", "2027-01", "2027-02", "2027-03"],
      keywords: "gd",
    },
  ],
};

export const GEC_BANKING: GecTable = {
  id: "banking-ibps",
  title: "Banking exams calendar (IBPS)",
  intro:
    "IBPS publishes the schedule for its PO/MT, Clerk, SO and Regional Rural Banks recruitments in one calendar. SBI announces its own exams separately, so check the SBI careers page for its next cycle.",
  columns: ["Exam", "Prelims", "Mains", "Status"],
  category: "banking",
  searchPrefix: "bank",
  rows: [
    { cells: ["IBPS PO / MT", "22–23 Aug 2026", "4 Oct 2026"], status: CONCLUDED, months: ["2026-08", "2026-10"] },
    { cells: ["IBPS SO", "29 Aug 2026", "1 Nov 2026"], status: CONCLUDED, months: ["2026-08", "2026-11"] },
    {
      cells: ["IBPS Clerk", "10–11 Oct 2026", "27 Dec 2026 (tentative)"],
      status: status("Mains upcoming", "upcoming"),
      months: ["2026-10", "2026-12"],
    },
    {
      cells: ["IBPS RRB Officer Scale I", "21–22 Nov 2026", "20 Dec 2026"],
      status: status("Prelims upcoming", "upcoming"),
      months: ["2026-11", "2026-12"],
      keywords: "po",
    },
    {
      cells: ["IBPS RRB Office Assistant", "6, 12 and 13 Dec 2026", "30 Jan 2027"],
      status: UPCOMING,
      months: ["2026-12", "2027-01"],
      keywords: "clerk",
    },
    {
      cells: ["IBPS RRB Officer Scale II and III", "Single exam: 20 Dec 2026", "Not applicable"],
      status: UPCOMING,
      months: ["2026-12"],
    },
  ],
};

export const GEC_RAILWAY: GecTable = {
  id: "railway-rrb",
  title: "Railway exams calendar (RRB)",
  intro:
    "Railway Recruitment Boards issue a Centralised Employment Notice (CEN) for each recruitment and announce exam dates through short notices on regional RRB websites. Use the CEN number when you look for your exam.",
  columns: ["Exam", "Notice", "Exam date / stage", "Status"],
  category: "railway",
  searchPrefix: "rrb railway",
  rows: [
    {
      cells: ["RRB Assistant Loco Pilot (ALP)", "CEN 01/2026, 11,127 posts", "CBT 1: 3–5 Nov 2026"],
      status: UPCOMING,
      months: ["2026-11"],
    },
    {
      cells: ["RRB Junior Engineer, DMS and CMA", "CEN 04/2026, 4,029 posts", "CBT 1: from 27 Oct 2026"],
      status: status("Concluded, result awaited", "concluded"),
      months: ["2026-10"],
      keywords: "je",
    },
    {
      cells: [
        "RRB NTPC (graduate level)",
        "Non-technical popular categories, 3,548 posts",
        "Exam date awaited. Apply by 6 Nov 2026",
      ],
      status: APPLICATIONS_OPEN,
      months: ["2026-11"],
    },
    {
      cells: [
        "RRB NTPC (undergraduate level)",
        "Junior Clerk cum Typist, Accounts Clerk cum Typist and others, 1,688 posts",
        "Exam date awaited. Apply by 13 Nov 2026",
      ],
      status: APPLICATIONS_OPEN,
      months: ["2026-11"],
      keywords: "ug",
    },
    {
      cells: ["RRB Station Master", "1,250 posts", "Exam date awaited. Apply by 25 Nov 2026"],
      status: APPLICATIONS_OPEN,
      months: ["2026-11"],
    },
    {
      cells: ["RRB Isolated categories", "195 posts", "Exam date awaited. Apply by 4 Dec 2026"],
      status: APPLICATIONS_OPEN,
      months: ["2026-12"],
    },
    {
      cells: ["RRB Group D (Level 1)", "Notice awaited", "To be announced"],
      status: status("Awaited", "awaited"),
      months: [],
    },
  ],
};

export const GEC_STATE: GecTable = {
  id: "state-exams",
  title: "State exam calendar highlights",
  intro:
    "State commissions publish their own planners. The dates below come from the UPPSC, UPSSSC and TNPSC schedules and stay tentative until each commission confirms them.",
  columns: ["Commission", "Exam", "Date", "Note"],
  category: "state",
  searchPrefix: "state",
  rows: [
    {
      cells: ["UPPSC", "Combined State / Upper Subordinate Services (PCS) Prelims", "6 Dec 2026", "Tentative"],
      months: ["2026-12"],
    },
    {
      cells: ["UPSSSC", "Platoon Commander / Block Organiser; Havildar Instructor", "22 Nov 2026", "Written (Main)"],
      months: ["2026-11"],
    },
    {
      cells: ["UPSSSC", "Sugarcane Supervisor; Mohrir", "29 Nov 2026", "Written (Main)"],
      months: ["2026-11"],
    },
    {
      cells: [
        "UPSSSC",
        "Auditor and Assistant Accountant; Vidhan Bhavan Guard and Agnirakshak",
        "20 Dec 2026",
        "Written (Main)",
      ],
      months: ["2026-12"],
    },
    {
      cells: ["TNPSC", "Combined Technical Services (interview posts)", "From 14 Nov 2026 (4 days)", "Tentative"],
      months: ["2026-11"],
    },
    {
      cells: [
        "TNPSC",
        "Combined Civil Services-IV (Group IV Services)",
        "20 Dec 2026",
        "Tentative. Apply by 11 Nov 2026",
      ],
      months: ["2026-11", "2026-12"],
    },
  ],
};

const openRow = (
  deadline: string,
  label: string,
  organisation: string,
  post: string,
  vacancies: string,
  category: GecCategory
): GecRow => ({
  cells: [label, organisation, post, vacancies],
  deadline,
  category,
  months: [deadline.slice(0, 7)],
});

export const GEC_OPEN: GecTable = {
  id: "open-applications",
  title: "Government jobs open for application (last dates)",
  intro:
    "Applications are open for the recruitments below as of 2 November 2026. Last dates come from each official notification and are sometimes extended, so confirm on the notice before you apply.",
  columns: ["Last date", "Organisation", "Post", "Vacancies"],
  searchPrefix: "apply application",
  rows: [
    openRow("2026-11-06", "6 Nov 2026", "RRB", "NTPC (graduate level): non-technical popular categories", "3,548", "railway"),
    openRow("2026-11-07", "7 Nov 2026", "WBPSC", "English Stenographer", "266", "state"),
    openRow("2026-11-09", "9 Nov 2026", "WBPSC", "Sub Surveyor", "1,145", "state"),
    openRow("2026-11-09", "9 Nov 2026", "Delhi University", "Senior Assistant and Assistant", "126", "central"),
    openRow("2026-11-11", "11 Nov 2026", "CRPF", "Constable (Sports Quota)", "521", "central"),
    openRow("2026-11-11", "11 Nov 2026", "TNPSC", "Group IV Services", "6,574", "state"),
    openRow("2026-11-12", "12 Nov 2026", "JKSSB", "MTS and Sanitation Worker", "2,863", "state"),
    openRow("2026-11-13", "13 Nov 2026", "RRB", "NTPC (undergraduate level)", "1,688", "railway"),
    openRow("2026-11-15", "15 Nov 2026", "Cabinet Secretariat", "Deputy Field Officer (Technical)", "250", "central"),
    openRow("2026-11-15", "15 Nov 2026", "CWC", "Assistant Manager and Junior Executive", "327", "central"),
    openRow("2026-11-25", "25 Nov 2026", "RRB", "Station Master", "1,250", "railway"),
    openRow("2026-11-25", "25 Nov 2026", "UPSSSC", "Junior Engineer and Technical Assistant", "1,156", "state"),
    openRow("2026-11-25", "25 Nov 2026", "Supreme Court of India", "Junior Court Attendant", "130", "central"),
    openRow("2026-11-27", "27 Nov 2026", "UPSSSC", "Junior Engineer, Electrician and others", "380", "state"),
    openRow("2026-11-30", "30 Nov 2026", "Nagaland Police", "Constable", "1,137", "state"),
    openRow("2026-11-30", "30 Nov 2026", "APPSC", "Junior Accountant, Assistant Section Officer and others", "686", "state"),
    openRow("2026-12-04", "4 Dec 2026", "RRB", "Isolated categories", "195", "railway"),
    openRow("2026-12-15", "15 Dec 2026", "JKSSB", "Junior Engineer (Mechanical)", "127", "state"),
  ],
};

export const GEC_CONCLUDED: GecTable = {
  id: "recently-concluded",
  title: "Recently concluded: results awaited",
  intro: "These exams have finished. The last column shows what to watch for next.",
  columns: ["Exam", "Stage", "Held on", "What to watch for"],
  rows: [
    {
      cells: ["SSC CGL 2026", "Tier-I", "30 Sep – 30 Oct 2026", "Answer key and result on ssc.gov.in"],
      category: "ssc",
      months: ["2026-09", "2026-10"],
    },
    {
      cells: ["RRB JE, DMS and CMA (CEN 04/2026)", "CBT 1", "From 27 Oct 2026", "Result on regional RRB websites"],
      category: "railway",
      months: ["2026-10"],
      keywords: "railway",
    },
    {
      cells: ["IBPS SO", "Mains", "1 Nov 2026", "Result and interview notice on ibps.in"],
      category: "banking",
      months: ["2026-11"],
      keywords: "bank",
    },
    {
      cells: ["IBPS PO / MT", "Mains", "4 Oct 2026", "Interview and final result notice on ibps.in"],
      category: "banking",
      months: ["2026-10"],
      keywords: "bank",
    },
    {
      cells: ["IBPS Clerk", "Prelims", "10–11 Oct 2026", "Mains admit card ahead of 27 Dec 2026"],
      category: "banking",
      months: ["2026-10"],
      keywords: "bank",
    },
  ],
};

/** Every filterable table, in page order. */
export const GEC_TABLES: GecTable[] = [
  GEC_NEXT_30,
  GEC_UPSC,
  GEC_SSC,
  GEC_BANKING,
  GEC_RAILWAY,
  GEC_STATE,
  GEC_OPEN,
  GEC_CONCLUDED,
];

export const GEC_CYCLE_INTRO =
  "Every recruitment moves through the same steps. Knowing which one you are at tells you what to watch for.";

export const GEC_CYCLE: { title: string; text: string }[] = [
  {
    title: "Annual calendar.",
    text: "UPSC, SSC, IBPS and the RRBs publish a tentative calendar for the year. It gives months or planned dates, not guarantees.",
  },
  {
    title: "Notification.",
    text: "The detailed notice lists vacancies, eligibility, age limits, fees and the application window. This is the document that fixes your deadlines.",
  },
  {
    title: "Application and correction.",
    text: "Fill in the form on the official portal before the last date. Many boards open a short correction window afterwards.",
  },
  {
    title: "City intimation and admit card.",
    text: "RRBs usually publish exam city details about ten days before the exam and the e-call letter about four days before. SSC and IBPS release admit cards a few days ahead.",
  },
  {
    title: "Exam, answer key and result.",
    text: "Multi-stage exams then move to the next stage, which has its own schedule.",
  },
];

export const GEC_CTA = {
  title: "Practise before the exam",
  text: "Practise with Testkart’s test series for your exam and see where you stand before exam day.",
  button: "Explore Testkart test series",
};

export const GEC_FAQS: { question: string; answer: string }[] = [
  {
    question: "Which government exams are coming up in November 2026?",
    answer:
      "Several begin this month: SSC JE Paper-I (2–6 November), RRB ALP CBT 1 (3–5 November), SSC Sub-Inspector Paper-I (20–28 November), IBPS RRB Officer Scale I prelims (21–22 November) and SSC CHSL Tier-I, which starts on 30 November. UPSSSC and TNPSC also hold exams in this window. The next-30-days table at the top lists all of them.",
  },
  {
    question: "When is the UPSC Civil Services Prelims 2027?",
    answer:
      "The Civil Services (Preliminary) Examination 2027 is on 23 May 2027. The notification is due on 13 January 2027 and applications close on 2 February 2027. The Main examination starts on 20 August 2027 and runs for five days.",
  },
  {
    question: "When was the SSC CGL 2026 Tier-I exam held?",
    answer:
      "SSC CGL 2026 Tier-I ran from 30 September to 30 October 2026. Applications were open from 21 May to 22 June 2026. SSC will announce the answer key, result and the next stage on ssc.gov.in.",
  },
  {
    question: "What are the IBPS RRB 2026 exam dates?",
    answer:
      "For Officer Scale I, prelims are on 21 and 22 November 2026 and mains on 20 December 2026. For Office Assistant, prelims are on 6, 12 and 13 December 2026 and mains on 30 January 2027. Officer Scale II and III take a single exam on 20 December 2026.",
  },
  {
    question: "Are the dates in this calendar final?",
    answer:
      "Not always. An annual calendar shows planned dates, and boards such as UPSC state that these can change. SSC and the RRBs also move exams through short notices. Treat the exam notice as the final word and check the official site a few days before your exam.",
  },
  {
    question: "What is the difference between an exam calendar and an exam notification?",
    answer:
      "A calendar is a planning document with tentative months or dates. A notification is the formal announcement for one recruitment. It fixes the number of vacancies, eligibility, fee and the application window.",
  },
  {
    question: "Which government exams can I take after Class 12?",
    answer:
      "NDA, SSC CHSL, SSC Stenographer (Grade C and D) and RRB NTPC undergraduate posts ask for Class 12. SSC MTS, SSC GD Constable and RRB Group D ask for Class 10 or an equivalent qualification. Age limits and other conditions differ for each post, so read the notification before you apply.",
  },
  {
    question: "Where can I check official exam dates?",
    answer:
      "On the official websites: upsc.gov.in for UPSC, ssc.gov.in for SSC, ibps.in for IBPS, sbi.bank.in for SBI and your regional RRB website for railway exams. State exams are listed on the relevant commission’s website.",
  },
  {
    question: "When are admit cards released?",
    answer:
      "Usually a few days before the exam. RRBs publish exam city details about ten days ahead and e-call letters about four days ahead. SSC CGL Tier-I admit cards, for example, began on 27 September for exams starting 30 September. Keep your registration number and date of birth ready.",
  },
  {
    question: "How often is this page updated?",
    answer:
      "Every week, and the last-dates table every two to three days. The date at the top shows when the page was last checked.",
  },
];

export const GEC_SOURCES = [
  { label: "UPSC", domain: "upsc.gov.in" },
  { label: "SSC", domain: "ssc.gov.in" },
  { label: "IBPS", domain: "ibps.in" },
  { label: "SBI", domain: "sbi.bank.in" },
];

export const GEC_SOURCES_TAIL =
  "regional Railway Recruitment Board websites and the websites of the state commissions named above.";

export const GEC_DISCLAIMER =
  "Testkart is not affiliated with any exam-conducting body. Dates can change without notice. Confirm on the official website before you apply or travel to an exam centre.";

/** Newest first. Add a line on every update. */
export const GEC_UPDATE_LOG: { date: string; text: string }[] = [
  {
    date: "2 November 2026",
    text: "Page published with RRB ALP, IBPS RRB and SSC schedules and refreshed last dates.",
  },
];

export const GEC_RELATED: { title: string; text: string }[] = [
  { title: "Syllabus", text: "Topic-wise syllabus for the exam you are preparing for." },
  { title: "Exam pattern", text: "Sections, questions, marks and timing for each stage." },
  { title: "Previous year papers", text: "Past papers to see how questions are actually set." },
  { title: "Mock tests", text: "Full-length tests in the real exam format, with your score." },
];

export const GEC_CHIPS: { id: GecSectionId; label: string }[] = [
  { id: "next-30-days", label: "Next 30 Days" },
  { id: "upsc-2027", label: "UPSC" },
  { id: "ssc-2026-27", label: "SSC" },
  { id: "banking-ibps", label: "Banking" },
  { id: "railway-rrb", label: "Railway" },
  { id: "state-exams", label: "State Exams" },
  { id: "open-applications", label: "Open Applications" },
];

export const GEC_ON_THIS_PAGE: { id: GecSectionId; label: string }[] = [
  { id: "next-30-days", label: "Next 30 days" },
  { id: "exam-bodies", label: "Exam bodies at a glance" },
  { id: "upsc-2027", label: "UPSC 2027" },
  { id: "ssc-2026-27", label: "SSC 2026-27" },
  { id: "banking-ibps", label: "Banking (IBPS)" },
  { id: "railway-rrb", label: "Railway (RRB)" },
  { id: "state-exams", label: "State exams" },
  { id: "open-applications", label: "Last dates to apply" },
  { id: "recently-concluded", label: "Recently concluded" },
  { id: "exam-cycle", label: "How the exam cycle works" },
  { id: "faqs", label: "FAQs" },
  { id: "sources", label: "Sources and update log" },
];
