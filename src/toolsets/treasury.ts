import type { ToolsetModule } from "./types.js";
import { treasuryListProposalsTool } from "../tools/treasury_list_proposals.js";
import { treasuryProposeTool } from "../tools/treasury_propose.js";
import { treasurySignProposalTool } from "../tools/treasury_sign_proposal.js";

/** treasury: treasury_signer on the token exchange, else opt-in. */
export const treasuryToolset: ToolsetModule = {
    id: "treasury",
    gate: "treasury_signer on the token exchange, else opt-in",
    tools: [
        treasuryProposeTool,
        treasuryListProposalsTool,
        treasurySignProposalTool,
    ],
};
