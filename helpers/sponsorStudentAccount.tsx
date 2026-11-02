import type { Kysely } from "kysely";
import type { DB } from "./schema";
import { normalizePhoneNumber } from "./normalizePhoneNumber";

/**
 * Resolves which account a teacher's sponsor lookup (email or mobile number) points at.
 * Emails are unique, but a mobile number can be shared by a student and a teacher account,
 * or by several accounts, so every match is read and only active student accounts are eligible.
 * Used by both sponsor-student/check and sponsor-student/enroll so they always agree.
 */

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type SponsorAccountCandidate = {
  id: number;
  name: string;
  maskedEmail: string | null;
  maskedPhone: string | null;
  joinedAt: Date | null;
};

type StudentRow = {
  id: number;
  displayName: string;
  mobileNumber: string | null;
  email: string | null;
  createdAt: Date | null;
};

export type SponsorAccountResolution =
  | { kind: "invalid"; message: string }
  | { kind: "not_found"; isEmail: boolean; email?: string; phone?: string }
  | { kind: "not_student"; isEmail: boolean; email?: string; phone?: string; message: string }
  | {
      kind: "multiple_students";
      isEmail: boolean;
      email?: string;
      phone?: string;
      message: string;
      candidates: SponsorAccountCandidate[];
    }
  | {
      kind: "student";
      isEmail: boolean;
      email?: string;
      phone?: string;
      student: StudentRow;
      candidates?: SponsorAccountCandidate[];
    };

export function parseSponsorIdentifier(
  identifier: string
): { ok: true; isEmail: boolean; email?: string; phone?: string } | { ok: false; message: string } {
  const trimmed = identifier.trim();
  if (trimmed.includes("@")) {
    const email = trimmed.toLowerCase();
    if (!EMAIL_PATTERN.test(email)) {
      return { ok: false, message: "Enter a valid email address." };
    }
    return { ok: true, isEmail: true, email };
  }
  try {
    return { ok: true, isEmail: false, phone: normalizePhoneNumber(trimmed) };
  } catch {
    return { ok: false, message: "Enter a valid 10-digit mobile number or email address." };
  }
}

function maskEmail(email: string | null): string | null {
  if (!email) return null;
  const [local, domain] = email.split("@");
  if (!domain) return null;
  return `${local.slice(0, 2)}${"*".repeat(Math.max(1, local.length - 2))}@${domain}`;
}

function maskPhone(phone: string | null): string | null {
  if (!phone) return null;
  return `******${phone.slice(-4)}`;
}

function toCandidate(row: StudentRow): SponsorAccountCandidate {
  return {
    id: row.id,
    name: row.displayName,
    maskedEmail: maskEmail(row.email),
    maskedPhone: maskPhone(row.mobileNumber),
    joinedAt: row.createdAt,
  };
}

function roleLabel(role: string): string {
  if (role === "teacher") return "a Teacher";
  if (role === "admin") return "an Admin";
  return `a ${role}`;
}

export async function resolveSponsorAccount(
  db: Kysely<DB>,
  identifier: string,
  selectedStudentId?: number
): Promise<SponsorAccountResolution> {
  const parsed = parseSponsorIdentifier(identifier);
  if (!parsed.ok) return { kind: "invalid", message: parsed.message };
  const { isEmail, email, phone } = parsed;
  const what = isEmail ? "email" : "mobile number";

  const query = db
    .selectFrom("users")
    .select(["id", "displayName", "role", "mobileNumber", "email", "isActive", "createdAt"])
    .orderBy("id", "asc");
  const matches = isEmail
    ? await query.where(db.fn("lower", ["users.email"]), "=", email!).execute()
    : await query.where("mobileNumber", "=", phone!).execute();

  if (matches.length === 0) {
    return { kind: "not_found", isEmail, email, phone };
  }

  const students = matches.filter((m) => m.role === "student");
  const activeStudents: StudentRow[] = students.filter((m) => m.isActive !== false);

  if (activeStudents.length === 0) {
    if (students.length > 0) {
      return {
        kind: "not_student",
        isEmail,
        email,
        phone,
        message: `The student account with this ${what} is deactivated and cannot be sponsored.`,
      };
    }
    const roles = Array.from(new Set(matches.map((m) => m.role as string)));
    const label = roles.length === 1 ? `${roleLabel(roles[0])} account` : "a non-student account";
    return {
      kind: "not_student",
      isEmail,
      email,
      phone,
      message: `This ${what} is registered as ${label} and cannot be sponsored.`,
    };
  }

  const candidates = activeStudents.length > 1 ? activeStudents.map(toCandidate) : undefined;

  if (selectedStudentId !== undefined) {
    const chosen = activeStudents.find((s) => s.id === selectedStudentId);
    if (!chosen) {
      return {
        kind: "multiple_students",
        isEmail,
        email,
        phone,
        message: `The selected account is not a student account for this ${what}. Choose one of the accounts listed.`,
        candidates: activeStudents.map(toCandidate),
      };
    }
    return { kind: "student", isEmail, email, phone, student: chosen, candidates };
  }

  if (activeStudents.length > 1) {
    return {
      kind: "multiple_students",
      isEmail,
      email,
      phone,
      message: `${activeStudents.length} student accounts use this ${what}. Choose the one to sponsor.`,
      candidates: activeStudents.map(toCandidate),
    };
  }

  return { kind: "student", isEmail, email, phone, student: activeStudents[0] };
}