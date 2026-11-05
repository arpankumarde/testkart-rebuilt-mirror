import * as React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import styles from "./Tooltip.module.css";

/**
 * This is already included in the global context providers so should not be rendered again.
 */
const TooltipProvider = TooltipPrimitive.Provider;

type TapToggle = { open: boolean; setOpen: (open: boolean) => void };
const TapToggleContext = React.createContext<TapToggle | null>(null);

/**
 * Radix tooltips never open from a touch, so on phones every hint was
 * unreachable. A tap on the trigger now toggles the tooltip; mouse and
 * keyboard behave exactly as before.
 */
const Tooltip = ({
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  ...props
}: React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Root>) => {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen);
  const open = openProp ?? uncontrolledOpen;
  const setOpen = React.useCallback(
    (next: boolean) => {
      if (openProp === undefined) setUncontrolledOpen(next);
      onOpenChange?.(next);
    },
    [openProp, onOpenChange]
  );
  const tapToggle = React.useMemo(() => ({ open, setOpen }), [open, setOpen]);
  return (
    <TapToggleContext.Provider value={tapToggle}>
      <TooltipPrimitive.Root open={open} onOpenChange={setOpen} {...props} />
    </TapToggleContext.Provider>
  );
};

const TooltipTrigger = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Trigger>
>(({ onPointerDown, onClick, ...props }, ref) => {
  const tapToggle = React.useContext(TapToggleContext);
  const touchRef = React.useRef<{ wasOpen: boolean } | null>(null);
  return (
    <TooltipPrimitive.Trigger
      ref={ref}
      onPointerDown={(event) => {
        onPointerDown?.(event);
        touchRef.current = event.pointerType === "touch" && tapToggle ? { wasOpen: tapToggle.open } : null;
      }}
      onClick={(event) => {
        onClick?.(event);
        const touch = touchRef.current;
        touchRef.current = null;
        // Radix closes the tooltip on this click, so reopen after it has run.
        if (touch && tapToggle && !touch.wasOpen) {
          requestAnimationFrame(() => tapToggle.setOpen(true));
        }
      }}
      {...props}
    />
  );
});
TooltipTrigger.displayName = TooltipPrimitive.Trigger.displayName;

const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={`${styles.content} ${className || ""}`}
      {...props}
    />
  </TooltipPrimitive.Portal>
));
TooltipContent.displayName = TooltipPrimitive.Content.displayName;

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
