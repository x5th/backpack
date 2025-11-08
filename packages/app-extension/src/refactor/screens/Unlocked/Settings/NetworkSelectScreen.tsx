import { Blockchain } from "@coral-xyz/common";
import {
  blockchainConfigAtom,
  blockchainConnectionUrl,
  useActiveWallet,
  useBackgroundClient,
} from "@coral-xyz/recoil";
import { useTheme } from "@coral-xyz/tamagui";
import { Check } from "@mui/icons-material";
import { useRecoilValue } from "recoil";

import { SettingsList } from "../../../../components/common/Settings/List";
import { changeNetwork } from "../../../../components/Unlocked/Settings/Preferences/Blockchains/ConnectionSwitch";
import { ScreenContainer } from "../../../components/ScreenContainer";
import type {
  Routes,
  SettingsScreenProps,
} from "../../../navigation/SettingsNavigator";

export function NetworkSelectScreen(
  _props: SettingsScreenProps<Routes.NetworkSelectScreen>
) {
  return (
    <ScreenContainer loading={<Loading />}>
      <Container />
    </ScreenContainer>
  );
}

function Loading() {
  return null;
}

function Checkmark() {
  const theme = useTheme();
  return (
    <Check
      style={{
        color: theme.accentBlue.val,
      }}
    />
  );
}

function Container() {
  const activeWallet = useActiveWallet();
  const background = useBackgroundClient();
  const currentUrl = useRecoilValue(
    blockchainConnectionUrl(activeWallet.blockchain)
  );
  const blockchainConfig = useRecoilValue(
    blockchainConfigAtom(activeWallet.blockchain)
  );

  // Only show for X1 blockchain
  if (activeWallet.blockchain !== Blockchain.X1 || !blockchainConfig) {
    return null;
  }

  const menuItems = Object.fromEntries(
    new Map(
      Object.entries(blockchainConfig.RpcConnectionUrls).map(
        ([, { name, url, chainId }]) => [
          name,
          {
            onClick: () => {
              changeNetwork(background, activeWallet.blockchain, url, chainId);
            },
            detail: currentUrl === url ? <Checkmark /> : null,
          },
        ]
      )
    )
  );

  return <SettingsList menuItems={menuItems} />;
}
