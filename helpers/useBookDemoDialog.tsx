import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

/**
 * Shared open/closed state for the "Book a demo" modal.
 *
 * The modal itself is rendered once by components/BookDemoPopup (mounted in
 * _globalContextProviders). Anything on the page — the corner teaser, or a
 * BookDemoButton dropped into a landing page — opens that single instance
 * through this context, so there is never more than one dialog in the tree.
 */
type BookDemoDialogValue = {
  isOpen: boolean;
  /** True once a demo has been booked in this session; the modal then shows its confirmation. */
  isBooked: boolean;
  open: () => void;
  setOpen: (open: boolean) => void;
  markBooked: () => void;
};

const BookDemoDialogContext = createContext<BookDemoDialogValue | undefined>(
  undefined
);

export const BookDemoDialogProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isBooked, setIsBooked] = useState(false);

  const open = useCallback(() => setIsOpen(true), []);
  const markBooked = useCallback(() => setIsBooked(true), []);

  const value = useMemo(
    () => ({ isOpen, isBooked, open, setOpen: setIsOpen, markBooked }),
    [isOpen, isBooked, open, markBooked]
  );

  return (
    <BookDemoDialogContext.Provider value={value}>
      {children}
    </BookDemoDialogContext.Provider>
  );
};

export const useBookDemoDialog = (): BookDemoDialogValue => {
  const context = useContext(BookDemoDialogContext);
  if (!context) {
    throw new Error(
      "useBookDemoDialog must be used within a BookDemoDialogProvider"
    );
  }
  return context;
};
