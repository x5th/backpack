#!/usr/bin/env node

/**
 * Mock REST Server for Transaction Activity
 *
 * This server responds to POST requests at /transactions endpoint
 * and returns mock transaction data for any wallet address.
 *
 * Usage:
 *   node mock-rest-server.js
 *
 * The server will listen on http://localhost:4000
 */

const http = require("http");
const PORT = 4000;

// Mock transaction template
const createMockTransaction = (index, offset = 0) => {
  const types = [
    "SEND",
    "RECEIVE",
    "SWAP",
    "STAKE",
    "UNSTAKE",
    "NFT_MINT",
    "NFT_SALE",
  ];
  const now = new Date();
  const hoursAgo = (index + offset) * 3;
  const timestamp = new Date(now.getTime() - hoursAgo * 60 * 60 * 1000);

  const type = types[index % types.length];
  const isSend = type === "SEND";
  const isNFT = type.startsWith("NFT_");

  return {
    hash: `${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`,
    type: type,
    timestamp: timestamp.toISOString(),
    amount: isNFT ? "1" : (Math.random() * 100).toFixed(2),
    tokenName: isNFT ? "Cool NFT Collection" : "X1 Token",
    tokenSymbol: isNFT ? "CNFT" : "XNT",
    fee: (Math.random() * 0.001).toFixed(6),
    feePayer: "mock" + Math.random().toString(36).substring(2, 15),
    description: getDescription(type, index),
    error: null,
    source: getSource(type),
    nfts: isNFT
      ? [
          {
            mint: "NFTmint" + Math.random().toString(36).substring(2, 15),
            name: `Cool NFT #${1000 + index}`,
            image: `https://example.com/nft/${1000 + index}.png`,
          },
        ]
      : [],
  };
};

const getDescription = (type, index) => {
  const descriptions = {
    SEND: ["Transfer to wallet", "Payment sent", "Sent to friend"],
    RECEIVE: ["Received payment", "Incoming transfer", "Payment received"],
    SWAP: ["Swapped XNT for USDC", "Token swap", "Exchanged tokens"],
    STAKE: ["Staked to validator", "Staking rewards", "Validator stake"],
    UNSTAKE: ["Unstaked tokens", "Withdrew stake", "Unstake from validator"],
    NFT_MINT: ["Minted NFT", "NFT created", "New NFT minted"],
    NFT_SALE: ["Sold NFT", "NFT sale", "NFT transferred"],
  };

  const options = descriptions[type] || ["Transaction"];
  return options[index % options.length];
};

const getSource = (type) => {
  if (type.startsWith("NFT_")) return "marketplace";
  if (type === "SWAP") return "dex";
  if (type === "STAKE" || type === "UNSTAKE") return "staking";
  return "wallet";
};

// Request handler
const server = http.createServer((req, res) => {
  // Enable CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // Handle preflight
  if (req.method === "OPTIONS") {
    res.writeHead(200);
    res.end();
    return;
  }

  // Only handle POST to /transactions
  if (req.method !== "POST" || req.url !== "/transactions") {
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not Found" }));
    return;
  }

  let body = "";

  req.on("data", (chunk) => {
    body += chunk.toString();
  });

  req.on("end", () => {
    try {
      const requestData = JSON.parse(body);
      const {
        address,
        providerId,
        limit = 50,
        offset = 0,
        tokenMint,
      } = requestData;

      console.log(`\n📥 [${new Date().toISOString()}] Request received:`);
      console.log(`   Address: ${address}`);
      console.log(`   Provider: ${providerId}`);
      console.log(`   Limit: ${limit}, Offset: ${offset}`);
      if (tokenMint) console.log(`   Token Mint: ${tokenMint}`);

      // Generate mock transactions
      const totalTransactions = 25; // Total mock transactions available
      const transactions = [];
      const actualLimit = Math.min(limit, 50);

      for (let i = 0; i < actualLimit && offset + i < totalTransactions; i++) {
        transactions.push(createMockTransaction(i, offset));
      }

      const hasMore = offset + transactions.length < totalTransactions;

      const response = {
        transactions,
        hasMore,
        totalCount: totalTransactions,
        requestParams: {
          address,
          providerId,
          limit: actualLimit,
          offset,
        },
        meta: {
          timestamp: new Date().toISOString(),
          version: "1.0.0",
        },
      };

      console.log(
        `✅ Returning ${transactions.length} transactions (hasMore: ${hasMore})\n`
      );

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(response, null, 2));
    } catch (error) {
      console.error("❌ Error processing request:", error);
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          error: "Bad Request",
          message: error.message,
        })
      );
    }
  });
});

server.listen(PORT, () => {
  console.log("🚀 Mock REST Server Started");
  console.log("================================");
  console.log(`📍 Listening on: http://localhost:${PORT}`);
  console.log(`📡 Endpoint: POST /transactions`);
  console.log("\n📝 Expected request body:");
  console.log(
    JSON.stringify(
      {
        address: "wallet_address_here",
        providerId: "X1-testnet",
        limit: 50,
        offset: 0,
      },
      null,
      2
    )
  );
  console.log("\n💡 Press Ctrl+C to stop the server\n");
});

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(`❌ Error: Port ${PORT} is already in use`);
    console.error("   Please stop the other server or use a different port");
  } else {
    console.error("❌ Server error:", error);
  }
  process.exit(1);
});
