import { Blockchain } from "@coral-xyz/common";
import React, { createContext, useContext, useEffect, useState } from "react";

interface X1Balance {
  balance: number;
  balanceUSD: number;
}

interface X1DataContextType {
  getBalance: (publicKey: string) => Promise<X1Balance>;
  balanceCache: Map<string, X1Balance>;
}

const X1DataContext = createContext<X1DataContextType | null>(null);

export function X1DataProvider({ children }: { children: React.ReactNode }) {
  const [balanceCache, setBalanceCache] = useState<Map<string, X1Balance>>(
    new Map()
  );

  const getBalance = async (publicKey: string): Promise<X1Balance> => {
    // Check cache first
    if (balanceCache.has(publicKey)) {
      return balanceCache.get(publicKey)!;
    }

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
      const xntAmount = bal / LAMPORTS_PER_SOL;

      const result = {
        balance: xntAmount,
        balanceUSD: xntAmount * 1.0, // $1.00 per XNT
      };

      // Update cache
      setBalanceCache((prev) => new Map(prev).set(publicKey, result));

      return result;
    } catch (e) {
      console.error("Error fetching X1 balance:", e);
      return { balance: 0, balanceUSD: 0 };
    }
  };

  return (
    <X1DataContext.Provider value={{ getBalance, balanceCache }}>
      {children}
    </X1DataContext.Provider>
  );
}

export function useX1Data() {
  const context = useContext(X1DataContext);
  if (!context) {
    throw new Error("useX1Data must be used within X1DataProvider");
  }
  return context;
}

// Helper to create token data in Apollo-compatible format
export function createX1TokenData(
  publicKey: string,
  balance: number,
  assetId?: string
) {
  return {
    id: assetId || "x1-native",
    address: "11111111111111111111111111111111",
    amount: balance.toString(),
    decimals: 9,
    displayAmount: balance.toFixed(4),
    token: "11111111111111111111111111111111",
    tokenListEntry: {
      id: "xnt",
      address: "11111111111111111111111111111111",
      decimals: 9,
      logo: "https://x1.xyz/_next/image?url=%2Fx1-logo.png&w=96&q=75&dpl=dpl_CgqrxgM4ijNMynKBvmQG3HnYr6yY",
      name: "XNT",
      symbol: "XNT",
    },
    marketData: {
      id: "xnt-market",
      price: 1.0,
      value: balance * 1.0,
      percentChange: 0,
      valueChange: 0,
    },
  };
}
