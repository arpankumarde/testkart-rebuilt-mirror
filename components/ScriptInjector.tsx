import { useEffect, useRef, useState } from "react";
import { useAdminScriptsQuery } from "../helpers/useAdminScripts";

const CACHE_KEY = "tk_scripts_cache";
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

type CachedScripts = {
  headerScript: string | null;
  footerScript: string | null;
  timestamp: number;
};

/**
 * A non-visual component that fetches platform-wide header and footer scripts
 * and injects them into the document by parsing the HTML strings and appending nodes directly.
 * This properly handles admin-provided script fragments that already contain <script> tags.
 * 
 * Scripts are fetched with a 5-second delay as they are not critical for initial page render.
 */
export const ScriptInjector = () => {
  const [initialDelayPassed, setInitialDelayPassed] = useState(false);
  const [cachedData, setCachedData] = useState<{ headerScript: string | null; footerScript: string | null } | null>(null);
  const injectedRef = useRef(false);

  useEffect(() => {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached) as CachedScripts;
        if (Date.now() - parsed.timestamp < CACHE_DURATION_MS) {
          setCachedData({
            headerScript: parsed.headerScript,
            footerScript: parsed.footerScript,
          });
          return; // We have valid cache, skip fetching and delay
        }
      }
    } catch (e) {
      // ignore parsing error
    }

    const timer = setTimeout(() => {
      setInitialDelayPassed(true);
    }, 5000); // 5 seconds delay for non-critical scripts

    return () => clearTimeout(timer);
  }, []);

  const { data } = useAdminScriptsQuery({
    enabled: initialDelayPassed && !cachedData,
  });

  useEffect(() => {
    if (data && !cachedData) {
      try {
        localStorage.setItem(
          CACHE_KEY,
          JSON.stringify({
            headerScript: data.headerScript,
            footerScript: data.footerScript,
            timestamp: Date.now(),
          })
        );
      } catch (e) {
        // ignore localStorage errors
      }
    }
  }, [data, cachedData]);

  useEffect(() => {
    const scriptsToInject = cachedData || data;

    // Only inject once to avoid duplicates on re-renders or HMR
    if (injectedRef.current || !scriptsToInject) {
      return;
    }

    const { headerScript, footerScript } = scriptsToInject;

    // Helper function to parse HTML string and inject nodes into target element
    const injectScript = (htmlString: string | null, target: HTMLElement) => {
      if (!htmlString || htmlString.trim() === "") {
        return;
      }

      // Parse the HTML string using a template element
      const template = document.createElement("template");
      template.innerHTML = htmlString.trim();

      // Process each parsed node
      Array.from(template.content.childNodes).forEach((node) => {
        if (
          node.nodeType === Node.ELEMENT_NODE &&
          (node as HTMLElement).tagName === "SCRIPT"
        ) {
          // For script tags, we need to create a new script element
          // and copy attributes + content for it to execute
          const originalScript = node as HTMLScriptElement;
          const newScript = document.createElement("script");

          // Copy all attributes
          Array.from(originalScript.attributes).forEach((attr) => {
            newScript.setAttribute(attr.name, attr.value);
          });

          // Copy text content
          if (originalScript.textContent) {
            newScript.textContent = originalScript.textContent;
          }

          target.appendChild(newScript);
          console.log(
            `[ScriptInjector] Injected script into ${target === document.head ? "head" : "body"}`
          );
        } else {
          // For non-script nodes, append them directly
          target.appendChild(node.cloneNode(true));
        }
      });
    };

    // Inject header script into document.head
    injectScript(headerScript, document.head);

    // Inject footer script into document.body
    injectScript(footerScript, document.body);

    injectedRef.current = true;
    console.log("[ScriptInjector] Scripts injection completed");
  }, [data, cachedData]);

  // This component is non-visual
  return null;
};