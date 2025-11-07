#!/usr/bin/env node

/**
 * X1 Keyring Bug - Standalone Test
 *
 * This test demonstrates the bug where X1 transactions fail with
 * "no keyring for solana" error.
 *
 * Run with: node packages/secure-background/X1_KEYRING_BUG_TEST.js
 */

const Blockchain = {
  SOLANA: "solana",
  X1: "x1",
  ETHEREUM: "ethereum",
};

// ============================================================================
// Test Data from Actual Console Log
// ============================================================================

const ACTUAL_X1_REQUEST = {
  name: "SECURE_SVM_SIGN_TX",
  id: "8c137991-398f-42cf-843a-95cf1c63df92",
  request: {
    blockchain: Blockchain.X1, // User is trying to sign X1 transaction
    publicKey: "5paZC1vV94AF513DJn5yXj2TTnTEqm4RuPkWgKYujAi5",
    tx: "3md7BBV9wFjYGnMWcMNyAZcjca2HGfXWZkrU8vvho66z2sJMZFcx6HZdBiAddjo2kzgBv3uZoac3domBRjJJSXkbBvokxQeobbZGctAMXwd79FAF4FUv3KBDTErwwufqEKkoaBT3FGwPb9i8iemQGUJcJAEVFK9ytb3WzFKBr2VM433Rb7rESYxMSGVJ5JhMF8fHgwURP8yPiTc3bY11pom92dk3RLFZXqMjZpY5obGhdKzGNw2kHgdn5iDhxD512BiwZj6zA53xT97aZqzZwjMWDUvVVbcoWRpQX",
    uuid: undefined,
    disableTxMutation: undefined,
  },
  origin: {
    name: "Backpack Extension",
    address: "https://backpack.app",
    context: "extension",
  },
  uiOptions: { type: "ANY" },
};

// ============================================================================
// Simulated Keyring Store
// ============================================================================

class KeyringStore {
  constructor() {
    // Simulates a user who imported an X1 wallet
    // The keyring is named "x1", not "solana"
    this.keyrings = {
      "test-user-uuid": {
        x1: {
          publicKeys: ["5paZC1vV94AF513DJn5yXj2TTnTEqm4RuPkWgKYujAi5"],
          signTransaction: (tx) => "mock-signature-x1",
        },
        // No Solana keyring for this user!
      },
    };
  }

  getUserKeyring(uuid) {
    return {
      keyringForBlockchain: (blockchain) => {
        console.log(`    → Looking for keyring: "${blockchain}"`);
        const keyring = this.keyrings[uuid]?.[blockchain];
        if (keyring) {
          console.log(`    ✅ Found keyring: "${blockchain}"`);
        } else {
          console.log(`    ❌ No keyring found for: "${blockchain}"`);
        }
        return keyring;
      },
    };
  }
}

// ============================================================================
// Simulated Server Code (BUGGY VERSION)
// ============================================================================

class SVMService_BUGGY {
  constructor(keyringStore) {
    this.keyringStore = keyringStore;
  }

  async handleSign(event) {
    console.log("\n" + "─".repeat(80));
    console.log("BUGGY VERSION: handleSign");
    console.log("─".repeat(80));

    const publicKey = event.request.publicKey;
    const blockchain = event.request.blockchain ?? Blockchain.SOLANA;

    // Step 1: Console log (works correctly)
    console.log("\n[Step 1] Console log at server.ts:259");
    console.log(`  [SECURE_SVM_SIGN_TX] blockchain: ${blockchain}`);
    console.log("  ✅ This shows the correct blockchain");

    // Step 2: approveOrigin (works correctly)
    console.log("\n[Step 2] approveOrigin at server.ts:265");
    console.log(`  blockchain: ${blockchain}`);
    console.log("  ✅ This uses the correct blockchain");

    // Step 3: getTransactionSignature (BUG HERE!)
    console.log("\n[Step 3] getTransactionSignature at server.ts:283");
    console.log("  ❌ BUG: Does not receive blockchain parameter!");

    const result = await this.getTransactionSignature_BUGGY(
      { user: { uuid: "test-user-uuid" } },
      publicKey,
      event.request.tx,
      event.origin
      // ❌ blockchain is NOT passed!
    );

    return result;
  }

  async getTransactionSignature_BUGGY(user, publicKey, tx, origin) {
    console.log("\n[Step 4] Inside getTransactionSignature at server.ts:348");
    console.log("  Parameters received:");
    console.log("    - user: test-user-uuid");
    console.log("    - publicKey: " + publicKey);
    console.log("    - tx: " + tx.substring(0, 50) + "...");
    console.log("    - origin: extension");
    console.log("    ❌ - blockchain: NOT RECEIVED!");

    // BUG: Hardcoded Blockchain.SOLANA at line 356
    console.log("\n[Step 5] Looking up keyring at server.ts:356");
    console.log(`  ❌ BUG: .keyringForBlockchain(Blockchain.SOLANA)`);

    const blockchainKeyring = this.keyringStore
      .getUserKeyring(user.user.uuid)
      ?.keyringForBlockchain(Blockchain.SOLANA); // ← HARDCODED!

    if (!blockchainKeyring) {
      const error = new Error("no keyring for solana");
      console.log("\n[Step 6] ERROR thrown:");
      console.log("  ❌ " + error.message);
      console.log(
        '\n  Why? Because the user has an "x1" keyring, not a "solana" keyring!'
      );
      throw error;
    }

    return { signature: "mock-signature" };
  }
}

// ============================================================================
// Simulated Server Code (FIXED VERSION)
// ============================================================================

class SVMService_FIXED {
  constructor(keyringStore) {
    this.keyringStore = keyringStore;
  }

  async handleSign(event) {
    console.log("\n" + "─".repeat(80));
    console.log("FIXED VERSION: handleSign");
    console.log("─".repeat(80));

    const publicKey = event.request.publicKey;
    const blockchain = event.request.blockchain ?? Blockchain.SOLANA;

    // Step 1: Console log (works correctly)
    console.log("\n[Step 1] Console log at server.ts:259");
    console.log(`  [SECURE_SVM_SIGN_TX] blockchain: ${blockchain}`);
    console.log("  ✅ This shows the correct blockchain");

    // Step 2: approveOrigin (works correctly)
    console.log("\n[Step 2] approveOrigin at server.ts:265");
    console.log(`  blockchain: ${blockchain}`);
    console.log("  ✅ This uses the correct blockchain");

    // Step 3: getTransactionSignature (FIXED!)
    console.log("\n[Step 3] getTransactionSignature at server.ts:283");
    console.log("  ✅ FIX: Now passes blockchain parameter!");

    const result = await this.getTransactionSignature_FIXED(
      { user: { uuid: "test-user-uuid" } },
      publicKey,
      event.request.tx,
      event.origin,
      blockchain // ✅ blockchain IS passed!
    );

    return result;
  }

  async getTransactionSignature_FIXED(user, publicKey, tx, origin, blockchain) {
    console.log("\n[Step 4] Inside getTransactionSignature at server.ts:348");
    console.log("  Parameters received:");
    console.log("    - user: test-user-uuid");
    console.log("    - publicKey: " + publicKey);
    console.log("    - tx: " + tx.substring(0, 50) + "...");
    console.log("    - origin: extension");
    console.log(`    ✅ - blockchain: ${blockchain} (NEW PARAMETER)`);

    // FIX: Use blockchain parameter at line 356
    console.log("\n[Step 5] Looking up keyring at server.ts:356");
    console.log(`  ✅ FIX: .keyringForBlockchain(blockchain)`);

    const blockchainKeyring = this.keyringStore
      .getUserKeyring(user.user.uuid)
      ?.keyringForBlockchain(blockchain); // ← DYNAMIC!

    if (!blockchainKeyring) {
      const error = new Error(`no keyring for ${blockchain}`);
      console.log("\n[Step 6] ERROR thrown:");
      console.log("  ❌ " + error.message);
      throw error;
    }

    console.log("\n[Step 6] SUCCESS:");
    console.log("  ✅ Keyring found, transaction signed!");

    return { signature: "mock-signature" };
  }
}

// ============================================================================
// Run Tests
// ============================================================================

async function runTests() {
  console.log("\n" + "=".repeat(80));
  console.log("X1 KEYRING BUG - REPRODUCTION TEST");
  console.log("=".repeat(80));
  console.log("\nTest Data:");
  console.log('  User has X1 wallet imported (keyring: "x1")');
  console.log('  User does NOT have Solana wallet (no "solana" keyring)');
  console.log("  User attempts to sign X1 transaction");
  console.log('  Request blockchain parameter: "x1"');

  const keyringStore = new KeyringStore();

  // Test 1: Buggy version
  console.log("\n\n" + "=".repeat(80));
  console.log("TEST 1: BUGGY VERSION (Current Code)");
  console.log("=".repeat(80));

  const buggyService = new SVMService_BUGGY(keyringStore);

  try {
    await buggyService.handleSign(ACTUAL_X1_REQUEST);
    console.log("\n❌ TEST FAILED: Expected error but none was thrown");
  } catch (error) {
    console.log("\n✅ TEST PASSED: Error thrown as expected");
    console.log(`   Error: "${error.message}"`);
  }

  // Test 2: Fixed version
  console.log("\n\n" + "=".repeat(80));
  console.log("TEST 2: FIXED VERSION (With Blockchain Parameter)");
  console.log("=".repeat(80));

  const fixedService = new SVMService_FIXED(keyringStore);

  try {
    const result = await fixedService.handleSign(ACTUAL_X1_REQUEST);
    console.log("\n✅ TEST PASSED: Transaction signed successfully");
    console.log(`   Signature: ${result.signature}`);
  } catch (error) {
    console.log("\n❌ TEST FAILED: Unexpected error");
    console.log(`   Error: "${error.message}"`);
  }

  // Test 3: Backward compatibility
  console.log("\n\n" + "=".repeat(80));
  console.log("TEST 3: BACKWARD COMPATIBILITY (Missing blockchain parameter)");
  console.log("=".repeat(80));

  // Create a Solana keyring for backward compat test
  keyringStore.keyrings["test-user-uuid"].solana = {
    publicKeys: ["SolanaPubKey123"],
    signTransaction: (tx) => "mock-signature-solana",
  };

  const oldRequest = {
    ...ACTUAL_X1_REQUEST,
    request: {
      ...ACTUAL_X1_REQUEST.request,
      blockchain: undefined, // Old client doesn't send blockchain
    },
  };

  try {
    const result = await fixedService.handleSign(oldRequest);
    console.log("\n✅ TEST PASSED: Fallback to Solana works");
    console.log(`   Signature: ${result.signature}`);
  } catch (error) {
    console.log("\n❌ TEST FAILED: Backward compatibility broken");
    console.log(`   Error: "${error.message}"`);
  }
}

// ============================================================================
// Print Fix Summary
// ============================================================================

function printFixSummary() {
  console.log("\n\n" + "=".repeat(80));
  console.log("REQUIRED CODE CHANGES");
  console.log("=".repeat(80));

  console.log(`
FILE: packages/secure-background/src/services/svm/server.ts

┌─────────────────────────────────────────────────────────────────────────────┐
│ CHANGE 1: Add blockchain parameter to getTransactionSignature (line 348)   │
└─────────────────────────────────────────────────────────────────────────────┘

BEFORE:
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
    blockchain: Blockchain  // ← ADD THIS
  ): Promise<{ signature: string }> {

┌─────────────────────────────────────────────────────────────────────────────┐
│ CHANGE 2: Use blockchain parameter instead of hardcoded value (line 356)   │
└─────────────────────────────────────────────────────────────────────────────┘

BEFORE:
    const blockchainKeyring = this.keyringStore
      .getUserKeyring(user.user.uuid)
      ?.keyringForBlockchain(Blockchain.SOLANA);  // ← HARDCODED!

AFTER:
    const blockchainKeyring = this.keyringStore
      .getUserKeyring(user.user.uuid)
      ?.keyringForBlockchain(blockchain);  // ← DYNAMIC!

┌─────────────────────────────────────────────────────────────────────────────┐
│ CHANGE 3: Pass blockchain when calling getTransactionSignature (line 283)  │
└─────────────────────────────────────────────────────────────────────────────┘

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
      event.request.blockchain ?? Blockchain.SOLANA  // ← ADD THIS
    );

┌─────────────────────────────────────────────────────────────────────────────┐
│ CHANGE 4: Same changes for getMessageSignature (line 404, 412, 229)        │
└─────────────────────────────────────────────────────────────────────────────┘

Apply the same pattern to getMessageSignature method.

┌─────────────────────────────────────────────────────────────────────────────┐
│ CHANGE 5: Same changes for handleSignAll (line 330)                        │
└─────────────────────────────────────────────────────────────────────────────┘

Apply the same pattern to the getTransactionSignature call in handleSignAll.

  `);

  console.log("=".repeat(80));
  console.log("SUMMARY");
  console.log("=".repeat(80));
  console.log(`
The fix requires:
  1. Add 'blockchain' parameter to getTransactionSignature()
  2. Add 'blockchain' parameter to getMessageSignature()
  3. Pass blockchain from request to these methods (3 locations)
  4. Use blockchain parameter instead of hardcoded Blockchain.SOLANA

This ensures that when a user signs an X1 transaction, the code looks up
the "x1" keyring instead of the "solana" keyring.
  `);
}

// ============================================================================
// Main
// ============================================================================

if (require.main === module) {
  runTests()
    .then(() => {
      printFixSummary();
      console.log("\n✅ All tests completed!\n");
    })
    .catch((error) => {
      console.error("\n❌ Test failed with error:", error);
      process.exit(1);
    });
}

module.exports = { runTests, printFixSummary };
