import React from "react";
import { Blockchain } from "@coral-xyz/common";
import {
  type ProviderId,
  TokenBalances as _TokenBalances,
} from "@coral-xyz/data-components";
import { useTranslation } from "@coral-xyz/i18n";
import { useActiveWallet, useIsDevnet } from "@coral-xyz/recoil";
import {
  temporarilyMakeStylesForBrowserExtension,
  XStack,
  YStack,
} from "@coral-xyz/tamagui";
import VisibilityOffOutlinedIcon from "@mui/icons-material/VisibilityOffOutlined";

import { SkeletonRow } from "../../common/TokenTable";
import { TransferWidget } from "../Balances/TransferWidget";

export { TokenDetails } from "./TokenDetails";
import { useNavigation } from "@react-navigation/native";

import { Routes } from "../../../refactor/navigation/WalletsNavigator";

const useStyles = temporarilyMakeStylesForBrowserExtension((theme) => ({
  settings: {
    color: theme.baseTextMedEmphasis.val,
    "&:hover": {
      color: theme.accentBlue.val,
    },
  },
}));

export function TokenBalances() {
  const { t } = useTranslation();
  const classes = useStyles();
  const { publicKey, blockchain } = useActiveWallet();
  const navigation = useNavigation<any>();
  const isDevnet = useIsDevnet();
  const swapEnabled = blockchain === Blockchain.SOLANA && !isDevnet;

  // For X1, use simple hardcoded display without Apollo GraphQL
  if (blockchain === Blockchain.X1) {
    return <X1TokenBalances publicKey={publicKey} />;
  }

  return (
    <_TokenBalances
      address={publicKey}
      providerId={blockchain.toUpperCase() as ProviderId}
      fetchPolicy="cache-and-network"
      onItemClick={async ({
        id,
        displayAmount,
        symbol,
        token,
        tokenAccount,
      }) => {
        navigation.push(Routes.TokensDetailScreen, {
          id,
          displayAmount,
          symbol,
          token,
          tokenAddress: tokenAccount,
        });
      }}
      tableFooterComponent={
        <XStack
          className={classes.settings}
          ai="center"
          alignSelf="center"
          cursor="pointer"
          gap={4}
          jc="center"
          marginTop={12}
          marginBottom={8}
          maxWidth="fit-content"
          onPress={() => {
            navigation.push(Routes.TokensDisplayManagementScreen);
          }}
        >
          <VisibilityOffOutlinedIcon sx={{ fontSize: 18 }} />
          <p style={{ margin: 0 }}>{t("manage_token_display")}</p>
        </XStack>
      }
      tableLoaderComponent={<TokenBalanceTableLoader />}
      widgets={
        <div>
          <TransferWidget
            rampEnabled
            blockchain={blockchain}
            publicKey={publicKey}
            swapEnabled={swapEnabled}
          />
        </div>
      }
    />
  );
}

function X1TokenBalances({ publicKey }: { publicKey: string }) {
  const [balance, setBalance] = React.useState<number | null>(null);
  const { blockchain } = useActiveWallet();

  React.useEffect(() => {
    const fetchBalance = async () => {
      try {
        const { Connection, PublicKey, LAMPORTS_PER_SOL } = await import(
          "@solana/web3.js"
        );
        const connection = new Connection(
          "https://rpc.mainnet.x1.xyz",
          "confirmed"
        );
        const pubkey = new PublicKey(publicKey);
        const bal = await connection.getBalance(pubkey);
        setBalance(bal / LAMPORTS_PER_SOL);
      } catch (e) {
        console.error("Error fetching X1 balance:", e);
        setBalance(0);
      }
    };
    fetchBalance();
  }, [publicKey]);

  if (balance === null) {
    return <TokenBalanceTableLoader />;
  }

  const balanceUSD = balance * 1.0; // $1.00 per XNT

  return (
    <YStack>
      <div>
        <TransferWidget
          rampEnabled={false}
          blockchain={blockchain}
          publicKey={publicKey}
          swapEnabled={false}
        />
      </div>
      <div style={{ padding: 16 }}>
        <div style={{ fontSize: 24, fontWeight: "bold" }}>
          ${balanceUSD.toFixed(2)}
        </div>
        <div style={{ fontSize: 14, color: "#888", marginTop: 4 }}>
          {balance.toFixed(4)} XNT
        </div>
      </div>
      <div style={{ padding: 16, borderTop: "1px solid #eee" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <img
            src="https://x1.xyz/_next/image?url=%2Fx1-logo.png&w=96&q=75&dpl=dpl_CgqrxgM4ijNMynKBvmQG3HnYr6yY"
            alt="XNT"
            style={{ width: 40, height: 40, borderRadius: 20 }}
          />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 500 }}>XNT</div>
            <div style={{ fontSize: 12, color: "#888" }}>X1 Native Token</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontWeight: 500 }}>{balance.toFixed(4)}</div>
            <div style={{ fontSize: 12, color: "#888" }}>
              ${balanceUSD.toFixed(2)}
            </div>
          </div>
        </div>
      </div>
    </YStack>
  );
}

export function TokenBalanceTableLoader() {
  return (
    <div style={{ borderRadius: 16, width: "100%" }}>
      <YStack>
        <SkeletonRow />
        <SkeletonRow />
        <SkeletonRow />
        <SkeletonRow />
      </YStack>
    </div>
  );
}
