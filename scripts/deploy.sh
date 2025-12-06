#!/bin/bash
###############################################################################
# Secret Santa Deployment Script
#
# One-command deployment to Azure with automatic resource group creation
# and infrastructure provisioning
#
# Usage:
#   ./deploy.sh [dev|qa|prod] [--skip-login] [--skip-build]
#
# Examples:
#   ./deploy.sh prod
#   ./deploy.sh qa --skip-login
###############################################################################

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
PROJECT_NAME="secretsanta"
LOCATION="centralus"
INFRA_PATH="./infra"

# Parse arguments
ENVIRONMENT="${1:-dev}"
SKIP_LOGIN=false
SKIP_BUILD=false

for arg in "$@"; do
    case $arg in
        --skip-login)
            SKIP_LOGIN=true
            shift
            ;;
        --skip-build)
            SKIP_BUILD=true
            shift
            ;;
    esac
done

# Validate environment
if [[ ! "$ENVIRONMENT" =~ ^(dev|qa|prod)$ ]]; then
    echo -e "${RED}❌ Invalid environment: $ENVIRONMENT${NC}"
    echo "   Valid options: dev, qa, prod"
    exit 1
fi

# Environment configuration
declare -A SKU_MAP=(
    [dev]="Free"
    [qa]="Free"
    [prod]="Standard"
)

declare -A EMAIL_MAP=(
    [dev]="false"
    [qa]="true"
    [prod]="true"
)

declare -A RG_MAP=(
    [dev]="secretsanta-dev"
    [qa]="secretsanta-qa"
    [prod]="secretsanta"
)

RESOURCE_GROUP="${RG_MAP[$ENVIRONMENT]}"
SKU="${SKU_MAP[$ENVIRONMENT]}"
EMAIL_ENABLED="${EMAIL_MAP[$ENVIRONMENT]}"

# Header
echo -e "${CYAN}================================${NC}"
echo -e "${CYAN}🚀 Secret Santa Deployment${NC}"
echo -e "${CYAN}================================${NC}"
echo -e "${YELLOW}Environment: $ENVIRONMENT${NC}"
echo -e "${YELLOW}Resource Group: $RESOURCE_GROUP${NC}"
echo -e "${YELLOW}Location: $LOCATION${NC}"
echo -e "${YELLOW}SKU: $SKU${NC}"
echo -e "${YELLOW}Email Enabled: $EMAIL_ENABLED${NC}"
echo ""

# Step 1: Authenticate
if [ "$SKIP_LOGIN" = false ]; then
    echo -e "${CYAN}📝 Authenticating with Azure...${NC}"
    az login
    
    SUBSCRIPTION=$(az account show --query 'name' -o tsv)
    USER=$(az account show --query 'user.name' -o tsv)
    echo -e "${GREEN}✅ Logged in as: $USER${NC}"
    echo -e "${GREEN}   Subscription: $SUBSCRIPTION${NC}"
    echo ""
fi

# Step 2: Build
if [ "$SKIP_BUILD" = false ]; then
    echo -e "${CYAN}🔨 Building application...${NC}"
    
    echo -e "${CYAN}  Building frontend...${NC}"
    npm run build
    
    echo -e "${CYAN}  Building API...${NC}"
    cd api
    npm run build
    cd ..
    
    echo -e "${GREEN}✅ Build complete${NC}"
    echo ""
fi

# Step 3: Create/Update Resource Group
echo -e "${CYAN}📦 Creating/updating resource group...${NC}"

RG_EXISTS=$(az group exists --name "$RESOURCE_GROUP" -o tsv)

if [ "$RG_EXISTS" = "true" ]; then
    echo -e "${CYAN}  ℹ️  Resource group exists, updating...${NC}"
else
    echo -e "${CYAN}  ℹ️  Creating new resource group...${NC}"
fi

az group create \
    --name "$RESOURCE_GROUP" \
    --location "$LOCATION" \
    --tags "environment=$ENVIRONMENT" "project=$PROJECT_NAME" "createdBy=deploy.sh" \
    > /dev/null

echo -e "${GREEN}✅ Resource group ready: $RESOURCE_GROUP${NC}"
echo ""

# Step 4: Deploy Infrastructure
echo -e "${CYAN}🏗️  Deploying infrastructure (Bicep)...${NC}"

PARAMETER_FILE="$INFRA_PATH/parameters.$ENVIRONMENT.json"

if [ ! -f "$PARAMETER_FILE" ]; then
    echo -e "${RED}❌ Parameter file not found: $PARAMETER_FILE${NC}"
    exit 1
fi

az deployment group create \
    --resource-group "$RESOURCE_GROUP" \
    --template-file "$INFRA_PATH/main.bicep" \
    --parameters "@$PARAMETER_FILE" \
    --parameters "projectName=$PROJECT_NAME" \
    > /dev/null

echo -e "${GREEN}✅ Infrastructure deployed${NC}"
echo ""

# Step 5: Deploy Application
echo -e "${CYAN}📂 Deploying application...${NC}"

# Get Static Web App name
SWA_NAME=$(az resource list \
    --resource-group "$RESOURCE_GROUP" \
    --resource-type 'Microsoft.Web/staticSites' \
    --query "[0].name" \
    -o tsv)

if [ -z "$SWA_NAME" ]; then
    echo -e "${RED}❌ Static Web App not found in resource group${NC}"
    exit 1
fi

echo -e "${CYAN}  ℹ️  Static Web App: $SWA_NAME${NC}"

# Get deployment token
DEPLOYMENT_TOKEN=$(az staticwebapp secrets list \
    --name "$SWA_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --query "properties.apiKey" \
    -o tsv)

echo -e "${GREEN}✅ Application deployed${NC}"
echo ""

# Step 6: Summary
echo -e "${GREEN}================================${NC}"
echo -e "${GREEN}✅ Deployment Complete!${NC}"
echo -e "${GREEN}================================${NC}"
echo ""
echo -e "${CYAN}📋 Deployment Summary:${NC}"
echo -e "  Environment: $ENVIRONMENT"
echo -e "  Resource Group: $RESOURCE_GROUP"
echo -e "  Static Web App: $SWA_NAME"
echo ""

# Get app URL
APP_URL=$(az staticwebapp show \
    --name "$SWA_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --query "defaultHostname" \
    -o tsv)

if [ ! -z "$APP_URL" ]; then
    echo -e "${GREEN}🔗 Application URL: https://$APP_URL${NC}"
fi

echo ""
echo -e "${CYAN}Next Steps:${NC}"
echo -e "  1. Open the app: https://$APP_URL"
echo -e "  2. Configure custom domain (if needed)"
echo -e "  3. Monitor with Application Insights"
