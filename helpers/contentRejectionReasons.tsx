import { ReasonPreset } from "./reasonPresets";

/* Common reasons for rejecting teacher content, offered as pills in both reject dialogs (content reviews and the admin preview page). */
export const CONTENT_REJECTION_REASONS: ReasonPreset[] = [
  {
    label: "Wrong section",
    text: "This content has been submitted under [current section]; however, it should be published under [correct section].",
  },
  {
    label: "Not original content",
    text: "The material in [lesson name] does not appear to be your original work. Kindly upload only content you have created or hold the rights to.",
  },
  {
    label: "Incomplete course",
    text: "The course currently covers only [covered topics], whereas the title indicates coverage of [promised topics]. Kindly complete the course before resubmitting.",
  },
  {
    label: "Low content quantity",
    text: "The course contains only [number] lesson(s), which is insufficient for the listed price of Rs [price].",
  },
  {
    label: "Missing description",
    text: 'The current description, "[current description]", does not adequately explain the course. Kindly include details about [missing details].',
  },
  {
    label: "Sensitive information",
    text: "The [video/thumbnail] contains [sensitive detail]. Kindly remove it before resubmitting.",
  },
  {
    label: "Description mismatch",
    text: "The description states [claimed content]; however, the course contains only [actual content].",
  },
  {
    label: "Low quality",
    text: "The [issue] in [lesson name] does not meet our quality standards. Kindly revise and resubmit.",
  },
  {
    label: "Invalid listing",
    text: "The listing is missing [missing item]. Kindly add the required details and resubmit.",
  },
  {
    label: "Misleading claims",
    text: 'The statement "[claim]" in the description cannot be verified. Kindly remove or substantiate it.',
  },
];