import { scoreQuestion, getMatchAnswerRows, parseStoredMatchData } from "./testScoringLogic";
import { QuestionData } from "./questionTypes";
import { schema as createSchema, richTextHasContent } from "../endpoints/teacher/questions/create_POST.schema";
import { schema as updateSchema } from "../endpoints/teacher/questions/update_POST.schema";
import { schema as bulkUploadSchema } from "../endpoints/teacher/questions/bulk-upload_POST.schema";
import { GeneratedQuestionDraftSchema } from "../endpoints/teacher/questions/generate-ai_POST.schema";

const baseQuestion = (overrides: Partial<QuestionData>): QuestionData => ({
  id: 1,
  questionType: "single_correct_mcq",
  correctOption: null,
  correctOptions: null,
  numericalAnswer: null,
  numericalTolerance: null,
  positiveMarks: "4.00",
  negativeMarks: "1.00",
  partialMarking: false,
  matchData: null,
  explanation: null,
  ...overrides,
});

// Shape of question 24306 in production: item texts carry trailing spaces and
// the teacher form stores the key by index.
const asYouLikeIt = {
  leftItems: ["Rosalind ", "Celia", "Phebe", "Audrey"],
  rightItems: ["Silvius", "Touchstone ", "Orlando ", "Oliver"],
  correctMatches: { "0": "2", "1": "3", "2": "0", "3": "1" },
};

const matchQuestion = (overrides: Partial<QuestionData> = {}) =>
  baseQuestion({ questionType: "match_the_following", positiveMarks: "2.00", negativeMarks: "0.50", matchData: asYouLikeIt, ...overrides });

const match = (matchAnswers: Record<string, string>) => ({ answerType: "match" as const, matchAnswers });

describe("scoreQuestion - match the following", () => {
  it("scores a fully correct text-keyed answer (what the student player submits) as correct", () => {
    const result = scoreQuestion(matchQuestion(), match({ Celia: "Oliver", Phebe: "Silvius", Audrey: "Touchstone ", "Rosalind ": "Orlando " }));
    expect(result.isCorrect).toBe(true);
    expect(result.marksObtained).toBe(2);
  });

  it("scores a fully correct index-keyed answer as correct", () => {
    const result = scoreQuestion(matchQuestion(), match({ "0": "2", "1": "3", "2": "0", "3": "1" }));
    expect(result.isCorrect).toBe(true);
    expect(result.marksObtained).toBe(2);
  });

  it("scores match data stored as a JSON string, or a doubly encoded one, the same as an object", () => {
    const answer = match({ Celia: "Oliver", Phebe: "Silvius", Audrey: "Touchstone ", "Rosalind ": "Orlando " });
    const asString = scoreQuestion(matchQuestion({ matchData: JSON.stringify(asYouLikeIt) as any }), answer);
    const asDoubleString = scoreQuestion(
      matchQuestion({ matchData: JSON.stringify(JSON.stringify(asYouLikeIt)) as any }),
      answer
    );
    expect(asString).toEqual({ isCorrect: true, marksObtained: 2 });
    expect(asDoubleString).toEqual({ isCorrect: true, marksObtained: 2 });
  });

  it("ignores leading, trailing and repeated whitespace in item texts", () => {
    const result = scoreQuestion(matchQuestion(), match({ Rosalind: "Orlando", " Celia ": "Oliver", Phebe: "  Silvius", Audrey: "Touchstone" }));
    expect(result.isCorrect).toBe(true);
    expect(result.marksObtained).toBe(2);
  });

  it("applies the negative marks for a partly wrong answer when partial marking is off", () => {
    const result = scoreQuestion(matchQuestion(), match({ "Rosalind ": "Orlando ", Celia: "Oliver", Phebe: "Touchstone ", Audrey: "Silvius" }));
    expect(result.isCorrect).toBe(false);
    expect(result.marksObtained).toBe(-0.5);
  });

  it("awards proportional marks when partial marking is on", () => {
    const result = scoreQuestion(
      matchQuestion({ partialMarking: true }),
      match({ "Rosalind ": "Orlando ", Celia: "Oliver", Phebe: "Touchstone ", Audrey: "Silvius" })
    );
    expect(result.isCorrect).toBe(false);
    expect(result.marksObtained).toBe(1);
  });

  it("awards proportional marks for mixed text and index keys", () => {
    const result = scoreQuestion(matchQuestion({ partialMarking: true }), match({ "0": "2", Celia: "Oliver", "2": "1" }));
    expect(result.isCorrect).toBe(false);
    expect(result.marksObtained).toBe(1);
  });

  it("treats identical right-column texts as interchangeable", () => {
    const question = matchQuestion({
      matchData: { leftItems: ["Haemoglobin", "Myoglobin", "Chlorophyll"], rightItems: ["Iron", "Iron", "Magnesium"], correctMatches: { "0": "0", "1": "1", "2": "2" } },
    });
    const result = scoreQuestion(question, match({ Haemoglobin: "Iron", Myoglobin: "Iron", Chlorophyll: "Magnesium" }));
    expect(result.isCorrect).toBe(true);
    expect(result.marksObtained).toBe(2);
  });

  it("applies one text-keyed answer to every left item that shares that text", () => {
    const question = matchQuestion({
      matchData: { leftItems: ["Same", "Same", "Other"], rightItems: ["r0", "r1", "r2"], correctMatches: { "0": "0", "1": "0", "2": "2" } },
    });
    const result = scoreQuestion(question, match({ Same: "r0", Other: "r2" }));
    expect(result.isCorrect).toBe(true);
    expect(result.marksObtained).toBe(2);
  });

  it("does not credit answers whose texts are not in the question", () => {
    const result = scoreQuestion(matchQuestion({ partialMarking: true }), match({ Hamlet: "Ophelia", Celia: "Oliver" }));
    expect(result.isCorrect).toBe(false);
    expect(result.marksObtained).toBe(0.5);
  });

  it("does not penalise an empty answer", () => {
    const result = scoreQuestion(matchQuestion(), match({}));
    expect(result.isCorrect).toBe(false);
    expect(result.marksObtained).toBe(0);
  });

  it("never credits a question with no answer key", () => {
    const result = scoreQuestion(matchQuestion({ matchData: { ...asYouLikeIt, correctMatches: {} } }), match({ "0": "2" }));
    expect(result.isCorrect).toBe(false);
    expect(result.marksObtained).toBe(0);
  });
});

describe("scoreQuestion - negative marks stored as negative numbers", () => {
  it("deducts for a wrong single-correct answer instead of adding", () => {
    const result = scoreQuestion(baseQuestion({ correctOption: "B", negativeMarks: "-0.66" }), { answerType: "single", selectedOption: "A" });
    expect(result.isCorrect).toBe(false);
    expect(result.marksObtained).toBe(-0.66);
  });

  it("still awards the positive marks for a correct answer", () => {
    const result = scoreQuestion(baseQuestion({ correctOption: "B", negativeMarks: "-0.66" }), { answerType: "single", selectedOption: "B" });
    expect(result.marksObtained).toBe(4);
  });

  it("deducts for a wrong multiple-correct answer without partial marking", () => {
    const question = baseQuestion({ questionType: "multiple_correct_mcq", correctOptions: ["A", "C"], negativeMarks: "-2" });
    const result = scoreQuestion(question, { answerType: "multiple", selectedOptions: ["A", "B"] });
    expect(result.marksObtained).toBe(-2);
  });

  it("subtracts wrong selections under partial marking", () => {
    const question = baseQuestion({
      questionType: "multiple_correct_mcq",
      correctOptions: ["A", "C"],
      partialMarking: true,
      negativeMarks: "-4",
      optionA: "a", optionB: "b", optionC: "c", optionD: "d",
    } as Partial<QuestionData>);
    const result = scoreQuestion(question, { answerType: "multiple", selectedOptions: ["A", "B"] });
    expect(result.marksObtained).toBe(1);
  });

  it("deducts for a wrong numerical answer", () => {
    const question = baseQuestion({ questionType: "numerical", numericalAnswer: "9.8", numericalTolerance: "0.1", negativeMarks: "-1" });
    expect(scoreQuestion(question, { answerType: "numerical", numericalAnswer: 7 }).marksObtained).toBe(-1);
    expect(scoreQuestion(question, { answerType: "numerical", numericalAnswer: 9.85 }).marksObtained).toBe(4);
  });

  it("deducts for a wrong match answer", () => {
    const result = scoreQuestion(matchQuestion({ negativeMarks: "-1.00" }), match({ "Rosalind ": "Silvius" }));
    expect(result.marksObtained).toBe(-1);
  });

  it("scores the same with a positive stored value", () => {
    const wrongNeg = scoreQuestion(baseQuestion({ correctOption: "B", negativeMarks: "-1" }), { answerType: "single", selectedOption: "C" });
    const wrongPos = scoreQuestion(baseQuestion({ correctOption: "B", negativeMarks: "1" }), { answerType: "single", selectedOption: "C" });
    expect(wrongNeg.marksObtained).toBe(wrongPos.marksObtained);
  });
});

describe("getMatchAnswerRows", () => {
  it("resolves text-keyed answers to item texts for the results view", () => {
    const rows = getMatchAnswerRows(asYouLikeIt, { Celia: "Oliver", Phebe: "Touchstone " });
    expect(rows.length).toBe(4);
    expect(rows[1]).toEqual(jasmine.objectContaining({ leftText: "Celia", correctText: "Oliver", studentText: "Oliver", isCorrect: true }));
    expect(rows[2]).toEqual(jasmine.objectContaining({ leftText: "Phebe", correctText: "Silvius", studentText: "Touchstone ", isCorrect: false }));
    expect(rows[0]).toEqual(jasmine.objectContaining({ leftText: "Rosalind ", studentText: null, isCorrect: false }));
  });

  it("resolves index-keyed answers the same way", () => {
    const rows = getMatchAnswerRows(asYouLikeIt, { "1": "3" });
    expect(rows[1]).toEqual(jasmine.objectContaining({ studentText: "Oliver", isCorrect: true }));
  });
});

describe("teacher question write schemas", () => {
  const singleMcq = {
    subjectId: 1,
    questionType: "single_correct_mcq" as const,
    questionText: "<p>Which planet is closest to the sun?</p>",
    optionA: "<p>Mercury</p>",
    optionB: "<p>Venus</p>",
    optionC: "<p>Earth</p>",
    optionD: "<p>Mars</p>",
    correctOption: "A" as const,
    positiveMarks: 4,
    negativeMarks: 1,
  };

  const messages = (result: { success: boolean; error?: { issues: { message: string }[] } }) =>
    result.success ? [] : result.error!.issues.map((issue) => issue.message);

  it("rejects negative marks from the form with a readable message", () => {
    const result = createSchema.safeParse({ ...singleMcq, negativeMarks: -0.66 });
    expect(result.success).toBe(false);
    expect(messages(result as any).join(" ")).toContain("without a minus sign");
    expect(updateSchema.safeParse({ ...singleMcq, questionId: 7, negativeMarks: -1 }).success).toBe(false);
  });

  it("normalises spreadsheet and AI negative marks to the magnitude", () => {
    const bulk = bulkUploadSchema.parse({ subjectId: 1, questions: [{ ...singleMcq, subjectId: undefined, negativeMarks: -0.66 }] });
    expect(bulk.questions[0].negativeMarks).toBe(0.66);
    const draft = GeneratedQuestionDraftSchema.parse({
      questionText: "q", questionType: "single_correct_mcq", optionA: "a", optionB: "b", optionC: "c", optionD: "d",
      correctOption: "A", correctOptions: null, numericalAnswer: null, numericalTolerance: null, explanation: null,
      positiveMarks: 4, negativeMarks: -1,
    });
    expect(draft.negativeMarks).toBe(1);
  });

  it("treats an editor-cleared option as empty but keeps image and formula options", () => {
    expect(richTextHasContent("<p></p>")).toBe(false);
    expect(richTextHasContent("<p> &nbsp; </p><p><br></p>")).toBe(false);
    expect(richTextHasContent('<p><img src="/_cdn/x.png"></p>')).toBe(true);
    expect(richTextHasContent('<p><span data-type="inline-math" data-latex="x^2"></span></p>')).toBe(true);
    expect(messages(createSchema.safeParse({ ...singleMcq, optionC: "<p></p>" }) as any)).toEqual(["Option C cannot be empty."]);
  });

  it("names the field when an edit still carries a null left over from another type", () => {
    const result = updateSchema.safeParse({ ...singleMcq, questionId: 7, optionB: null, correctOption: null });
    expect(result.success).toBe(false);
    const issues = (result as any).error.issues.map((issue: any) => `${issue.path.join(".")}: ${issue.message}`);
    expect(issues).toEqual(["optionB: Option B cannot be empty.", "correctOption: Mark the correct answer."]);
  });

  it("requires a match for every column A item", () => {
    const match = {
      subjectId: 1,
      questionType: "match_the_following" as const,
      questionText: "<p>Match the planets</p>",
      positiveMarks: 2,
      negativeMarks: 0,
      matchData: { leftItems: ["Mercury", "Venus"], rightItems: ["Closest", "Hottest"], correctMatches: { "0": "0" } },
    };
    expect(messages(createSchema.safeParse(match) as any)).toEqual(["Choose the match for item 2."]);
    expect(createSchema.safeParse({ ...match, matchData: { ...match.matchData, correctMatches: { "0": "0", "1": "1" } } }).success).toBe(true);
  });
});
