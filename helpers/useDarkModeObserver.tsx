import { useState, useEffect } from 'react';

/**
 * A custom hook that tracks whether dark mode is active by observing the 'dark' class on document.body.
 * returns true if dark mode is active, false otherwise.
 */
export function useDarkModeObserver(): boolean {
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    // Initial check
    const checkDarkMode = () => {
      setIsDarkMode(document.body.classList.contains('dark'));
    };

    checkDarkMode();

    // Create observer to watch for class changes on body
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (
          mutation.type === 'attributes' &&
          mutation.attributeName === 'class'
        ) {
          checkDarkMode();
        }
      });
    });

    // Start observing
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['class'],
    });

    // Cleanup
    return () => {
      observer.disconnect();
    };
  }, []);

  return isDarkMode;
}