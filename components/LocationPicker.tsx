import React, { useState } from "react";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "./Select";
import { Input } from "./Input";
import { Button } from "./Button";
import { INDIAN_STATES, CITIES_BY_STATE, type IndianState } from "../helpers/indianLocationsData";
import styles from "./LocationPicker.module.css";

const OTHER_CITY_VALUE = "__other__";

interface LocationPickerProps {
  state: string;
  city: string;
  onChange: (next: { state: string; city: string }) => void;
  className?: string;
}

/**
 * Two linked fields (state select, then city) backed by a curated Indian
 * state/city dataset - replaces a freeform location text input so an
 * organisation's location is normally a real, pickable place. The dataset
 * isn't exhaustive, so the city field also offers "Other" which swaps to a
 * free-text input - picking a new state clears the city either way, since
 * the previous city likely doesn't belong to the new state.
 */
export const LocationPicker: React.FC<LocationPickerProps> = ({ state, city, onChange, className }) => {
  const cityOptions = state && (INDIAN_STATES as readonly string[]).includes(state)
    ? CITIES_BY_STATE[state as IndianState]
    : [];

  // Manual mode is implied whenever the current city value doesn't match a
  // known option for this state (e.g. it was typed in before, or the state
  // changed under a still-custom city) - no separate "mode" to get out of
  // sync with the actual value.
  const [manualOverride, setManualOverride] = useState(false);
  const isManual = manualOverride || (!!city && !cityOptions.includes(city));

  return (
    <div className={`${styles.row} ${className ?? ""}`}>
      <div className={styles.field}>
        <span className={styles.fieldLabel}>State</span>
        <Select
          value={state || undefined}
          onValueChange={(next) => {
            setManualOverride(false);
            onChange({ state: next, city: "" });
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select state" />
          </SelectTrigger>
          <SelectContent>
            {INDIAN_STATES.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className={styles.field}>
        <span className={styles.fieldLabel}>City</span>
        {isManual ? (
          <div className={styles.manualCityRow}>
            <Input
              value={city}
              onChange={(e) => onChange({ state, city: e.target.value })}
              placeholder="Type city name"
              maxLength={80}
              autoFocus
            />
            {cityOptions.length > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className={styles.backToListButton}
                onClick={() => {
                  setManualOverride(false);
                  onChange({ state, city: "" });
                }}
              >
                Pick from list
              </Button>
            )}
          </div>
        ) : (
          <Select
            value={city || undefined}
            onValueChange={(next) => {
              if (next === OTHER_CITY_VALUE) {
                setManualOverride(true);
                onChange({ state, city: "" });
                return;
              }
              onChange({ state, city: next });
            }}
            disabled={!state}
          >
            <SelectTrigger>
              <SelectValue placeholder={state ? "Select city" : "Pick a state first"} />
            </SelectTrigger>
            <SelectContent>
              {cityOptions.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
              <SelectItem value={OTHER_CITY_VALUE}>Other (type city name)</SelectItem>
            </SelectContent>
          </Select>
        )}
      </div>
    </div>
  );
};
