/**
 * Copy and data for the promotional pages of Dr. Mukesh Goyal (SWMG), teacher
 * 15752. Facts come from swmg.in, his two YouTube channels and his Testkart
 * profile as of September 2026. Video titles are the originals from YouTube;
 * the summaries only restate what each title and description says.
 */

export type SwmgVideo = {
  id: string;
  title: string;
  summary: string;
  channel: "evs" | "paper1";
  uploadDate: string;
  durationSeconds: number;
};

export type SwmgFaqItem = { question: string; answer: string };

export type SwmgUnit = { number: number; name: string; topics: string[] };

const BASE_PATH = "/ugc-net-swmg-success-with-mukesh-goyal";

export const swmgPromoContent = {
  teacherSlug: "ugc-net-mukesh-goyal",
  siteUrl: "https://testkart.in",
  basePath: BASE_PATH,
  paths: {
    overview: BASE_PATH,
    evs: `${BASE_PATH}/environmental-science`,
    reviews: `${BASE_PATH}/reviews`,
  },
  name: "Dr. Mukesh Goyal",
  academy: "SWMG - Success with Mukesh Goyal",
  portrait: {
    src900: "https://cdn.testkart.in/marketing/swmg/0079bd4c-c425-4dde-9138-43313c0d8bc2.webp",
    src600: "https://cdn.testkart.in/marketing/swmg/64366e1a-0034-4dfb-8f4f-bae8a77f114b.webp",
    width: 900,
    height: 1125,
  },
  shareImage: "https://cdn.testkart.in/marketing/swmg/af6f563d-9896-4333-876e-72e65c2fe84f.jpg",
  credentials: [
    { value: "JRF", label: "UGC NET qualified" },
    { value: "Ph.D.", label: "Environmental Science" },
    { value: "10+ years", label: "Teaching UGC NET" },
    { value: "140K+", label: "YouTube subscribers" },
  ],
  channels: {
    paper1: {
      name: "SWMG UGC NET PAPER 1",
      url: "https://www.youtube.com/@ugcnet_paper-1_Dr.MukeshGoyal",
      subscribers: "120K+ subscribers",
      videos: "1,500+ free lessons",
      focus: "Teaching Aptitude, Research Aptitude, Reasoning, ICT, Data Interpretation and the rest of Paper 1.",
    },
    evs: {
      name: "SWMG UGC NET EVS",
      url: "https://www.youtube.com/@swmgugcnetevs",
      subscribers: "19K+ subscribers",
      videos: "380+ free lessons",
      focus: "Environmental Science Paper 2 concepts, PYQ discussions, paper analysis and exam updates.",
    },
  },
  sameAs: [
    "https://www.swmg.in",
    "https://www.youtube.com/@ugcnet_paper-1_Dr.MukeshGoyal",
    "https://www.youtube.com/@swmgugcnetevs",
    "https://www.facebook.com/successwithMG",
    "https://www.linkedin.com/in/dr-mukesh-goyal-1a811945",
    "https://www.instagram.com/mukesh.goyal.31542",
    "https://x.com/mukeshgoyal995",
  ],
  method: [
    {
      title: "Learn the concept",
      text: "Every topic starts from the basics and builds to exam depth, with diagrams, processes and worked numericals where the unit needs them.",
    },
    {
      title: "Apply it to PYQs",
      text: "The same topic is then read through previous-year questions, so you see how NTA turns a syllabus line into statements, matches and close options.",
    },
    {
      title: "Test yourself",
      text: "Topic tests, unit tests and full mocks show which mistakes come from concepts, recall, calculation or time pressure.",
    },
    {
      title: "Revise the gap",
      text: "Wrong answers become a revision list. You go back to that lesson, fix it, and test again instead of restarting the syllabus.",
    },
  ],
  paper1Units: [
    "Teaching Aptitude",
    "Research Aptitude",
    "Comprehension",
    "Communication",
    "Mathematical Reasoning and Aptitude",
    "Logical Reasoning",
    "Data Interpretation",
    "Information and Communication Technology (ICT)",
    "People, Development and Environment",
    "Higher Education System",
  ],
  evsUnits: [
    {
      number: 1,
      name: "Fundamentals of Environmental Sciences",
      topics: [
        "Definition, principles and scope of environmental science",
        "Structure of the atmosphere, hydrosphere, lithosphere and biosphere",
        "Laws of thermodynamics, heat transfer and material balance",
        "Meteorology: stability, inversions, mixing height and wind roses",
        "Sustainable development and environmental ethics",
      ],
    },
    {
      number: 2,
      name: "Environmental Chemistry",
      topics: [
        "Stoichiometry, chemical kinetics, Gibbs energy and chemical potential",
        "Water chemistry: pH, alkalinity, hardness, DO, BOD and COD",
        "Atmospheric chemistry: photochemical smog, ozone and greenhouse gases",
        "Soil chemistry, heavy metals and pesticides",
        "Analytical methods from titrimetry to AAS, chromatography and spectroscopy",
      ],
    },
    {
      number: 3,
      name: "Environmental Biology",
      topics: [
        "Ecosystem structure, food chains, energy flow and ecological pyramids",
        "Population and community ecology, succession and biomes",
        "Biogeochemical cycles",
        "Biodiversity, hotspots and conservation strategies",
        "Toxicology and bioaccumulation",
      ],
    },
    {
      number: 4,
      name: "Environmental Geosciences",
      topics: [
        "Origin of the Earth, geological time scale and plate tectonics",
        "Minerals, rocks, weathering and soil formation",
        "Hydrological cycle and groundwater",
        "Natural hazards: earthquakes, landslides, floods and cyclones",
        "Remote sensing and GIS in environmental studies",
      ],
    },
    {
      number: 5,
      name: "Energy and Environment",
      topics: [
        "Solar radiation and the Earth's energy budget",
        "Fossil fuels and their environmental impact",
        "Solar, wind, hydro, tidal, geothermal and biomass energy",
        "Nuclear energy and radioactive waste",
        "Energy conservation and efficiency",
      ],
    },
    {
      number: 6,
      name: "Environmental Pollution and Control",
      topics: [
        "Air pollutants, dispersion and control equipment",
        "Water pollution and wastewater treatment",
        "Soil, noise, marine, thermal and radioactive pollution",
        "Ambient standards and monitoring",
        "Pollution prevention and cleaner production",
      ],
    },
    {
      number: 7,
      name: "Solid and Hazardous Waste Management",
      topics: [
        "Sources, composition and characteristics of solid waste",
        "Collection, segregation and the 3Rs",
        "Sanitary landfill, incineration, composting and vermicomposting",
        "Hazardous, biomedical and electronic waste",
        "Waste-to-energy options",
      ],
    },
    {
      number: 8,
      name: "Environmental Assessment, Management and Legislation",
      topics: [
        "Environmental Impact Assessment: screening, scoping, baseline and public hearing",
        "Environmental audit, life cycle assessment and ISO 14000",
        "Environment Protection Act 1986, Water Act 1974 and Air Act 1981",
        "Wildlife, forest and biodiversity legislation",
        "National Green Tribunal and environmental clearances",
      ],
    },
    {
      number: 9,
      name: "Statistical Approaches and Modelling in Environmental Sciences",
      topics: [
        "Central tendency, dispersion and probability distributions",
        "Hypothesis testing: t-test, chi-square and ANOVA",
        "Correlation and regression",
        "Environmental models such as Gaussian plume and DO sag",
        "Population growth models",
      ],
    },
    {
      number: 10,
      name: "Contemporary Environmental Issues",
      topics: [
        "Climate change, ozone depletion and acid rain",
        "International conventions from Stockholm 1972 to Paris 2015",
        "India's climate action plans and missions",
        "Environmental movements such as Chipko and Narmada Bachao",
        "Major environmental disasters and what they changed",
      ],
    },
  ] as SwmgUnit[],
  videos: {
    firstAttempt: {
      id: "idIp78MvBfw",
      title: "First Attempt में UGC NET EVS Qualified! क्या थी तैयारी की Strategy? | UGC NET June 2026 Result",
      summary:
        "Interview with a student who qualified UGC NET Environmental Science in the June 2026 exam on the first attempt: where they started, how they managed theory and PYQs, how they revised and which mistakes to avoid.",
      channel: "evs",
      uploadDate: "2026-08-30",
      durationSeconds: 521,
    },
    resultAnalysis: {
      id: "YZMdbAjkAcY",
      title: "Result Truth UGC NET EVS June 2026 II JRF, NET & PhD Only Selection Data",
      summary:
        "Dr. Goyal's breakdown of the June 2026 Environmental Science result: registered versus appeared candidates and how many qualified for JRF, NET and Ph.D. admission only.",
      channel: "evs",
      uploadDate: "2026-08-29",
      durationSeconds: 340,
    },
    batchLaunch: {
      id: "DIAAgkyeBLs",
      title: "UGC NET Environmental Science December 2026 Batch Launch",
      summary: "Dr. Goyal introduces his December 2026 UGC NET Environmental Science batch.",
      channel: "evs",
      uploadDate: "2026-07-17",
      durationSeconds: 416,
    },
    paperReview: {
      id: "xFxtLBZJ7Ww",
      title: "PART-01 UGC NET EVS June 2026 Paper-2 Analysis | NTA Answer Key? II Complete Question Review",
      summary:
        "Part 1 of Dr. Goyal's question-by-question review of the June 2026 Environmental Science Paper 2, checked against the NTA answer key. A full class, not a clip.",
      channel: "evs",
      uploadDate: "2026-08-17",
      durationSeconds: 2590,
    },
    jrfStrategy: {
      id: "PlqBAYSl3r8",
      title: "JRF Student से बातचीत, जानिए इनकी Complete Strategy",
      summary: "A conversation with a JRF-qualified student about the full preparation strategy that worked for them.",
      channel: "paper1",
      uploadDate: "2024-01-26",
      durationSeconds: 363,
    },
    firstScholarship: {
      id: "F4vAWtGP4kQ",
      title: "पहली Scholarship की ख़ुशी, Power of JRF",
      summary: "A student on the first scholarship that came with qualifying JRF.",
      channel: "paper1",
      uploadDate: "2024-04-01",
      durationSeconds: 481,
    },
    airRankInterview: {
      id: "8wjHjibm3Wk",
      title: "AIR Rank Holder Our Online Student UGC NET JRF, With Dr. Mukesh Goyal",
      summary: "An online SWMG student with an All India Rank in UGC NET JRF, in conversation with Dr. Goyal.",
      channel: "paper1",
      uploadDate: "2023-04-16",
      durationSeconds: 268,
    },
    feedbackOne: {
      id: "fjeSAaHGSP0",
      title: "Congratulation Dear Student II Thanks a lot for your Feedback",
      summary: "Feedback from a student who qualified UGC NET JRF, recorded for Dr. Goyal after her result.",
      channel: "paper1",
      uploadDate: "2022-02-24",
      durationSeconds: 65,
    },
    feedbackTwo: {
      id: "-qRxCugJynU",
      title: "Congratulation Dear Student II Thanks a lot for your Feedback",
      summary: "Another JRF-qualified student on preparing with Dr. Goyal.",
      channel: "paper1",
      uploadDate: "2022-02-24",
      durationSeconds: 102,
    },
    teachersDay: {
      id: "pPCyfXIGcaI",
      title: "Thanks Dear Student II Teacher's Day Gift",
      summary: "A student's Teacher's Day message for Dr. Goyal.",
      channel: "paper1",
      uploadDate: "2021-09-05",
      durationSeconds: 417,
    },
  } satisfies Record<string, SwmgVideo>,
  overviewFaqs: [
    {
      question: "Who is Dr. Mukesh Goyal?",
      answer:
        "Dr. Mukesh Goyal is a UGC NET educator from Hisar, Haryana. He qualified UGC NET JRF, holds a Ph.D. in Environmental Science and has more than 10 years of academic experience. He founded SWMG (Success with Mukesh Goyal) and teaches UGC NET Environmental Science Paper 2 and the common Paper 1.",
    },
    {
      question: "What does SWMG stand for?",
      answer:
        "SWMG stands for Success with Mukesh Goyal, the online coaching brand he runs for UGC NET, JRF, SET and Assistant Professor aspirants.",
    },
    {
      question: "Which UGC NET papers does he teach?",
      answer:
        "His main subject is UGC NET Environmental Science, Paper 2, subject code 89. He also teaches the common Paper 1 that every UGC NET candidate takes. Both are taught across all 10 units.",
    },
    {
      question: "Are his courses available on Testkart?",
      answer:
        "Yes. Dr. Goyal is publishing his UGC NET courses on Testkart. Each one appears on this page and on his Testkart profile as soon as it goes live, and you can buy and study it with your Testkart account on the web or in the Testkart app.",
    },
    {
      question: "Which language does he teach in?",
      answer: "He teaches in Hindi and English, switching between them the way most of his students study.",
    },
    {
      question: "Can I watch his teaching before I buy a course?",
      answer:
        "Yes. His YouTube channels SWMG UGC NET PAPER 1 and SWMG UGC NET EVS carry close to 1,900 free lessons between them, including Paper 1 units, Environmental Science concepts and PYQ discussions.",
    },
    {
      question: "Is Paper 1 compulsory with Environmental Science?",
      answer:
        "Yes. Paper 1 is common to every subject. You take it with Paper 2 in one 3-hour sitting: 50 questions for 100 marks in Paper 1 and 100 questions for 200 marks in Paper 2, with no negative marking.",
    },
    {
      question: "Can a course guarantee NET or JRF?",
      answer:
        "No. A course gives you structure, teaching and practice. Whether you qualify depends on your own preparation, revision and performance on the day.",
    },
  ] as SwmgFaqItem[],
  evsFaqs: [
    {
      question: "What is the subject code for UGC NET Environmental Science?",
      answer: "Environmental Sciences is subject code 89 in UGC NET. It is the Paper 2 you take alongside the common Paper 1.",
    },
    {
      question: "How many units are in the UGC NET Environmental Science syllabus?",
      answer:
        "Ten. They run from the fundamentals of environmental science through chemistry, biology, geosciences, energy, pollution, waste, assessment and legislation, statistics and modelling, to contemporary environmental issues.",
    },
    {
      question: "What is the exam pattern?",
      answer:
        "The exam is computer based. Paper 1 has 50 questions for 100 marks and Environmental Science Paper 2 has 100 questions for 200 marks. Both are attempted together in 3 hours, every question carries 2 marks and there is no negative marking.",
    },
    {
      question: "How often is UGC NET held?",
      answer: "NTA conducts UGC NET twice a year, in a June cycle and a December cycle. Check the NTA notification for each cycle's exact dates.",
    },
    {
      question: "Which unit do students find hardest?",
      answer:
        "Many find Unit 9, statistics and modelling, and the numericals in Unit 2 the hardest, because they need regular calculation practice rather than reading. Dr. Goyal breaks these into steps and practises them through PYQs.",
    },
    {
      question: "Can beginners prepare Environmental Science with Dr. Goyal?",
      answer:
        "Yes. His teaching starts from basic concepts and builds to exam level, so it suits first-time candidates as well as repeaters strengthening weak units.",
    },
    {
      question: "Is Environmental Science a good subject for JRF?",
      answer:
        "JRF goes to the top-scoring candidates within the NET cut-off and has an upper age limit set in each NTA notification. Candidates who cover all ten units and practise PYQs and mocks consistently give themselves the best chance.",
    },
  ] as SwmgFaqItem[],
  reviewFaqs: [
    {
      question: "Are these real student reviews?",
      answer:
        "Yes. Every video on this page was published on Dr. Goyal's own YouTube channels, and each card plays the original video. Testkart has not edited or scripted them.",
    },
    {
      question: "Where are the ratings for his Testkart courses?",
      answer:
        "Only students who enrol in a course on Testkart can rate it. Those ratings show on this page and on each course page as they come in.",
    },
    {
      question: "Will I get the same result as these students?",
      answer:
        "Not necessarily. These are individual experiences. Your result depends on your preparation, consistency, revision and performance in the exam.",
    },
    {
      question: "How should I judge a UGC NET teacher before paying?",
      answer:
        "Watch at least one complete free class, check that all ten units are covered, look at how PYQs and tests are used, and confirm what the course includes before you buy.",
    },
  ] as SwmgFaqItem[],
};
