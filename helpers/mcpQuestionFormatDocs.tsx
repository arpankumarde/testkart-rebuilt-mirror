/**
 * How question rich text is written, for agents using the teacher connector (teacher_docs) and the
 * admin connector's content_edit (embedded in each question action's schema). Keep it in step with
 * helpers/delimitedLatexToMathNodes, which applies the conversion and checks described here.
 */

export const QUESTION_RICH_TEXT_FIELDS = [
  "questionText",
  "paragraphText",
  "explanation",
  "optionA",
  "optionB",
  "optionC",
  "optionD",
  "optionE",
  "leftItems",
  "rightItems",
] as const;

export const QUESTION_FORMAT_POINTER =
  "questionText, paragraphText, optionA-E, explanation and matchData.leftItems/rightItems are HTML, " +
  'with formulas as data-latex math nodes. Call teacher_docs with topic "question-format" before writing them.';

export const QUESTION_FORMAT_DOCS = {
  topic: "question-format",
  appliesTo: "questions/* and question-bank/* writes, including bulk uploads and accepted AI drafts.",
  richTextFields: [
    "questionText",
    "paragraphText (comprehension passage)",
    "optionA to optionE",
    "explanation",
    "matchData.leftItems[] and matchData.rightItems[] (each item)",
  ],
  html: [
    "Each field is an HTML fragment, as the question editor saves it. Wrap text in <p>; plain text without tags is shown as one paragraph.",
    "The editor keeps <p>, <br>, <strong>, <em>, <u>, <s>, <code>, <pre>, <blockquote>, <ul>/<ol>/<li>, <h2>/<h3>, <hr>, <a href>, <img src> and tables. Other tags, including <sub> and <sup>, are dropped when the teacher opens the question.",
    "Markdown is not rendered: **bold** shows with its asterisks.",
    "Escape text as HTML: & as &amp;, < as &lt;, > as &gt;.",
    "Images: upload with editor-images/upload or editor-images/upload-url and use the returned url in <img src>.",
  ],
  math: {
    inline: '<span data-type="inline-math" data-latex="\\frac{a}{b}"></span>',
    large: '<p><span data-type="inline-math" data-latex="\\displaystyle \\int_0^1 x^2\\,dx"></span></p>',
    rules: [
      "Both nodes are empty: the LaTeX lives only in data-latex. Formulas are rendered with KaTeX, so use KaTeX-supported commands and no custom macros.",
      "Every formula is an inline-math <span>. Question screens do not show block-math, so a large formula on its own line is an inline-math span alone in its <p>, starting with \\displaystyle.",
      'Inside data-latex escape & as &amp;, " as &quot;, < as &lt; and > as &gt;. In a JSON body every LaTeX backslash is doubled, as in the example.',
      "Use math for subscripts and superscripts (H_2O as \\text{H}_2\\text{O}), not <sub>/<sup>.",
    ],
  },
  conversion: [
    "$...$ and \\(...\\) are converted to inline-math nodes, and $$...$$ and \\[...\\] to inline-math nodes in \\displaystyle.",
    "A single $ is only a formula when it is closed on the same line, the opening $ is not followed by a space and the closing $ is not followed by a digit, so prices such as $5 stay text. Write a literal dollar as \\$.",
    "Delimiters inside <code>, <pre>, tag attributes and existing math nodes are left alone.",
    "A command sent with a single backslash in JSON arrives as a control character (\\frac as a form feed, \\times as a tab). Inside formulas these are repaired; outside them they are not, so double every backslash.",
  ],
  checks: {
    refused:
      "The write is refused, and nothing is saved, when a formula does not render in KaTeX, a $$, \\(, \\), \\[ or \\] delimiter is left unclosed, a block-math node is used, an inline-math node is not a <span> or has no data-latex, or a tag cannot be parsed.",
    warnings:
      "Successful writes return formatCheck: { formulas, converted, warnings }. Warnings flag a $ that may start an unclosed formula, LaTeX commands outside a formula, double-escaped commands, Markdown, and tags the editor drops. Fix and update the question when a warning applies.",
  },
  example: {
    action: "questions/create",
    note: "subjectId comes from test-item-subjects/list. Shown as the JSON body, so LaTeX backslashes are doubled.",
    body: {
      subjectId: 123,
      questionType: "single_correct_mcq",
      questionText:
        '<p>Evaluate <span data-type="inline-math" data-latex="\\int_0^1 (x^4 - 3x^3 + 2x)\\,dx"></span>.</p>',
      optionA: '<p><span data-type="inline-math" data-latex="\\frac{9}{20}"></span></p>',
      optionB: '<p><span data-type="inline-math" data-latex="\\frac{1}{4}"></span></p>',
      optionC: '<p><span data-type="inline-math" data-latex="\\frac{11}{20}"></span></p>',
      optionD: '<p><span data-type="inline-math" data-latex="\\frac{3}{4}"></span></p>',
      correctOption: "A",
      positiveMarks: 4,
      negativeMarks: 1,
      explanation:
        '<p>Integrate term by term:</p><p><span data-type="inline-math" data-latex="\\displaystyle \\left[\\frac{x^5}{5} - \\frac{3x^4}{4} + x^2\\right]_0^1 = \\frac{1}{5} - \\frac{3}{4} + 1 = \\frac{9}{20}"></span></p>',
    },
  },
};

export const TEACHER_DOCS = { "question-format": QUESTION_FORMAT_DOCS } as const;
export type TeacherDocsTopic = keyof typeof TEACHER_DOCS;
