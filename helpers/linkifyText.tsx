import React from "react";

export function linkifyText(text: string): React.ReactNode[] {
  const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi;
  const parts = text.split(urlRegex);
  
  return parts.map((part, i) => {
    if (part.match(urlRegex)) {
      let href = part;
      if (part.toLowerCase().startsWith("www.")) {
        href = "http://" + part;
      }
      return (
        <a key={i} href={href} target="_blank" rel="noopener noreferrer">
          {part}
        </a>
      );
    }
    return <React.Fragment key={i}>{part}</React.Fragment>;
  });
}