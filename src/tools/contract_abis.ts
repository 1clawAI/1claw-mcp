import { z } from "zod";
import type { OneClawClient } from "../client.js";

export function uploadContractAbiTool(client: OneClawClient) {
    return {
        name: "upload_contract_abi" as const,
        description:
            "Upload a contract ABI to the organization's registry. ABIs enable rich policy evaluation with decoded " +
            "transaction data (function names, parameters, token amounts) for Cedar/OPA policies.",
        parameters: z.object({
            chain: z.string().describe("Chain name (e.g. ethereum, base, polygon)"),
            contract_address: z.string().describe("Contract address (0x...)"),
            abi_json: z.unknown().describe("The ABI as a JSON array of function/event definitions"),
            name: z.string().optional().describe("Display name for the contract"),
            description: z.string().optional().describe("Description of what the contract does"),
            token_decimals: z.number().optional().describe("Token decimals for ERC-20 contracts"),
        }),
        execute: async (
            args: {
                chain: string;
                contract_address: string;
                abi_json: unknown;
                name?: string;
                description?: string;
                token_decimals?: number;
            },
            { log }: { log: { info: (msg: string) => void } },
        ) => {
            const res = await client.uploadContractAbi(args);
            log.info(`uploaded contract ABI: ${res.id} (${args.chain}:${args.contract_address})`);
            return `Contract ABI uploaded.\n  ID: ${res.id}\n  Chain: ${res.chain}\n  Address: ${res.contract_address}\n  Name: ${res.name ?? "(unnamed)"}`;
        },
    };
}

export function listContractAbisTool(client: OneClawClient) {
    return {
        name: "list_contract_abis" as const,
        description:
            "List all contract ABIs registered in the organization. Optionally filter by chain.",
        parameters: z.object({
            chain: z.string().optional().describe("Filter by chain name"),
        }),
        execute: async (
            args: { chain?: string },
            { log }: { log: { info: (msg: string) => void } },
        ) => {
            const res = await client.listContractAbis(args.chain);
            log.info(`listed ${res.abis.length} contract ABIs`);
            if (!res.abis.length) return "No contract ABIs found.";
            return JSON.stringify(res.abis, null, 2);
        },
    };
}
