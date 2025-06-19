# Express Multi-Tenant Demo

This example demonstrates how to use the Multi-Tenant SaaS Toolkit with Express.js.

## Features Demonstrated

- Subdomain-based tenant resolution
- JWT authentication
- Role-based access control (RBAC)
- Attribute-based access control (ABAC)
- Tenant context management

## Setup

1. Install dependencies:
```bash
npm install
```

2. Start the server:
```bash
npm run dev
```

3. Configure your hosts file to test subdomains locally:
```
127.0.0.1 acme.localhost
127.0.0.1 techstartup.localhost
```

## Testing the API

### 1. Login to get a JWT token

```bash
# Login as admin
curl -X POST http://acme.localhost:3000/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@acme.com", "password": "password"}'

# Login as member
curl -X POST http://acme.localhost:3000/login \
  -H "Content-Type: application/json" \
  -d '{"email": "member@acme.com", "password": "password"}'
```

### 2. Access tenant information

```bash
# Get current tenant info (replace TOKEN with actual JWT)
curl http://acme.localhost:3000/api/tenant \
  -H "Authorization: Bearer TOKEN"
```

### 3. Test role-based access

```bash
# Admin-only endpoint (works with admin token)
curl http://acme.localhost:3000/api/admin \
  -H "Authorization: Bearer ADMIN_TOKEN"

# Member-accessible endpoint (works with both admin and member tokens)
curl http://acme.localhost:3000/api/projects \
  -H "Authorization: Bearer TOKEN"
```

### 4. Test attribute-based access

```bash
# Update a project (only owner or admin can update)
curl -X PUT http://acme.localhost:3000/api/projects/1 \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Updated Project Alpha"}'
```

### 5. Create a new tenant

```bash
curl -X POST http://localhost:3000/api/tenants \
  -H "Content-Type: application/json" \
  -d '{"name": "New Company", "subdomain": "newco"}'
```

## Project Structure

- `src/index.ts` - Main application file with all routes and middleware
- Mock data store implementation for tenants and users
- JWT authentication implementation
- RBAC and ABAC authorization examples

## Key Concepts

1. **Tenant Resolution**: The middleware automatically identifies the tenant from the subdomain
2. **Context Propagation**: Tenant context is available throughout the request lifecycle
3. **Role-Based Access**: Routes can require specific roles using `requireRole` middleware
4. **Attribute-Based Access**: More complex authorization rules using the policy engine
5. **Data Isolation**: In a real application, you would use ORM adapters to automatically filter data by tenant