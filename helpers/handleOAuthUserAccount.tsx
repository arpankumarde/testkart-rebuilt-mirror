import { db } from "./db";
import { OAuthProviderType } from "./OAuthProvider";
import { assignUserSlug } from "./assignUserSlug";

export type OAuthUserAccountResult = {
  user: {
    id: number;
    email: string | null;
    displayName: string;
    role: string;
  };
  isNewUser: boolean;
};

export type HandleOAuthUserAccountParams = {
  providerName: OAuthProviderType;
  providerEmail: string;
  mappedUserData: {
    email: string | null;
    displayName: string;
    avatarUrl: string | null;
    providerUserId: string;
  };
  requestedRole: string;
  linkUserId: number | null;
  now: Date;
};

/**
 * Handles OAuth user account creation, login, and linking logic.
 * Returns the user object and whether this was a new user signup.
 */
export async function handleOAuthUserAccount({
  providerName,
  providerEmail,
  mappedUserData,
  requestedRole,
  linkUserId,
  now,
}: HandleOAuthUserAccountParams): Promise<OAuthUserAccountResult> {
  let user: {
    id: number;
    email: string | null;
    displayName: string;
    role: string;
  };
  let isNewUser = false;

  if (linkUserId !== null) {
    // Account linking scenario - update existing user with email from OAuth
    console.log(
      "Account linking scenario - updating user",
      linkUserId,
      "with email",
      mappedUserData.email
    );

    // Verify the user exists
    const existingUserResults = await db
      .selectFrom("users")
      .select(["id", "email", "displayName", "role", "mobileNumber"])
      .where("id", "=", linkUserId)
      .limit(1)
      .execute();

    if (existingUserResults.length === 0) {
      throw new Error("User account not found for linking");
    }

    const existingUser = existingUserResults[0];

    // Check if the email is already used by another account
    const emailConflictResults = await db
      .selectFrom("users")
      .select(["id"])
      .where("email", "=", providerEmail)
      .where("id", "!=", linkUserId)
      .limit(1)
      .execute();

    if (emailConflictResults.length > 0) {
      throw new Error(
        `The email ${providerEmail} is already associated with another account. Please use a different email or contact support.`
      );
    }

    // Update user with email only (preserve manually edited profile data)
    await db
      .updateTable("users")
      .set({
        email: providerEmail,
        emailVerified: true,
        updatedAt: now,
      })
      .where("id", "=", linkUserId)
      .execute();

    // Create or update OAuth account record
    const existingOAuthAccount = await db
      .selectFrom("oauthAccounts")
      .select(["id"])
      .where("userId", "=", linkUserId)
      .where("provider", "=", providerName)
      .limit(1)
      .execute();

    if (existingOAuthAccount.length > 0) {
      await db
        .updateTable("oauthAccounts")
        .set({
          providerUserId: mappedUserData.providerUserId,
          providerEmail: providerEmail,
          updatedAt: now,
        })
        .where("id", "=", existingOAuthAccount[0].id)
        .execute();
    } else {
      await db
        .insertInto("oauthAccounts")
        .values({
          userId: linkUserId,
          provider: providerName,
          providerUserId: mappedUserData.providerUserId,
          providerEmail: providerEmail,
          createdAt: now,
          updatedAt: now,
        })
        .execute();
    }

    user = {
      id: linkUserId,
      email: providerEmail,
      displayName: mappedUserData.displayName,
      role: existingUser.role,
    };
  } else {
    // Normal signup/login scenario - find by email
    const existingUsers = await db
      .selectFrom("users")
      .select(["id", "email", "displayName", "role"])
      .where("email", "=", providerEmail)
      .limit(1)
      .execute();

    if (existingUsers.length > 0) {
      const existingUser = existingUsers[0];
      user = {
        id: existingUser.id,
        email: existingUser.email,
        displayName: existingUser.displayName,
        role: existingUser.role,
      };

      // Ensure email is marked as verified since they logged in via OAuth
      await db
        .updateTable("users")
        .set({ emailVerified: true, updatedAt: now })
        .where("id", "=", user.id)
        .execute();

      // Check if this user has any OAuth accounts (smart linking logic)
      const existingOAuthAccounts = await db
        .selectFrom("oauthAccounts")
        .select(["id", "provider", "providerUserId"])
        .where("userId", "=", user.id)
        .execute();

      if (existingOAuthAccounts.length === 0) {
        // No OAuth accounts - check if user has a password set
        const userPassword = await db
          .selectFrom("userPasswords")
          .select(["userId"])
          .where("userId", "=", user.id)
          .limit(1)
          .execute();

        if (userPassword.length > 0) {
          // User has a password but no OAuth accounts - they need to login with password first to link accounts
          console.log("Password user trying to OAuth login - blocking");
          throw new Error(
            `You already have an account with ${providerEmail}. Please login with your password instead.`
          );
        }
      }

      // This is an OAuth user - check if this specific provider is already linked
      const existingProviderAccount = existingOAuthAccounts.find(
        (account) => account.provider === providerName
      );

      if (existingProviderAccount) {
        // Update existing OAuth account
        console.log(
          "Updating existing OAuth account for provider:",
          providerName
        );
        await db
          .updateTable("oauthAccounts")
          .set({
            providerUserId: mappedUserData.providerUserId,
            providerEmail: providerEmail,
            updatedAt: now,
          })
          .where("id", "=", existingProviderAccount.id)
          .execute();
      } else {
        // Link new OAuth provider to existing OAuth user
        console.log(
          "Linking new OAuth provider to existing user:",
          providerName
        );
        await db
          .insertInto("oauthAccounts")
          .values({
            userId: user.id,
            provider: providerName,
            providerUserId: mappedUserData.providerUserId,
            providerEmail: providerEmail,
            createdAt: now,
            updatedAt: now,
          })
          .onConflict((oc) =>
            oc.columns(["provider", "providerUserId"]).doUpdateSet({
              userId: user.id,
              providerEmail: providerEmail,
              updatedAt: now,
            })
          )
          .execute();
      }
    } else {
      console.log("Creating new user");
      isNewUser = true;

      // Create new user
      const newUsers = await db
        .insertInto("users")
        .values({
          email: providerEmail,
          emailVerified: true,
          displayName: mappedUserData.displayName,
          avatarUrl: mappedUserData.avatarUrl || null,
          role: requestedRole as "student" | "teacher",
          createdAt: now,
          updatedAt: now,
        })
        .returning(["id", "email", "displayName", "role"])
        .execute();

      const newUserId = newUsers[0].id;

      // Use dicebear as fallback avatar if provider didn't supply one
      const resolvedAvatarUrl = mappedUserData.avatarUrl || `https://api.dicebear.com/9.x/fun-emoji/png?seed=${newUserId}`;

      if (!mappedUserData.avatarUrl) {
        await db
          .updateTable("users")
          .set({ avatarUrl: resolvedAvatarUrl })
          .where("id", "=", newUserId)
          .execute();
        console.log(`Avatar URL set for new OAuth user ${newUserId}: ${resolvedAvatarUrl}`);
      }

      // Safely generate+assign a unique slug (retries on a unique-constraint
      // race instead of leaving the account with slug = NULL if it throws).
      const slug = await assignUserSlug(newUserId, mappedUserData.displayName);
      console.log(`Slug generated for new OAuth user ${newUserId}: ${slug}`);

      user = {
        id: newUserId,
        email: newUsers[0].email,
        displayName: newUsers[0].displayName,
        role: newUsers[0].role,
      };

      // Insert sales contact for new teacher (non-blocking)
      if (requestedRole === "teacher") {
        db.insertInto("salesContacts")
          .values({ userId: user.id, stage: "new" as const })
          .execute()
          .then(() => console.log(`Sales contact created for OAuth teacher ${user.id}`))
          .catch((err) => console.error(`Failed to create sales contact for OAuth teacher ${user.id}:`, err));
      }

      // Assign free plan to new teachers
      if (requestedRole === "teacher") {
        try {
          // Query for the free plan (where price = 0)
          const freePlan = await db
            .selectFrom("subscriptionPlans")
            .select(["id", "durationDays"])
            .where("price", "=", "0")
            .where("isActive", "=", true)
            .executeTakeFirst();

          // If free plan exists, create subscription
          if (freePlan) {
            let endDate: Date | null = null;

            // Calculate endDate based on plan duration
            if (freePlan.durationDays) {
              endDate = new Date(
                now.getTime() + freePlan.durationDays * 24 * 60 * 60 * 1000
              );
            }

            await db
              .insertInto("teacherSubscriptions")
              .values({
                teacherId: user.id,
                planId: freePlan.id,
                status: "active",
                startDate: now,
                endDate: endDate,
                nextChargeDate: null,
              })
              .execute();

            console.log(
              `Free plan assigned to teacher ${user.id} via OAuth signup`
            );
          } else {
            // Log warning but continue - registration should succeed
            console.warn(
              `No active free plan found (price = 0) for OAuth teacher registration. Teacher ${user.id} registered without subscription.`
            );
          }
        } catch (freePlanError) {
          // Log error but don't fail the registration
          console.error(
            `Failed to assign free plan to teacher ${user.id} during OAuth signup:`,
            freePlanError instanceof Error
              ? freePlanError.message
              : "Unknown error"
          );
        }
      }

      // Create OAuth account record for new user
      await db
        .insertInto("oauthAccounts")
        .values({
          userId: user.id,
          provider: providerName,
          providerUserId: mappedUserData.providerUserId,
          providerEmail: providerEmail,
          createdAt: now,
          updatedAt: now,
        })
        .execute();
    }
  }

  return { user, isNewUser };
}