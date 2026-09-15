import React, { useState, useCallback, useMemo } from 'react';
import { Upload, Download, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from './Dialog';
import { Button } from './Button';
import { FileDropzone } from './FileDropzone';
import { Badge } from './Badge';
import { postTeacherQuestionsBulkUpload } from '../endpoints/teacher/questions/bulk-upload_POST.schema';
import styles from './BulkQuestionUpload.module.css';

interface BulkQuestionUploadProps {
  className?: string;
  subjectId: number;
  onSuccess: (count: number) => void;
}

// Types for parsing logic
export interface ParsedQuestion {
  originalRow: number;
  questionText: string;
  questionType: 'single_correct_mcq' | 'multiple_correct_mcq' | 'numerical' | 'comprehension' | 'assertion_reason';
  positiveMarks: number;
  negativeMarks: number;
  explanation?: string;
  // MCQ fields
  optionA?: string;
  optionB?: string;
  optionC?: string;
  optionD?: string;
  optionE?: string;
  correctOption?: string;
  correctOptions?: string[];
  // Numerical fields
  numericalAnswer?: number;
  numericalTolerance?: number;
  // Comprehension fields
  paragraphText?: string;
}

export interface ValidationError {
  row: number;
  errors: string[];
}

const CSV_TEMPLATE_HEADER = [
  "Question_Type",
  "Paragraph_Text",
  "Question_Text",
  "Option_A",
  "Option_B",
  "Option_C",
  "Option_D",
  "Option_E",
  "Correct_Option",
  "Correct_Options",
  "Numerical_Answer",
  "Numerical_Tolerance",
  "Positive_Marks",
  "Negative_Marks",
  "Explanation"
];

const CSV_TEMPLATE_BODY = [
  // Single Correct MCQ Example
  [
    "single_correct_mcq",
    "",
    "What is the capital of France?",
    "London",
    "Berlin",
    "Paris",
    "Madrid",
    "",
    "C",
    "",
    "",
    "",
    "4",
    "1",
    "Paris is the capital of France."
  ],
  // Multiple Correct MCQ Example
  [
    "multiple_correct_mcq",
    "",
    "Which of the following are prime numbers?",
    "2",
    "4",
    "5",
    "9",
    "",
    "",
    "A,C",
    "",
    "",
    "4",
    "1",
    "2 and 5 are prime numbers."
  ],
  // Numerical Example
  [
    "numerical",
    "",
    "What is the value of pi to 2 decimal places?",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "3.14",
    "0.01",
    "4",
    "0",
    "Pi is approximately 3.14159..."
  ],
  // Comprehension Example
  [
    "comprehension",
    "The quick brown fox jumps over the lazy dog. This sentence is used because it contains every letter of the English alphabet.",
    "What animal jumps in the passage?",
    "Cat",
    "Fox",
    "Dog",
    "Rabbit",
    "",
    "B",
    "",
    "",
    "",
    "4",
    "1",
    "The fox jumps over the dog."
  ],
  // Assertion-Reason Example
  [
    "assertion_reason",
    "",
    "Assertion (A): Water boils at 100°C at sea level.\nReason (R): The boiling point of water depends on atmospheric pressure.",
    "Both A and R are true and R is correct explanation of A",
    "Both A and R are true but R is NOT correct explanation of A",
    "A is true but R is false",
    "A is false but R is true",
    "",
    "A",
    "",
    "",
    "",
    "4",
    "1",
    ""
  ]
];

const CSV_TEMPLATE = [
  CSV_TEMPLATE_HEADER.join(","),
  ...CSV_TEMPLATE_BODY.map(row => row.map(cell => `"${cell}"`).join(","))
].join("\n");

// Helper function to parse a single row
const parseRowToQuestion = (row: any, index: number): { success: boolean; data?: ParsedQuestion; errors?: string[] } => {
  const errors: string[] = [];
  const rowNum = index + 2; // +1 for 0-index, +1 for header

  // Normalize keys to handle case insensitivity and trim spaces
  const normalizedRow: Record<string, string> = {};
  Object.keys(row).forEach(key => {
    const cleanKey = key.trim().toLowerCase().replace(/_/g, '');
    normalizedRow[cleanKey] = String(row[key]).trim();
  });

  // Helper to get value
  const getVal = (key: string) => normalizedRow[key.toLowerCase().replace(/_/g, '')];

  const questionTypeRaw = getVal('Question_Type') || 'single_correct_mcq';
  const paragraphText = getVal('Paragraph_Text');
  const questionText = getVal('Question_Text');
  const positiveMarks = parseFloat(getVal('Positive_Marks') || '4');
  const negativeMarks = parseFloat(getVal('Negative_Marks') || '0');
  const explanation = getVal('Explanation');

  if (!questionText) errors.push("Question Text is required");
  if (isNaN(positiveMarks)) errors.push("Positive Marks must be a number");
  if (isNaN(negativeMarks)) errors.push("Negative Marks must be a number");

  let questionType: ParsedQuestion['questionType'] = 'single_correct_mcq';
  if (questionTypeRaw.toLowerCase().includes('multiple')) questionType = 'multiple_correct_mcq';
  else if (questionTypeRaw.toLowerCase().includes('numerical')) questionType = 'numerical';
  else if (questionTypeRaw.toLowerCase().includes('comprehension')) questionType = 'comprehension';
  else if (questionTypeRaw.toLowerCase().includes('assertion')) questionType = 'assertion_reason';
  else if (questionTypeRaw.toLowerCase().includes('single')) questionType = 'single_correct_mcq';
  else {
    errors.push(`Invalid Question Type: ${questionTypeRaw}`);
    return { success: false, errors }; // Return early if type is invalid to avoid confusing follow-up errors
  }

  const baseQuestion: Partial<ParsedQuestion> = {
    originalRow: rowNum,
    questionText,
    questionType,
    positiveMarks,
    negativeMarks,
    explanation: explanation || undefined,
  };

  if (questionType === 'single_correct_mcq' || questionType === 'assertion_reason' || questionType === 'comprehension') {
    const optionA = getVal('Option_A');
    const optionB = getVal('Option_B');
    const optionC = getVal('Option_C');
    const optionD = getVal('Option_D');
    const optionE = getVal('Option_E');
    const correctOption = getVal('Correct_Option')?.toUpperCase();

    if (!optionA) errors.push("Option A is required");
    if (!optionB) errors.push("Option B is required");
    if (!optionC) errors.push("Option C is required");
    if (!optionD) errors.push("Option D is required");
    if (!correctOption || !['A', 'B', 'C', 'D', 'E'].includes(correctOption)) {
      errors.push("Correct Option must be A, B, C, D, or E");
    }

    if (questionType === 'comprehension') {
      if (!paragraphText || paragraphText.length < 10) {
        errors.push("Paragraph Text is required and must be at least 10 characters for comprehension");
      }
    }

    if (errors.length === 0) {
      return {
        success: true,
        data: {
          ...baseQuestion,
          optionA,
          optionB,
          optionC,
          optionD,
          optionE: optionE || undefined,
          correctOption,
          paragraphText: questionType === 'comprehension' ? paragraphText : undefined,
        } as ParsedQuestion
      };
    }
  } else if (questionType === 'multiple_correct_mcq') {
    const optionA = getVal('Option_A');
    const optionB = getVal('Option_B');
    const optionC = getVal('Option_C');
    const optionD = getVal('Option_D');
    const optionE = getVal('Option_E');
    const correctOptionsRaw = getVal('Correct_Options');

    if (!optionA) errors.push("Option A is required");
    if (!optionB) errors.push("Option B is required");
    if (!optionC) errors.push("Option C is required");
    if (!optionD) errors.push("Option D is required");

    let correctOptions: string[] = [];
    if (correctOptionsRaw) {
      correctOptions = correctOptionsRaw.split(',').map((o: string) => o.trim().toUpperCase());
      const invalidOptions = correctOptions.filter(o => !['A', 'B', 'C', 'D', 'E'].includes(o));
      if (invalidOptions.length > 0) {
        errors.push(`Invalid Correct Options: ${invalidOptions.join(', ')}. Must be A, B, C, D, or E.`);
      }
      if (correctOptions.length === 0) {
        errors.push("At least one correct option is required");
      }
    } else {
      errors.push("Correct Options are required (comma separated, e.g., A,C)");
    }

    if (errors.length === 0) {
      return {
        success: true,
        data: {
          ...baseQuestion,
          optionA,
          optionB,
          optionC,
          optionD,
          optionE: optionE || undefined,
          correctOptions,
        } as ParsedQuestion
      };
    }
  } else if (questionType === 'numerical') {
    const numericalAnswerStr = getVal('Numerical_Answer');
    const numericalToleranceStr = getVal('Numerical_Tolerance');

    if (!numericalAnswerStr) errors.push("Numerical Answer is required");
    const numericalAnswer = parseFloat(numericalAnswerStr);
    const numericalTolerance = numericalToleranceStr ? parseFloat(numericalToleranceStr) : 0;

    if (isNaN(numericalAnswer)) errors.push("Numerical Answer must be a valid number");
    if (isNaN(numericalTolerance)) errors.push("Numerical Tolerance must be a valid number");

    if (errors.length === 0) {
      return {
        success: true,
        data: {
          ...baseQuestion,
          numericalAnswer,
          numericalTolerance,
        } as ParsedQuestion
      };
    }
  }

  return { success: false, errors };
};

export const BulkQuestionUpload: React.FC<BulkQuestionUploadProps> = ({
  className,
  subjectId,
  onSuccess,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<'upload' | 'preview'>('upload');
  const [parsedQuestions, setParsedQuestions] = useState<ParsedQuestion[]>([]);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);

  const resetState = useCallback(() => {
    setStep('upload');
    setParsedQuestions([]);
    setValidationErrors([]);
    setIsProcessing(false);
    setIsUploading(false);
    setFileName(null);
  }, []);

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      // Delay reset to allow for closing animation
      setTimeout(resetState, 300);
    }
  };

  const handleDownloadTemplate = () => {
    const blob = new Blob([CSV_TEMPLATE], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.href) {
      URL.revokeObjectURL(link.href);
    }
    link.href = URL.createObjectURL(blob);
    link.download = 'question-upload-template.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadExcelTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([CSV_TEMPLATE_HEADER, ...CSV_TEMPLATE_BODY]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    const wbout = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
    const blob = new Blob([wbout], { type: 'application/octet-stream' });
    
    const link = document.createElement('a');
    if (link.href) {
      URL.revokeObjectURL(link.href);
    }
    link.href = URL.createObjectURL(blob);
    link.download = 'question-upload-template.xlsx';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const processFile = useCallback((file: File) => {
    setIsProcessing(true);
    setFileName(file.name);
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const arrayBuffer = e.target?.result;
        if (!arrayBuffer) throw new Error("Failed to read file.");

                const data = new Uint8Array(arrayBuffer as ArrayBuffer);
        console.log(`[BulkUpload] File: ${file.name}, Size: ${data.length} bytes, Type: ${file.type}`);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(worksheet, { defval: "", raw: false });
        console.log(`[BulkUpload] Sheets: ${workbook.SheetNames.join(', ')}, Rows parsed: ${json.length}`);
        if (json.length > 0) {
          console.log(`[BulkUpload] Headers detected: ${Object.keys(json[0] as any).join(', ')}`);
        }

        const questions: ParsedQuestion[] = [];
        const errors: ValidationError[] = [];

        json.forEach((row: any, index) => {
          // Skip empty rows
          if (Object.values(row).every(val => val === "" || val === null || val === undefined)) {
            return;
          }

          const { success, data, errors: rowErrors } = parseRowToQuestion(row, index);

          if (success && data) {
            questions.push(data);
          } else if (rowErrors) {
            errors.push({
              row: index + 2,
              errors: rowErrors,
            });
          }
        });

        setParsedQuestions(questions);
        setValidationErrors(errors);
        setStep('preview');
      } catch (error) {
        console.error("Error parsing file:", error);
        toast.error("Failed to parse file. Please ensure it's a valid CSV or Excel file and matches the template format.");
        resetState();
      } finally {
        setIsProcessing(false);
      }
    };

    reader.onerror = () => {
      toast.error("Error reading file.");
      setIsProcessing(false);
    };

    reader.readAsArrayBuffer(file);
  }, [resetState]);

  const handleImport = async () => {
    if (validationErrors.length > 0 || parsedQuestions.length === 0) return;

    setIsUploading(true);
    try {
      // Remove originalRow before sending to API
      const questionsToSend = parsedQuestions.map(({ originalRow, ...question }) => question);
      const result = await postTeacherQuestionsBulkUpload({
        subjectId,
        questions: questionsToSend as any,
      });
      toast.success(`${result.count} questions imported successfully!`);
      onSuccess(result.count);
      handleOpenChange(false);
    } catch (error) {
      console.error("Error importing questions:", error);
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
      toast.error(`Import failed: ${errorMessage}`);
    } finally {
      setIsUploading(false);
    }
  };

  const { validCount, errorCount } = useMemo(() => ({
    validCount: parsedQuestions.length,
    errorCount: validationErrors.length,
  }), [parsedQuestions, validationErrors]);

  const renderCorrectAnswer = (q: ParsedQuestion) => {
    if ('correctOption' in q && q.correctOption) {
      return q.correctOption;
    }
    if ('correctOptions' in q && q.correctOptions) {
      return (q.correctOptions as string[]).join(', ');
    }
    if ('numericalAnswer' in q) {
      return `${q.numericalAnswer} (±${q.numericalTolerance})`;
    }
    return 'N/A';
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" className={className}>
          <Upload size={16} />
          Bulk Upload
        </Button>
      </DialogTrigger>
      <DialogContent className={styles.dialogContent}>
        <DialogHeader>
          <DialogTitle>Bulk Upload Questions</DialogTitle>
          <DialogDescription>
            {step === 'upload'
              ? 'Upload questions with rich content including mathematical formulas. Supports .xlsx, .xls, and .csv files.'
              : `Reviewing file: ${fileName}`}
          </DialogDescription>
        </DialogHeader>

        {step === 'upload' && (
          <div className={styles.uploadStep}>
            <FileDropzone
              accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
              onFilesSelected={(files) => files[0] && processFile(files[0])}
              disabled={isProcessing}
              title={isProcessing ? "Processing file..." : "Click to upload or drag and drop"}
              subtitle="Supports .xlsx, .xls, .csv"
            />
            <div className={styles.helperText}>
              <p>
                <strong>Supported Types:</strong> Single Correct MCQ, Multiple Correct MCQ, Numerical, Comprehension, Assertion-Reason.<br/>
                You can include mathematical formulas using HTML format: <code>&lt;span data-type="mathematics"&gt;</code>.<br/>
                For Comprehension, include the passage in <strong>Paragraph_Text</strong>. For Assertion-Reason, include both parts in Question_Text.<br/>
                <em>Note: "Match the Following" questions must be created manually.</em>
              </p>
            </div>
            <div className={styles.templateButtons}>
              <Button variant="link" onClick={handleDownloadTemplate}>
                <Download size={16} />
                Download CSV Template
              </Button>
              <Button variant="link" onClick={handleDownloadExcelTemplate}>
                <Download size={16} />
                Download Excel Template
              </Button>
            </div>
          </div>
        )}

        {step === 'preview' && (
          <div className={styles.previewStep}>
            <div className={styles.summary}>
              {errorCount > 0 ? (
                <Badge variant="warning" className={styles.summaryBadge}>
                  <AlertCircle size={14} />
                  {validCount} valid, {errorCount} {errorCount === 1 ? 'error' : 'errors'}
                </Badge>
              ) : (
                <Badge variant="success" className={styles.summaryBadge}>
                  <CheckCircle size={14} />
                  {validCount} valid questions found
                </Badge>
              )}
            </div>
            <div className={styles.previewTableContainer}>
              <table className={styles.previewTable}>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Type</th>
                    <th>Question</th>
                    <th>Marks</th>
                    <th>Correct</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedQuestions.map((q) => {
                    const questionText = 'questionText' in q ? q.questionText : 'N/A';
                    const positiveMarks = 'positiveMarks' in q ? q.positiveMarks : 0;
                    const negativeMarks = 'negativeMarks' in q ? q.negativeMarks : 0;
                    const paragraphText = 'paragraphText' in q && q.paragraphText ? q.paragraphText : null;
                    
                    return (
                      <tr key={`valid-${q.originalRow}`} className={styles.validRow}>
                        <td>{q.originalRow}</td>
                        <td className={styles.typeCell}>
                          <Badge variant="outline" className={styles.typeBadge}>
                            {q.questionType?.replace(/_/g, ' ') || 'unknown'}
                          </Badge>
                        </td>
                        <td className={styles.questionCell}>
                          {paragraphText && (
                            <div className={styles.paragraphPreview}>
                              <span className={styles.paragraphLabel}>Passage:</span> {paragraphText.substring(0, 50)}...
                            </div>
                          )}
                          {questionText}
                        </td>
                        <td className={styles.marksCell}>+{positiveMarks} / -{negativeMarks}</td>
                        <td>{renderCorrectAnswer(q)}</td>
                        <td><Badge variant="success">Valid</Badge></td>
                      </tr>
                    );
                  })}
                  {validationErrors.map((err) => (
                    <tr key={`error-${err.row}`} className={styles.errorRow}>
                      <td>{err.row}</td>
                      <td colSpan={4}>
                        <div className={styles.errorDetails}>
                          <strong>Invalid data in this row.</strong>
                          <ul>
                            {err.errors.map((e, i) => <li key={i}>{e}</li>)}
                          </ul>
                        </div>
                      </td>
                      <td><Badge variant="destructive">Error</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <DialogFooter>
          {step === 'preview' && (
            <Button variant="outline" onClick={resetState} disabled={isUploading}>
              Upload New File
            </Button>
          )}
          <Button variant="secondary" onClick={() => handleOpenChange(false)} disabled={isUploading}>
            Cancel
          </Button>
          {step === 'preview' && (
            <Button
              onClick={handleImport}
              disabled={isUploading || errorCount > 0 || validCount === 0}
            >
              {isUploading ? (
                <>
                  <Loader2 size={16} className={styles.spinner} />
                  Importing...
                </>
              ) : (
                `Import ${validCount} Questions`
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};