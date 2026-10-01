const { ACTIONS, riskRequiresConfirmation } = require("./actionSchema");

/**
 * Validates and normalizes a raw plan object (as parsed from the model's JSON output).
 * Never trusts the model's own riskLevel/requiresConfirmation — those are always
 * re-derived from our own fixed action table.
 *
 * @returns {{ ok: true, plan: object } | { ok: false, reason: string }}
 */
function validatePlan(raw) {
  if (!raw || typeof raw !== "object") {
    return { ok: false, reason: "Model did not return a JSON object." };
  }

  const { action, params } = raw;

  if (!action || typeof action !== "string") {
    return { ok: false, reason: "Plan is missing a valid 'action' field." };
  }

  const actionDef = ACTIONS[action];
  if (!actionDef) {
    return { ok: false, reason: `"${action}" is not an allowed action.` };
  }

  const parseResult = actionDef.schema.safeParse(params || {});
  if (!parseResult.success) {
    return {
      ok: false,
      reason: `Invalid parameters for "${action}": ${parseResult.error.issues
        .map((i) => `${i.path.join(".")} — ${i.message}`)
        .join("; ")}`,
    };
  }

  return {
    ok: true,
    plan: {
      action,
      params: parseResult.data,
      riskLevel: actionDef.riskLevel,
      requiresConfirmation: riskRequiresConfirmation(actionDef.riskLevel),
    },
  };
}

module.exports = { validatePlan };
