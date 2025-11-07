# X1 JSON Server

## Overview

The X1 JSON Server is a local development server that provides wallet balance and token price data for X1 blockchain integration with the Backpack wallet. It serves as a mock backend API during development and testing.

## Location

```
/Users/yakovlevin/dev/backpack/x1-json-server.js
```

## Purpose

The Backpack wallet's Apollo GraphQL client is configured to fetch token balances and prices from various blockchain providers. For X1 blockchain, which is a new SVM-compatible chain, we need a custom API endpoint since standard Solana APIs don't support X1.

This server intercepts X1-specific queries from the wallet and provides:
- Real-time XNT balance from X1 RPC
- Token metadata (name, symbol, decimals)
- Price data ($1.00 per XNT)
- GraphQL priority fee estimates
- Transaction security scanning (mock)

## How It Works

### Architecture

```
┌─────────────────────┐
│  Backpack Wallet    │
│  (Chrome Extension) │
└──────────┬──────────┘
           │
           │ Apollo GraphQL Query
           │ providerId: "X1"
           │
           ▼
┌─────────────────────────────────────────┐
│  Apollo Interceptor                     │
│  packages/common/src/apollo/index.ts    │
│                                         │
│  if (providerId === "X1")               │
│    → http://localhost:4000/wallet/:addr│
└──────────┬──────────────────────────────┘
           │
           │ HTTP GET
           │
           ▼
┌─────────────────────────────────────────┐
│  X1 JSON Server (Port 4000)             │
│  x1-json-server.js                      │
│                                         │
│  ┌───────────────────────────────────┐ │
│  │ GET /wallet/:address?providerId=X1│ │
│  │   → Fetch balance from X1 RPC     │ │
│  │   → Return token data             │ │
│  └───────────────────────────────────┘ │
│                                         │
│  ┌───────────────────────────────────┐ │
│  │ POST /v2/graphql                  │ │
│  │   → Priority fee estimates        │ │
│  └───────────────────────────────────┘ │
│                                         │
│  ┌───────────────────────────────────┐ │
│  │ GET /test                         │ │
│  │   → Transaction signing test UI   │ │
│  └───────────────────────────────────┘ │
└──────────┬──────────────────────────────┘
           │
           │ JSON-RPC
           │
           ▼
┌─────────────────────────────────────────┐
│  X1 RPC                                 │
│  https://rpc.mainnet.x1.xyz             │
│                                         │
│  getBalance(address) → lamports         │
└─────────────────────────────────────────┘
```

### Code Integration Points

#### 1. Apollo Interceptor (`packages/common/src/apollo/index.ts`)

```typescript
export const x1InterceptorLink = new ApolloLink((operation, forward) => {
  const { variables } = operation;
  const isX1Query = variables?.providerId === "X1";

  if (!isX1Query) return forward(operation);

  // Intercept X1 queries and route to local server
  const address = variables.address;
  return fetch(`${X1_JSON_SERVER_URL}/wallet/${address}?providerId=X1`)
    .then(response => response.json())
    .then(data => ({
      data: {
        wallet: {
          balances: {
            tokens: data.tokens
          }
        }
      }
    }));
});
```

#### 2. Constants (`packages/common/src/constants.ts`)

```typescript
export const X1_JSON_SERVER_URL = "http://localhost:4000";
```

#### 3. X1 RPC Connection (`packages/common/src/solana/cluster.ts`)

X1 blockchain uses its own RPC endpoint configured in the wallet settings:
```
https://rpc.mainnet.x1.xyz
```

## API Endpoints

### 1. Wallet Balance Endpoint

**Request:**
```
GET /wallet/:address?providerId=X1
```

**Response:**
```json
{
  "balance": 0.0999965,
  "tokens": [
    {
      "mint": "XNT111111111111111111111111111111111111111",
      "decimals": 9,
      "balance": 0.0999965,
      "logo": "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png",
      "name": "X1 Native Token",
      "symbol": "XNT",
      "price": 1.0,
      "valueUSD": 0.0999965
    }
  ]
}
```

**Implementation:**
- Calls X1 RPC `getBalance(address)` method
- Converts lamports to XNT (9 decimals)
- Returns token metadata with current price

### 2. GraphQL Priority Fee Endpoint

**Request:**
```
POST /v2/graphql
Content-Type: application/json

{
  "query": "query GetSolanaPriorityFee($transaction: String!) { solanaPriorityFeeEstimate(transaction: $transaction) }",
  "variables": { "transaction": "base58_encoded_tx" },
  "operationName": "GetSolanaPriorityFee"
}
```

**Response:**
```json
{
  "data": {
    "solanaPriorityFeeEstimate": "1000"
  }
}
```

### 3. Transaction Scan Endpoint

**Request:**
```
GET /solana/v0/mainnet/scan/transactions?language=en
```

**Response:**
```json
{
  "transactions": []
}
```

**Purpose:** Mock response for Blowfish security scanning. Returns empty array since X1 is not yet supported by Blowfish.

### 4. Test Page

**URL:**
```
http://localhost:4000/test
```

**Purpose:** Interactive web interface for testing X1 transaction signing and message signing with the Backpack wallet.

**Features:**
- Connect wallet and view balance
- Send XNT tokens
- Sign arbitrary messages
- Transaction history log
- Real-time balance updates

## Running the Server

### Start Server

```bash
cd /Users/yakovlevin/dev/backpack
node x1-json-server.js
```

**Output:**
```
================================================================================
🚀 X1 JSON Server Started
================================================================================
📡 Listening on: http://localhost:4000
📋 Endpoint: GET /wallet/:address?providerId=X1
🧪 Test Page: http://localhost:4000/test

Example:
  curl "http://localhost:4000/wallet/5paZC1vV94AF513DJn5yXj2TTnTEqm4RuPkWgKYujAi5?providerId=X1"

Press Ctrl+C to stop
================================================================================
```

### Test Balance Query

```bash
curl "http://localhost:4000/wallet/9gdwrSvdzeWfxLPxfW2EHbavfkYTXa2iGv19dUr7BMgq?providerId=X1"
```

## Configuration

### Port

Default: `4000`

To change port, edit `x1-json-server.js`:
```javascript
const PORT = 4000;
```

And update `packages/common/src/constants.ts`:
```typescript
export const X1_JSON_SERVER_URL = "http://localhost:4000";
```

### X1 RPC URL

Default: `https://rpc.mainnet.x1.xyz`

To change RPC endpoint, edit `x1-json-server.js`:
```javascript
const X1_RPC_URL = 'https://rpc.mainnet.x1.xyz';
```

### XNT Price

Default: `$1.00`

To change price, edit `x1-json-server.js`:
```javascript
const XNT_PRICE = 1.0; // $1 per XNT
```

## Development Workflow

### 1. Extension Development

```bash
# Terminal 1: Build and watch extension
yarn build:ext

# Terminal 2: Run X1 JSON server
node x1-json-server.js
```

### 2. Testing Workflow

1. Load extension from `packages/app-extension/build/` in Chrome
2. Start X1 JSON server: `node x1-json-server.js`
3. Open test page: http://localhost:4000/test
4. Connect wallet and test signing

### 3. Debugging

**Check server logs:**
```
[2025-11-07T04:59:07.083Z] GET /wallet/9gdwrSvdzeWfxLPxfW2EHbavfkYTXa2iGv19dUr7BMgq?providerId=X1
✅ X1 wallet request for address: 9gdwrSvdzeWfxLPxfW2EHbavfkYTXa2iGv19dUr7BMgq
  Balance from X1 RPC: 0.0999965 XNT
```

**Check Apollo interceptor:**
Open browser DevTools → Network tab → Filter by "wallet" → Look for requests to localhost:4000

## Error Handling

### Balance Fetch Failure

If X1 RPC is unavailable, the server returns default data:
```json
{
  "balance": 0,
  "tokens": [
    {
      "mint": "XNT111111111111111111111111111111111111111",
      "balance": 0,
      "price": 1.0,
      "valueUSD": 0
    }
  ]
}
```

Error is logged but doesn't crash the server:
```
❌ Error fetching balance: connect ECONNREFUSED
```

## Files Structure

```
backpack/
├── x1-json-server.js              # Main server file
├── x1-test-signing.html           # Test page UI
├── test-server.js                 # Alternative standalone test server (not used)
├── X1_JSON_SERVER_README.md       # This file
└── packages/
    ├── common/src/
    │   ├── apollo/index.ts        # GraphQL interceptor
    │   └── constants.ts           # X1_JSON_SERVER_URL constant
    └── app-extension/build/        # Built extension
```

## Production Considerations

⚠️ **This is a development server only**

For production deployment, you would need:

1. **Production API Service**
   - Deploy REST API on cloud infrastructure
   - Add authentication and rate limiting
   - Use real price feeds (CoinGecko, CoinMarketCap, etc.)
   - Implement caching layer

2. **Configuration Updates**
   - Update `X1_JSON_SERVER_URL` to production URL
   - Add environment-specific configs
   - Implement proper error handling

3. **Security**
   - HTTPS/TLS
   - CORS configuration for production domains
   - Input validation and sanitization
   - Rate limiting

## Troubleshooting

### Issue: Wallet shows "0 XNT" balance

**Cause:** X1 JSON server not running

**Solution:**
```bash
node x1-json-server.js
```

### Issue: "Failed to fetch" errors in wallet

**Cause:** Server not accessible or wrong URL

**Check:**
1. Server is running on port 4000
2. No other service using port 4000
3. `X1_JSON_SERVER_URL` matches server port

### Issue: Balance not updating

**Cause:** Cache or stale data

**Solution:**
1. Refresh wallet
2. Restart X1 JSON server
3. Clear browser cache

### Issue: Test page shows "Wallet not found"

**Cause:** Extension not loaded or content script not injected

**Solution:**
1. Verify extension loaded in chrome://extensions
2. Refresh test page
3. Check browser console for errors
4. Ensure extension has `<all_urls>` permission

## Related Documentation

- [TESTING_GUIDE.md](./TESTING_GUIDE.md) - Manual testing procedures for X1 wallet
- [X1_KEYRING_FIX_SUMMARY.md](./X1_KEYRING_FIX_SUMMARY.md) - X1 keyring bug fix details
- [X1_KEYRING_BUG_README.md](./X1_KEYRING_BUG_README.md) - Detailed bug analysis

## Git Commits

- `5b69cb40` - Add X1 JSON server with GraphQL and transaction scan endpoints
- `692e324d` - Add test page route to X1 JSON server
- `9f3738e3` - Add X1 transaction signing test page
- `6066f4a3` - Add wallet injection detection and retry logic to test page
