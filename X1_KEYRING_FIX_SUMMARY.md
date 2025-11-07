# X1 Blockchain Keyring Lookup Fix - Summary

## Problem Statement

When attempting to send XNT tokens on the X1 blockchain using the Backpack wallet extension, users encountered the error:

```
Error: no keyring for solana
```

This occurred despite having:
- X1 blockchain enabled in Backpack settings
- An X1 wallet imported using the seed phrase
- Sufficient XNT balance to complete the transaction

## Root Cause Analysis

The X1 blockchain is SVM-compatible (Solana Virtual Machine), meaning it uses the same transaction structure as Solana. The Backpack codebase was designed to reuse the `SolanaClient` for X1 transactions.

However, the secure background service had **hardcoded `Blockchain.SOLANA`** references in multiple locations where it performed keyring lookups. This caused the wallet to search for a "solana" keyring instead of an "x1" keyring when processing X1 transactions.

### Locations of Hardcoded References

The investigation revealed **4 locations** with hardcoded `Blockchain.SOLANA`:

1. **`server.ts:206`** - `handleSignMessage` handler
2. **`server.ts:253`** - `handleSign` handler (transaction signing)
3. **`server.ts:301`** - `handleSignAll` handler (batch transaction signing)
4. **Event type definitions** - Missing `blockchain` parameter in event interfaces

## Solution Implemented

### Version 0.10.37 Changes

#### 1. Event Type Updates (`packages/secure-background/src/services/svm/events.ts`)

Added `blockchain?: Blockchain` field to all SVM event request types:

**SECURE_SVM_SIGN_MESSAGE**:
```typescript
export interface SECURE_SVM_SIGN_MESSAGE extends SecureEventBase<"SECURE_SVM_SIGN_MESSAGE"> {
  request: {
    message: string;
    publicKey: string;
    uuid?: string;
    blockchain?: Blockchain;  // ← ADDED
  };
  // ...
}
```

**SECURE_SVM_SIGN_TX**:
```typescript
export interface SECURE_SVM_SIGN_TX extends SecureEventBase<"SECURE_SVM_SIGN_TX"> {
  request: {
    publicKey: string;
    tx: string;
    uuid?: string;
    disableTxMutation?: boolean;
    blockchain?: Blockchain;  // ← ADDED
  };
  // ...
}
```

**SECURE_SVM_SIGN_ALL_TX**:
```typescript
export interface SECURE_SVM_SIGN_ALL_TX extends SecureEventBase<"SECURE_SVM_SIGN_ALL_TX"> {
  request: {
    publicKey: string;
    txs: string[];
    uuid?: string;
    disableTxMutation?: boolean;
    blockchain?: Blockchain;  // ← ADDED
  };
  // ...
}
```

#### 2. Client-Side Updates

**SolanaClient** (`packages/secure-clients/src/SolanaClient/SolanaClient.ts`):
```typescript
export class SolanaClient extends BlockchainClientBase<Blockchain.SOLANA> {
  public blockchain: Blockchain;  // ← ADDED field

  constructor(
    client: TransportSender,
    rpcUrl: string,
    commitmentOrConfig?: Commitment | ConnectionConfig,
    blockchain: Blockchain = Blockchain.SOLANA  // ← ADDED parameter
  ) {
    this.blockchain = blockchain;  // ← Store blockchain type
    this.wallet = new BackpackSolanaWallet(
      this.secureSvmClient,
      this.connection,
      blockchain  // ← Pass to wallet
    );
  }
}
```

**BackpackSolanaWallet** (`packages/secure-clients/src/SolanaClient/BackpackSolanaWallet.ts`):
```typescript
export class BackpackSolanaWallet {
  private blockchain: Blockchain;  // ← ADDED field

  constructor(
    svmClient: SVMClient,
    connection: Connection,
    blockchain: Blockchain = Blockchain.SOLANA  // ← ADDED parameter
  ) {
    this.blockchain = blockchain;  // ← Store blockchain type
  }

  // Updated all signing methods to pass blockchain:
  public async signMessage(...): Promise<Uint8Array> {
    const svmResponse = await this.secureSvmClient.signMessage({
      publicKey: request.publicKey.toBase58(),
      message: encode(request.message),
      uuid: request.uuid,
      blockchain: this.blockchain,  // ← PASS blockchain
    });
  }

  public async signTransaction(...): Promise<T> {
    const signature = await this.secureSvmClient.signTransaction({
      publicKey: publicKey.toBase58(),
      tx: txStr,
      uuid: request.uuid,
      disableTxMutation: request.disableTxMutation,
      blockchain: this.blockchain,  // ← PASS blockchain
    }, { uiOptions });
  }

  public async signAllTransactions(...): Promise<T[]> {
    const signatures = await this.secureSvmClient.signAllTransactions({
      publicKey: publicKey.toBase58(),
      txs: txStrs,
      uuid: request.uuid,
      disableTxMutation: request.disableTxMutation,
      blockchain: this.blockchain,  // ← PASS blockchain
    });
  }
}
```

**createBlockchainClient** (`packages/secure-clients/src/createBlockchainClient.ts`):
```typescript
case Blockchain.X1: {
  const connectionUrl = "https://rpc.mainnet.x1.xyz";
  const commitment = "confirmed";
  const client: BlockchainClient<Blockchain.X1> = new SolanaClient(
    transportSender,
    connectionUrl,
    commitment,
    Blockchain.X1  // ← PASS X1 as blockchain type
  );
  return client as BlockchainClient<B>;
}
```

#### 3. Server-Side Updates (`packages/secure-background/src/services/svm/server.ts`)

Updated all three handlers to use dynamic blockchain parameter with console logging:

**handleSignMessage (line 203)**:
```typescript
private handleSignMessage: TransportHandler<"SECURE_SVM_SIGN_MESSAGE"> = async (event) => {
  let publicKey = event.request.publicKey;
  if (["xnft", "browser"].includes(event.event.origin.context)) {
    console.log("[SECURE_SVM_SIGN_MESSAGE] blockchain:", event.request.blockchain ?? Blockchain.SOLANA);
    const response = await safeClientResponse(
      this.userClient.approveOrigin({
        origin: event.event.origin,
        blockchain: event.request.blockchain ?? Blockchain.SOLANA,  // ← DYNAMIC
      })
    );
    publicKey = response.publicKey;
  }
  // ...
};
```

**handleSign (line 251)**:
```typescript
private handleSign: TransportHandler<"SECURE_SVM_SIGN_TX"> = async (event) => {
  // ...
  let publicKey = event.request.publicKey;
  if (["xnft", "browser"].includes(event.event.origin.context)) {
    console.log("[SECURE_SVM_SIGN_TX] blockchain:", event.request.blockchain ?? Blockchain.SOLANA);
    const response = await safeClientResponse(
      this.userClient.approveOrigin({
        origin: event.event.origin,
        blockchain: event.request.blockchain ?? Blockchain.SOLANA,  // ← DYNAMIC
      })
    );
    publicKey = publicKey ?? response.publicKey;
  }
  // ...
};
```

**handleSignAll (line 300)**:
```typescript
private handleSignAll: TransportHandler<"SECURE_SVM_SIGN_ALL_TX"> = async ({ event, request, ... }) => {
  // ...
  let publicKey = request.publicKey;
  if (["xnft", "browser"].includes(event.origin.context)) {
    console.log("[SECURE_SVM_SIGN_ALL_TX] blockchain:", request.blockchain ?? Blockchain.SOLANA);
    const response = await safeClientResponse(
      this.userClient.approveOrigin({
        origin: event.origin,
        blockchain: request.blockchain ?? Blockchain.SOLANA,  // ← DYNAMIC
      })
    );
    publicKey = response.publicKey;
  }
  // ...
};
```

## Data Flow

### Before Fix (BROKEN)
```
User sends XNT on X1
    ↓
createBlockchainClient → SolanaClient(blockchain: X1)
    ↓
SolanaClient.transferAsset()
    ↓
BackpackSolanaWallet.signTransaction()
    ↓
secureSvmClient.signTransaction({ ... })  ← blockchain NOT passed
    ↓
server.ts handleSign
    ↓
approveOrigin({ blockchain: Blockchain.SOLANA })  ← HARDCODED!
    ↓
Keyring lookup for "solana"
    ↓
❌ ERROR: "no keyring for solana" (keyring is named "x1")
```

### After Fix (WORKING)
```
User sends XNT on X1
    ↓
createBlockchainClient → SolanaClient(blockchain: X1)
    ↓
SolanaClient.transferAsset()
    ↓
BackpackSolanaWallet.signTransaction()
    ↓
secureSvmClient.signTransaction({
  ...,
  blockchain: X1  ← PASSED
})
    ↓
server.ts handleSign
    ↓
console.log("[SECURE_SVM_SIGN_TX] blockchain:", X1)
    ↓
approveOrigin({
  blockchain: X1  ← DYNAMIC
})
    ↓
Keyring lookup for "x1"
    ↓
✅ SUCCESS: X1 keyring found, transaction signed
```

## Files Modified

### Core Fix Files
1. **packages/secure-background/src/services/svm/events.ts**
   - Added `blockchain?: Blockchain` to all SVM event request types

2. **packages/secure-background/src/services/svm/server.ts**
   - Updated `handleSignMessage`, `handleSign`, and `handleSignAll`
   - Changed hardcoded `Blockchain.SOLANA` to `event.request.blockchain ?? Blockchain.SOLANA`
   - Added console.log debugging statements

3. **packages/secure-clients/src/SolanaClient/SolanaClient.ts**
   - Added `blockchain: Blockchain` parameter and field
   - Pass blockchain to BackpackSolanaWallet
   - Use blockchain parameter in config

4. **packages/secure-clients/src/SolanaClient/BackpackSolanaWallet.ts**
   - Added `blockchain: Blockchain` parameter and field
   - Updated `signMessage()` to pass blockchain
   - Updated `signTransaction()` to pass blockchain
   - Updated `signAllTransactions()` to pass blockchain

5. **packages/secure-clients/src/createBlockchainClient.ts**
   - Pass `Blockchain.X1` when creating SolanaClient for X1

6. **packages/app-extension/src/manifest.json**
   - Bumped version to 0.10.37

### Additional X1 Support Files
- **packages/secure-background/src/blockchain-configs/x1/** - X1 blockchain configuration
- **packages/common/src/constants.ts** - X1 constants
- **packages/app-extension/src/x1.png** - X1 logo
- **packages/recoil/src/context/X1DataProvider.tsx** - X1 data provider

## Testing & Debugging

### Console Logging
The fix includes console.log statements in all three server handlers to help debug blockchain parameter flow:

- `[SECURE_SVM_SIGN_MESSAGE] blockchain: <value>`
- `[SECURE_SVM_SIGN_TX] blockchain: <value>`
- `[SECURE_SVM_SIGN_ALL_TX] blockchain: <value>`

These logs can be viewed in the Chrome extension's service worker console (background.js) when performing X1 transactions.

### Expected Behavior
When sending XNT on X1:
1. Console should show: `[SECURE_SVM_SIGN_TX] blockchain: x1`
2. Keyring lookup should use "x1" instead of "solana"
3. Transaction should sign successfully
4. No "no keyring for solana" error

## Backwards Compatibility

The fix maintains backwards compatibility through the fallback pattern:
```typescript
blockchain: event.request.blockchain ?? Blockchain.SOLANA
```

This ensures that:
- Old clients without the `blockchain` field will default to `Blockchain.SOLANA`
- New clients will pass the correct blockchain type
- Existing Solana transactions continue to work

## Version Information

- **Initial broken version**: 0.10.35
- **First attempt fix**: 0.10.36 (partial fix - only updated handleSign)
- **Complete fix**: 0.10.37 (all handlers updated)

## Commit Information

**Commit Hash**: `da13d304`

**Commit Message**: Add X1 blockchain support and fix keyring lookup

**Files Changed**: 41 files
- 780 insertions
- 2131 deletions (due to linter/formatter changes)

## Future Improvements

1. **Remove console.log statements** once the fix is confirmed working in production
2. **Add unit tests** for blockchain parameter propagation
3. **Consider making blockchain required** instead of optional to prevent future hardcoding issues
4. **Document blockchain parameter** in API/SDK documentation

## Related Issues

- Original error: "no keyring for solana" when using X1 blockchain
- User had X1 enabled, wallet imported, and sufficient XNT balance
- Error occurred at transaction signing stage

## Contributors

Generated with Claude Code (Anthropic)

---

*Last Updated: November 6, 2025*
*Version: 0.10.37*
