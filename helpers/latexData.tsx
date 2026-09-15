export type FormulaItem = {
  label: string;
  latex: string;
  keywords?: string[]; // Extra keywords for search
};

export type FormulaCategory = {
  id: string;
  label: string;
  items: FormulaItem[];
  subsections?: {
    label: string;
    items: FormulaItem[];
  }[];
};

export const latexData: FormulaCategory[] = [
  {
    id: "basic",
    label: "Basic Syntax",
    items: [
      { label: "Fraction", latex: "\\frac{a}{b}" },
      { label: "Exponent (Superscript)", latex: "x^2" },
      { label: "Complex Exponent", latex: "x^{10}" },
      { label: "Subscript", latex: "x_1" },
      { label: "Complex Subscript", latex: "x_{10}" },
      { label: "Square Root", latex: "\\sqrt{x}" },
      { label: "Nth Root", latex: "\\sqrt[n]{x}" },
      { label: "Parentheses", latex: "(x+y)" },
      { label: "Brackets", latex: "[x+y]" },
      { label: "Curly Braces", latex: "\\{x+y\\}" },
      { label: "Angle Brackets", latex: "\\langle x,y \\rangle" },
      { label: "Absolute Value", latex: "|x|" },
      { label: "Text in Math", latex: "\\text{hello}" },
      { label: "Space", latex: "\\quad" },
    ],
  },
  {
    id: "symbols",
    label: "Symbols",
    items: [],
    subsections: [
      {
        label: "Greek Letters",
        items: [
          { label: "Alpha", latex: "\\alpha" },
          { label: "Beta", latex: "\\beta" },
          { label: "Gamma", latex: "\\gamma" },
          { label: "Delta", latex: "\\delta" },
          { label: "Theta", latex: "\\theta" },
          { label: "Pi", latex: "\\pi" },
          { label: "Sigma", latex: "\\sigma" },
          { label: "Omega", latex: "\\omega" },
          { label: "Epsilon", latex: "\\epsilon" },
          { label: "Lambda", latex: "\\lambda" },
          { label: "Mu", latex: "\\mu" },
        ],
      },
      {
        label: "Greek Capitals",
        items: [
          { label: "Gamma", latex: "\\Gamma" },
          { label: "Delta", latex: "\\Delta" },
          { label: "Theta", latex: "\\Theta" },
          { label: "Pi", latex: "\\Pi" },
          { label: "Sigma", latex: "\\Sigma" },
          { label: "Omega", latex: "\\Omega" },
        ],
      },
      {
        label: "Operators",
        items: [
          { label: "Plus", latex: "+" },
          { label: "Minus", latex: "-" },
          { label: "Times", latex: "\\times" },
          { label: "Divide", latex: "\\div" },
          { label: "Plus-Minus", latex: "\\pm" },
          { label: "Minus-Plus", latex: "\\mp" },
          { label: "Dot Product", latex: "\\cdot" },
          { label: "Asterisk", latex: "\\ast" },
        ],
      },
      {
        label: "Relations",
        items: [
          { label: "Equals", latex: "=" },
          { label: "Not Equals", latex: "\\neq" },
          { label: "Less Than", latex: "<" },
          { label: "Greater Than", latex: ">" },
          { label: "Less or Equal", latex: "\\leq" },
          { label: "Greater or Equal", latex: "\\geq" },
          { label: "Approximate", latex: "\\approx" },
          { label: "Equivalent", latex: "\\equiv" },
          { label: "Proportional", latex: "\\propto" },
        ],
      },
      {
        label: "Logic & Sets",
        items: [
          { label: "And", latex: "\\land" },
          { label: "Or", latex: "\\lor" },
          { label: "Not", latex: "\\neg" },
          { label: "Implies", latex: "\\implies" },
          { label: "If and only if", latex: "\\iff" },
          { label: "For all", latex: "\\forall" },
          { label: "Exists", latex: "\\exists" },
          { label: "In set", latex: "\\in" },
          { label: "Not in set", latex: "\\notin" },
          { label: "Subset", latex: "\\subset" },
          { label: "Subset or Equal", latex: "\\subseteq" },
          { label: "Union", latex: "\\cup" },
          { label: "Intersection", latex: "\\cap" },
          { label: "Empty Set", latex: "\\emptyset" },
          { label: "Infinity", latex: "\\infty" },
        ],
      },
      {
        label: "Arrows",
        items: [
          { label: "Right Arrow", latex: "\\rightarrow" },
          { label: "Left Arrow", latex: "\\leftarrow" },
          { label: "Left-Right Arrow", latex: "\\leftrightarrow" },
          { label: "Double Right Arrow", latex: "\\Rightarrow" },
          { label: "Double Left Arrow", latex: "\\Leftarrow" },
        ],
      },
    ],
  },
  {
    id: "formulas",
    label: "Common Formulas",
    items: [],
    subsections: [
      {
        label: "Mathematics",
        items: [
          { label: "Quadratic Formula", latex: "x = \\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}" },
          { label: "Pythagorean Theorem", latex: "a^2 + b^2 = c^2" },
          { label: "Area of Circle", latex: "A = \\pi r^2" },
          { label: "Binomial Expansion", latex: "(a+b)^2 = a^2 + 2ab + b^2" },
          { label: "Summation", latex: "\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}" },
          { label: "Slope Formula", latex: "m = \\frac{y_2 - y_1}{x_2 - x_1}" },
        ],
      },
      {
        label: "Physics",
        items: [
          { label: "Newton's 2nd Law", latex: "F = ma" },
          { label: "Mass-Energy Equivalence", latex: "E = mc^2" },
          { label: "Kinetic Energy", latex: "KE = \\frac{1}{2}mv^2" },
          { label: "Ohm's Law", latex: "V = IR" },
          { label: "Wave Equation", latex: "v = f\\lambda" },
          { label: "Gravitational Force", latex: "F = G\\frac{m_1m_2}{r^2}" },
        ],
      },
      {
        label: "Chemistry",
        items: [
          { label: "Ideal Gas Law", latex: "PV = nRT" },
          { label: "pH Formula", latex: "pH = -\\log[H^+]" },
          { label: "Molarity", latex: "M = \\frac{n}{V}" },
          { label: "Density", latex: "\\rho = \\frac{m}{V}" },
        ],
      },
    ],
  },
  {
    id: "advanced",
    label: "Advanced",
    items: [
      { label: "Integral", latex: "\\int_{a}^{b} x^2 dx" },
      { label: "Derivative", latex: "\\frac{d}{dx}f(x)" },
      { label: "Partial Derivative", latex: "\\frac{\\partial f}{\\partial x}" },
      { label: "Limit", latex: "\\lim_{x \\to 0} \\frac{\\sin x}{x}" },
      { label: "Summation", latex: "\\sum_{n=1}^{\\infty} 2^{-n} = 1" },
      { label: "Product", latex: "\\prod_{i=1}^{n} x_i" },
      { label: "Matrix (2x2)", latex: "\\begin{matrix} a & b \\\\ c & d \\end{matrix}" },
      { label: "Cases", latex: "f(x) = \\begin{cases} x & x \\ge 0 \\\\ -x & x < 0 \\end{cases}" },
      { label: "Sine", latex: "\\sin(\\theta)" },
      { label: "Cosine", latex: "\\cos(\\theta)" },
      { label: "Tangent", latex: "\\tan(\\theta)" },
      { label: "Logarithm", latex: "\\log_{10}(x)" },
      { label: "Natural Log", latex: "\\ln(x)" },
      { label: "Vector", latex: "\\vec{v}" },
      { label: "Hat", latex: "\\hat{i}" },
      { label: "Bar", latex: "\\bar{x}" },
    ],
  },
];