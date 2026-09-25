import { useEffect, useRef, useState } from "react";

export const SEARCH_DEBOUNCE_MS = 300;

/*
 * Keeps a search box's text local and hands it to the page only once typing
 * pauses, so a keystroke re-renders the input rather than the whole list.
 * Clearing the box or pressing Enter commits at once. When the page changes
 * the value itself (a "Clear filters" button), that replaces the draft. Text
 * still pending on unmount is dropped, so a commit that writes the URL cannot
 * pull the admin back after they navigate away.
 */
export function useDebouncedInput(
  value: string,
  onCommit: (value: string) => void,
  delay: number = SEARCH_DEBOUNCE_MS
) {
  const [draft, setDraft] = useState(value);
  const draftRef = useRef(value);
  const committed = useRef(value);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onCommitRef = useRef(onCommit);
  onCommitRef.current = onCommit;

  const cancel = () => {
    if (timer.current === null) return;
    clearTimeout(timer.current);
    timer.current = null;
  };

  const commit = (next: string) => {
    cancel();
    committed.current = next;
    onCommitRef.current(next);
  };

  useEffect(() => {
    if (value === committed.current) return;
    cancel();
    committed.current = value;
    draftRef.current = value;
    setDraft(value);
  }, [value]);

  useEffect(() => cancel, []);

  const onChange = (next: string) => {
    draftRef.current = next;
    setDraft(next);
    if (next === "") {
      commit(next);
      return;
    }
    cancel();
    timer.current = setTimeout(() => commit(next), delay);
  };

  const flush = () => {
    if (timer.current !== null) commit(draftRef.current);
  };

  return { value: draft, onChange, flush };
}