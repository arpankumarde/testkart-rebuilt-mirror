import React, { useRef, useState } from "react";
import { ChevronDown, Download, FileUp, Upload } from "lucide-react";
import { Button } from "./Button";
import { Checkbox } from "./Checkbox";
import { Dialog } from "./Dialog";
import { ConsoleDialogBody, ConsoleDialogContent, ConsoleDialogFooter, ConsoleDialogHeader } from "./ConsoleDialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "./DropdownMenu";
import { getAdminGecExport } from "../endpoints/admin/govt-exams-calendar/export_GET.schema";
import type { OutputType as ImportResult } from "../endpoints/admin/govt-exams-calendar/import_POST.schema";
import { useImportGec } from "../helpers/useAdminGovtExamsCalendar";
import { parseErrorMessage } from "../helpers/parseErrorMessage";
import { toast } from "sonner";
import styles from "./GecImportExport.module.css";

const download = (filename: string, contentType: string, body: string) => {
  const url = URL.createObjectURL(new Blob([body], { type: `${contentType};charset=utf-8` }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

/** Import / Export menu: CSV (one row per date) for spreadsheets, JSON for a full backup including page copy. */
export const GecImportExport: React.FC = () => {
  const [importOpen, setImportOpen] = useState(false);
  const [file, setFile] = useState<{ name: string; format: "csv" | "json"; content: string } | null>(null);
  const [includePage, setIncludePage] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const importer = useImportGec();

  const exportAs = async (format: "csv" | "json") => {
    try {
      const data = await getAdminGecExport({ format });
      download(data.filename, data.contentType, data.body);
    } catch (err) {
      toast.error(parseErrorMessage(err));
    }
  };

  const reset = () => {
    setFile(null);
    setResult(null);
    setError(null);
    setIncludePage(false);
    if (inputRef.current) inputRef.current.value = "";
  };

  const pick = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const picked = event.target.files?.[0];
    setResult(null);
    setError(null);
    if (!picked) return;
    const format = picked.name.toLowerCase().endsWith(".json") ? "json" : "csv";
    setFile({ name: picked.name, format, content: await picked.text() });
  };

  const run = async (dryRun: boolean) => {
    if (!file) return;
    setError(null);
    try {
      const response = await importer.mutateAsync({ format: file.format, content: file.content, dryRun, includePage });
      setResult(response);
      if (!dryRun) {
        toast.success("Import applied to the draft. Publish to update the public page.");
        setImportOpen(false);
        reset();
      }
    } catch (err) {
      setError(parseErrorMessage(err));
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline">
            Import / Export <ChevronDown size={16} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => exportAs("csv")}>
            <Download size={16} /> Export CSV (records and dates)
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => exportAs("json")}>
            <Download size={16} /> Export JSON (full backup)
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={() => {
              reset();
              setImportOpen(true);
            }}
          >
            <Upload size={16} /> Import CSV or JSON...
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <ConsoleDialogContent size="lg">
          <ConsoleDialogHeader
            icon={<FileUp size={18} />}
            title="Import into the calendar"
            description="Records match by exam_slug and dates by event_id, or by type, stage and date. Nothing is deleted, and the import lands in the draft until you publish."
          />
          <ConsoleDialogBody className={styles.body}>
            <div className={styles.picker}>
              <input ref={inputRef} type="file" accept=".csv,.json,text/csv,application/json" onChange={pick} className={styles.file} id="gec-import-file" />
              <Button variant="outline" onClick={() => inputRef.current?.click()}>
                <FileUp size={16} /> Choose file
              </Button>
              <span className={styles.fileName}>{file ? `${file.name} (${file.format.toUpperCase()})` : "Use a file exported from this page as the template."}</span>
            </div>
            {file?.format === "json" && (
              <label className={styles.check}>
                <Checkbox checked={includePage} onChange={(e) => setIncludePage(e.target.checked)} />
                <span>Also replace the page content (hero, FAQs, sources and other copy) with the file's</span>
              </label>
            )}
            {result && (
              <div className={styles.result}>
                <p className={styles.resultTitle}>{result.dryRun ? "Check complete - nothing has changed yet" : "Imported"}</p>
                <ul className={styles.counts}>
                  <li>
                    <strong>{result.summary.created}</strong> new records
                  </li>
                  <li>
                    <strong>{result.summary.updated}</strong> updated records
                  </li>
                  <li>
                    <strong>{result.summary.eventsAdded}</strong> dates added
                  </li>
                  <li>
                    <strong>{result.summary.eventsUpdated}</strong> dates updated
                  </li>
                  <li>
                    <strong>{result.summary.skipped}</strong> skipped
                  </li>
                  {result.summary.pageReplaced && <li>Page content replaced</li>}
                </ul>
                {result.issues.length > 0 && (
                  <ul className={styles.issues}>
                    {result.issues.map((issue, index) => (
                      <li key={index}>
                        <strong>{issue.path}</strong> {issue.message}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            {error && (
              <p className={styles.error} role="alert">
                {error}
              </p>
            )}
          </ConsoleDialogBody>
          <ConsoleDialogFooter>
            <Button variant="outline" onClick={() => setImportOpen(false)} disabled={importer.isPending}>
              Cancel
            </Button>
            <Button variant="outline" onClick={() => run(true)} disabled={!file || importer.isPending}>
              Check file
            </Button>
            <Button onClick={() => run(false)} disabled={!file || !result?.dryRun || importer.isPending}>
              {importer.isPending ? "Working..." : "Import"}
            </Button>
          </ConsoleDialogFooter>
        </ConsoleDialogContent>
      </Dialog>
    </>
  );
};