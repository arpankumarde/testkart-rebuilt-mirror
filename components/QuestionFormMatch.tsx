import { Plus, X } from "lucide-react";
import { FormControl, FormItem, FormMessage } from "./Form";
import { Input } from "./Input";
import { Button } from "./Button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./Select";
import styles from "./QuestionForm.module.css";

interface QuestionFormMatchProps {
  form: any;
}

type MatchData = {
  leftItems: string[];
  rightItems: string[];
  correctMatches: Record<string, string>;
};

const EMPTY = "__empty";
const letterFor = (index: number) => String.fromCharCode(65 + index);

// The key is stored by position, so removing an item has to shift every
// position after it or the remaining pairs point at the wrong items.
export const removeMatchLeftItem = (data: MatchData, removed: number): MatchData => {
  const correctMatches: Record<string, string> = {};
  Object.entries(data.correctMatches ?? {}).forEach(([key, value]) => {
    const index = Number(key);
    if (index === removed) return;
    correctMatches[String(index > removed ? index - 1 : index)] = value;
  });
  return { ...data, leftItems: data.leftItems.filter((_, i) => i !== removed), correctMatches };
};

export const removeMatchRightItem = (data: MatchData, removed: number): MatchData => {
  const correctMatches: Record<string, string> = {};
  Object.entries(data.correctMatches ?? {}).forEach(([key, value]) => {
    const index = Number(value);
    if (index === removed) return;
    correctMatches[key] = String(index > removed ? index - 1 : index);
  });
  return { ...data, rightItems: data.rightItems.filter((_, i) => i !== removed), correctMatches };
};

export const QuestionFormMatch = ({ form }: QuestionFormMatchProps) => {
  const matchData: MatchData = form.values.matchData ?? { leftItems: ["", ""], rightItems: ["", ""], correctMatches: {} };
  const { leftItems, rightItems } = matchData;
  const correctMatches = matchData.correctMatches ?? {};

  const updateMatchData = (update: (current: MatchData) => MatchData) =>
    form.setValues((p: any) => ({
      ...p,
      matchData: update(p.matchData ?? { leftItems: ["", ""], rightItems: ["", ""], correctMatches: {} }),
    }));

  const setItem = (column: "leftItems" | "rightItems", index: number, value: string) =>
    updateMatchData((current) => {
      const items = [...current[column]];
      items[index] = value;
      return { ...current, [column]: items };
    });

  const setMatch = (leftIndex: number, value: string) =>
    updateMatchData((current) => {
      const next = { ...(current.correctMatches ?? {}) };
      if (value === EMPTY) {
        delete next[String(leftIndex)];
      } else {
        next[String(leftIndex)] = value;
      }
      return { ...current, correctMatches: next };
    });

  return (
    <div className={styles.matchEditor}>
      <div className={styles.matchColumn}>
        <div className={styles.matchColumnHead}>
          <span>Column A</span>
          <span className={styles.matchColumnHint}>Correct match</span>
        </div>
        {leftItems.map((item, index) => (
          <div key={index} className={styles.matchRow}>
            <span className={styles.matchItemLabel}>{index + 1}.</span>
            <FormItem name={`matchData.leftItems.${index}`} className={styles.matchItemField}>
              <FormControl>
                <Input
                  value={item}
                  aria-label={`Column A item ${index + 1}`}
                  placeholder={`Item ${index + 1}`}
                  onChange={(e) => setItem("leftItems", index, e.target.value)}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
            <FormItem name={`matchData.correctMatches.${index}`} className={styles.matchSelectField}>
              <Select value={correctMatches[String(index)] ?? EMPTY} onValueChange={(value) => setMatch(index, value)}>
                <SelectTrigger className={styles.matchSelectTrigger} aria-label={`Correct match for item ${index + 1}`}>
                  <SelectValue placeholder="Match" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={EMPTY}>Not set</SelectItem>
                  {rightItems.map((rightItem, rightIndex) => (
                    <SelectItem key={rightIndex} value={String(rightIndex)}>
                      {letterFor(rightIndex)}. {rightItem || `Item ${letterFor(rightIndex)}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
            {leftItems.length > 2 && (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Remove column A item ${index + 1}`}
                onClick={() => updateMatchData((current) => removeMatchLeftItem(current, index))}
              >
                <X size={14} />
              </Button>
            )}
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={styles.addButton}
          onClick={() => updateMatchData((current) => ({ ...current, leftItems: [...current.leftItems, ""] }))}
        >
          <Plus size={14} /> Add item to column A
        </Button>
      </div>

      <div className={styles.matchColumn}>
        <div className={styles.matchColumnHead}>
          <span>Column B</span>
        </div>
        {rightItems.map((item, index) => (
          <div key={index} className={styles.matchRow}>
            <span className={styles.matchItemLabel}>{letterFor(index)}.</span>
            <FormItem name={`matchData.rightItems.${index}`} className={styles.matchItemField}>
              <FormControl>
                <Input
                  value={item}
                  aria-label={`Column B item ${letterFor(index)}`}
                  placeholder={`Item ${letterFor(index)}`}
                  onChange={(e) => setItem("rightItems", index, e.target.value)}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
            {rightItems.length > 2 && (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Remove column B item ${letterFor(index)}`}
                onClick={() => updateMatchData((current) => removeMatchRightItem(current, index))}
              >
                <X size={14} />
              </Button>
            )}
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={styles.addButton}
          onClick={() => updateMatchData((current) => ({ ...current, rightItems: [...current.rightItems, ""] }))}
        >
          <Plus size={14} /> Add item to column B
        </Button>
      </div>
    </div>
  );
};
