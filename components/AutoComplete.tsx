import { CommandEmpty, CommandGroup, CommandItem, CommandList } from "./Command";
import { Command as CommandPrimitive } from "cmdk";
import {
  useState,
  useRef,
  useCallback,
  useEffect,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { Popover, PopoverContent, PopoverTrigger } from "./Popover";

import { Skeleton } from "./Skeleton";
import styles from "./AutoComplete.module.css";

export type Option<T = unknown> = {
  value: string;
  label: ReactNode;
  displayText?: string;
  metadata?: T;
};

const getDisplayText = <T,>(option: Option<T>): string => {
  if (option.displayText) {
    return option.displayText;
  }
  if (typeof option.label === "string") {
    return option.label;
  }
  return option.value;
};

type AutoCompleteProps<T = unknown> = {
  options: Option<T>[];
  emptyMessage: string;
  value?: Option<T>;
  onValueChange?: (value: Option<T>) => void;
  inputValue: string;
  onInputValueChange: (value: string) => void;
  isLoading?: boolean;
  disabled?: boolean;
  placeholder?: string;
  // when this is false, only values in the options will be accepted
  allowFreeForm?: boolean;
  /*
   * False when the caller filters `options` itself. cmdk's own filter is fuzzy
   * and keeps any option sharing the typed letters in order, so a precise list
   * must turn it off. The caller's list is then shown as given, with
   * emptyMessage when a search finds nothing, and typing opens the list.
   */
  shouldFilter?: boolean;
};

export const AutoComplete = <T = unknown,>({
  options,
  placeholder,
  emptyMessage,
  value,
  onValueChange,
  inputValue,
  onInputValueChange,
  disabled,
  isLoading = false,
  allowFreeForm = false,
  shouldFilter = true,
}: AutoCompleteProps<T>) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const [isOpen, setOpen] = useState(false);
  const [selected, setSelected] = useState<Option<T> | undefined>(value);

  // Edit forms usually fill their values after mounting, so follow the value
  // prop whenever it points at a real option. A later undefined (the input
  // holds partial text) keeps the last valid selection for the blur below.
  useEffect(() => {
    if (value) setSelected(value);
  }, [value]);

  // A new search starts at the top of its results, not where the last list was scrolled.
  useEffect(() => {
    if (!shouldFilter && listRef.current) listRef.current.scrollTop = 0;
  }, [inputValue, shouldFilter]);

  const handleInputChange = useCallback(
    (next: string) => {
      onInputValueChange(next);
      if (!shouldFilter && next.trim() !== "") setOpen(true);
    },
    [onInputValueChange, shouldFilter],
  );

  const showEmpty = !shouldFilter && options.length === 0 && inputValue.trim() !== "" && !isLoading;

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      const input = inputRef.current;
      if (!input) {
        return;
      }

      // This is not a default behaviour of the <input /> field
      if (event.key === "Enter" && input.value !== "") {
        const optionToSelect = options.find(
          (option) => getDisplayText(option) === input.value,
        );
        if (optionToSelect) {
          setSelected(optionToSelect);
          onValueChange?.(optionToSelect);
        }
      }

      if (event.key === "Escape") {
        input.blur();
        setOpen(false);
      }
    },
    [options, onValueChange],
  );

  const handleBlur = useCallback(() => {
    // Only snap the input back when the popover is closed and not in free-form
    // mode, so a click on an option is not interrupted.
    if (isOpen || allowFreeForm) return;
    const typed = inputValue.trim();
    if (typed === "") {
      setSelected(undefined);
      return;
    }
    const exactMatch = options.find(
      (option) => getDisplayText(option).toLowerCase() === typed.toLowerCase(),
    );
    if (exactMatch) {
      setSelected(exactMatch);
      if (getDisplayText(exactMatch) !== inputValue) {
        onInputValueChange(getDisplayText(exactMatch));
      }
      return;
    }
    // Without options there is nothing to validate against yet, so never
    // discard a stored value just because the list is still loading.
    if (isLoading || options.length === 0) return;
    onInputValueChange(selected ? getDisplayText(selected) : "");
  }, [selected, isOpen, onInputValueChange, allowFreeForm, inputValue, options, isLoading]);

  const handleSelectOption = useCallback(
    (selectedOption: Option<T>) => {
      onInputValueChange(getDisplayText(selectedOption));

      setSelected(selectedOption);
      onValueChange?.(selectedOption);

      // Close the popover after selection
      setOpen(false);

      // This is a hack to prevent the input from being focused after the user selects an option
      // We can call this hack: "The next tick"
      setTimeout(() => {
        inputRef?.current?.blur();
      }, 0);
    },
    [onValueChange, onInputValueChange],
  );

  return (
    <Popover open={isOpen} onOpenChange={setOpen}>
      <CommandPrimitive
        onKeyDown={handleKeyDown}
        shouldFilter={shouldFilter}
        className={styles.autoComplete}
      >
        <div className={styles.inputWrapper}>
          <PopoverTrigger asChild>
            <CommandPrimitive.Input
              ref={inputRef}
              value={inputValue}
              onValueChange={isLoading ? undefined : handleInputChange}
              onBlur={handleBlur}
              placeholder={placeholder}
              disabled={disabled}
              className={styles.customInput}
            />
          </PopoverTrigger>
        </div>
        {(!!options.length || showEmpty) && (
          <PopoverContent
            removeBackgroundAndPadding
            className={styles.popoverContent}
            align="start"
            onOpenAutoFocus={(e) => e.preventDefault()}
          >
            <CommandList ref={listRef} className={styles.commandList}>
              {showEmpty && <CommandEmpty>{emptyMessage}</CommandEmpty>}
              {options.length > 0 && (
                <CommandGroup>
                  {options.map((option) => {
                    return (
                      <CommandItem
                        key={option.value}
                        value={getDisplayText(option)}
                        onMouseDown={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                        }}
                        onSelect={() => handleSelectOption(option)}
                      >
                        {option.label}
                      </CommandItem>
                    );
                    {
                      isLoading ? (
                        <CommandPrimitive.Loading>
                          <div className={styles.loadingContainer}>
                            <Skeleton style={{ height: "2rem" }} />
                          </div>
                        </CommandPrimitive.Loading>
                      ) : null;
                    }
                  })}
                </CommandGroup>
              )}
            </CommandList>
          </PopoverContent>
        )}
      </CommandPrimitive>
    </Popover>
  );
};
