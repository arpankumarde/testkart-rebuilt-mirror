import { useState } from "react";
import { useStudentNameRequired } from "./useStudentNameRequired";
import { useStudentProfileMutations } from "./useStudentProfileMutations";
import { displayNameProblem } from "./isPlaceholderDisplayName";

/**
 * Review forms show the student's name, and the review endpoints refuse a generated User_<id> one.
 * While the account still has one, the form renders ReviewerNameField and calls ensureName() before
 * submitting: it saves the typed name to the profile (which also renames any older reviews), and
 * returns false with nameError set when the name is missing or still a placeholder.
 */
export const useReviewerName = () => {
  const needsName = useStudentNameRequired();
  const [name, setNameValue] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const { useUpdateStudentProfileMutation } = useStudentProfileMutations();
  const updateProfile = useUpdateStudentProfileMutation();

  const setName = (value: string) => {
    setNameValue(value);
    if (nameError) setNameError(null);
  };

  const ensureName = async (): Promise<boolean> => {
    if (!needsName) return true;
    const trimmed = name.trim();
    const problem = displayNameProblem(trimmed);
    if (problem) {
      setNameError(problem);
      return false;
    }
    try {
      await updateProfile.mutateAsync({ displayName: trimmed });
      return true;
    } catch (err) {
      setNameError(err instanceof Error ? err.message : "Could not save your name.");
      return false;
    }
  };

  return { needsName, name, setName, nameError, ensureName, isSavingName: updateProfile.isPending };
};
