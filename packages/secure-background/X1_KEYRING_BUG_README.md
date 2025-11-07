# X1 Keyring Bug - Test Suite and Analysis

## Overview

This directory contains a comprehensive test suite that reproduces and documents the X1 keyring bug where transaction signing fails with "no keyring for solana" error.

## The Bug

**Symptom:** When attempting to send XNT tokens on X1 blockchain, the transaction fails with:

```
Error: no keyring for solana
```

**Root Cause:** The `getTransactionSignature()` and `getMessageSignature()` methods in `server.ts` have **hardcoded `Blockchain.SOLANA`** when looking up the keyring, even though the request correctly specifies `blockchain: "x1"`.

**Location:** `packages/secure-background/src/services/svm/server.ts`

- Line 356: `?.keyringForBlockchain(Blockchain.SOLANA)` in `getTransactionSignature()`
- Line 412: `?.keyringForBlockchain(Blockchain.SOLANA)` in `getMessageSignature()`

## Test Files

### 1. X1_KEYRING_BUG_TEST.js (Standalone Test)

**Location:** `packages/secure-background/X1_KEYRING_BUG_TEST.js`

**Purpose:** Standalone JavaScript test that can run without dependencies.

**Run:**

```bash
node packages/secure-background/X1_KEYRING_BUG_TEST.js
```

**What it tests:**

1. Reproduces the bug with hardcoded `Blockchain.SOLANA`
2. Demonstrates the fix with dynamic blockchain parameter
3. Verifies backward compatibility (Solana fallback)
4. Provides detailed console output showing the exact flow

**Output:** Clear visual demonstration of:

- Where blockchain parameter is correctly passed (console.log, approveOrigin)
- Where blockchain parameter is missing (getTransactionSignature)
- The exact error that occurs
- How the fix resolves the issue

### 2. x1-keyring-fix.test.ts (Jest Test Suite)

**Location:** `packages/secure-background/src/services/svm/__tests__/x1-keyring-fix.test.ts`

**Purpose:** Comprehensive Jest test suite for integration testing.

**Run:**

```bash
cd packages/secure-background
npm test -- x1-keyring-fix.test.ts
```

**Test Cases:**

- `Bug Reproduction: Hardcoded Blockchain.SOLANA`
  - Fails with "no keyring for solana" for X1 transactions
  - Logs correct blockchain in console
- `Expected Behavior After Fix`
  - Uses blockchain parameter from request
  - Fallback to Blockchain.SOLANA when not specified
- `SECURE_SVM_SIGN_MESSAGE` tests
  - Same bug in message signing
- `SECURE_SVM_SIGN_ALL_TX` tests
  - Same bug in batch transaction signing
- `Integration Test: Full Request Flow`
  - End-to-end test from extension to secure-background

### 3. x1-keyring-manual-test.ts (Detailed Analysis)

**Location:** `packages/secure-background/src/services/svm/__tests__/x1-keyring-manual-test.ts`

**Purpose:** TypeScript documentation with detailed analysis and code examples.

**Features:**

- Full code flow simulation
- Before/after comparison
- Exact code changes required
- Line-by-line explanation

## The Bug in Detail

### Data Flow (BROKEN)

```
User sends XNT on X1
    ↓
Frontend: SECURE_SVM_SIGN_TX {
  blockchain: "x1",  ← Correct!
  publicKey: "5paZ...",
  tx: "3md7..."
}
    ↓
server.ts handleSign (line 241)
    ↓
Console log (line 259):
  [SECURE_SVM_SIGN_TX] blockchain: x1  ← Correct!
    ↓
approveOrigin (line 263):
  blockchain: x1  ← Correct!
    ↓
getTransactionSignature (line 283):
  ❌ blockchain parameter NOT passed
    ↓
getTransactionSignature (line 348):
  ❌ blockchain parameter NOT received
    ↓
keyringForBlockchain (line 356):
  ❌ Blockchain.SOLANA hardcoded
    ↓
ERROR: "no keyring for solana"
```

### Console Log Evidence

From actual browser console:

```
backpack: secure-ui FromExtensionTransportSender: Request
{
  name: 'SECURE_SVM_SIGN_TX',
  request: {
    blockchain: "x1",  ← THIS IS CORRECT
    publicKey: "5paZC1vV94AF513DJn5yXj2TTnTEqm4RuPkWgKYujAi5",
    tx: "3md7BBV9wFjYGnMWcMNyAZcjca2HGfXWZkrU8vvho66z2sJMZF..."
  }
}
```

The console log at line 259 correctly shows:

```
[SECURE_SVM_SIGN_TX] blockchain: x1
```

But then the code fails because line 356 uses hardcoded `Blockchain.SOLANA`.

## The Fix

### Required Changes

**File:** `packages/secure-background/src/services/svm/server.ts`

#### Change 1: Update method signature (line 348)

```typescript
// BEFORE
private async getTransactionSignature(
  user: SecureUserType,
  publicKey: string,
  tx: string,
  origin: SecureEventOrigin
): Promise<{ signature: string }> {

// AFTER
private async getTransactionSignature(
  user: SecureUserType,
  publicKey: string,
  tx: string,
  origin: SecureEventOrigin,
  blockchain: Blockchain  // ← ADD THIS
): Promise<{ signature: string }> {
```

#### Change 2: Use blockchain parameter (line 356)

```typescript
// BEFORE
const blockchainKeyring = this.keyringStore
  .getUserKeyring(user.user.uuid)
  ?.keyringForBlockchain(Blockchain.SOLANA);

// AFTER
const blockchainKeyring = this.keyringStore
  .getUserKeyring(user.user.uuid)
  ?.keyringForBlockchain(blockchain); // ← USE PARAMETER
```

#### Change 3: Pass blockchain in handleSign (line 283)

```typescript
// BEFORE
const { signature } = await this.getTransactionSignature(
  activeUser,
  publicKey,
  confirmation.tx,
  event.event.origin
);

// AFTER
const { signature } = await this.getTransactionSignature(
  activeUser,
  publicKey,
  confirmation.tx,
  event.event.origin,
  event.request.blockchain ?? Blockchain.SOLANA // ← ADD THIS
);
```

#### Change 4: Apply same pattern to getMessageSignature

Update method signature (line 404), use parameter (line 412), and pass in caller (line 229).

#### Change 5: Apply same pattern to handleSignAll

Pass blockchain parameter at line 330.

### Data Flow (FIXED)

```
User sends XNT on X1
    ↓
Frontend: SECURE_SVM_SIGN_TX {
  blockchain: "x1",  ✅
  publicKey: "5paZ...",
  tx: "3md7..."
}
    ↓
server.ts handleSign (line 241)
    ↓
Console log (line 259):
  [SECURE_SVM_SIGN_TX] blockchain: x1  ✅
    ↓
approveOrigin (line 263):
  blockchain: x1  ✅
    ↓
getTransactionSignature (line 283):
  ✅ blockchain parameter PASSED
    ↓
getTransactionSignature (line 348):
  ✅ blockchain parameter RECEIVED
    ↓
keyringForBlockchain (line 356):
  ✅ blockchain (dynamic)
    ↓
SUCCESS: X1 keyring found, transaction signed!
```

## Test Results

Running `node packages/secure-background/X1_KEYRING_BUG_TEST.js`:

```
TEST 1: BUGGY VERSION
  ✅ Error thrown: "no keyring for solana"
  ✅ Reproduces the bug correctly

TEST 2: FIXED VERSION
  ✅ Transaction signed successfully
  ✅ X1 keyring found

TEST 3: BACKWARD COMPATIBILITY
  ✅ Fallback to Solana works
  ✅ Old clients still function
```

## Why This Bug Occurred

1. **X1 is SVM-compatible** - It reuses Solana's transaction structure and signing logic
2. **Code was designed for Solana** - The `SolanaClient` was originally built for Solana only
3. **Partial fix was applied** - When X1 support was added:

   - ✅ Event types were updated to include optional `blockchain` field
   - ✅ Clients were updated to pass `blockchain` parameter
   - ✅ Console logs were added to verify blockchain parameter
   - ✅ `approveOrigin` calls were updated to use dynamic blockchain
   - ❌ **BUT** `getTransactionSignature` and `getMessageSignature` were missed

4. **Why it was missed** - These are private methods deep in the call stack, and the blockchain parameter needs to be threaded through multiple function calls

## Related Documentation

- `TESTING_GUIDE.md` - Manual testing instructions for the X1 fix
- `X1_KEYRING_FIX_SUMMARY.md` - Complete summary of the X1 blockchain support and fix

## Impact

**Affected Operations:**

- Sending XNT tokens on X1
- Signing messages on X1
- Signing multiple transactions on X1
- Any SVM operation on X1 blockchain

**Workaround:** None. Users cannot sign X1 transactions until this is fixed.

**User Impact:** High. Users with X1 wallets cannot use their wallets.

## Testing Checklist

- [x] Standalone test runs and reproduces bug
- [x] Test demonstrates fix works correctly
- [x] Test verifies backward compatibility
- [x] Jest test suite created
- [x] Integration tests cover all affected handlers
- [x] Documentation explains root cause
- [x] Code changes documented with line numbers

## Running the Tests

### Quick Test (Standalone)

```bash
cd /Users/yakovlevin/dev/backpack
node packages/secure-background/X1_KEYRING_BUG_TEST.js
```

### Full Test Suite (if Jest configured)

```bash
cd packages/secure-background
npm test
```

### Manual Testing

Follow the instructions in `TESTING_GUIDE.md` to test in the browser extension.

## Next Steps

1. **Apply the fix** - Implement the code changes in server.ts
2. **Run tests** - Verify all tests pass
3. **Manual testing** - Follow TESTING_GUIDE.md
4. **Remove console.log** - Optional: remove debugging logs in production
5. **Update version** - Bump to v0.10.38 or appropriate version
6. **Deploy** - Release the fix to users

## Summary

This test suite comprehensively documents and reproduces the X1 keyring bug. The bug occurs because `getTransactionSignature()` and `getMessageSignature()` use hardcoded `Blockchain.SOLANA` instead of the blockchain parameter from the request. The fix is straightforward: add blockchain as a parameter to these methods and use it when looking up the keyring.

---

**Created:** 2025-11-06
**Version:** 0.10.37 (bug present)
**Target Fix Version:** 0.10.38
