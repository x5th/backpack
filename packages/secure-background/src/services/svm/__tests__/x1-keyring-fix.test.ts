/**
 * Test suite for X1 Keyring Fix
 *
 * This test reproduces the bug where SECURE_SVM_SIGN_TX requests for X1 blockchain
 * fail with "no keyring for solana" error because the server.ts handlers have
 * hardcoded Blockchain.SOLANA in getTransactionSignature() and getMessageSignature()
 *
 * Bug Location: packages/secure-background/src/services/svm/server.ts
 * - Line 356: .keyringForBlockchain(Blockchain.SOLANA) - should be dynamic
 * - Line 412: .keyringForBlockchain(Blockchain.SOLANA) - should be dynamic
 */

import { Blockchain } from "@coral-xyz/common";
import {
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import { encode } from "bs58";

import type { KeyringStore } from "../../../store/KeyringStore/KeyringStore";
import type {
  SecureEventOrigin,
  TransportReceiver,
  TransportSender,
} from "../../../types/transports";
import { SVMService } from "../server";

describe("X1 Keyring Fix - SECURE_SVM_SIGN_TX", () => {
  let svmService: SVMService;
  let mockKeyringStore: KeyringStore;
  let mockSecureSender: TransportSender;
  let mockSecureReceiver: TransportReceiver<any>;
  let mockSecureUISender: TransportSender<any, "ui">;

  // Mock X1 transaction data from your console log
  const mockX1Request = {
    name: "SECURE_SVM_SIGN_TX" as const,
    id: "8c137991-398f-42cf-843a-95cf1c63df92",
    request: {
      blockchain: Blockchain.X1,
      publicKey: "5paZC1vV94AF513DJn5yXj2TTnTEqm4RuPkWgKYujAi5",
      tx: "3md7BBV9wFjYGnMWcMNyAZcjca2HGfXWZkrU8vvho66z2sJMZFcx6HZdBiAddjo2kzgBv3uZoac3domBRjJJSXkbBvokxQeobbZGctAMXwd79FAF4FUv3KBDTErwwufqEKkoaBT3FGwPb9i8iemQGUJcJAEVFK9ytb3WzFKBr2VM433Rb7rESYxMSGVJ5JhMF8fHgwURP8yPiTc3bY11pom92dk3RLFZXqMjZpY5obGhdKzGNw2kHgdn5iDhxD512BiwZj6zA53xT97aZqzZwjMWDUvVVbcoWRpQX",
      uuid: undefined,
      disableTxMutation: undefined,
    },
    origin: {
      name: "Backpack Extension",
      address: "https://backpack.app",
      context: "extension" as const,
    },
    uiOptions: { type: "ANY" as const },
  };

  beforeEach(() => {
    // Create mock keyring store with both X1 and Solana keyrings
    mockKeyringStore = createMockKeyringStore();

    // Create mock transport senders/receivers
    mockSecureSender = createMockSender();
    mockSecureReceiver = createMockReceiver();
    mockSecureUISender = createMockSender();

    // Initialize SVM service
    svmService = new SVMService({
      secureReceiver: mockSecureReceiver,
      secureSender: mockSecureSender,
      keyringStore: mockKeyringStore,
      secureUISender: mockSecureUISender,
    });
  });

  afterEach(() => {
    // Clean up
    if (svmService && svmService.destroy) {
      svmService.destroy();
    }
  });

  describe("Bug Reproduction: Hardcoded Blockchain.SOLANA", () => {
    it("should fail with 'no keyring for solana' when signing X1 transaction (BUG)", async () => {
      // This test reproduces the bug where the server looks for a "solana" keyring
      // even when the request specifies blockchain: "x1"

      const event = {
        name: mockX1Request.name,
        request: mockX1Request.request,
        event: {
          origin: mockX1Request.origin,
          uiOptions: mockX1Request.uiOptions,
        },
        respond: jest.fn(),
        error: jest.fn(),
      };

      // Attempt to handle the sign request
      await expect(async () => {
        // The handler will call getTransactionSignature which has hardcoded Blockchain.SOLANA
        // This will fail because the keyring store only has an X1 keyring for this user
        // @ts-ignore - accessing private method for testing
        await svmService.handleSign(event);
      }).rejects.toThrow(
        /no keyring for solana|invariant violation: BlockchainKeyring not found/
      );

      // Verify error was called
      expect(event.error).toHaveBeenCalled();
    });

    it("should log correct blockchain parameter in console", () => {
      // Verify that the console.log shows the correct blockchain
      const consoleSpy = jest.spyOn(console, "log");

      const event = {
        name: mockX1Request.name,
        request: mockX1Request.request,
        event: {
          origin: mockX1Request.origin,
          uiOptions: mockX1Request.uiOptions,
        },
        respond: jest.fn(),
        error: jest.fn(),
      };

      // The handler should log the blockchain parameter
      // @ts-ignore
      svmService.handleSign(event).catch(() => {});

      // Should log "x1" not "solana"
      expect(consoleSpy).toHaveBeenCalledWith(
        "[SECURE_SVM_SIGN_TX] blockchain:",
        Blockchain.X1
      );

      consoleSpy.mockRestore();
    });
  });

  describe("Expected Behavior After Fix", () => {
    it("should use blockchain parameter from request when looking up keyring", async () => {
      // After the fix, getTransactionSignature should accept a blockchain parameter
      // and use it instead of hardcoded Blockchain.SOLANA

      const mockUser = {
        user: { uuid: "test-user-uuid" },
        keyringStoreState: "Unlocked" as const,
      };

      const mockOrigin: SecureEventOrigin = {
        name: "Backpack Extension",
        address: "https://backpack.app",
        context: "extension",
      };

      // The fix should make getTransactionSignature accept blockchain parameter
      // @ts-ignore - accessing private method for testing
      const keyringLookupSpy = jest.spyOn(mockKeyringStore, "getUserKeyring");

      // This should succeed after the fix
      // @ts-ignore
      await svmService.getTransactionSignature(
        mockUser,
        mockX1Request.request.publicKey,
        mockX1Request.request.tx,
        mockOrigin,
        Blockchain.X1 // <- Fix: pass blockchain parameter
      );

      // Verify it looked up the correct blockchain keyring
      expect(keyringLookupSpy).toHaveBeenCalled();

      const userKeyring = mockKeyringStore.getUserKeyring(mockUser.user.uuid);
      // After fix: should call keyringForBlockchain(Blockchain.X1) not Blockchain.SOLANA
      expect(userKeyring?.keyringForBlockchain(Blockchain.X1)).toBeDefined();
    });

    it("should fallback to Blockchain.SOLANA when blockchain not specified", async () => {
      // Ensure backward compatibility - if blockchain is not provided, default to SOLANA

      const event = {
        name: "SECURE_SVM_SIGN_TX" as const,
        request: {
          publicKey: "SolanaPubKey123",
          tx: "mock-solana-tx",
          // No blockchain specified - should default to SOLANA
        },
        event: {
          origin: {
            name: "Legacy App",
            address: "https://legacy.app",
            context: "browser" as const,
          },
          uiOptions: { type: "ANY" as const },
        },
        respond: jest.fn(),
        error: jest.fn(),
      };

      const consoleSpy = jest.spyOn(console, "log");

      // @ts-ignore
      await svmService.handleSign(event).catch(() => {});

      // Should log Blockchain.SOLANA as fallback
      expect(consoleSpy).toHaveBeenCalledWith(
        "[SECURE_SVM_SIGN_TX] blockchain:",
        Blockchain.SOLANA
      );

      consoleSpy.mockRestore();
    });
  });

  describe("SECURE_SVM_SIGN_MESSAGE", () => {
    it("should fail with hardcoded Blockchain.SOLANA for X1 messages (BUG)", async () => {
      const event = {
        name: "SECURE_SVM_SIGN_MESSAGE" as const,
        request: {
          blockchain: Blockchain.X1,
          publicKey: mockX1Request.request.publicKey,
          message: encode(Buffer.from("Test message")),
        },
        event: {
          origin: mockX1Request.origin,
        },
        respond: jest.fn(),
        error: jest.fn(),
      };

      await expect(async () => {
        // @ts-ignore
        await svmService.handleSignMessage(event);
      }).rejects.toThrow(
        /no keyring for solana|invariant violation: BlockchainKeyring not found/
      );
    });

    it("should log correct blockchain for message signing", () => {
      const consoleSpy = jest.spyOn(console, "log");

      const event = {
        name: "SECURE_SVM_SIGN_MESSAGE" as const,
        request: {
          blockchain: Blockchain.X1,
          publicKey: mockX1Request.request.publicKey,
          message: encode(Buffer.from("Test message")),
        },
        event: {
          origin: {
            name: "Test App",
            address: "https://test.app",
            context: "browser" as const,
          },
        },
        respond: jest.fn(),
        error: jest.fn(),
      };

      // @ts-ignore
      svmService.handleSignMessage(event).catch(() => {});

      expect(consoleSpy).toHaveBeenCalledWith(
        "[SECURE_SVM_SIGN_MESSAGE] blockchain:",
        Blockchain.X1
      );

      consoleSpy.mockRestore();
    });
  });

  describe("SECURE_SVM_SIGN_ALL_TX", () => {
    it("should fail with hardcoded Blockchain.SOLANA for X1 batch transactions (BUG)", async () => {
      const event = {
        event: {
          origin: {
            name: "Test App",
            address: "https://test.app",
            context: "browser" as const,
          },
        },
        request: {
          blockchain: Blockchain.X1,
          publicKey: mockX1Request.request.publicKey,
          txs: [mockX1Request.request.tx, mockX1Request.request.tx],
        },
        respond: jest.fn(),
        error: jest.fn(),
      };

      await expect(async () => {
        // @ts-ignore
        await svmService.handleSignAll(event);
      }).rejects.toThrow(
        /no keyring for solana|invariant violation: BlockchainKeyring not found/
      );
    });

    it("should log correct blockchain for batch signing", () => {
      const consoleSpy = jest.spyOn(console, "log");

      const event = {
        event: {
          origin: {
            name: "Test App",
            address: "https://test.app",
            context: "browser" as const,
          },
        },
        request: {
          blockchain: Blockchain.X1,
          publicKey: mockX1Request.request.publicKey,
          txs: [mockX1Request.request.tx],
        },
        respond: jest.fn(),
        error: jest.fn(),
      };

      // @ts-ignore
      svmService.handleSignAll(event).catch(() => {});

      expect(consoleSpy).toHaveBeenCalledWith(
        "[SECURE_SVM_SIGN_ALL_TX] blockchain:",
        Blockchain.X1
      );

      consoleSpy.mockRestore();
    });
  });

  describe("Integration Test: Full Request Flow", () => {
    it("should process X1 transaction request end-to-end", async () => {
      // This test simulates the full flow from extension to secure-background
      const requestId = "test-request-id";

      // Step 1: Extension sends SECURE_SVM_SIGN_TX request with blockchain: "x1"
      console.log("Step 1: Extension sends request");
      console.log("Request:", {
        name: mockX1Request.name,
        blockchain: mockX1Request.request.blockchain,
        publicKey: mockX1Request.request.publicKey,
      });

      // Step 2: Server receives request and logs blockchain parameter
      console.log("Step 2: Server receives request");
      const consoleSpy = jest.spyOn(console, "log");

      const event = {
        name: mockX1Request.name,
        request: mockX1Request.request,
        event: {
          origin: mockX1Request.origin,
          uiOptions: mockX1Request.uiOptions,
        },
        respond: jest.fn(),
        error: jest.fn(),
      };

      // Step 3: Handler processes request
      console.log("Step 3: Handler processes request");
      try {
        // @ts-ignore
        await svmService.handleSign(event);
      } catch (error: any) {
        console.log("Step 4: Error occurred:", error.message);

        // BUG: This should show the hardcoded blockchain lookup issue
        expect(error.message).toMatch(/solana/);
      }

      // Verify console log showed correct blockchain
      expect(consoleSpy).toHaveBeenCalledWith(
        "[SECURE_SVM_SIGN_TX] blockchain:",
        Blockchain.X1
      );

      consoleSpy.mockRestore();
    });
  });
});

// ============================================================================
// Mock Helper Functions
// ============================================================================

function createMockKeyringStore(): KeyringStore {
  const mockX1Keyring = {
    signTransaction: jest.fn().mockResolvedValue("mock-signature"),
    signMessage: jest.fn().mockResolvedValue("mock-signature"),
    publicKeys: jest
      .fn()
      .mockReturnValue(["5paZC1vV94AF513DJn5yXj2TTnTEqm4RuPkWgKYujAi5"]),
  };

  const mockUserKeyring = {
    keyringForBlockchain: jest.fn((blockchain: Blockchain) => {
      // Only return keyring for X1, not for SOLANA
      // This reproduces the bug condition
      if (blockchain === Blockchain.X1) {
        return mockX1Keyring;
      }
      // Simulate missing Solana keyring
      return undefined;
    }),
  };

  return {
    getUserKeyring: jest.fn().mockReturnValue(mockUserKeyring),
  } as any;
}

function createMockSender(): TransportSender {
  return {
    send: jest.fn().mockResolvedValue({ response: "mock-response" }),
  } as any;
}

function createMockReceiver(): TransportReceiver<any> {
  return {
    setHandler: jest.fn().mockReturnValue(() => {}),
  } as any;
}
