# Helper script to deploy the API

Write-Host "Deploying CampusLink API to Cloudflare Workers..." -ForegroundColor Cyan

# Install dependencies if missing
if (!(Test-Path "node_modules")) {
    Write-Host "Installing dependencies..."
    npm install
}

# Check for Wrangler login
Write-Host "Checking Wrangler status..."
npx wrangler whoami

# Deploy
Write-Host "Deploying..." -ForegroundColor Yellow
npx wrangler deploy

Write-Host "Deployment complete!" -ForegroundColor Green
Write-Host "Running secrets setup reminder..."
Write-Host "REMINDER: Set your secrets if you haven't already:" -ForegroundColor Magenta
Write-Host "  npx wrangler secret put SUPABASE_URL"
Write-Host "  npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY"
Write-Host "  npx wrangler secret put MP_ACCESS_TOKEN"
