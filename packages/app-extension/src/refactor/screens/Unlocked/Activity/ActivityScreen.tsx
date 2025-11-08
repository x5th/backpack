import { useRef } from "react";
import { useActiveWallet } from "@coral-xyz/recoil";
import { useFocusEffect } from "@react-navigation/native";

import { Transactions } from "../../../../components/Unlocked/Transactions";
import { ScreenContainer } from "../../../components/ScreenContainer";
import { useMountOnFocusWallet } from "../../../hooks/useMountOnFocus";
import type { ActivityScreenProps } from "../../../navigation/TabsNavigator";
import { setActivityRefreshFn } from "../../../navigation/TabsNavigator";

export function ActivityScreen(_props: ActivityScreenProps) {
  return useMountOnFocusWallet(
    <ScreenContainer loading={<Loading />} noScrollbar>
      <Container />
    </ScreenContainer>,
    <Loading />
  );
}

function Loading() {
  // TODO.
  return null;
}

function Container() {
  const activeWallet = useActiveWallet();
  const refreshFnRef = useRef<(() => void) | null>(null);

  // Capture the refresh function from ActivityPage
  const handleRefreshReady = (refreshFn: () => void) => {
    refreshFnRef.current = refreshFn;
    // Also register it globally for the tab bar icon
    setActivityRefreshFn(refreshFn);
  };

  // Trigger refresh when screen comes into focus
  useFocusEffect(() => {
    if (refreshFnRef.current) {
      console.log("🔄 Activity tab focused - refreshing transactions");
      refreshFnRef.current();
    }
  });

  return (
    <Transactions ctx={activeWallet} onRefreshReady={handleRefreshReady} />
  );
}
