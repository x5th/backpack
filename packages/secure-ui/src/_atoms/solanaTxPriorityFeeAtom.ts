import { BACKEND_API_URL } from "@coral-xyz/common";
import {
  ComputeBudgetInstruction,
  ComputeBudgetProgram,
} from "@solana/web3.js";
import { selectorFamily } from "recoil";

import { solanaTransactionAtom } from "./solanaTransactionAtom";

const DEFAULT_COMPUTE_UNIT_LIMIT = 200_000;
const DEFAULT_PRIORITY_FEE = BigInt(50_000);

export const solanaTxPriorityFeeAtom = selectorFamily<
  {
    computeUnits: number;
    priorityFee: BigInt;
  },
  {
    tx: string;
  }
>({
  key: "solanaTxPriorityFeeAtom",
  get:
    (request) =>
    async ({ get }) => {
      const { message } = get(solanaTransactionAtom(request));
      const config = {
        computeUnits: DEFAULT_COMPUTE_UNIT_LIMIT,
        priorityFee: DEFAULT_PRIORITY_FEE,
      };
      try {
        const ixs = message.instructions;
        const dynamicMicroLamports = await _getPriorityFee(request.tx);
        config.priorityFee = BigInt(dynamicMicroLamports);

        ixs.forEach((ix) => {
          if (ix.programId.equals(ComputeBudgetProgram.programId)) {
            // SetComputeUnitLimit parsing
            try {
              const decodedUnits =
                ComputeBudgetInstruction.decodeSetComputeUnitLimit(ix);
              config.computeUnits = decodedUnits.units;
            } catch {
              // NOOP
            }
            // SetComputeUnitPrice parsing
            try {
              const decodedParams =
                ComputeBudgetInstruction.decodeSetComputeUnitPrice(ix);
              config.priorityFee = BigInt(decodedParams.microLamports);
            } catch {
              // NOOP
            }
          }
        });
      } catch (err: any) {
        console.error(
          "failed to calculate transaction priority fee",
          err.message
        );
      }

      return config;
    },
});

/**
 * Query for the suggested micro-lamport amount to set
 * as the unit price for the priority fee assignment of a transaction.
 * @param {string} transaction
 * @returns {Promise<number>}
 */
async function _getPriorityFee(transaction: string): Promise<number> {
  console.log("🔍 [_getPriorityFee] BACKEND_API_URL:", BACKEND_API_URL);
  console.log("🔍 [_getPriorityFee] Would call:", `${BACKEND_API_URL}/v2/graphql`);
  console.log("🔍 [_getPriorityFee] Skipping GraphQL query - returning 0");

  // Disabled: Priority fee estimation not needed
  // Just return 0 immediately without making the GraphQL call
  return 0;
}
