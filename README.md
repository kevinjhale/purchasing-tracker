# Receipt Tracker

A simple, self-hosted web application for tracking construction purchase receipts with image/PDF uploads and line item tracking.

## Features

- Upload receipt images (JPG, PNG) and PDFs
- Track job name, date, store location, and notes per receipt
- Add multiple line items per receipt (item name, date, amount)
- Automatic total calculation
- Mobile-friendly responsive design
- SQLite database (single file, easy backup)
- Local file storage for uploads

## Requirements

- Node.js 18+ (LTS recommended)
- npm 8+

## Quick Start

```bash
# Clone the repository
git clone https://github.com/kevinjhale/purchasing-tracker.git
cd purchasing-tracker

# Install dependencies
npm install

# Start the server
npm start
```

Open http://localhost:3000 in your browser.

## Project Structure

```
purchasing-tracker/
├── server.js          # Express server and API routes
├── database.js        # SQLite database layer
├── package.json       # Dependencies and scripts
├── public/
│   ├── index.html     # Single-page application
│   ├── styles.css     # Responsive styles
│   └── app.js         # Frontend JavaScript
├── uploads/           # Receipt files (auto-created)
└── data/
    └── receipts.db    # SQLite database (auto-created)
```

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT`   | `3000`  | Server port |

Example:
```bash
PORT=8080 npm start
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/receipts` | List all receipts with items |
| POST | `/api/receipts` | Create receipt (multipart form) |
| GET | `/api/receipts/:id` | Get single receipt |
| PUT | `/api/receipts/:id` | Update receipt |
| DELETE | `/api/receipts/:id` | Delete receipt and file |
| POST | `/api/receipts/:id/items` | Add line item |
| PUT | `/api/items/:id` | Update line item |
| DELETE | `/api/items/:id` | Delete line item |

## Deployment

### Option 1: Direct Node.js

Run directly on a server with Node.js installed:

```bash
# Install dependencies
npm install --production

# Run with a process manager (recommended)
npm install -g pm2
pm2 start server.js --name receipt-tracker

# Or run directly
PORT=3000 node server.js
```

### Option 2: Docker

Create a `Dockerfile`:

```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .

# Create directories for persistent data
RUN mkdir -p /app/data /app/uploads

EXPOSE 3000

CMD ["node", "server.js"]
```

Build and run:

```bash
# Build the image
docker build -t receipt-tracker .

# Run with persistent storage
docker run -d \
  --name receipt-tracker \
  -p 3000:3000 \
  -v receipt-data:/app/data \
  -v receipt-uploads:/app/uploads \
  receipt-tracker
```

### Option 3: Docker Compose

Create a `docker-compose.yml`:

```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    volumes:
      - ./data:/app/data
      - ./uploads:/app/uploads
    restart: unless-stopped
```

Run:

```bash
docker compose up -d
```

### Reverse Proxy (Nginx)

For production, put behind a reverse proxy with HTTPS:

```nginx
server {
    listen 80;
    server_name receipts.example.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name receipts.example.com;

    ssl_certificate /etc/letsencrypt/live/receipts.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/receipts.example.com/privkey.pem;

    client_max_body_size 10M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## Backup

The application stores all data in two locations:

- `data/receipts.db` - SQLite database
- `uploads/` - Receipt files

To backup:

```bash
# Stop the application first for consistency
cp data/receipts.db backup/receipts-$(date +%Y%m%d).db
cp -r uploads/ backup/uploads-$(date +%Y%m%d)/
```

## Development

```bash
# Run with auto-reload (Node.js 18+)
npm run dev
```

## License

MIT
