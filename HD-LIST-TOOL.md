# Home Depot List Tool

A CLI tool for managing Home Depot lists via their GraphQL API. Create lists, add items by SKU, and fetch existing list contents.

## Prerequisites

- Node.js 18+ (uses native `fetch`)
- A Home Depot account with list access
- Bearer token from browser DevTools

## Getting Your Bearer Token

1. Log into homedepot.com
2. Open DevTools (F12 or Cmd+Shift+I)
3. Go to Network tab
4. Perform any action (like viewing a list)
5. Find any request to `federation-gateway/graphql`
6. Copy the `Authorization` header value (everything after "Bearer ")

> **Note:** Tokens expire after some time. You'll need to refresh when you get authentication errors.

## Usage

```bash
node hd-list-tool.js [options]
```

### Options

| Option | Description |
|--------|-------------|
| `--list-id <id>` | The Home Depot list ID (UUID from URL) |
| `--create-list <name>` | Create a new list with the given name |
| `--fetch-list` | Fetch all items from a list |
| `--token <token>` | Your Bearer token (required) |
| `--items <SKU:QTY,...>` | Comma-separated SKU:quantity pairs |
| `--file <path>` | JSON file with items array |
| `--batch-size <n>` | Items per API call (default: 10) |
| `--store-id <id>` | Store ID for pricing (default: 473) |
| `--output <path>` | Output file for `--fetch-list` |

## Examples

### Add Items to an Existing List

```bash
node hd-list-tool.js \
  --list-id "1be7cce0-9f0e-11f0-908a-071e30655413" \
  --token "eyJz..." \
  --items "100125397:5,100456789:2,100789123:10"
```

**Output:**
```
Adding 3 items to list 1be7cce0-9f0e-11f0-908a-071e30655413...

Adding batch 1/1 (3 items)...
  Success!

Complete! 1 batches succeeded, 0 failed.

List ID: 1be7cce0-9f0e-11f0-908a-071e30655413
```

### Create a New List and Add Items

```bash
node hd-list-tool.js \
  --create-list "Electrical Restock Jan 2026" \
  --token "eyJz..." \
  --items "100125397:5,100456789:2"
```

**Output:**
```
Creating list "Electrical Restock Jan 2026"...
  Created list with ID: 06a82be0-f3ff-11f0-81ae-edb383cc6004

Adding 2 items to list 06a82be0-f3ff-11f0-81ae-edb383cc6004...

Adding batch 1/1 (2 items)...
  Success!

Complete! 1 batches succeeded, 0 failed.

List ID: 06a82be0-f3ff-11f0-81ae-edb383cc6004
```

### Create an Empty List

```bash
node hd-list-tool.js \
  --create-list "New Project List" \
  --token "eyJz..."
```

**Output:**
```
Creating list "New Project List"...
  Created list with ID: 12345678-abcd-1234-efgh-567890abcdef

List created successfully (no items to add).

List ID: 12345678-abcd-1234-efgh-567890abcdef
```

### Fetch All Items from a List

```bash
node hd-list-tool.js \
  --fetch-list \
  --list-id "1be7cce0-9f0e-11f0-908a-071e30655413" \
  --token "eyJz..."
```

**Output:**
```json
{
  "listId": "1be7cce0-9f0e-11f0-908a-071e30655413",
  "name": "Electrical Stock",
  "itemCount": 3,
  "subTotal": "$127.45",
  "items": [
    {
      "sku": "100125397",
      "quantity": 5,
      "group": "Default",
      "comments": null
    },
    {
      "sku": "100456789",
      "quantity": 2,
      "group": "Default",
      "comments": null
    },
    {
      "sku": "100789123",
      "quantity": 10,
      "group": "Default",
      "comments": null
    }
  ]
}
```

### Fetch List and Save to File

```bash
node hd-list-tool.js \
  --fetch-list \
  --list-id "1be7cce0-9f0e-11f0-908a-071e30655413" \
  --token "eyJz..." \
  --output electrical-stock.json
```

**Output:**
```
List saved to electrical-stock.json
  Name: Electrical Stock
  Items: 3
  Subtotal: $127.45
```

### Add Items from a JSON File

Create a file `items.json`:
```json
[
  {"sku": "100125397", "quantity": 5},
  {"sku": "100456789", "quantity": 2},
  {"sku": "100789123", "quantity": 10}
]
```

Then run:
```bash
node hd-list-tool.js \
  --list-id "1be7cce0-9f0e-11f0-908a-071e30655413" \
  --token "eyJz..." \
  --file items.json
```

### Large Batch with Custom Batch Size

```bash
node hd-list-tool.js \
  --list-id "1be7cce0-9f0e-11f0-908a-071e30655413" \
  --token "eyJz..." \
  --file large-order.json \
  --batch-size 5
```

**Output:**
```
Adding 25 items to list 1be7cce0-9f0e-11f0-908a-071e30655413...

Adding batch 1/5 (5 items)...
  Success!
Adding batch 2/5 (5 items)...
  Success!
Adding batch 3/5 (5 items)...
  Success!
Adding batch 4/5 (5 items)...
  Success!
Adding batch 5/5 (5 items)...
  Success!

Complete! 5 batches succeeded, 0 failed.

List ID: 1be7cce0-9f0e-11f0-908a-071e30655413
```

## Finding SKUs

SKUs can be found on any Home Depot product page in the URL or product details. For example:
- URL: `homedepot.com/p/Eaton-BR-50-Amp-Circuit-Breaker/100125397` - SKU is `100125397`
- Product page: Look for "Internet #" or "SKU" in product details

## Error Handling

If a batch fails, the tool will continue with remaining batches and report failures:

```
Adding batch 1/3 (10 items)...
  Success!
Adding batch 2/3 (10 items)...
  Failed: GraphQL errors: [{"message":"Invalid SKU"}]
Adding batch 3/3 (5 items)...
  Success!

Complete! 2 batches succeeded, 1 failed.

Failed batches:
  Batch 2: GraphQL errors: [{"message":"Invalid SKU"}]
    Items: 999999999, 888888888, ...
```

## Workflow Example

1. **Export existing list for backup:**
   ```bash
   node hd-list-tool.js --fetch-list --list-id "..." --token "..." --output backup.json
   ```

2. **Create a new list from a template:**
   ```bash
   node hd-list-tool.js --create-list "Project ABC" --token "..." --file template.json
   ```

3. **Add more items to the list:**
   ```bash
   node hd-list-tool.js --list-id "..." --token "..." --items "100125397:10,100456789:5"
   ```
