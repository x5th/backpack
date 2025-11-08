import { Loader } from "@coral-xyz/tamagui";

import { ImportMnemonic } from "../../../../components/Unlocked/Settings/AddConnectWallet/ImportMnemonic";
import { ScreenContainer } from "../../../components/ScreenContainer";
import type {
  Routes,
  SettingsScreenProps,
} from "../../../navigation/SettingsNavigator";

export function WalletAddHardwareScreen(
  props: SettingsScreenProps<Routes.WalletAddHardwareScreen>
) {
  return (
    <ScreenContainer loading={<Loading />}>
      <Container {...props} />
    </ScreenContainer>
  );
}

function Loading() {
  return <Loader />;
}

function Container({
  route: {
    params: { blockchain },
  },
}: SettingsScreenProps<Routes.WalletAddHardwareScreen>) {
  return (
    <ImportMnemonic blockchain={blockchain} ledger inputMnemonic={false} />
  );
}
