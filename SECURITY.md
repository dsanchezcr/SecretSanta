# Security Policy

Thank you for helping keep Secret Santa secure!

## Reporting Security Issues

If you believe you have found a security vulnerability, please report it privately to us.

**Please do not report security vulnerabilities through public GitHub issues, discussions, or pull requests.**

Instead, please send an email to **github@dsanchezcr.com**.

Include as much of the information listed below as you can to help us better understand and resolve the issue:

- **Type of issue**: (e.g., buffer overflow, SQL injection, cross-site scripting, authentication bypass)
- **Affected component**: Frontend, API, Database, Infrastructure
- **Source file paths** related to the issue
- **Location**: Tag, branch, commit, or direct URL
- **Configuration required** to reproduce
- **Step-by-step reproduction** instructions
- **Proof-of-concept** or exploit code (if possible)
- **Impact assessment**: How could an attacker exploit this?
- **Severity**: Critical, High, Medium, Low

## Security Best Practices for Contributors

### Dependencies
- Keep all npm packages updated
- Run `npm audit` before submitting PRs
- Report vulnerable dependencies privately first

### Code
- Never commit secrets (API keys, tokens, passwords)
- Use environment variables for sensitive configuration
- Sanitize user input on both frontend and API
- Use HTTPS for all communications
- Enable CORS restrictions appropriately

### Azure Resources
- Use managed identities when possible
- Rotate secrets regularly
- Enable Application Insights for monitoring
- Use resource group RBAC for access control
- Enable audit logging

## Third-Party Services

This application uses the following third-party services:

- **Azure Communication Services**: For sending notification emails (optional, only when explicitly requested by users)
- **Google Analytics**: For anonymous usage analytics (optional, requires user consent via cookie banner, only in production)

### Google Analytics
- Only loads in production environment
- Requires explicit user consent via cookie consent banner
- Collects anonymous usage data (page views, interaction patterns)
- Users can opt out at any time through the privacy policy page
- Tracking ID is configured via `VITE_GA_TRACKING_ID` environment variable (required for analytics to work)

## Automated Security Scanning

This project uses:
- **CodeQL**: Static code analysis for security vulnerabilities
- **Dependency Check**: Identifies known vulnerable dependencies
- **npm audit**: Runtime dependency vulnerability scanning

These run automatically on all pull requests and merges to main.

## Response Timeline

- **Acknowledgment**: Within 48 hours
- **Initial assessment**: Within 1 week
- **Patch release**: As soon as possible after confirmation
- **Public disclosure**: After patch is available

## Disclosure Timeline

We follow responsible disclosure practices:
1. Issue reported privately
2. We confirm and create a fix
3. Security update released
4. Vulnerability publicly disclosed after update is available

If you prefer a different disclosure timeline, please let us know in your initial report.

## Questions?

For security questions that aren't vulnerabilities, feel free to open a discussion or email github@dsanchezcr.com.

