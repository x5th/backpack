import { useEffect, useState } from "react";
import { Blockchain } from "@coral-xyz/common";
import { useTranslation } from "@coral-xyz/i18n";
import {
  blockchainClientAtom,
  useActiveWallet,
  useBlockchainConnectionUrl,
} from "@coral-xyz/recoil";
import {
  BpPrimaryButton,
  StyledText,
  useTheme,
  XStack,
  YStack,
} from "@coral-xyz/tamagui";
import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import { useRecoilValue } from "recoil";

import { ScreenContainer } from "../../../components/ScreenContainer";
import {
  ConfirmationErrorDrawer,
  withTransactionCancelBypass,
} from "../../../components/TransactionConfirmation";
import {
  Routes,
  type SendReviewScreenProps,
} from "../../../navigation/SendNavigator";

export function SendReviewScreen(props: SendReviewScreenProps) {
  return (
    <ScreenContainer loading={<Loading />}>
      <Container {...props} />
    </ScreenContainer>
  );
}

function Loading() {
  return null;
}

function Container({ navigation, route }: SendReviewScreenProps) {
  const { assetId, amount, strAmount, to, tokenSymbol } = route.params;
  const { t } = useTranslation();
  const activeWallet = useActiveWallet();
  const connectionUrl = useBlockchainConnectionUrl(activeWallet.blockchain);
  const blockchainClient = useRecoilValue(
    blockchainClientAtom(activeWallet.blockchain)
  );
  const theme = useTheme();

  const [estimatedComputeUnits, setEstimatedComputeUnits] = useState<
    number | null
  >(null);
  const [simulatingTransaction, setSimulatingTransaction] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const [openDrawer, setOpenDrawer] = useState(false);

  // Simulate transaction on mount to estimate compute units
  useEffect(() => {
    const simulateTransfer = async () => {
      // Only simulate for X1 blockchain
      if (activeWallet.blockchain !== Blockchain.X1) {
        return;
      }

      try {
        setSimulatingTransaction(true);

        // Create a connection to the X1 RPC
        const connection = new Connection(connectionUrl, "confirmed");

        // Create a dummy transaction to simulate
        const fromPubkey = new PublicKey(activeWallet.publicKey);
        const toPubkey = new PublicKey(to.address);

        // For native XNT transfer
        const transaction = new Transaction().add(
          SystemProgram.transfer({
            fromPubkey,
            toPubkey,
            lamports: Number(amount.toString()),
          })
        );

        // Get recent blockhash
        const { blockhash } = await connection.getLatestBlockhash();
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = fromPubkey;

        // Simulate the transaction
        const simulation = await connection.simulateTransaction(transaction);

        if (simulation.value.unitsConsumed) {
          console.log(
            "🧮 [SendReview] Simulated compute units:",
            simulation.value.unitsConsumed
          );
          setEstimatedComputeUnits(simulation.value.unitsConsumed);
        } else {
          console.warn("⚠️ [SendReview] No compute units in simulation");
          setEstimatedComputeUnits(null);
        }
      } catch (error) {
        console.error("❌ [SendReview] Transaction simulation error:", error);
        setEstimatedComputeUnits(null);
      } finally {
        setSimulatingTransaction(false);
      }
    };

    simulateTransfer();
  }, [
    amount,
    to.address,
    activeWallet.blockchain,
    activeWallet.publicKey,
    connectionUrl,
  ]);

  // Calculate estimated cost in lamports (compute units × 10)
  const estimatedCostLamports = estimatedComputeUnits
    ? estimatedComputeUnits * 10
    : null;

  const handleConfirm = async () => {
    try {
      await withTransactionCancelBypass(async () => {
        const txSignature = await blockchainClient.transferAsset({
          amount: amount.toString(),
          assetId,
          from: { publicKey: activeWallet.publicKey },
          to: { ...to, publicKey: to.address },
        });

        const amtVal = Number(strAmount.replaceAll(",", ""));
        navigation.push(Routes.SendConfirmationScreen, {
          amount: amtVal >= 1_000 ? amtVal.toLocaleString() : amtVal.toString(),
          signature: txSignature,
          tokenId: assetId,
        });
      });
    } catch (err: any) {
      setError(err.message);
      setOpenDrawer(true);
    }
  };

  return (
    <>
      <YStack flex={1} justifyContent="space-between">
        <YStack gap="$4" padding="$4">
          {/* Transaction Summary */}
          <YStack
            backgroundColor="$baseBackgroundL1"
            borderRadius={12}
            padding="$4"
            gap="$3"
          >
            <StyledText fontSize="$lg" fontWeight="$semiBold">
              Review Transaction
            </StyledText>

            <XStack justifyContent="space-between">
              <StyledText color="$baseTextMedEmphasis">Amount</StyledText>
              <StyledText fontWeight="$semiBold">
                {strAmount} {tokenSymbol}
              </StyledText>
            </XStack>

            <XStack justifyContent="space-between">
              <StyledText color="$baseTextMedEmphasis">To</StyledText>
              <StyledText fontWeight="$medium" fontSize="$sm">
                {to.walletName ||
                  to.username ||
                  `${to.address.slice(0, 4)}...${to.address.slice(-4)}`}
              </StyledText>
            </XStack>
          </YStack>

          {/* Estimated Cost Section */}
          {activeWallet.blockchain === Blockchain.X1 ? <YStack
            backgroundColor="$baseBackgroundL1"
            borderRadius={12}
            padding="$4"
            >
            <XStack justifyContent="space-between" alignItems="center">
              <StyledText
                color="$baseTextMedEmphasis"
                fontWeight="$bold"
                fontSize="$xs"
                >
                Estimated Cost
              </StyledText>
              <StyledText color="$baseTextMedEmphasis" fontSize="$xs">
                {simulatingTransaction
                    ? "Calculating..."
                    : estimatedCostLamports !== null
                      ? `${estimatedCostLamports.toLocaleString()} lamports`
                      : "—"}
              </StyledText>
            </XStack>
          </YStack> : null}
        </YStack>

        {/* Confirm Button */}
        <YStack paddingHorizontal={12} paddingBottom={16} paddingTop={25}>
          <BpPrimaryButton label={t("confirm")} onPress={handleConfirm} />
        </YStack>
      </YStack>

      <ConfirmationErrorDrawer
        error={error}
        open={openDrawer}
        resetError={() => setError(undefined)}
        setOpen={setOpenDrawer}
      />
    </>
  );
}
