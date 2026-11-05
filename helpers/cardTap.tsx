import type React from "react";

// A press that starts on one of these keeps its own meaning; the card ignores it.
const OWN_TARGETS = [
  "a",
  "button",
  "input",
  "select",
  "textarea",
  "label",
  "summary",
  "video",
  "audio",
  "[role='button']",
  "[role='checkbox']",
  "[role='menuitem']",
  "[role='switch']",
  "[role='tab']",
  "[contenteditable='true']",
  "[data-card-tap-ignore]",
].join(", ");

const pressedOnOwnTarget = new WeakMap<Element, boolean>();

const ownTargetIn = (card: Element, target: EventTarget | null) => {
  if (!(target instanceof Element)) return false;
  const own = target.closest(OWN_TARGETS);
  return !!own && own !== card && card.contains(own);
};

/**
 * Makes a whole card act as its main control, the way list items behave in a
 * phone app: a tap anywhere on the card that is not on a button, link or field
 * clicks the element inside it marked data-card-primary. Spread on the card's
 * root element. Presses that start on a control (or a drag handle marked
 * data-card-tap-ignore), clicks inside portaled menus and dialogs, and clicks
 * that end a text selection are left alone.
 */
export const cardTapProps = {
  "data-card-tap": "",
  onPointerDown: (event: React.PointerEvent<HTMLElement>) => {
    pressedOnOwnTarget.set(event.currentTarget, ownTargetIn(event.currentTarget, event.target));
  },
  onClick: (event: React.MouseEvent<HTMLElement>) => {
    const card = event.currentTarget;
    const startedOnOwn = pressedOnOwnTarget.get(card);
    pressedOnOwnTarget.delete(card);
    if (startedOnOwn) return;
    if (!(event.target instanceof Node) || !card.contains(event.target)) return;
    if (ownTargetIn(card, event.target)) return;
    if (window.getSelection()?.toString()) return;
    card.querySelector<HTMLElement>("[data-card-primary]")?.click();
  },
};