#!/usr/bin/env node

/**
 * X1 Transaction Indexer
 *
 * This service polls the X1 blockchain RPC for new transactions and stores them
 * in the SQLite database via the x1-json-server API.
 *
 * Features:
 * - Polls X1 RPC for transaction signatures
 * - Fetches and parses transaction details
 * - Stores transactions in SQLite via /transactions/store endpoint
 * - Supports multiple wallet addresses
 * - Configurable polling interval
 * - Automatic retry on errors
 */

const https = require("https");

// Configuration
const CONFIG = {
  // X1 RPC endpoints
  X1_TESTNET_RPC: "https://rpc.testnet.x1.xyz",
  X1_MAINNET_RPC: "https://rpc.mainnet.x1.xyz",

  // API server endpoint
  API_SERVER: "http://localhost:4000",

  // Polling configuration
  POLL_INTERVAL_MS: 30000, // 30 seconds
  MAX_SIGNATURES_PER_POLL: 50,

  // Retry configuration
  MAX_RETRIES: 3,
  RETRY_DELAY_MS: 5000,

  // Dynamic wallet loading - wallets are now loaded from API
  // To add wallets, they will be auto-registered when querying transactions
  // Or manually register via: POST /wallets/register
};

// Track last processed signature for each wallet
const lastProcessedSignatures = new Map();

/**
 * Make RPC call to X1 blockchain
 */
function rpcCall(endpoint, method, params) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method,
      params,
    });

    const options = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(postData),
      },
    };

    const req = https.request(endpoint, options, (res) => {
      let data = "";

      res.on("data", (chunk) => {
        data += chunk;
      });

      res.on("end", () => {
        try {
          const response = JSON.parse(data);
          if (response.error) {
            reject(new Error(response.error.message || "RPC error"));
          } else {
            resolve(response.result);
          }
        } catch (error) {
          reject(error);
        }
      });
    });

    req.on("error", (error) => {
      reject(error);
    });

    req.write(postData);
    req.end();
  });
}

/**
 * Fetch transaction signatures for an address
 * Note: RPC returns signatures in descending order (newest first)
 * We fetch the latest signatures and filter out ones we've already processed
 */
async function getSignaturesForAddress(
  rpcUrl,
  address,
  limit = 50,
  lastProcessed = null
) {
  const params = [address, { limit }];
  // Don't use 'before' parameter - always fetch latest signatures
  // We'll filter out already-processed ones locally

  const result = await rpcCall(rpcUrl, "getSignaturesForAddress", params);

  if (!result || !lastProcessed) {
    return result;
  }

  // Filter out signatures we've already processed
  // Stop at the last processed signature
  const newSignatures = [];
  for (const sig of result) {
    if (sig.signature === lastProcessed) {
      break; // Found the last one we processed, stop here
    }
    newSignatures.push(sig);
  }

  return newSignatures;
}

/**
 * Fetch transaction details
 */
async function getTransaction(rpcUrl, signature) {
  return await rpcCall(rpcUrl, "getTransaction", [
    signature,
    {
      encoding: "jsonParsed",
      maxSupportedTransactionVersion: 0,
    },
  ]);
}

/**
 * Parse and format transaction for storage
 * @param {object} txData - Transaction data from RPC
 * @param {string} signature - Transaction signature/hash
 * @param {string} walletAddress - The wallet address we're indexing for
 */
function parseTransaction(txData, signature, walletAddress) {
  try {
    const tx = txData.transaction;
    const meta = txData.meta;

    // Determine transaction type based on instructions
    let type = "UNKNOWN";
    let amount = null;
    let description = null;

    // Find which account index corresponds to our wallet
    let walletAccountIndex = -1;
    if (tx.message && tx.message.accountKeys) {
      walletAccountIndex = tx.message.accountKeys.findIndex(
        (acc) => acc.pubkey === walletAddress
      );
    }

    // Determine type based on balance change for THIS wallet
    if (
      meta &&
      meta.postBalances &&
      meta.preBalances &&
      walletAccountIndex >= 0
    ) {
      const balanceChange =
        meta.postBalances[walletAccountIndex] -
        meta.preBalances[walletAccountIndex];
      if (balanceChange > 0) {
        type = "RECEIVE";
        amount = (balanceChange / 1e9).toFixed(9);
        description = "Received XNT";
      } else if (balanceChange < 0) {
        type = "SEND";
        amount = (Math.abs(balanceChange) / 1e9).toFixed(9);
        description = "Sent XNT";
      }
    }

    // Get timestamp
    const timestamp = txData.blockTime
      ? new Date(txData.blockTime * 1000).toISOString()
      : new Date().toISOString();

    // Get fee
    const fee = meta && meta.fee ? (meta.fee / 1e9).toFixed(9) : "0";

    return {
      hash: signature,
      type,
      timestamp,
      amount,
      tokenName: "X1 Token",
      tokenSymbol: "XNT",
      fee,
      feePayer: tx.message?.accountKeys?.[0]?.pubkey || null,
      description: description || `${type} transaction`,
      error: meta && meta.err ? JSON.stringify(meta.err) : null,
      source: "wallet",
      nfts: [],
    };
  } catch (error) {
    console.error(`Error parsing transaction ${signature}:`, error);

    // Return minimal transaction data
    return {
      hash: signature,
      type: "UNKNOWN",
      timestamp: new Date().toISOString(),
      amount: null,
      tokenName: "X1 Token",
      tokenSymbol: "XNT",
      fee: "0",
      feePayer: null,
      description: "Parse error",
      error: error.message,
      source: "wallet",
      nfts: [],
    };
  }
}

/**
 * Fetch registered wallets from API
 */
async function fetchRegisteredWallets() {
  return new Promise((resolve, reject) => {
    const url = new URL(`${CONFIG.API_SERVER}/wallets`);

    const req = require("http").request(url, { method: "GET" }, (res) => {
      let data = "";

      res.on("data", (chunk) => {
        data += chunk;
      });

      res.on("end", () => {
        try {
          const response = JSON.parse(data);
          if (response.success) {
            resolve(response.wallets);
          } else {
            reject(new Error("Failed to fetch wallets"));
          }
        } catch (error) {
          reject(error);
        }
      });
    });

    req.on("error", (error) => {
      reject(error);
    });

    req.end();
  });
}

/**
 * Update last indexed timestamp for a wallet
 */
async function updateLastIndexed(address) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({ address });
    const url = new URL(`${CONFIG.API_SERVER}/wallets/update-indexed`);

    const options = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(postData),
      },
    };

    const req = require("http").request(url, options, (res) => {
      let data = "";

      res.on("data", (chunk) => {
        data += chunk;
      });

      res.on("end", () => {
        resolve();
      });
    });

    req.on("error", (error) => {
      // Don't reject, just log - this is not critical
      console.error(
        `   Warning: Failed to update last_indexed timestamp:`,
        error.message
      );
      resolve();
    });

    req.write(postData);
    req.end();
  });
}

/**
 * Store transactions via API
 */
async function storeTransactions(address, providerId, transactions) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      address,
      providerId,
      transactions,
    });

    const url = new URL(`${CONFIG.API_SERVER}/transactions/store`);

    const options = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(postData),
      },
    };

    const req = require("http").request(url, options, (res) => {
      let data = "";

      res.on("data", (chunk) => {
        data += chunk;
      });

      res.on("end", () => {
        try {
          const response = JSON.parse(data);
          resolve(response);
        } catch (error) {
          reject(error);
        }
      });
    });

    req.on("error", (error) => {
      reject(error);
    });

    req.write(postData);
    req.end();
  });
}

/**
 * Index transactions for a wallet
 */
async function indexWallet(wallet) {
  const { address, network, enabled } = wallet;

  if (!enabled) {
    console.log(`⏭️  Skipping disabled wallet: ${address.substring(0, 8)}...`);
    return;
  }

  const rpcUrl =
    network === "mainnet" ? CONFIG.X1_MAINNET_RPC : CONFIG.X1_TESTNET_RPC;

  const providerId = network === "mainnet" ? "X1-mainnet" : "X1-testnet";

  console.log(
    `\n🔍 Indexing wallet: ${address.substring(0, 8)}... (${network})`
  );

  try {
    // Fetch signatures
    const lastSig = lastProcessedSignatures.get(address);
    const signatures = await getSignaturesForAddress(
      rpcUrl,
      address,
      CONFIG.MAX_SIGNATURES_PER_POLL,
      lastSig
    );

    if (!signatures || signatures.length === 0) {
      console.log(`   No new transactions found`);
      return;
    }

    console.log(`   Found ${signatures.length} signatures`);

    // Fetch and parse transactions
    const transactions = [];
    for (const sigInfo of signatures) {
      try {
        const txData = await getTransaction(rpcUrl, sigInfo.signature);
        const parsed = parseTransaction(txData, sigInfo.signature, address);
        transactions.push(parsed);
      } catch (error) {
        console.error(
          `   ❌ Error fetching tx ${sigInfo.signature}:`,
          error.message
        );
      }
    }

    if (transactions.length === 0) {
      console.log(`   No transactions to store`);
      return;
    }

    // Store transactions
    console.log(`   💾 Storing ${transactions.length} transactions...`);
    const result = await storeTransactions(address, providerId, transactions);

    console.log(
      `   ✅ Stored: ${result.inserted} new, ${result.duplicates} duplicates, ${result.errors} errors`
    );

    // Update last processed signature
    if (signatures.length > 0) {
      lastProcessedSignatures.set(address, signatures[0].signature);
    }

    // Update last indexed timestamp in database
    await updateLastIndexed(address);
  } catch (error) {
    console.error(`   ❌ Error indexing wallet:`, error.message);
  }
}

/**
 * Main polling loop
 */
async function pollAll() {
  console.log(`\n${"=".repeat(80)}`);
  console.log(`⏰ Polling cycle started: ${new Date().toISOString()}`);
  console.log(`${"=".repeat(80)}`);

  try {
    // Fetch wallets from API
    const wallets = await fetchRegisteredWallets();
    console.log(`👛 Found ${wallets.length} registered wallet(s)\n`);

    for (const wallet of wallets) {
      try {
        await indexWallet(wallet);
      } catch (error) {
        console.error(`Error processing wallet ${wallet.address}:`, error);
      }
    }
  } catch (error) {
    console.error(`❌ Error fetching wallets:`, error.message);
    console.log(`   Will retry on next poll cycle`);
  }

  console.log(
    `\n✓ Polling cycle complete. Next poll in ${CONFIG.POLL_INTERVAL_MS / 1000}s\n`
  );
}

/**
 * Start the indexer
 */
async function start() {
  console.log("\n" + "=".repeat(80));
  console.log("🚀 X1 Transaction Indexer Started");
  console.log("=".repeat(80));
  console.log(`📡 Testnet RPC: ${CONFIG.X1_TESTNET_RPC}`);
  console.log(`📡 Mainnet RPC: ${CONFIG.X1_MAINNET_RPC}`);
  console.log(`🔗 API Server: ${CONFIG.API_SERVER}`);
  console.log(`⏱️  Poll Interval: ${CONFIG.POLL_INTERVAL_MS / 1000}s`);
  console.log(`\n💡 Wallets are loaded dynamically from the database`);
  console.log(`💡 Wallets are auto-registered when querying transactions`);
  console.log(
    `💡 Or manually register via: POST ${CONFIG.API_SERVER}/wallets/register`
  );
  console.log("=".repeat(80) + "\n");

  // Run first poll immediately
  await pollAll();

  // Schedule recurring polls
  setInterval(pollAll, CONFIG.POLL_INTERVAL_MS);
}

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("\n\n👋 Shutting down indexer...");
  console.log("✅ Indexer stopped");
  process.exit(0);
});

// Handle errors
process.on("unhandledRejection", (error) => {
  console.error("❌ Unhandled rejection:", error);
});

// Start the indexer
start().catch((error) => {
  console.error("❌ Failed to start indexer:", error);
  process.exit(1);
});
