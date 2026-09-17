import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { schema, OutputType, InputType } from "./check_POST.schema";
import superjson from "superjson";
import { NotAuthenticatedError } from "../../../helpers/getSetServerSession";
import { normalizePhoneNumber } from "../../../helpers/normalizePhoneNumber";
import { getTeacherAvailableBalance } from "../../../helpers/getTeacherAvailableBalance";
import { getTeacherPlatformFee } from "../../../helpers/getTeacherPlatformFee";

function isEmailIdentifier(identifier: string): boolean {
  return identifier.includes("@");
}

type ContentInfo = {
  id: number;
  title: string;
  price: number;
  discountPrice: number | null;
  teacherId: number;
  isPublished: boolean;
  isFree: boolean;
};

async function resolveContent(
  contentType: InputType["contentType"],
  contentId: number
): Promise<ContentInfo | null> {
  if (contentType === "test") {
    const row = await db
      .selectFrom("mockTests")
      .select(["id", "title", "price", "discountPrice", "teacherId", "isPublished", "isFree"])
      .where("id", "=", contentId)
      .executeTakeFirst();
    if (!row) return null;
    return {
      id: row.id,
      title: row.title,
      price: Number(row.price),
      discountPrice: row.discountPrice !== null && Number(row.discountPrice) > 0 ? Number(row.discountPrice) : null,
      teacherId: row.teacherId,
      isPublished: row.isPublished,
      isFree: row.isFree,
    };
  }

  if (contentType === "course") {
    const row = await db
      .selectFrom("courses")
      .select(["id", "title", "price", "teacherId", "status"])
      .where("id", "=", contentId)
      .executeTakeFirst();
    if (!row) return null;
    return {
      id: row.id,
      title: row.title,
      price: Number(row.price),
      discountPrice: null,
      teacherId: row.teacherId,
      isPublished: row.status === "published",
      isFree: Number(row.price) === 0,
    };
  }

  if (contentType === "product") {
    const row = await db
      .selectFrom("digitalProducts")
      .select(["id", "title", "price", "teacherId", "isPublished"])
      .where("id", "=", contentId)
      .executeTakeFirst();
    if (!row) return null;
    return {
      id: row.id,
      title: row.title,
      price: Number(row.price),
      discountPrice: null,
      teacherId: row.teacherId,
      isPublished: row.isPublished ?? false,
      isFree: Number(row.price) === 0,
    };
  }

  if (contentType === "bundle") {
    const row = await db
      .selectFrom("courseBundles")
      .select(["id", "title", "price", "teacherId", "isPublished"])
      .where("id", "=", contentId)
      .executeTakeFirst();
    if (!row) return null;
    return {
      id: row.id,
      title: row.title,
      price: Number(row.price),
      discountPrice: null,
      teacherId: row.teacherId,
      isPublished: row.isPublished,
      isFree: Number(row.price) === 0,
    };
  }

  return null;
}

async function checkExistingEnrollment(
  contentType: InputType["contentType"],
  contentId: number,
  studentId: number
): Promise<boolean> {
  if (contentType === "test") {
    // Check regular completed orders
    const existingOrder = await db
      .selectFrom("orderItems")
      .innerJoin("orders", "orderItems.orderId", "orders.id")
      .where("orders.userId", "=", studentId)
      .where("orderItems.mockTestId", "=", contentId)
      .where("orders.status", "=", "completed")
      .select("orders.id")
      .executeTakeFirst();

    if (existingOrder) return true;

    // Check sponsored enrollments - only count completed ones
    const existingSponsorship = await db
      .selectFrom("teacherSponsoredEnrollments as tse")
      .leftJoin("orders", "tse.orderId", "orders.id")
      .where("tse.studentId", "=", studentId)
      .where("tse.mockTestId", "=", contentId)
      .where((eb) =>
        eb.or([
          eb("tse.paymentMethod", "!=", "online_pending"),
          eb("orders.status", "=", "completed"),
        ])
      )
      .select("tse.id")
      .executeTakeFirst();

    return !!existingSponsorship;
  }

  if (contentType === "course") {
    const existing = await db
      .selectFrom("courseEnrollments")
      .where("studentId", "=", studentId)
      .where("courseId", "=", contentId)
      .select("id")
      .executeTakeFirst();
    return !!existing;
  }

  if (contentType === "product") {
    const existing = await db
      .selectFrom("digitalProductPurchases")
      .where("studentId", "=", studentId)
      .where("productId", "=", contentId)
      .select("id")
      .executeTakeFirst();
    return !!existing;
  }

  if (contentType === "bundle") {
    const existing = await db
      .selectFrom("bundleEnrollments")
      .where("studentId", "=", studentId)
      .where("bundleId", "=", contentId)
      .select("id")
      .executeTakeFirst();
    return !!existing;
  }

  return false;
}

export async function handle(request: Request): Promise<Response> {
  try {
    const { user, effectiveTeacherId, teacherRole } = await getServerUserSession(request);

    if (user.role !== "teacher" && user.role !== "admin") {
      return new Response(
        superjson.stringify({ error: "Unauthorized" }),
        { status: 403 }
      );
    }

    const json = superjson.parse<InputType>(await request.text());
    const input = schema.parse(json);

    const errors: string[] = [];
    let userCreationMessage: string | undefined;

    // Determine lookup strategy based on identifier type
    const isEmail = isEmailIdentifier(input.identifier);
    let lookupPhone: string | undefined;
    let lookupEmail: string | undefined;

    if (isEmail) {
      lookupEmail = input.identifier.trim().toLowerCase();
    } else {
      try {
        lookupPhone = normalizePhoneNumber(input.identifier);
      } catch {
        return new Response(
          superjson.stringify({ error: "Invalid phone number format. Please enter a valid 10-digit number or email address." }),
          { status: 400 }
        );
      }
    }

    // 1. Check if user exists
    const studentUserQuery = db
      .selectFrom("users")
      .select(["id", "displayName", "role", "mobileNumber", "email"]);

    const studentUser = isEmail
      ? await studentUserQuery
          .where(db.fn("lower", ["users.email"]), "=", lookupEmail!)
          .executeTakeFirst()
      : await studentUserQuery
          .where("mobileNumber", "=", lookupPhone!)
          .executeTakeFirst();

    const userExists = !!studentUser;
    const isStudent = studentUser?.role === "student";

    if (userExists && !isStudent) {
      errors.push("User exists but is not a student account.");
    }

    if (!userExists) {
      userCreationMessage = "This identifier is not registered. A new student account will be created.";
    }

    // 2. Get Content Details
    const content = await resolveContent(input.contentType, input.contentId);

    if (!content) {
      return new Response(
        superjson.stringify({ error: "Content not found" }),
        { status: 404 }
      );
    }

    // Validate ownership
    if (content.teacherId !== effectiveTeacherId && user.role !== "admin") {
      errors.push("You do not own this content.");
    }

    // Validate published status
    if (!content.isPublished) {
      errors.push("This content is not published.");
    }

    // Validate price
    if (content.isFree || content.price === 0) {
      errors.push("Cannot sponsor free content.");
    }

    // 3. Check if student already enrolled (only applicable if user exists)
    if (userExists && studentUser && isStudent) {
      const alreadyEnrolled = await checkExistingEnrollment(
        input.contentType,
        input.contentId,
        studentUser.id
      );
      if (alreadyEnrolled) {
        errors.push("Student is already enrolled in this content.");
      }
    }

    // 4. Calculate Commission Cost — shared lookup so this preview always
    // matches what enroll_POST actually charges (that endpoint had its own
    // copy of this query which ignored platformFeeOverride; fixed to use
    // the same helper as this preview).
    const platformFeePercentage = await getTeacherPlatformFee(effectiveTeacherId);

    const testPrice = content.price;
    const discountPrice = content.discountPrice !== null && content.discountPrice < testPrice
      ? content.discountPrice
      : null;
    const effectivePrice = discountPrice !== null ? discountPrice : testPrice;
    const rawCommission = (effectivePrice * platformFeePercentage) / 100;
    const commissionAmount = rawCommission * 0.95;
    const isFreeEnrollment = commissionAmount < 1;

    // 5. Get Teacher's Available Balance. Managers cannot see or spend the
    // owner's earnings, so for them the balance is 0 and only online payment is offered.
    const isManager = teacherRole === "manager";
    const availableBalance = isManager
      ? 0
      : (await getTeacherAvailableBalance(effectiveTeacherId)).availableBalance;

    const hasSufficientBalance = isFreeEnrollment || availableBalance >= commissionAmount;

    // Construct Response
    const responseData: OutputType = {
      isValid: errors.length === 0,
      ...(userCreationMessage && { message: userCreationMessage }),
      user: {
        exists: userExists,
        id: studentUser?.id,
        name: studentUser?.displayName,
        isStudent: isStudent,
        phoneNumber: studentUser?.mobileNumber ?? lookupPhone,
        email: studentUser?.email ?? lookupEmail,
      },
      content: {
        title: content.title,
        price: testPrice,
        isFree: content.isFree,
        contentType: input.contentType,
      },
      cost: {
        testPrice,
        platformFeePercentage,
        commissionAmount: isFreeEnrollment ? 0 : commissionAmount,
        formula: `(${effectivePrice} * ${platformFeePercentage}%) * 0.95`,
        discountPrice,
      },
      teacher: {
        availableBalance,
        hasSufficientBalance,
        requiresPayment: !hasSufficientBalance,
      },
      isFreeEnrollment,
      errors: errors.length > 0 ? errors : undefined,
    };

    return new Response(superjson.stringify(responseData));

  } catch (error) {
    console.error("Error checking student sponsorship:", error);
    if (error instanceof NotAuthenticatedError) {
      return new Response(superjson.stringify({ error: "Not authenticated" }), {
        status: 401,
      });
    }
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