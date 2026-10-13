import { useMemo, useEffect } from "react";
import { useLocation } from "react-router-dom";

export const ScrollToTop = () => {
  const location = useLocation();

  const hashElement = useMemo(() => {
    const hash = location.hash;
    const removeHashCharacter = (str: string) => {
      return str.slice(1);
    };

    if (hash) {
      const element = document.getElementById(removeHashCharacter(hash));
      return element;
    } else {
      return null;
    }
  }, [location.hash]);

  useEffect(() => {
    if (hashElement) {
      // Scroll to hash element if present
      hashElement.scrollIntoView({
        behavior: "smooth",
        inline: "nearest",
      });
    } else if (!(location.state as { preserveScroll?: boolean } | null)?.preserveScroll) {
      // Scroll to top if no hash, unless the link passed state.preserveScroll (in-page tabs)
      window.scrollTo(0, 0);
    }
  }, [hashElement, location.pathname]);

  return null;
};