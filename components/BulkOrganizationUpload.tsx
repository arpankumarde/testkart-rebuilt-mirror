import React, { useState, useCallback, useMemo } from "react";
import { Upload, Download, AlertCircle, CheckCircle, Loader2 } from "lucide-react";
import * as XLSX from "xlsx";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from "./Dialog";
import { Button } from "./Button";
import { FileDropzone } from "./FileDropzone";
import { Badge } from "./Badge";
import {
  postAdminOrganizationsBulkUpload,
  BulkOrgRowInput,
} from "../endpoints/admin/organizations/bulk-upload_POST.schema";
import { OrganizationTypeValues, OrganizationTypeValue } from "../endpoints/teacher/organizations/create_POST.schema";
import styles from "./BulkOrganizationUpload.module.css";

interface BulkOrganizationUploadProps {
  className?: string;
  onSuccess: (count: number) => void;
}

interface ParsedOrgRow extends BulkOrgRowInput {
  originalRow: number;
}

interface ValidationError {
  row: number;
  errors: string[];
}

const CSV_TEMPLATE_HEADER = [
  "Name",
  "Org_Type",
  "Description",
  "Location",
  "Website_Url",
  "Phone_Number",
  "Founded_Year",
  "Affiliated_University_Name",
  "Contact_Emails",
  "Specialties",
  "External_Id",
];

const CSV_TEMPLATE_BODY = [
  [
    "Rajiv Gandhi University",
    "university",
    "",
    "Arunachal Pradesh, India",
    "http://www.rgu.ac.in",
    "0360-2277253",
    "1984",
    "",
    "",
    "",
    "U-0369",
  ],
  [
    "Andaman College",
    "college",
    "",
    "Andaman and Nicobar Islands, India",
    "www.ancol.andaman.gov.in",
    "",
    "2014",
    "Pondicherry University",
    "",
    "",
    "C-50934",
  ],
];

const CSV_TEMPLATE = [
  CSV_TEMPLATE_HEADER.join(","),
  ...CSV_TEMPLATE_BODY.map((row) => row.map((cell) => `"${cell}"`).join(",")),
].join("\n");

const ORG_TYPE_SET = new Set<string>(OrganizationTypeValues);

const parseRowToOrg = (
  row: Record<string, unknown>,
  index: number
): { success: boolean; data?: ParsedOrgRow; errors?: string[] } => {
  const errors: string[] = [];
  const rowNum = index + 2; // +1 for 0-index, +1 for header

  const normalizedRow: Record<string, string> = {};
  Object.keys(row).forEach((key) => {
    const cleanKey = key.trim().toLowerCase().replace(/_/g, "");
    const value = row[key];
    normalizedRow[cleanKey] = value === null || value === undefined ? "" : String(value).trim();
  });
  const getVal = (key: string) => normalizedRow[key.toLowerCase().replace(/_/g, "")] || "";

  const name = getVal("Name");
  const orgTypeRaw = (getVal("Org_Type") || "college").toLowerCase();
  const description = getVal("Description");
  const location = getVal("Location");
  const websiteUrl = getVal("Website_Url");
  const phoneNumber = getVal("Phone_Number");
  const foundedYearRaw = getVal("Founded_Year");
  const affiliatedUniversityName = getVal("Affiliated_University_Name");
  const contactEmails = getVal("Contact_Emails");
  const specialties = getVal("Specialties");
  const externalId = getVal("External_Id");

  if (!name) errors.push("Name is required");
  if (!ORG_TYPE_SET.has(orgTypeRaw)) {
    errors.push(`Org Type must be one of: ${OrganizationTypeValues.join(", ")} (got "${orgTypeRaw}")`);
  }

  let foundedYear: number | null = null;
  if (foundedYearRaw) {
    const parsed = parseInt(foundedYearRaw, 10);
    if (isNaN(parsed)) {
      errors.push("Founded Year must be a number");
    } else {
      foundedYear = parsed;
    }
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }

  return {
    success: true,
    data: {
      originalRow: rowNum,
      name,
      orgType: orgTypeRaw as OrganizationTypeValue,
      description: description || null,
      location: location || null,
      websiteUrl: websiteUrl || null,
      phoneNumber: phoneNumber || null,
      foundedYear,
      affiliatedUniversityName: affiliatedUniversityName || null,
      contactEmails: contactEmails || null,
      specialties: specialties || null,
      externalId: externalId || null,
    },
  };
};

const PREVIEW_ROW_LIMIT = 200;

export const BulkOrganizationUpload: React.FC<BulkOrganizationUploadProps> = ({ className, onSuccess }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<"upload" | "preview" | "result">("upload");
  const [parsedRows, setParsedRows] = useState<ParsedOrgRow[]>([]);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [resultSummary, setResultSummary] = useState<string | null>(null);

  const resetState = useCallback(() => {
    setStep("upload");
    setParsedRows([]);
    setValidationErrors([]);
    setIsProcessing(false);
    setIsUploading(false);
    setFileName(null);
    setResultSummary(null);
  }, []);

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      setTimeout(resetState, 300);
    }
  };

  const handleDownloadTemplate = () => {
    const blob = new Blob([CSV_TEMPLATE], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    if (link.href) URL.revokeObjectURL(link.href);
    link.href = URL.createObjectURL(blob);
    link.download = "organization-upload-template.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadExcelTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([CSV_TEMPLATE_HEADER, ...CSV_TEMPLATE_BODY]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    const wbout = XLSX.write(wb, { type: "array", bookType: "xlsx" });
    const blob = new Blob([wbout], { type: "application/octet-stream" });
    const link = document.createElement("a");
    if (link.href) URL.revokeObjectURL(link.href);
    link.href = URL.createObjectURL(blob);
    link.download = "organization-upload-template.xlsx";
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
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(worksheet, { defval: "", raw: false });

        const rows: ParsedOrgRow[] = [];
        const errors: ValidationError[] = [];

        (json as Record<string, unknown>[]).forEach((row, index) => {
          if (Object.values(row).every((val) => val === "" || val === null || val === undefined)) {
            return;
          }
          const { success, data, errors: rowErrors } = parseRowToOrg(row, index);
          if (success && data) {
            rows.push(data);
          } else if (rowErrors) {
            errors.push({ row: index + 2, errors: rowErrors });
          }
        });

        setParsedRows(rows);
        setValidationErrors(errors);
        setStep("preview");
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
    if (parsedRows.length === 0) return;
    setIsUploading(true);
    try {
      const rowsToSend = parsedRows.map(({ originalRow, ...rest }) => rest);
      const result = await postAdminOrganizationsBulkUpload({ rows: rowsToSend, source: "admin_csv_upload" });
      setResultSummary(
        `Imported ${result.imported} new, updated ${result.updated} existing, created ${result.universitiesCreated} universities, skipped ${result.skipped}.`
      );
      setStep("result");
      toast.success(`${result.imported + result.updated} organisations processed successfully!`);
      onSuccess(result.imported + result.updated);
    } catch (error) {
      console.error("Error importing organisations:", error);
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
      toast.error(`Import failed: ${errorMessage}`);
    } finally {
      setIsUploading(false);
    }
  };

  const { validCount, errorCount } = useMemo(
    () => ({ validCount: parsedRows.length, errorCount: validationErrors.length }),
    [parsedRows, validationErrors]
  );

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
          <DialogTitle>Bulk Upload Organisations</DialogTitle>
          <DialogDescription>
            {step === "upload"
              ? "Upload schools, colleges, coaching institutes or universities in bulk. Supports .xlsx, .xls, and .csv files, including very large files (tens of thousands of rows)."
              : step === "preview"
              ? `Reviewing file: ${fileName}`
              : "Import complete."}
          </DialogDescription>
        </DialogHeader>

        {step === "upload" && (
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
                Required column: <code>Name</code>. <code>Org_Type</code> must be one of:{" "}
                {OrganizationTypeValues.join(", ")} (defaults to "college" if left blank).
                <br />
                For colleges, set <code>Affiliated_University_Name</code> to the university's name - it will be
                linked automatically, and a new unclaimed university organisation is created if none matches yet.
                <br />
                <code>External_Id</code> is optional: re-uploading the same file later with the same External_Id
                updates existing unclaimed rows instead of duplicating them.
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

        {step === "preview" && (
          <div className={styles.previewStep}>
            <div className={styles.summary}>
              {errorCount > 0 ? (
                <Badge variant="warning" className={styles.summaryBadge}>
                  <AlertCircle size={14} />
                  {validCount} valid, {errorCount} {errorCount === 1 ? "row skipped" : "rows skipped"}
                </Badge>
              ) : (
                <Badge variant="success" className={styles.summaryBadge}>
                  <CheckCircle size={14} />
                  {validCount} valid organisations found
                </Badge>
              )}
            </div>
            <div className={styles.previewTableContainer}>
              <table className={styles.previewTable}>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Type</th>
                    <th>Name</th>
                    <th>Location</th>
                    <th>Affiliated University</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedRows.slice(0, PREVIEW_ROW_LIMIT).map((r) => (
                    <tr key={`valid-${r.originalRow}`} className={styles.validRow}>
                      <td>{r.originalRow}</td>
                      <td className={styles.typeCell}>
                        <Badge variant="outline" className={styles.typeBadge}>
                          {r.orgType}
                        </Badge>
                      </td>
                      <td className={styles.nameCell}>{r.name}</td>
                      <td className={styles.nameCell}>{r.location || "-"}</td>
                      <td className={styles.univCell}>{r.affiliatedUniversityName || "-"}</td>
                      <td>
                        <Badge variant="success">Valid</Badge>
                      </td>
                    </tr>
                  ))}
                  {validationErrors.slice(0, PREVIEW_ROW_LIMIT).map((err) => (
                    <tr key={`error-${err.row}`} className={styles.errorRow}>
                      <td>{err.row}</td>
                      <td colSpan={4}>
                        <div className={styles.errorDetails}>
                          <strong>Skipped.</strong>
                          <ul>
                            {err.errors.map((e, i) => (
                              <li key={i}>{e}</li>
                            ))}
                          </ul>
                        </div>
                      </td>
                      <td>
                        <Badge variant="destructive">Skipped</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {validCount + errorCount > PREVIEW_ROW_LIMIT * 2 && (
                <div className={styles.moreRowsNote}>
                  Showing first {PREVIEW_ROW_LIMIT} valid and {PREVIEW_ROW_LIMIT} skipped rows. All {validCount}{" "}
                  valid rows will still be imported.
                </div>
              )}
            </div>
          </div>
        )}

        {step === "result" && resultSummary && (
          <div className={styles.resultSummary}>
            <Badge variant="success" className={styles.summaryBadge}>
              <CheckCircle size={14} />
              Done
            </Badge>
            <p>{resultSummary}</p>
          </div>
        )}

        <DialogFooter>
          {step === "preview" && (
            <Button variant="outline" onClick={resetState} disabled={isUploading}>
              Upload New File
            </Button>
          )}
          <Button variant="secondary" onClick={() => handleOpenChange(false)} disabled={isUploading}>
            {step === "result" ? "Close" : "Cancel"}
          </Button>
          {step === "preview" && (
            <Button onClick={handleImport} disabled={isUploading || validCount === 0}>
              {isUploading ? (
                <>
                  <Loader2 size={16} className={styles.spinner} />
                  Importing...
                </>
              ) : (
                `Import ${validCount} Organisations`
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
