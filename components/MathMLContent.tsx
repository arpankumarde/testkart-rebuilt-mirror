import React, { useEffect, useState } from 'react';
import katex from 'katex';
import { sanitizeHtml } from '../helpers/sanitizeHtml';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './Tooltip';
import 'katex/dist/katex.min.css';
import styles from './MathMLContent.module.css';

export interface MathMLContentProps {
  /**
   * The HTML content string, which may contain Tiptap/KaTeX math spans.
   * e.g., '<p>The formula is <span data-type="math-inline" data-latex="E=mc^2"></span>.</p>'
   */
  html: string | null | undefined;
  /**
   * Optional maximum length for text content. If exceeded, content is truncated and a tooltip is shown.
   * Useful for table views.
   */
  maxLength?: number;
  /**
   * Optional CSS class to apply to the container element.
   */
  className?: string;
  /**
   * Whether to render the container as an inline element (span) or block element (div).
   * Defaults to false (block).
   */
  inline?: boolean;
}

/**
 * A robust component that safely renders HTML content and processes embedded
 * mathematical formulas using KaTeX. It includes XSS protection via sanitizeHtml
 * and optional text truncation with tooltips.
 */
export const MathMLContent = ({ 
  html, 
  maxLength, 
  className, 
  inline = false 
}: MathMLContentProps) => {
  const [isTruncated, setIsTruncated] = useState(false);
  const [sanitizedHtml, setSanitizedHtml] = useState<string>('');

  // Process HTML: Sanitize, handle truncation, and pre-render KaTeX
  useEffect(() => {
    if (!html) {
      setSanitizedHtml('');
      setIsTruncated(false);
      return;
    }

    // Sanitize before KaTeX renders, since KaTeX output is not on the allow list
    const cleanHtml = sanitizeHtml(html);

    // Create a temporary element to process the HTML
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = cleanHtml;
    
    // Check for truncation based on text content length
    const textContent = tempDiv.textContent || '';
    const shouldTruncate = maxLength && maxLength > 0 && textContent.length > maxLength;

    if (shouldTruncate) {
      setIsTruncated(true);
      // If truncated, we show a text-only preview to avoid breaking HTML/formulas in the middle.
      // The full content (with formulas) will be shown in the tooltip.
      const truncatedText = textContent.slice(0, maxLength!) + '...';
      setSanitizedHtml(truncatedText);
    } else {
      setIsTruncated(false);
      
      // If not truncated, we pre-render the KaTeX formulas into the HTML string.
      // This prevents React from re-rendering the raw HTML and wiping out the KaTeX DOM
      // when the component re-renders.
      
      // Find all elements that are designated to contain math formulas.
      // Supports old format (data-type="mathematics") from existing data in the database
      // and new formats (inline-math, block-math) from @tiptap/extension-mathematics v3.6.2
      const mathElements = tempDiv.querySelectorAll<HTMLElement>('span[data-type="mathematics"], span[data-type="inline-math"], span[data-type="block-math"]');

      mathElements.forEach((element) => {
        // Support data-katex-content (new format), data-latex (Tiptap standard), data-math (legacy), and data-formula (old format)
        const mathContent = element.getAttribute('data-katex-content') || element.getAttribute('data-latex') || element.getAttribute('data-math') || element.getAttribute('data-formula');

        if (mathContent) {
          try {
            // Render the formula using KaTeX to a string
            const katexHtml = katex.renderToString(mathContent, {
              throwOnError: false,
              displayMode: false, // Tiptap usually does inline
              output: 'html', // Use HTML output for better accessibility/compatibility
            });
            
            // Replace the element's content with the rendered KaTeX HTML
            element.innerHTML = katexHtml;
            
            // Add a class for styling
            element.classList.add(styles.mathFormula);
          } catch (error) {
            console.error('Failed to render KaTeX formula:', error);
            element.title = "Failed to render formula";
            element.classList.add(styles.mathError);
          }
        }
      });
      
      // Set the final processed HTML
      setSanitizedHtml(tempDiv.innerHTML);
    }
  }, [html, maxLength]);

  const ContainerTag = inline ? 'span' : 'div';

  const content = (
    <ContainerTag
      className={`${styles.mathContainer} ${inline ? styles.inline : ''} ${className || ''}`}
      dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
    />
  );

  if (isTruncated) {
    // If truncated, wrap in tooltip to show full content
    // We pass maxLength={0} to render the full content inside the tooltip
    return (
      <TooltipProvider>
        <Tooltip delayDuration={300}>
          <TooltipTrigger asChild>
            {/* We render the truncated text version here */}
            <span className={`${styles.truncatedPreview} ${className || ''}`}>
               {sanitizedHtml}
            </span>
          </TooltipTrigger>
          <TooltipContent side="top" className={styles.tooltipContent}>
            <MathMLContent html={html} maxLength={0} />
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return content;
};