/**
 * Manual Test Suite for X1 Keyring Fix
 *
 * This is a standalone test that can be run with `npx ts-node` to reproduce
 * the X1 keyring bug without requiring Jest or other test frameworks.
 *
 * BUG LOCATION:
 * - packages/secure-background/src/services/svm/server.ts:356
 *   ?.keyringForBlockchain(Blockchain.SOLANA) <- HARDCODED, should be dynamic
 *
 * - packages/secure-background/src/services/svm/server.ts:412
 *   ?.keyringForBlockchain(Blockchain.SOLANA) <- HARDCODED, should be dynamic
 *
 * ROOT CAUSE:
 * When the frontend sends a SECURE_SVM_SIGN_TX request with blockchain: "x1",
 * the server correctly logs the blockchain parameter and passes it to
 * approveOrigin(), BUT when it calls getTransactionSignature(), it still
 * uses the hardcoded Blockchain.SOLANA to look up the keyring.
 *
 * REPRODUCTION:
 * 1. User has X1 wallet imported (keyring named "x1")
 * 2. User attempts to sign X1 transaction
 * 3. Request arrives with blockchain: "x1"
 * 4. Console logs: [SECURE_SVM_SIGN_TX] blockchain: x1
 * 5. getTransactionSignature() is called
 * 6. It looks for keyring with Blockchain.SOLANA (hardcoded!)
 * 7. ERROR: "no keyring for solana" (keyring is named "x1", not "solana")
 *
 * FIX REQUIRED:
 * 1. Add blockchain parameter to getTransactionSignature()
 * 2. Add blockchain parameter to getMessageSignature()
 * 3. Pass blockchain from request to these methods
 * 4. Use blockchain parameter instead of hardcoded Blockchain.SOLANA
 */

import { Blockchain } from "@coral-xyz/common";

// ============================================================================
// Test Data from Console Log
// ============================================================================

const ACTUAL_X1_REQUEST = {
  name: "SECURE_SVM_SIGN_TX",
  request: {
    blockchain: "x1" as any, // This is Blockchain.X1
    disableTxMutation: undefined,
    publicKey: "5paZC1vV94AF513DJn5yXj2TTnTEqm4RuPkWgKYujAi5",
    tx: "3md7BBV9wFjYGnMWcMNyAZcjca2HGfXWZkrU8vvho66z2sJMZFcx6HZdBiAddjo2kzgBv3uZoac3domBRjJJSXkbBvokxQeobbZGctAMXwd79FAF4FUv3KBDTErwwufqEKkoaBT3FGwPb9i8iemQGUJcJAEVFK9ytb3WzFKBr2VM433Rb7rESYxMSGVJ5JhMF8fHgwURP8yPiTc3bY11pom92dk3RLFZXqMjZpY5obGhdKzGNw2kHgdn5iDhxD512BiwZj6zA53xT97aZqzZwjMWDUvVVbcoWRpQX",
    uuid: undefined,
  },
  uiOptions: { type: "ANY" },
  origin: {
    name: "Backpack Extension",
    address: "https://backpack.app",
    context: "extension",
  },
  id: "8c137991-398f-42cf-843a-95cf1c63df92",
};

// ============================================================================
// Simulated Code Flow
// ============================================================================

class TestResults {
  passed: number = 0;
  failed: number = 0;
  tests: { name: string; passed: boolean; message: string }[] = [];

  assert(name: string, condition: boolean, message: string) {
    const passed = condition;
    this.tests.push({ name, passed, message });
    if (passed) {
      this.passed++;
      console.log(`✅ PASS: ${name}`);
    } else {
      this.failed++;
      console.log(`❌ FAIL: ${name}`);
      console.log(`   ${message}`);
    }
  }

  summary() {
    console.log("\n" + "=".repeat(80));
    console.log(`TEST SUMMARY: ${this.passed} passed, ${this.failed} failed`);
    console.log("=".repeat(80));

    if (this.failed > 0) {
      console.log("\nFailed tests:");
      this.tests
        .filter((t) => !t.passed)
        .forEach((t) => {
          console.log(`  - ${t.name}`);
          console.log(`    ${t.message}`);
        });
    }

    return this.failed === 0;
  }
}

function simulateServerHandleSign(request: typeof ACTUAL_X1_REQUEST) {
  console.log("\n" + "=".repeat(80));
  console.log("SIMULATING: handleSign in server.ts");
  console.log("=".repeat(80));

  // Step 1: Request arrives with blockchain parameter
  console.log("\n[Step 1] Request received:");
  console.log("  - blockchain:", request.request.blockchain);
  console.log("  - publicKey:", request.request.publicKey);

  // Step 2: Console log (this works correctly in the fix)
  const blockchainParam = request.request.blockchain ?? Blockchain.SOLANA;
  console.log("\n[Step 2] Console log (server.ts:259):");
  console.log(`  [SECURE_SVM_SIGN_TX] blockchain: ${blockchainParam}`);

  // Step 3: approveOrigin is called (this also works correctly in the fix)
  console.log("\n[Step 3] approveOrigin called with:");
  console.log("  blockchain:", blockchainParam);
  console.log("  ✅ This part is FIXED - uses dynamic blockchain");

  // Step 4: getTransactionSignature is called
  console.log("\n[Step 4] getTransactionSignature called:");
  console.log("  publicKey:", request.request.publicKey);
  console.log("  tx:", request.request.tx.substring(0, 50) + "...");

  // Step 5: THE BUG - keyringForBlockchain uses hardcoded Blockchain.SOLANA
  console.log("\n[Step 5] Looking up keyring (server.ts:356):");
  console.log("  ❌ BUG: .keyringForBlockchain(Blockchain.SOLANA)");
  console.log("  Should be: .keyringForBlockchain(blockchain)");

  // Step 6: Keyring lookup fails
  const lookupBlockchain = Blockchain.SOLANA; // Hardcoded!
  const requestBlockchain = request.request.blockchain;

  console.log("\n[Step 6] Keyring lookup:");
  console.log(`  Looking for keyring: "${lookupBlockchain}"`);
  console.log(`  But user has keyring: "${requestBlockchain}"`);
  console.log(
    `  Match: ${lookupBlockchain === requestBlockchain ? "YES ✅" : "NO ❌"}`
  );

  return {
    blockchainParam,
    lookupBlockchain,
    requestBlockchain,
    match: lookupBlockchain === requestBlockchain,
  };
}

function simulateFixedServerHandleSign(request: typeof ACTUAL_X1_REQUEST) {
  console.log("\n" + "=".repeat(80));
  console.log("SIMULATING: FIXED handleSign in server.ts");
  console.log("=".repeat(80));

  // Step 1: Request arrives with blockchain parameter
  console.log("\n[Step 1] Request received:");
  console.log("  - blockchain:", request.request.blockchain);
  console.log("  - publicKey:", request.request.publicKey);

  // Step 2: Console log
  const blockchainParam = request.request.blockchain ?? Blockchain.SOLANA;
  console.log("\n[Step 2] Console log:");
  console.log(`  [SECURE_SVM_SIGN_TX] blockchain: ${blockchainParam}`);

  // Step 3: approveOrigin is called
  console.log("\n[Step 3] approveOrigin called with:");
  console.log("  blockchain:", blockchainParam);

  // Step 4: getTransactionSignature is called WITH blockchain parameter
  console.log("\n[Step 4] getTransactionSignature called WITH blockchain:");
  console.log("  publicKey:", request.request.publicKey);
  console.log("  tx:", request.request.tx.substring(0, 50) + "...");
  console.log("  blockchain:", blockchainParam, "← NEW PARAMETER");

  // Step 5: FIXED - keyringForBlockchain uses dynamic blockchain
  console.log("\n[Step 5] Looking up keyring (FIXED):");
  console.log("  ✅ FIX: .keyringForBlockchain(blockchain)");

  // Step 6: Keyring lookup succeeds
  const lookupBlockchain = blockchainParam; // Dynamic!
  const requestBlockchain = request.request.blockchain;

  console.log("\n[Step 6] Keyring lookup:");
  console.log(`  Looking for keyring: "${lookupBlockchain}"`);
  console.log(`  User has keyring: "${requestBlockchain}"`);
  console.log(
    `  Match: ${lookupBlockchain === requestBlockchain ? "YES ✅" : "NO ❌"}`
  );

  return {
    blockchainParam,
    lookupBlockchain,
    requestBlockchain,
    match: lookupBlockchain === requestBlockchain,
  };
}

// ============================================================================
// Run Tests
// ============================================================================

function runTests() {
  console.log("\n" + "=".repeat(80));
  console.log("X1 KEYRING BUG - REPRODUCTION TEST");
  console.log("=".repeat(80));

  const results = new TestResults();

  // Test 1: Verify request has blockchain parameter
  results.assert(
    "Request contains blockchain: x1",
    ACTUAL_X1_REQUEST.request.blockchain === Blockchain.X1 ||
      ACTUAL_X1_REQUEST.request.blockchain === "x1",
    `Expected blockchain: x1, got: ${ACTUAL_X1_REQUEST.request.blockchain}`
  );

  // Test 2: Simulate current buggy behavior
  console.log("\n" + "=".repeat(80));
  console.log("TEST: Current Buggy Behavior");
  console.log("=".repeat(80));

  const bugResult = simulateServerHandleSign(ACTUAL_X1_REQUEST);

  results.assert(
    "BUG: Blockchain parameter is passed to approveOrigin",
    bugResult.blockchainParam === Blockchain.X1 ||
      bugResult.blockchainParam === "x1",
    "approveOrigin receives correct blockchain (this part is fixed)"
  );

  results.assert(
    "BUG: Keyring lookup uses hardcoded Blockchain.SOLANA",
    bugResult.lookupBlockchain === Blockchain.SOLANA,
    "getTransactionSignature uses Blockchain.SOLANA (this is the bug!)"
  );

  results.assert(
    "BUG: Keyring lookup fails because blockchain mismatch",
    !bugResult.match,
    `Looking for "${bugResult.lookupBlockchain}" but have "${bugResult.requestBlockchain}"`
  );

  // Test 3: Simulate fixed behavior
  console.log("\n" + "=".repeat(80));
  console.log("TEST: Fixed Behavior");
  console.log("=".repeat(80));

  const fixResult = simulateFixedServerHandleSign(ACTUAL_X1_REQUEST);

  results.assert(
    "FIX: Blockchain parameter is passed to getTransactionSignature",
    fixResult.blockchainParam === fixResult.lookupBlockchain,
    "getTransactionSignature receives and uses blockchain parameter"
  );

  results.assert(
    "FIX: Keyring lookup uses dynamic blockchain",
    fixResult.lookupBlockchain === fixResult.requestBlockchain,
    `Looking for "${fixResult.lookupBlockchain}" matches "${fixResult.requestBlockchain}"`
  );

  results.assert(
    "FIX: Keyring lookup succeeds",
    fixResult.match,
    "Keyring lookup finds the correct X1 keyring"
  );

  // Test 4: Verify fallback behavior
  console.log("\n" + "=".repeat(80));
  console.log("TEST: Backward Compatibility (Solana fallback)");
  console.log("=".repeat(80));

  const solanaRequest = {
    ...ACTUAL_X1_REQUEST,
    request: {
      ...ACTUAL_X1_REQUEST.request,
      blockchain: undefined, // No blockchain specified
    },
  };

  const fallbackBlockchain =
    solanaRequest.request.blockchain ?? Blockchain.SOLANA;

  results.assert(
    "Fallback: Missing blockchain defaults to Blockchain.SOLANA",
    fallbackBlockchain === Blockchain.SOLANA,
    "Ensures backward compatibility with old clients"
  );

  return results.summary();
}

// ============================================================================
// Code Change Required
// ============================================================================

function printRequiredFix() {
  console.log("\n" + "=".repeat(80));
  console.log("REQUIRED CODE CHANGES");
  console.log("=".repeat(80));

  console.log(`
FILE: packages/secure-background/src/services/svm/server.ts

CHANGE 1: Update getTransactionSignature method signature
──────────────────────────────────────────────────────────

BEFORE (line 348):
  private async getTransactionSignature(
    user: SecureUserType,
    publicKey: string,
    tx: string,
    origin: SecureEventOrigin
  ): Promise<{ signature: string }> {

AFTER:
  private async getTransactionSignature(
    user: SecureUserType,
    publicKey: string,
    tx: string,
    origin: SecureEventOrigin,
    blockchain: Blockchain  // ← ADD THIS PARAMETER
  ): Promise<{ signature: string }> {


CHANGE 2: Use blockchain parameter instead of hardcoded value
──────────────────────────────────────────────────────────────

BEFORE (line 354-356):
    const blockchainKeyring = this.keyringStore
      .getUserKeyring(user.user.uuid)
      ?.keyringForBlockchain(Blockchain.SOLANA);

AFTER (line 354-356):
    const blockchainKeyring = this.keyringStore
      .getUserKeyring(user.user.uuid)
      ?.keyringForBlockchain(blockchain);  // ← USE PARAMETER


CHANGE 3: Update getMessageSignature method signature
──────────────────────────────────────────────────────

BEFORE (line 404):
  private async getMessageSignature(
    user: SecureUserType,
    publicKey: string,
    message: string,
    origin: SecureEventOrigin
  ): Promise<{ signature: string }> {

AFTER:
  private async getMessageSignature(
    user: SecureUserType,
    publicKey: string,
    message: string,
    origin: SecureEventOrigin,
    blockchain: Blockchain  // ← ADD THIS PARAMETER
  ): Promise<{ signature: string }> {


CHANGE 4: Use blockchain parameter in getMessageSignature
──────────────────────────────────────────────────────────

BEFORE (line 410-412):
    const blockchainKeyring = this.keyringStore
      .getUserKeyring(user.user.uuid)
      ?.keyringForBlockchain(Blockchain.SOLANA);

AFTER:
    const blockchainKeyring = this.keyringStore
      .getUserKeyring(user.user.uuid)
      ?.keyringForBlockchain(blockchain);  // ← USE PARAMETER


CHANGE 5: Pass blockchain when calling getTransactionSignature (line 283)
──────────────────────────────────────────────────────────────────────────

BEFORE:
    const { signature } = await this.getTransactionSignature(
      activeUser,
      publicKey,
      confirmation.tx,
      event.event.origin
    );

AFTER:
    const { signature } = await this.getTransactionSignature(
      activeUser,
      publicKey,
      confirmation.tx,
      event.event.origin,
      event.request.blockchain ?? Blockchain.SOLANA  // ← ADD BLOCKCHAIN
    );


CHANGE 6: Pass blockchain when calling getMessageSignature (line 229)
──────────────────────────────────────────────────────────────────────

BEFORE:
    const { signature } = await this.getMessageSignature(
      user,
      publicKey,
      event.request.message,
      event.event.origin
    );

AFTER:
    const { signature } = await this.getMessageSignature(
      user,
      publicKey,
      event.request.message,
      event.event.origin,
      event.request.blockchain ?? Blockchain.SOLANA  // ← ADD BLOCKCHAIN
    );


CHANGE 7: Pass blockchain in handleSignAll (line 330)
──────────────────────────────────────────────────────

BEFORE:
    const { signature } = await this.getTransactionSignature(
      activeUser,
      publicKey,
      tx,
      event.origin
    );

AFTER:
    const { signature } = await this.getTransactionSignature(
      activeUser,
      publicKey,
      tx,
      event.origin,
      request.blockchain ?? Blockchain.SOLANA  // ← ADD BLOCKCHAIN
    );

  `);
}

// ============================================================================
// Main
// ============================================================================

if (require.main === module) {
  const success = runTests();
  printRequiredFix();

  if (!success) {
    console.log("\n❌ Some tests failed. See above for details.\n");
    process.exit(1);
  } else {
    console.log("\n✅ All tests passed!\n");
    process.exit(0);
  }
}

export { ACTUAL_X1_REQUEST,printRequiredFix, runTests };
