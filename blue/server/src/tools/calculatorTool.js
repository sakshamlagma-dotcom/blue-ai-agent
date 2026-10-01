// A safe arithmetic evaluator (no eval, no Function constructor).
// Supports + - * / % ^ parentheses, decimal numbers, and unary minus (e.g. "-5 + 3", "10 * -2").

function tokenize(expr) {
  const tokens = [];
  const re = /\s*([()+\-*/%^]|\d+\.?\d*)\s*/g;
  let lastIndex = 0;
  let match;
  while ((match = re.exec(expr))) {
    if (match.index !== lastIndex) {
      throw new Error(`Unexpected character near "${expr.slice(lastIndex, match.index)}"`);
    }
    tokens.push(match[1]);
    lastIndex = re.lastIndex;
  }
  if (lastIndex !== expr.length) {
    throw new Error(`Unexpected trailing characters: "${expr.slice(lastIndex)}"`);
  }
  return markUnaryMinus(tokens);
}

// A "-" is unary (a sign, not subtraction) when it's the first token,
// or immediately follows another operator or an opening parenthesis.
function markUnaryMinus(tokens) {
  const isOperator = (t) => ["+", "-", "*", "/", "%", "^"].includes(t);
  return tokens.map((tok, i) => {
    if (tok !== "-") return tok;
    const prev = tokens[i - 1];
    const isUnary = i === 0 || prev === "(" || isOperator(prev);
    return isUnary ? "u-" : "-";
  });
}

function toRPN(tokens) {
  const output = [];
  const ops = [];
  const prec = { "+": 1, "-": 1, "*": 2, "/": 2, "%": 2, "^": 3, "u-": 4 };
  const rightAssoc = { "^": true, "u-": true };

  for (const tok of tokens) {
    if (/^\d/.test(tok)) {
      output.push(Number(tok));
    } else if (tok === "(") {
      ops.push(tok);
    } else if (tok === ")") {
      while (ops.length && ops[ops.length - 1] !== "(") output.push(ops.pop());
      if (ops.pop() !== "(") throw new Error("Mismatched parentheses.");
    } else {
      while (
        ops.length &&
        ops[ops.length - 1] !== "(" &&
        (prec[ops[ops.length - 1]] > prec[tok] ||
          (prec[ops[ops.length - 1]] === prec[tok] && !rightAssoc[tok]))
      ) {
        output.push(ops.pop());
      }
      ops.push(tok);
    }
  }
  while (ops.length) {
    const op = ops.pop();
    if (op === "(") throw new Error("Mismatched parentheses.");
    output.push(op);
  }
  return output;
}

function evalRPN(rpn) {
  const stack = [];
  for (const tok of rpn) {
    if (typeof tok === "number") {
      stack.push(tok);
      continue;
    }
    if (tok === "u-") {
      const a = stack.pop();
      if (a === undefined) throw new Error("Invalid expression.");
      stack.push(-a);
      continue;
    }
    const b = stack.pop();
    const a = stack.pop();
    if (a === undefined || b === undefined) throw new Error("Invalid expression.");
    switch (tok) {
      case "+": stack.push(a + b); break;
      case "-": stack.push(a - b); break;
      case "*": stack.push(a * b); break;
      case "/":
        if (b === 0) throw new Error("Division by zero.");
        stack.push(a / b);
        break;
      case "%": stack.push(a % b); break;
      case "^": stack.push(Math.pow(a, b)); break;
      default: throw new Error(`Unknown operator "${tok}"`);
    }
  }
  if (stack.length !== 1) throw new Error("Invalid expression.");
  return stack[0];
}

export function evaluateExpression(expr) {
  const tokens = tokenize(expr.replace(/\s+/g, " ").trim());
  const rpn = toRPN(tokens);
  return evalRPN(rpn);
}

export const calculatorTool = {
  name: "calculator",
  description:
    "Evaluate a mathematical arithmetic expression safely (+, -, *, /, %, ^, parentheses). Use for any precise numeric computation instead of guessing.",
  inputSchema: {
    type: "object",
    properties: {
      expression: { type: "string", description: "e.g. '(12 + 8) * 3 / 2'" },
    },
    required: ["expression"],
  },
  async execute({ expression }) {
    if (!expression || typeof expression !== "string") {
      throw new Error("calculator requires a non-empty 'expression' string.");
    }
    const result = evaluateExpression(expression);
    return { expression, result };
  },
};
