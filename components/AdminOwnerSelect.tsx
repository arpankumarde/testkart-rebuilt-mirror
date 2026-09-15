import React from "react";
import { useAdminOptionsQuery } from "../helpers/useAdminOptions";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  SelectSeparator,
} from "./Select";

const UNASSIGNED = "__unassigned__";

interface AdminOwnerSelectProps {
  // The owner's name. undefined shows the placeholder; null is "Unassigned".
  value: string | null | undefined;
  onChange: (ownerName: string | null) => void;
  id?: string;
  className?: string;
  placeholder?: string;
}

// Owner picker that copies an admin's name. Lists active admins; a current
// value that is not one of them (an inactive admin, or an older free-text
// label) is kept as its own option so it still shows.
export const AdminOwnerSelect = ({
  value,
  onChange,
  id,
  className,
  placeholder = "Choose an admin",
}: AdminOwnerSelectProps) => {
  const { data, isFetching } = useAdminOptionsQuery();
  const admins = data?.admins ?? [];
  const activeNames = Array.from(new Set(admins.filter((admin) => admin.isActive).map((admin) => admin.fullName)));
  const extraName = value && !activeNames.includes(value) ? value : null;
  const extraIsInactiveAdmin = extraName !== null && admins.some((admin) => admin.fullName === extraName);

  return (
    <Select
      value={value === undefined ? "" : value ? value : UNASSIGNED}
      onValueChange={(next) => onChange(next === UNASSIGNED ? null : next)}
    >
      <SelectTrigger id={id} className={className}>
        <SelectValue placeholder={isFetching && !data ? "Loading admins..." : placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
        <SelectSeparator />
        {extraName !== null && (
          <SelectItem value={extraName}>
            {extraIsInactiveAdmin ? `${extraName} (inactive)` : extraName}
          </SelectItem>
        )}
        {activeNames.map((name) => (
          <SelectItem key={name} value={name}>
            {name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};