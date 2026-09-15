import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { schema } from "./download-pdf_GET.schema";
import superjson from "superjson";
import PdfPrinter from "pdfmake";
import {
  detectScripts,
  fetchScriptFonts,
  parseHtmlToPdfContent,
  stripHtml,
  collectQuestionText,
} from "../../../helpers/pdfFontLoader";

export async function handle(request: Request) {
  try {
    const { user, effectiveTeacherId } = await getServerUserSession(request);

    if (user.role !== "teacher" && user.role !== "admin") {
      return new Response(superjson.stringify({ error: "Unauthorized" }), {
        status: 403,
      });
    }

    const url = new URL(request.url);
    const testItemIdStr = url.searchParams.get("testItemId");
    if (!testItemIdStr) {
      return new Response(
        superjson.stringify({ error: "Missing testItemId" }),
        { status: 400 }
      );
    }
    const subjectIdStr = url.searchParams.get("subjectId");

    const input = schema.parse({
      testItemId: parseInt(testItemIdStr, 10),
      subjectId: subjectIdStr ? parseInt(subjectIdStr, 10) : undefined,
    });

    const testItem = await db
      .selectFrom("mockTestItems")
      .innerJoin("mockTests", "mockTestItems.packageId", "mockTests.id")
      .select([
        "mockTestItems.id",
        "mockTestItems.title",
        "mockTestItems.subject",
        "mockTestItems.durationMinutes",
        "mockTestItems.totalQuestions",
        "mockTests.teacherId",
      ])
      .where("mockTestItems.id", "=", input.testItemId)
      .executeTakeFirst();

    if (!testItem) {
      return new Response(
        superjson.stringify({ error: "Test item not found" }),
        { status: 404 }
      );
    }

    if (user.role === "teacher" && testItem.teacherId !== effectiveTeacherId) {
      console.log(
        `Teacher ${user.id} attempted to access test item owned by teacher ${testItem.teacherId}`
      );
      return new Response(
        superjson.stringify({ error: "Unauthorized access to test item" }),
        { status: 403 }
      );
    }

    const allSubjects = await db
      .selectFrom("testItemSubjects")
      .where("testItemId", "=", input.testItemId)
      .orderBy("orderIndex", "asc")
      .selectAll()
      .execute();

    let targetSubject: (typeof allSubjects)[number] | null = null;
    if (input.subjectId != null) {
      targetSubject = allSubjects.find((s) => s.id === input.subjectId) ?? null;
      if (!targetSubject) {
        return new Response(
          superjson.stringify({ error: "Subject not found in this test item." }),
          { status: 404 }
        );
      }
    }

    const subjects = targetSubject ? [targetSubject] : allSubjects;

    let questions = await db
      .selectFrom("testQuestions")
      .where("testId", "=", input.testItemId)
      .orderBy("orderIndex", "asc")
      .orderBy("id", "asc")
      .selectAll()
      .execute();

    if (targetSubject) {
      questions = questions.filter((q) => q.subjectId === targetSubject!.id);
    }

    console.log(
      `Generating PDF for test item ${input.testItemId}${targetSubject ? ` (subject ${targetSubject.id})` : ""}: ${questions.length} questions, ${subjects.length} subjects`
    );

    const allText = questions.map(collectQuestionText).join(" ");
    const detectedScripts = detectScripts(allText);
    console.log(
      `Script detection result: ${detectedScripts.size > 0 ? [...detectedScripts].join(", ") : "none (Latin only)"}`
    );

    const { fonts, defaultFont } = await fetchScriptFonts(detectedScripts);

    const content: object[] = [];

    // ── Header banner ──────────────────────────────────────────────────────────
    content.push({
      table: {
        widths: ["*"],
        body: [
          [
            {
              text: targetSubject
                ? `${testItem.title || "Test Item"} — ${targetSubject.subjectName}`
                : testItem.title || "Test Item",
              fontSize: 20,
              bold: true,
              color: "#ffffff",
              fillColor: "#1e3a5f",
              margin: [16, 14, 16, 14],
              alignment: "center",
            },
          ],
        ],
      },
      layout: "noBorders",
      margin: [0, 0, 0, 0],
    });

    // ── Metadata info box ──────────────────────────────────────────────────────
    content.push({
      table: {
        widths: ["*"],
        body: [
          [
            {
              text: [
                { text: "Subject: ", bold: true },
                { text: `${targetSubject ? targetSubject.subjectName : testItem.subject || "N/A"}   ` },
                { text: "Duration: ", bold: true },
                {
                  text: `${
                    targetSubject
                      ? targetSubject.durationMinutes != null
                        ? `${targetSubject.durationMinutes} mins`
                        : "No Time Limit"
                      : testItem.durationMinutes === 0
                      ? "No Time Limit"
                      : `${testItem.durationMinutes} mins`
                  }   `,
                },
                { text: "Total Questions: ", bold: true },
                { text: `${questions.length}` },
              ],
              fontSize: 11,
              color: "#374151",
              fillColor: "#f0f4f8",
              margin: [16, 10, 16, 10],
              alignment: "center",
            },
          ],
        ],
      },
      layout: "noBorders",
      margin: [0, 0, 0, 20],
    });

    let globalQuestionNumber = 1;

    const renderQuestion = async (q: {
      id: number;
      questionType: string | null;
      questionText: string;
      paragraphText: string | null;
      optionA: string | null;
      optionB: string | null;
      optionC: string | null;
      optionD: string | null;
      correctOption: string | null;
      correctOptions: string[] | null;
      numericalAnswer: string | null;
      numericalTolerance: string | null;
      positiveMarks: string | null;
      negativeMarks: string | null;
      explanation: string | null;
      matchData: unknown;
    }): Promise<object[]> => {
      const elements: object[] = [];
      const qNum = globalQuestionNumber;
      globalQuestionNumber++;

      const questionContentRows: object[] = [];

      if (q.questionType === "comprehension" && q.paragraphText) {
        const paraContent = await parseHtmlToPdfContent(q.paragraphText, "questionBody");
        questionContentRows.push({
          stack: [
            { text: "Paragraph", bold: true, fontSize: 10, color: "#6b7280", margin: [0, 0, 0, 4] },
            ...paraContent,
          ],
          fillColor: "#fffbeb",
          margin: [0, 0, 0, 8],
        });
      }

      const questionContent = await parseHtmlToPdfContent(q.questionText, "questionBody");
      questionContentRows.push(...questionContent);

      const optionTypes = ["single_correct_mcq", "multiple_correct_mcq", "assertion_reason", "comprehension"];
      if (q.questionType && optionTypes.includes(q.questionType)) {
        const options: { label: string; text: string | null }[] = [
          { label: "A", text: q.optionA },
          { label: "B", text: q.optionB },
          { label: "C", text: q.optionC },
          { label: "D", text: q.optionD },
        ];

        for (const opt of options) {
          if (!opt.text) continue;
          const optContent = await parseHtmlToPdfContent(opt.text);
          const optText = optContent.length > 0 ? optContent : [{ text: "" }];

          questionContentRows.push({
            columns: [
              {
                table: {
                  widths: [16],
                  body: [
                    [
                      {
                        text: opt.label,
                        fontSize: 9,
                        bold: true,
                        color: "#ffffff",
                        fillColor: "#6b7280",
                        alignment: "center",
                        margin: [0, 2, 0, 2],
                      },
                    ],
                  ],
                },
                layout: "noBorders",
                width: 24,
              },
              {
                stack: optText,
                fontSize: 11,
                margin: [6, 0, 0, 0],
              },
            ],
            margin: [0, 3, 0, 0],
          });
        }
      }

      if (q.questionType === "numerical") {
        questionContentRows.push({
          text: "[ Numerical Answer Type ]",
          italics: true,
          fontSize: 10,
          color: "#6b7280",
          margin: [0, 6, 0, 0],
        });
      }

      if (q.questionType === "match_the_following" && q.matchData) {
        try {
          const matchDataStr = JSON.stringify(q.matchData, null, 2);
          questionContentRows.push({
            text: `Match Data:\n${matchDataStr}`,
            style: "questionBody",
            margin: [0, 6, 0, 0],
          });
        } catch (_e) {
          // ignore malformed match data
        }
      }

      let answerText = "";
      if (q.correctOption) {
        answerText = `Answer: ${q.correctOption}`;
      } else if (q.correctOptions && q.correctOptions.length > 0) {
        answerText = `Answers: ${q.correctOptions.join(", ")}`;
      } else if (q.numericalAnswer !== null && q.numericalAnswer !== undefined) {
        answerText = `Answer: ${q.numericalAnswer} (Tolerance: ${q.numericalTolerance ?? 0})`;
      }

      if (answerText) {
        questionContentRows.push({
          table: {
            widths: ["*"],
            body: [
              [
                {
                  text: [
                    { text: "✓ ", color: "#16a34a", bold: true },
                    { text: answerText },
                  ],
                  fontSize: 11,
                  bold: true,
                  color: "#15803d",
                  fillColor: "#dcfce7",
                  margin: [10, 6, 10, 6],
                },
              ],
            ],
          },
          layout: "noBorders",
          margin: [0, 8, 0, 0],
        });
      }

      if (q.explanation) {
        const explanationContent = await parseHtmlToPdfContent(q.explanation);
        const explanationItems: object[] =
          explanationContent.length > 0
            ? explanationContent
            : [{ text: stripHtml(q.explanation) }];

        questionContentRows.push({
          table: {
            widths: ["*"],
            body: [
              [
                {
                  stack: [
                    {
                      text: "Explanation",
                      bold: true,
                      fontSize: 10,
                      color: "#92400e",
                      margin: [0, 0, 0, 4],
                    },
                    ...explanationItems,
                  ],
                  fontSize: 11,
                  color: "#78350f",
                  fillColor: "#fef9c3",
                  margin: [10, 8, 10, 8],
                },
              ],
            ],
          },
          layout: "noBorders",
          margin: [0, 6, 0, 0],
        });
      }

      elements.push({
        table: {
          widths: [36, "*"],
          body: [
            [
              {
                table: {
                  widths: [28],
                  body: [
                    [
                      {
                        text: `${qNum}`,
                        fontSize: 12,
                        bold: true,
                        color: "#ffffff",
                        fillColor: "#2563eb",
                        alignment: "center",
                        margin: [0, 4, 0, 4],
                      },
                    ],
                  ],
                },
                layout: "noBorders",
                margin: [0, 2, 0, 0],
              },
              {
                stack: [
                  {
                    columns: [
                      { text: "", width: "*" },
                      {
                        text: `+${q.positiveMarks ?? 0} / -${q.negativeMarks ?? 0}`,
                        fontSize: 9,
                        italics: true,
                        color: "#6b7280",
                        alignment: "right",
                        width: "auto",
                      },
                    ],
                    margin: [0, 0, 0, 4],
                  },
                  ...questionContentRows,
                ],
                margin: [8, 0, 0, 0],
              },
            ],
          ],
        },
        layout: {
          fillColor: "#f8fafc",
          hLineWidth: () => 0,
          vLineWidth: () => 0,
          paddingLeft: () => 10,
          paddingRight: () => 10,
          paddingTop: () => 10,
          paddingBottom: () => 10,
        },
        margin: [0, 0, 0, 12],
      });

      elements.push({
        canvas: [
          {
            type: "line",
            x1: 0,
            y1: 0,
            x2: 515,
            y2: 0,
            lineWidth: 0.5,
            lineColor: "#e2e8f0",
          },
        ],
        margin: [0, 0, 0, 12],
      });

      return elements;
    };

    const renderSubjectHeader = (title: string): object => ({
      stack: [
        {
          text: title,
          fontSize: 15,
          bold: true,
          color: "#1e3a5f",
          margin: [0, 0, 0, 4],
        },
        {
          canvas: [
            {
              type: "line",
              x1: 0,
              y1: 0,
              x2: 515,
              y2: 0,
              lineWidth: 2,
              lineColor: "#2563eb",
            },
          ],
        },
      ],
      margin: [0, 16, 0, 14],
    });

    if (subjects.length > 0) {
      for (const subject of subjects) {
        const subjectQuestions = questions.filter((q) => q.subjectId === subject.id);
        if (subjectQuestions.length > 0) {
          content.push(renderSubjectHeader(subject.subjectName));
          for (const q of subjectQuestions) {
            const rendered = await renderQuestion(q);
            content.push(...rendered);
          }
        }
      }
      const unassigned = questions.filter((q) => q.subjectId === null);
      if (unassigned.length > 0) {
        content.push(renderSubjectHeader("Other Questions"));
        for (const q of unassigned) {
          const rendered = await renderQuestion(q);
          content.push(...rendered);
        }
      }
    } else {
      for (const q of questions) {
        const rendered = await renderQuestion(q);
        content.push(...rendered);
      }
    }

    const docDefinition = {
      content,
      footer: (currentPage: number, pageCount: number) => ({
        text: `Page ${currentPage} of ${pageCount}`,
        alignment: "center",
        fontSize: 9,
        color: "#9ca3af",
        margin: [0, 10, 0, 0],
      }),
      pageMargins: [40, 40, 40, 50],
      styles: {
        questionBody: { fontSize: 11, color: "#1f2937", lineHeight: 1.4 },
        option: { fontSize: 11, color: "#374151", margin: [0, 2, 0, 2] },
      },
      defaultStyle: {
        font: defaultFont,
        fontSize: 11,
        color: "#1f2937",
      },
    };

    const printer = new PdfPrinter(fonts as any);
    const pdfDoc = printer.createPdfKitDocument(docDefinition as any);

    const chunks: Uint8Array[] = [];
    pdfDoc.on("data", (chunk: Uint8Array) => chunks.push(chunk));

    const pdfBytes = await new Promise<Uint8Array>((resolve, reject) => {
      pdfDoc.on("end", () => {
        let length = 0;
        for (const chunk of chunks) length += chunk.length;
        const result = new Uint8Array(length);
        let offset = 0;
        for (const chunk of chunks) {
          result.set(chunk, offset);
          offset += chunk.length;
        }
        resolve(result);
      });
      pdfDoc.on("error", reject);
      pdfDoc.end();
    });

    const safeTitleBase = targetSubject
      ? `${testItem.title || "test-item"}-${targetSubject.subjectName}`
      : testItem.title || "test-item";
    const safeTitle = safeTitleBase.replace(/[^a-zA-Z0-9]/g, "_");

    console.log(
      `PDF generated successfully for test item ${input.testItemId}${targetSubject ? ` (subject ${targetSubject.id})` : ""}, size: ${pdfBytes.length} bytes, font: ${defaultFont}`
    );

    return new Response(pdfBytes, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${safeTitle}.pdf"`,
      },
    });
  } catch (error) {
    console.error("Error generating PDF:", error);
    if (error instanceof Error) {
      return new Response(superjson.stringify({ error: error.message }), {
        status: 400,
      });
    }
    return new Response(
      superjson.stringify({ error: "An unknown error occurred" }),
      { status: 500 }
    );
  }
}