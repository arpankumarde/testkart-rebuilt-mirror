import React, { useState, useEffect, useCallback, useRef } from "react";
import { Calculator, Minimize2, X, Delete } from "lucide-react";
import * as math from "mathjs";
import { Button } from "./Button";
import styles from "./ScientificCalculator.module.css";

interface ScientificCalculatorProps {
  isEnabled: boolean;
  className?: string;
}

export const ScientificCalculator: React.FC<ScientificCalculatorProps> = ({
  isEnabled,
  className,
}) => {
  const [isMaximized, setIsMaximized] = useState(false);
  const [display, setDisplay] = useState("0");
  const [expression, setExpression] = useState("");
  const [memory, setMemory] = useState<number>(0);
  const [isNewCalculation, setIsNewCalculation] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const calculatorRef = useRef<HTMLDivElement>(null);

  // If not enabled, don't render anything
  if (!isEnabled) return null;

  const handleNumber = (num: string) => {
    if (error) setError(null);
    
    if (isNewCalculation) {
      setDisplay(num);
      setIsNewCalculation(false);
    } else {
      setDisplay(display === "0" ? num : display + num);
    }
  };

  const handleOperator = (op: string) => {
    if (error) setError(null);
    setIsNewCalculation(false);
    
    // Prevent multiple operators in a row if not needed, but mathjs handles expressions well
    // Just append to display for now
    if (display === "0" && op === "-") {
        setDisplay("-");
        return;
    }
    
    setDisplay(display + op);
  };

  const handleDecimal = () => {
    if (error) setError(null);
    if (isNewCalculation) {
      setDisplay("0.");
      setIsNewCalculation(false);
      return;
    }
    
    // Simple check to prevent multiple decimals in the current number segment
    // This is a basic check, a full parser would be more robust but complex
    const parts = display.split(/[\+\-\*\/]/);
    const currentNumber = parts[parts.length - 1];
    if (!currentNumber.includes(".")) {
      setDisplay(display + ".");
    }
  };

  const handleClear = () => {
    setDisplay("0");
    setExpression("");
    setError(null);
    setIsNewCalculation(true);
  };

  const handleDelete = () => {
    if (error) {
      handleClear();
      return;
    }
    if (display.length === 1) {
      setDisplay("0");
      setIsNewCalculation(true);
    } else {
      setDisplay(display.slice(0, -1));
    }
  };

  const handleCalculate = () => {
    try {
      // Replace visual operators with mathjs operators
      let evalString = display
        .replace(/×/g, "*")
        .replace(/÷/g, "/")
        .replace(/π/g, "pi")
        .replace(/e/g, "e");

      // Handle implicit multiplication for parentheses e.g. 5(2) -> 5*(2)
      // This is a simple regex replacement, might not cover all edge cases
      evalString = evalString.replace(/(\d)\(/g, '$1*(');

      const result = math.evaluate(evalString);
      
      // Format result to avoid long decimals
      const formattedResult = math.format(result, { precision: 10 });
      
      setExpression(display + " =");
      setDisplay(String(formattedResult));
      setIsNewCalculation(true);
    } catch (err) {
      setError("Error");
      setIsNewCalculation(true);
    }
  };

  const handleScientific = (func: string) => {
    if (error) setError(null);
    
    let newDisplay = display;
    if (isNewCalculation && display !== "0") {
        // If we just calculated something, use that result
        newDisplay = display;
        setIsNewCalculation(false);
    } else if (isNewCalculation) {
        newDisplay = "";
        setIsNewCalculation(false);
    }

    switch (func) {
      case "sin":
      case "cos":
      case "tan":
      case "log": // base 10
      case "ln": // natural log
      case "sqrt":
        // If display is 0, replace it. Otherwise append.
        if (newDisplay === "0") {
            setDisplay(`${func}(`);
        } else {
            // Check if the last char is a number, if so add multiplication
            const lastChar = newDisplay.slice(-1);
            if (/\d/.test(lastChar)) {
                setDisplay(newDisplay + `*${func}(`);
            } else {
                setDisplay(newDisplay + `${func}(`);
            }
        }
        break;
      case "x^2":
        setDisplay(newDisplay + "^2");
        break;
      case "x^y":
        setDisplay(newDisplay + "^");
        break;
      case "!":
        setDisplay(newDisplay + "!");
        break;
      case "pi":
        if (newDisplay === "0") setDisplay("π");
        else setDisplay(newDisplay + "π");
        break;
      case "e":
        if (newDisplay === "0") setDisplay("e");
        else setDisplay(newDisplay + "e");
        break;
      case "(":
      case ")":
        if (newDisplay === "0") setDisplay(func);
        else setDisplay(newDisplay + func);
        break;
    }
  };

  const handleMemory = (action: "M+" | "M-" | "MR" | "MC") => {
    try {
        const currentValue = parseFloat(display);
        if (isNaN(currentValue)) return;

        switch (action) {
            case "M+":
                setMemory(memory + currentValue);
                setIsNewCalculation(true);
                break;
            case "M-":
                setMemory(memory - currentValue);
                setIsNewCalculation(true);
                break;
            case "MR":
                setDisplay(String(memory));
                setIsNewCalculation(true);
                break;
            case "MC":
                setMemory(0);
                break;
        }
    } catch (e) {
        // ignore memory errors
    }
  };

  // Keyboard support
  useEffect(() => {
    if (!isMaximized) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key;

      // Numbers
      if (/\d/.test(key)) {
        e.preventDefault();
        handleNumber(key);
      }
      // Operators
      else if (["+", "-", "*", "/", "(", ")", "^", "!"].includes(key)) {
        e.preventDefault();
        const opMap: Record<string, string> = { "*": "×", "/": "÷" };
        handleOperator(opMap[key] || key);
      }
      // Decimal
      else if (key === ".") {
        e.preventDefault();
        handleDecimal();
      }
      // Enter/Return for equals
      else if (key === "Enter" || key === "=") {
        e.preventDefault();
        handleCalculate();
      }
      // Backspace
      else if (key === "Backspace") {
        e.preventDefault();
        handleDelete();
      }
      // Escape to clear
      else if (key === "Escape") {
        e.preventDefault();
        handleClear();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isMaximized, display, isNewCalculation, error]);

  if (!isMaximized) {
    return (
      <button
        className={`${styles.minimizedButton} ${className || ""}`}
        onClick={() => setIsMaximized(true)}
        aria-label="Open Scientific Calculator"
        title="Open Calculator"
      >
        <Calculator size={24} />
      </button>
    );
  }

  return (
    <div 
        className={`${styles.calculatorContainer} ${className || ""}`}
        ref={calculatorRef}
        role="dialog"
        aria-label="Scientific Calculator"
    >
      <div className={styles.header}>
        <span className={styles.title}>Scientific Calculator</span>
        <button
          className={styles.minimizeButton}
          onClick={() => setIsMaximized(false)}
          aria-label="Minimize Calculator"
        >
          <Minimize2 size={18} />
        </button>
      </div>

      <div className={styles.displayContainer}>
        <div className={styles.expressionDisplay}>{expression}</div>
        <div className={styles.mainDisplay}>{error || display}</div>
      </div>

      <div className={styles.keypad}>
        {/* Scientific Row 1 */}
        <button className={styles.sciBtn} onClick={() => handleScientific("sin")}>sin</button>
        <button className={styles.sciBtn} onClick={() => handleScientific("cos")}>cos</button>
        <button className={styles.sciBtn} onClick={() => handleScientific("tan")}>tan</button>
        <button className={styles.sciBtn} onClick={() => handleScientific("log")}>log</button>
        <button className={styles.sciBtn} onClick={() => handleScientific("ln")}>ln</button>
        
        {/* Scientific Row 2 */}
        <button className={styles.sciBtn} onClick={() => handleScientific("sqrt")}>√</button>
        <button className={styles.sciBtn} onClick={() => handleScientific("x^2")}>x²</button>
        <button className={styles.sciBtn} onClick={() => handleScientific("x^y")}>xʸ</button>
        <button className={styles.sciBtn} onClick={() => handleScientific("!")}>n!</button>
        <button className={styles.sciBtn} onClick={() => handleScientific("pi")}>π</button>

        {/* Scientific Row 3 */}
        <button className={styles.sciBtn} onClick={() => handleScientific("e")}>e</button>
        <button className={styles.sciBtn} onClick={() => handleScientific("(")}>(</button>
        <button className={styles.sciBtn} onClick={() => handleScientific(")")}>)</button>
        <button className={styles.sciBtn} onClick={() => handleMemory("MC")}>MC</button>
        <button className={styles.sciBtn} onClick={() => handleMemory("MR")}>MR</button>

        {/* Main Keypad Row 1 */}
        <button className={styles.numBtn} onClick={() => handleNumber("7")}>7</button>
        <button className={styles.numBtn} onClick={() => handleNumber("8")}>8</button>
        <button className={styles.numBtn} onClick={() => handleNumber("9")}>9</button>
        <button className={styles.opBtn} onClick={handleDelete} aria-label="Delete"><Delete size={16} /></button>
        <button className={styles.opBtn} onClick={handleClear} aria-label="Clear All">AC</button>

        {/* Main Keypad Row 2 */}
        <button className={styles.numBtn} onClick={() => handleNumber("4")}>4</button>
        <button className={styles.numBtn} onClick={() => handleNumber("5")}>5</button>
        <button className={styles.numBtn} onClick={() => handleNumber("6")}>6</button>
        <button className={styles.opBtn} onClick={() => handleOperator("×")}>×</button>
        <button className={styles.opBtn} onClick={() => handleOperator("÷")}>÷</button>

        {/* Main Keypad Row 3 */}
        <button className={styles.numBtn} onClick={() => handleNumber("1")}>1</button>
        <button className={styles.numBtn} onClick={() => handleNumber("2")}>2</button>
        <button className={styles.numBtn} onClick={() => handleNumber("3")}>3</button>
        <button className={styles.opBtn} onClick={() => handleOperator("+")}>+</button>
        <button className={styles.opBtn} onClick={() => handleOperator("-")}>-</button>

        {/* Main Keypad Row 4 */}
        <button className={styles.numBtn} onClick={() => handleNumber("0")}>0</button>
        <button className={styles.numBtn} onClick={handleDecimal}>.</button>
        <button className={styles.sciBtn} onClick={() => handleMemory("M+")}>M+</button>
        <button className={styles.sciBtn} onClick={() => handleMemory("M-")}>M-</button>
        <button className={`${styles.opBtn} ${styles.equalsBtn}`} onClick={handleCalculate}>=</button>
      </div>
    </div>
  );
};