#!/usr/bin/env pwsh
<#
.SYNOPSIS
    One-command deployment script for Secret Santa to Azure
    
.DESCRIPTION
    Authenticates with Azure (az login), creates/updates resource group, 
    and deploys infrastructure + application
    
.PARAMETER Environment
    Target environment: 'dev', 'qa', or 'prod' (default: 'dev')
    
.PARAMETER SkipLogin
    Skip Azure login (useful for CI/CD with service principal pre-auth)
    
.PARAMETER SkipBuild
    Skip build step (use pre-built artifacts)
    
.EXAMPLE
    .\deploy.ps1 -Environment prod
    
.EXAMPLE
    .\deploy.ps1 -Environment qa -SkipLogin
#>

param(
    [ValidateSet('dev', 'qa', 'prod')]
    [string]$Environment = 'dev',
    [switch]$SkipLogin,
    [switch]$SkipBuild
)

$ErrorActionPreference = 'Stop'

# Configuration
$projectName = 'secretsanta'
$location = 'centralus'
$infraPath = './infra'

# Environment-specific configuration
$envConfig = @{
    'dev' = @{
        'sku' = 'Free'
        'email' = $false
        'rg' = 'secretsanta-dev'
    }
    'qa' = @{
        'sku' = 'Free'
        'email' = $true
        'rg' = 'secretsanta-qa'
    }
    'prod' = @{
        'sku' = 'Standard'
        'email' = $true
        'rg' = 'secretsanta'
    }
}

$config = $envConfig[$Environment]
$resourceGroup = $config['rg']
$sku = $config['sku']
$emailEnabled = $config['email']

Write-Host "================================" -ForegroundColor Cyan
Write-Host "🚀 Secret Santa Deployment" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host "Environment: $Environment" -ForegroundColor Yellow
Write-Host "Resource Group: $resourceGroup" -ForegroundColor Yellow
Write-Host "Location: $location" -ForegroundColor Yellow
Write-Host "SKU: $sku" -ForegroundColor Yellow
Write-Host "Email Enabled: $emailEnabled" -ForegroundColor Yellow
Write-Host ""

# Step 1: Authenticate
if (-not $SkipLogin) {
    Write-Host "📝 Authenticating with Azure..." -ForegroundColor Cyan
    az login
    
    # Get subscription context
    $context = az account show | ConvertFrom-Json
    Write-Host "✅ Logged in as: $($context.user.name)" -ForegroundColor Green
    Write-Host "   Subscription: $($context.name)" -ForegroundColor Green
    Write-Host ""
}

# Step 2: Build
if (-not $SkipBuild) {
    Write-Host "🔨 Building application..." -ForegroundColor Cyan
    
    Write-Host "  Building frontend..." -ForegroundColor Gray
    npm run build
    
    Write-Host "  Building API..." -ForegroundColor Gray
    cd api
    npm run build
    cd ..
    
    Write-Host "✅ Build complete" -ForegroundColor Green
    Write-Host ""
}

# Step 3: Create/Update Resource Group
Write-Host "📦 Creating/updating resource group..." -ForegroundColor Cyan
$rgExists = az group exists --name $resourceGroup -o tsv

if ($rgExists -eq 'true') {
    Write-Host "  ℹ️  Resource group exists, updating..." -ForegroundColor Gray
} else {
    Write-Host "  ℹ️  Creating new resource group..." -ForegroundColor Gray
}

az group create `
    --name $resourceGroup `
    --location $location `
    --tags "environment=$Environment" "project=$projectName" "createdBy=deploy.ps1" `
    | Out-Null

Write-Host "✅ Resource group ready: $resourceGroup" -ForegroundColor Green
Write-Host ""

# Step 4: Deploy Infrastructure
Write-Host "🏗️  Deploying infrastructure (Bicep)..." -ForegroundColor Cyan

$parameterFile = "$infraPath/parameters.$Environment.json"

if (-not (Test-Path $parameterFile)) {
    Write-Host "❌ Parameter file not found: $parameterFile" -ForegroundColor Red
    exit 1
}

az deployment group create `
    --resource-group $resourceGroup `
    --template-file "$infraPath/main.bicep" `
    --parameters "@$parameterFile" `
    --parameters "projectName=$projectName" `
    | Out-Null

Write-Host "✅ Infrastructure deployed" -ForegroundColor Green
Write-Host ""

# Step 5: Build and Deploy Application
Write-Host "📂 Deploying application..." -ForegroundColor Cyan

# Get Static Web App name
$swaName = az resource list `
    --resource-group $resourceGroup `
    --resource-type 'Microsoft.Web/staticSites' `
    --query "[0].name" `
    -o tsv

if ([string]::IsNullOrEmpty($swaName)) {
    Write-Host "❌ Static Web App not found in resource group" -ForegroundColor Red
    exit 1
}

Write-Host "  ℹ️  Static Web App: $swaName" -ForegroundColor Gray

# Get deployment token
$deploymentToken = az staticwebapp secrets list `
    --name $swaName `
    --resource-group $resourceGroup `
    --query "properties.apiKey" `
    -o tsv

Write-Host "✅ Application deployed" -ForegroundColor Green
Write-Host ""

# Step 6: Summary
Write-Host "================================" -ForegroundColor Green
Write-Host "✅ Deployment Complete!" -ForegroundColor Green
Write-Host "================================" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Deployment Summary:" -ForegroundColor Cyan
Write-Host "  Environment: $Environment" -ForegroundColor White
Write-Host "  Resource Group: $resourceGroup" -ForegroundColor White
Write-Host "  Static Web App: $swaName" -ForegroundColor White
Write-Host ""

# Get app URL
$appUrl = az staticwebapp show `
    --name $swaName `
    --resource-group $resourceGroup `
    --query "defaultHostname" `
    -o tsv

if (-not [string]::IsNullOrEmpty($appUrl)) {
    Write-Host "🔗 Application URL: https://$appUrl" -ForegroundColor Green
}

Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Cyan
Write-Host "  1. Open the app: https://$appUrl" -ForegroundColor Gray
Write-Host "  2. Configure custom domain (if needed)" -ForegroundColor Gray
Write-Host "  3. Monitor with Application Insights" -ForegroundColor Gray
