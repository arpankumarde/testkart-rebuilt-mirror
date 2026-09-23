import React from "react";
import { Link } from "react-router-dom";
import { Pencil } from "lucide-react";
import { Button } from "./Button";
import { Tooltip, TooltipContent, TooltipTrigger } from "./Tooltip";
import { adminEditPath, AdminEditType } from "../helpers/adminContentEdit";

interface AdminEditIconButtonProps {
  type: AdminEditType;
  id: number;
  title: string;
  className?: string;
}

/* Row action on the admin catalogue lists that opens the item in the admin editor. */
export const AdminEditIconButton = ({ type, id, title, className }: AdminEditIconButtonProps) => {
  const href = adminEditPath(type, id);
  if (!href) return null;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon-md" className={className} asChild>
          <Link to={href} aria-label={`Edit ${title}`}>
            <Pencil />
          </Link>
        </Button>
      </TooltipTrigger>
      <TooltipContent>Edit</TooltipContent>
    </Tooltip>
  );
};