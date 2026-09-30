// One entry per card in the homepage "Explore Top Exams" carousel; add an exam
// here (and its icon in components/HomepageTopExams.tsx) and it joins the
// carousel. Plain data, no frontend imports: homepageFetchTopExamCounts reads
// the same list on the server.
export const TOP_EXAMS = [
  { name: "NEET UG", slug: "neet-ug", accentColor: "#F9B99A" },
  { name: "UGC NET", slug: "ugc-net", accentColor: "#C8B6F2" },
  { name: "JEE Main", slug: "jee-main", accentColor: "#A9DCC8" },
  { name: "UPSC CSE", slug: "upsc-cse", accentColor: "#A9DCEB" },
  { name: "SSC CGL", slug: "ssc-cgl", accentColor: "#F4DFA3" },
  { name: "JEE Advanced", slug: "jee-advanced", accentColor: "#E8B7C8" },
  { name: "CTET", slug: "ctet", accentColor: "#BFD8C2" },
  { name: "SSC GD", slug: "ssc-gd", accentColor: "#B8CDE8" },
  { name: "SSC CHSL", slug: "ssc-chsl", accentColor: "#F2B5A0" },
  { name: "CUET", slug: "cuet", accentColor: "#D4C3E8" },
  { name: "NEET PG", slug: "neet-pg", accentColor: "#F3E2A3" },
  { name: "GATE", slug: "gate", accentColor: "#B8D8C0" },
] as const;

export type TopExamSlug = (typeof TOP_EXAMS)[number]["slug"];
