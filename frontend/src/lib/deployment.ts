// Same lookup the generated bindings use: deployments.json is written by
// `stacksdapp deploy` and may not exist before the first deploy.
let deployments: { contracts?: Record<string, { contract_id?: string }> } = {};
try { deployments = require('../generated/deployments.json'); } catch {}

export const handoffContractId: string | null = deployments?.contracts?.handoff?.contract_id ?? null;
