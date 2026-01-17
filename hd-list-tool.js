#!/usr/bin/env node
/**
 * Home Depot List Tool
 * Creates lists, fetches items, and adds items via Home Depot's GraphQL API
 *
 * Usage:
 *   node hd-list-tool.js --list-id <listId> --token <bearerToken> --items '100125397:5,100456789:2'
 *   node hd-list-tool.js --create-list "List Name" --token <bearerToken> --items '100125397:5,100456789:2'
 *   node hd-list-tool.js --fetch-list --list-id <listId> --token <bearerToken>
 *
 * Or with a JSON file:
 *   node hd-list-tool.js --list-id <listId> --token <bearerToken> --file items.json
 *
 * items.json format:
 *   [{"sku": "100125397", "quantity": 5}, {"sku": "100456789", "quantity": 2}]
 */

const fs = require('fs');

const HD_GRAPHQL_URL = 'https://www.homedepot.com/federation-gateway/graphql?opname=updateList';
const HD_CREATE_LIST_URL = 'https://www.homedepot.com/federation-gateway/graphql?opname=createList';
const HD_LIST_DETAILS_URL = 'https://www.homedepot.com/federation-gateway/graphql?opname=listProductDetails';

async function createList(token, name) {
  const body = {
    operationName: 'createList',
    variables: {
      name: name
    },
    query: `mutation createList($name: String!) {
  createList(name: $name) {
    id
    name
    __typename
  }
}`
  };

  const headers = {
    'accept': '*/*',
    'accept-language': 'en-US,en;q=0.9',
    'authorization': `Bearer ${token}`,
    'content-type': 'application/json',
    'x-thd-customer-token': token,
    'x-experience-name': 'b2b-pip-desktop',
    'x-hd-dc': 'origin'
  };

  const response = await fetch(HD_CREATE_LIST_URL, {
    method: 'POST',
    headers: headers,
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const result = await response.json();

  if (result.errors) {
    throw new Error(`GraphQL errors: ${JSON.stringify(result.errors)}`);
  }

  return result.data.createList;
}

async function fetchListItems(listId, token, storeId = '473') {
  const body = {
    operationName: 'listProductDetails',
    variables: {
      id: listId,
      sharedList: false,
      storeId: storeId
    },
    query: `query listProductDetails($id: String!, $storeId: String, $sharedList: Boolean) {
  listProductDetails(id: $id, storeId: $storeId, sharedList: $sharedList) {
    id
    itemCount
    itemIds
    name
    listAccessType
    url
    groups {
      groupId
      groupName
      groupOrder
      items {
        itemId
        quantity
        itemOrder
        comments
        intent
        intentId
        __typename
      }
      __typename
    }
    subTotal
    __typename
  }
}`
  };

  const headers = {
    'accept': '*/*',
    'accept-language': 'en-US,en;q=0.9',
    'authorization': `Bearer ${token}`,
    'content-type': 'application/json',
    'x-thd-customer-token': token,
    'x-experience-name': 'lists-and-registries',
    'x-hd-dc': 'origin'
  };

  const response = await fetch(HD_LIST_DETAILS_URL, {
    method: 'POST',
    headers: headers,
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const result = await response.json();

  if (result.errors) {
    throw new Error(`GraphQL errors: ${JSON.stringify(result.errors)}`);
  }

  return result.data.listProductDetails;
}

async function addItemsToList(listId, token, items) {
  const products = items.map(item => ({
    itemId: String(item.sku),
    quantity: item.quantity || 1
  }));

  const body = {
    operationName: 'updateList',
    variables: {
      id: listId,
      operationName: 'AddItems',
      products: products
    },
    query: `mutation updateList($id: String!, $operationName: UpdateOperation, $products: [ProductInput!]) {
  updateList(id: $id, operationName: $operationName, products: $products) {
    id
    __typename
  }
}`
  };

  const headers = {
    'accept': '*/*',
    'accept-language': 'en-US,en;q=0.9',
    'authorization': `Bearer ${token}`,
    'content-type': 'application/json',
    'x-thd-customer-token': token,
    'x-experience-name': 'b2b-pip-desktop',
    'x-hd-dc': 'origin'
  };

  const response = await fetch(HD_GRAPHQL_URL, {
    method: 'POST',
    headers: headers,
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const result = await response.json();

  if (result.errors) {
    throw new Error(`GraphQL errors: ${JSON.stringify(result.errors)}`);
  }

  return result;
}

async function addItemsInBatches(listId, token, items, batchSize = 10) {
  const results = [];

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    console.log(`Adding batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(items.length / batchSize)} (${batch.length} items)...`);

    try {
      const result = await addItemsToList(listId, token, batch);
      results.push({ success: true, batch: i / batchSize + 1, items: batch });
      console.log(`  Success!`);
    } catch (err) {
      results.push({ success: false, batch: i / batchSize + 1, items: batch, error: err.message });
      console.error(`  Failed: ${err.message}`);
    }

    // Small delay between batches to avoid rate limiting
    if (i + batchSize < items.length) {
      await new Promise(r => setTimeout(r, 500));
    }
  }

  return results;
}

function parseItemsString(str) {
  // Format: "SKU:QTY,SKU:QTY" e.g., "100125397:5,100456789:2"
  return str.split(',').map(part => {
    const [sku, qty] = part.trim().split(':');
    return { sku: sku.trim(), quantity: parseInt(qty) || 1 };
  });
}

function printUsage() {
  console.log(`
Home Depot List Tool - Create lists, fetch items, and add items via Home Depot's API

Usage:
  node hd-list-tool.js --list-id <listId> --token <token> --items "SKU:QTY,SKU:QTY"
  node hd-list-tool.js --list-id <listId> --token <token> --file items.json
  node hd-list-tool.js --create-list "List Name" --token <token> --items "SKU:QTY,SKU:QTY"
  node hd-list-tool.js --fetch-list --list-id <listId> --token <token>

Options:
  --list-id      The Home Depot list ID (from the URL when viewing your list)
  --create-list  Create a new list with the given name (returns list ID)
  --fetch-list   Fetch all items from a list (outputs JSON)
  --token        Your Bearer token (from browser DevTools)
  --items        Comma-separated SKU:quantity pairs
  --file         JSON file with items array
  --batch-size   Number of items per API call (default: 10)
  --store-id     Store ID for fetching list (default: 473)
  --output       Output file for --fetch-list (default: stdout)

Examples:
  # Add items to an existing list
  node hd-list-tool.js --list-id "1be7cce0-9f0e-11f0-908a-071e30655413" \\
    --token "eyJz..." \\
    --items "100125397:5,100456789:2,100789123:10"

  # Create a new list and add items to it
  node hd-list-tool.js --create-list "Electrical Restock" \\
    --token "eyJz..." \\
    --items "100125397:5,100456789:2"

  # Fetch all items from a list
  node hd-list-tool.js --fetch-list --list-id "1be7cce0-9f0e-11f0-908a-071e30655413" \\
    --token "eyJz..."

  # Fetch list and save to file
  node hd-list-tool.js --fetch-list --list-id "1be7cce0-9f0e-11f0-908a-071e30655413" \\
    --token "eyJz..." --output my-list.json

  # Create an empty list
  node hd-list-tool.js --create-list "New Project List" --token "eyJz..."

JSON file format:
  [
    {"sku": "100125397", "quantity": 5},
    {"sku": "100456789", "quantity": 2}
  ]

Notes:
  - Get list ID from the URL when viewing your list on homedepot.com
  - Get token from DevTools > Network > find any API request > copy Authorization header value (without "Bearer ")
  - Token expires after some time, you'll need to refresh it
`);
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    printUsage();
    process.exit(0);
  }

  let listId, token, items, batchSize = 10, createListName, fetchList = false, storeId = '473', outputFile;

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--list-id':
        listId = args[++i];
        break;
      case '--create-list':
        createListName = args[++i];
        break;
      case '--fetch-list':
        fetchList = true;
        break;
      case '--token':
        token = args[++i];
        break;
      case '--items':
        items = parseItemsString(args[++i]);
        break;
      case '--file':
        const fileContent = fs.readFileSync(args[++i], 'utf8');
        items = JSON.parse(fileContent);
        break;
      case '--batch-size':
        batchSize = parseInt(args[++i]);
        break;
      case '--store-id':
        storeId = args[++i];
        break;
      case '--output':
        outputFile = args[++i];
        break;
    }
  }

  if (!token) {
    console.error('Error: --token is required');
    printUsage();
    process.exit(1);
  }

  // Handle fetch-list mode
  if (fetchList) {
    if (!listId) {
      console.error('Error: --list-id is required for --fetch-list');
      printUsage();
      process.exit(1);
    }

    try {
      const listDetails = await fetchListItems(listId, token, storeId);

      // Flatten items from all groups
      const allItems = [];
      for (const group of (listDetails.groups || [])) {
        for (const item of (group.items || [])) {
          allItems.push({
            sku: item.itemId,
            quantity: item.quantity,
            group: group.groupName,
            comments: item.comments || null
          });
        }
      }

      const output = {
        listId: listDetails.id,
        name: listDetails.name,
        itemCount: listDetails.itemCount,
        subTotal: listDetails.subTotal,
        items: allItems
      };

      const jsonOutput = JSON.stringify(output, null, 2);

      if (outputFile) {
        fs.writeFileSync(outputFile, jsonOutput);
        console.log(`List saved to ${outputFile}`);
        console.log(`  Name: ${listDetails.name}`);
        console.log(`  Items: ${allItems.length}`);
        console.log(`  Subtotal: ${listDetails.subTotal}`);
      } else {
        console.log(jsonOutput);
      }
    } catch (err) {
      console.error(`Failed to fetch list: ${err.message}`);
      process.exit(1);
    }
    return;
  }

  if (!listId && !createListName) {
    console.error('Error: Either --list-id or --create-list is required');
    printUsage();
    process.exit(1);
  }

  // Create a new list if requested
  if (createListName) {
    console.log(`\nCreating list "${createListName}"...`);
    try {
      const newList = await createList(token, createListName);
      listId = newList.id;
      console.log(`  Created list with ID: ${listId}`);
    } catch (err) {
      console.error(`  Failed to create list: ${err.message}`);
      process.exit(1);
    }
  }

  // Add items if provided
  if (items && items.length > 0) {
    console.log(`\nAdding ${items.length} items to list ${listId}...\n`);

    const results = await addItemsInBatches(listId, token, items, batchSize);

    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    console.log(`\nComplete! ${successful} batches succeeded, ${failed} failed.`);

    if (failed > 0) {
      console.log('\nFailed batches:');
      results.filter(r => !r.success).forEach(r => {
        console.log(`  Batch ${r.batch}: ${r.error}`);
        console.log(`    Items: ${r.items.map(i => i.sku).join(', ')}`);
      });
    }
  } else if (!createListName) {
    console.error('Error: --items or --file is required when using --list-id');
    printUsage();
    process.exit(1);
  } else {
    console.log('\nList created successfully (no items to add).');
  }

  console.log(`\nList ID: ${listId}`);
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
