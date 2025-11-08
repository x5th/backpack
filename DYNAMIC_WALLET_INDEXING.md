# Dynamic Wallet Indexing System

The X1 transaction indexer now supports **dynamic wallet discovery** - it automatically indexes any wallet that interacts with the REST API!

## How It Works

### 1. Auto-Registration

When a wallet queries the `/transactions` endpoint, it's automatically registered for indexing:

```bash
curl -X POST http://localhost:4000/transactions \
  -H "Content-Type: application/json" \
  -d '{"address":"YOUR_WALLET_ADDRESS","providerId":"X1-testnet","limit":10,"offset":0}'
```

This wallet is now in the database and will be picked up by the indexer on the next poll cycle.

### 2. Dynamic Indexing

The indexer polls every 30 seconds and:

- Fetches the list of registered wallets from the API (`GET /wallets`)
- Indexes each enabled wallet
- Stores new transactions in the database
- Updates the `last_indexed` timestamp

### 3. No Hardcoded Wallets

The `transaction-indexer.js` no longer requires hardcoded wallet addresses. All wallets are loaded from the database dynamically.

## API Endpoints

### List Registered Wallets

```bash
curl http://localhost:4000/wallets
```

Response:

```json
{
  "success": true,
  "wallets": [
    {
      "address": "nGMPASmdzR8V4vRKCZ3bLExsDTX1A5dqZ94iUaPY7SP",
      "network": "testnet",
      "enabled": true,
      "lastIndexed": "2025-11-08T06:31:15.234Z"
    }
  ],
  "count": 1
}
```

### Manually Register a Wallet

```bash
curl -X POST http://localhost:4000/wallets/register \
  -H "Content-Type: application/json" \
  -d '{"address":"YOUR_WALLET_ADDRESS","network":"testnet","enabled":true}'
```

Response:

```json
{
  "success": true,
  "wallet": {
    "address": "YOUR_WALLET_ADDRESS",
    "network": "testnet",
    "enabled": true
  }
}
```

## Database Schema

### Wallets Table

```sql
CREATE TABLE wallets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  address TEXT NOT NULL UNIQUE,
  network TEXT NOT NULL DEFAULT 'testnet',
  enabled INTEGER NOT NULL DEFAULT 1,
  last_indexed TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
```

Fields:

- `address` - Wallet public key
- `network` - Either 'testnet' or 'mainnet'
- `enabled` - 1 = active indexing, 0 = disabled
- `last_indexed` - ISO timestamp of last successful index
- `created_at` - When wallet was registered

## Usage Examples

### Scenario 1: Wallet Extension User

1. User opens Backpack wallet extension
2. Clicks on "Activity" tab
3. Extension queries `POST /transactions` with user's wallet address
4. **Wallet is automatically registered**
5. On next indexer poll (within 30 seconds), wallet starts being indexed
6. Future transactions appear automatically

### Scenario 2: Manual Registration

```bash
# Register a mainnet wallet
curl -X POST http://localhost:4000/wallets/register \
  -H "Content-Type: application/json" \
  -d '{
    "address": "5paZC1vV94AF513DJn5yXj2TTnTEqm4RuPkWgKYujAi5",
    "network": "mainnet",
    "enabled": true
  }'
```

### Scenario 3: Disable Indexing for a Wallet

```bash
# Update wallet to disabled
curl -X POST http://localhost:4000/wallets/register \
  -H "Content-Type: application/json" \
  -d '{
    "address": "nGMPASmdzR8V4vRKCZ3bLExsDTX1A5dqZ94iUaPY7SP",
    "network": "testnet",
    "enabled": false
  }'
```

## Monitoring

### Check Indexer Status

```bash
# View live indexer logs
tail -f /tmp/x1-indexer.log
```

Output shows:

```
================================================================================
⏰ Polling cycle started: 2025-11-08T06:30:59.818Z
================================================================================
👛 Found 1 registered wallet(s)

🔍 Indexing wallet: nGMPASmd... (testnet)
   Found 4 signatures
   💾 Storing 4 transactions...
   ✅ Stored: 4 new, 0 duplicates, 0 errors

✓ Polling cycle complete. Next poll in 30s
```

### Check Server Logs

```bash
tail -f /tmp/x1-server.log
```

### Query Database Directly

```bash
sqlite3 transactions.db "SELECT * FROM wallets;"
```

## Benefits

1. **Zero Configuration** - No need to edit config files to add wallets
2. **Automatic Discovery** - Wallets are discovered as users use the extension
3. **Scalable** - Can handle hundreds or thousands of wallets
4. **Centralized Management** - All wallet configuration in one database
5. **Flexible** - Enable/disable wallets via API without restarting services

## Architecture

```
┌─────────────────┐
│  Wallet Users   │
│  (Extensions)   │
└────────┬────────┘
         │
         │ POST /transactions
         │ (auto-registers wallet)
         ▼
┌─────────────────┐
│  x1-json-server │
│  (REST API)     │
└────────┬────────┘
         │
         │ stores in
         ▼
┌─────────────────┐
│  SQLite DB      │
│  - wallets      │
│  - transactions │
└────────┬────────┘
         │
         │ GET /wallets
         │ (every 30s)
         ▼
┌─────────────────┐
│ Indexer Service │
│  (Background)   │
└────────┬────────┘
         │
         │ Polls X1 RPC
         │ for new txs
         ▼
┌─────────────────┐
│  X1 Blockchain  │
└─────────────────┘
```

## Deployment Notes

### Starting Services

```bash
# Start server
node x1-json-server.js > /tmp/x1-server.log 2>&1 &

# Start indexer
node transaction-indexer.js > /tmp/x1-indexer.log 2>&1 &
```

### Production with PM2

```bash
# Start both services
pm2 start x1-json-server.js --name "x1-server"
pm2 start transaction-indexer.js --name "x1-indexer"

# Save configuration
pm2 save

# Enable auto-start on reboot
pm2 startup
```

## Migration from Hardcoded Wallets

If you previously had hardcoded wallets in `transaction-indexer.js`:

```javascript
// OLD (before)
WALLETS: [
  {
    address: "nGMPASmdzR8V4vRKCZ3bLExsDTX1A5dqZ94iUaPY7SP",
    network: "testnet",
    enabled: true,
  },
];
```

**Migration Steps:**

1. Stop the indexer
2. Manually register your wallets via the API (see above)
3. Restart the indexer - it will now load wallets dynamically

Or simply query `/transactions` with your wallet addresses and they'll be auto-registered!
