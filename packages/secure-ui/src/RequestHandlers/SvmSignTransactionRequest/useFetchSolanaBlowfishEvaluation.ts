import { useCallback, useEffect, useMemo, useState } from "react";

import { useRefreshingQuery } from "../../_hooks/useRefreshingQuery";
import { BlowfishCrossChainResult } from "../../_sharedComponents/BlowfishEvaluation";
import { SolanaScanTransactionsResponse } from "../../_types/BlowfishTypes";

export interface SolanaTxnsScanResult {
  isLoading: boolean;
  error: Error | null;
  evaluation?: SolanaScanTransactionsResponse;
  normalizedEvaluation?: BlowfishCrossChainResult;
}

const REQUEST_TIMEOUT_LIMIT = 10000;
// const REFETCH_INTERVAL_MS = 5000;

export const useFetchSolanaBlowfishEvaluation = (
  apiUrl: string,
  transactions: string[],
  dappUrl: string,
  userAccount: string | undefined,
  onError: (error: Error) => void,
  connectionUrl?: string
): SolanaTxnsScanResult => {
  const origin = getOrigin(dappUrl) || "";

  const queryFn = useCallback(async (): Promise<{
    evaluation?: SolanaScanTransactionsResponse;
    error?: any;
  }> => {
    // Blowfish queries disabled - return empty evaluation for all chains
    return {
      evaluation: {
        aggregated: {
          action: "NONE" as const,
          warnings: [],
          error: null,
          expectedStateChanges: {},
        },
        perTransaction: [],
      } as SolanaScanTransactionsResponse,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify({ transactions, origin, userAccount, connectionUrl })]);

  const txnsEvaluationQuery = useRefreshingQuery(queryFn, 5000);
  const txnsScanResult = useMemo(() => {
    const txnsScanEvaluation = txnsEvaluationQuery.data?.evaluation;
    return {
      isLoading: !txnsEvaluationQuery.isFetched,
      error: txnsEvaluationQuery.data?.error || txnsEvaluationQuery.error,
      evaluation: txnsScanEvaluation,
      normalizedEvaluation: txnsScanEvaluation
        ? normalizeEvaluation(txnsScanEvaluation)
        : undefined,
    };
  }, [txnsEvaluationQuery]);

  const txnsScanResultError = txnsScanResult.error;
  useEffect(() => {
    if (txnsScanResultError) {
      onError(txnsScanResultError);
    }
  }, [onError, txnsScanResultError]);

  return txnsScanResult;
};

const getOrigin = (url?: string): string | undefined => {
  if (!url) {
    return undefined;
  }
  try {
    const _url = new URL(url);
    return _url.origin;
  } catch (err) {
    return undefined;
  }
};

function normalizeEvaluation(
  evaluation: SolanaScanTransactionsResponse
): BlowfishCrossChainResult | undefined {
  try {
    const simulationError = evaluation.aggregated.error?.humanReadableError;
    return {
      action: evaluation.aggregated.action,
      warnings: evaluation.aggregated.warnings,
      errors: [
        ...(simulationError ? [simulationError] : []),
        ...evaluation.perTransaction
          .map((tx) => tx.error?.humanReadableError ?? null)
          .filter<string>(Boolean as any),
      ],
      expectedStateChanges: Object.fromEntries(
        Object.entries(evaluation.aggregated.expectedStateChanges ?? {}).map(
          ([address, changes]) => {
            const normalizedChanges: NonNullable<
              BlowfishCrossChainResult["expectedStateChanges"]
            >[string] = changes.map((change) => {
              const asset =
                "asset" in change.rawInfo.data &&
                change.rawInfo.data.asset.imageUrl
                  ? {
                      isNonFungible:
                        "mint" in change.rawInfo.data.asset
                          ? change.rawInfo.data.asset.metaplexTokenStandard.includes(
                              "non_fungible"
                            ) ||
                            change.rawInfo.data.asset.metaplexTokenStandard ===
                              "unknown"
                          : false,
                      imageUrl: change.rawInfo.data.asset.imageUrl,
                      name:
                        change.rawInfo.data.asset.name +
                        (change.rawInfo.data.asset.symbol &&
                        change.rawInfo.data.asset.symbol !== "Unknown"
                          ? ` (${change.rawInfo.data.asset.symbol})`
                          : ""),
                    }
                  : undefined;
              return {
                humanReadableDiff: change.humanReadableDiff,
                suggestedColor: change.suggestedColor,
                asset,
              };
            });
            return [address, normalizedChanges];
          }
        )
      ),
    };
  } catch (e) {
    console.error(e, "Unexpected Blowfish Schema");
    return undefined;
  }
}
