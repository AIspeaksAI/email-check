# 📧 Email Validator API

A modern, secure email validation service built with Next.js 15, featuring OAuth 2.0 authentication and comprehensive email validation including syntax checking and MX record verification.

[![Next.js](https://img.shields.io/badge/Next.js-15.5.3-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.1.0-blue?style=flat-square&logo=react)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4.0-38B2AC?style=flat-square&logo=tailwind-css)](https://tailwindcss.com/)

## ✨ Features

- 🔐 **OAuth 2.0 Authentication** - Secure authentication with JWT tokens
- 🏢 **Salesforce Integration** - Native Salesforce OAuth and JWT support
- 📧 **Comprehensive Email Validation** - Syntax validation (RFC 5322) and MX record verification
- 🎨 **Modern UI** - Built with shadcn/ui and Tailwind CSS
- ⚡ **High Performance** - Powered by Next.js 15 with Turbopack
- 🔒 **Security First** - Bearer token authentication and scope-based authorization
- 📱 **Responsive Design** - Mobile-friendly interface
- 🚀 **Production Ready** - Heroku deployment configuration included

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ 
- npm, yarn, pnpm, or bun
- Salesforce org (for Salesforce integration)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/email-check.git
   cd email-check
   ```

2. **Install dependencies**
   ```bash
   npm install
   # or
   yarn install
   # or
   pnpm install
   # or
   bun install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env.local
   ```
   
   Configure your `.env.local` file:
   ```env
   # OAuth 2.0 Configuration
   JWT_SECRET=your-super-secret-jwt-key-change-in-production
   
   # Salesforce Connected App Configuration
   SALESFORCE_CLIENT_ID=your-salesforce-connected-app-client-id
   SALESFORCE_CLIENT_SECRET=your-salesforce-connected-app-client-secret
   SALESFORCE_REDIRECT_URI=http://localhost:3000/oauth/salesforce/callback
   SALESFORCE_LOGIN_URL=https://login.salesforce.com
   SALESFORCE_API_VERSION=v60.0
   
   # Frontend Configuration
   NEXT_PUBLIC_SALESFORCE_CLIENT_ID=your-salesforce-connected-app-client-id
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   ```

4. **Start the development server**
   ```bash
   npm run dev
   # or
   yarn dev
   # or
   pnpm dev
   # or
   bun dev
   ```

5. **Open your browser**
   
   Navigate to [http://localhost:3000](http://localhost:3000) to see the application.

## 📖 API Documentation

### Authentication

The API uses OAuth 2.0 Bearer token authentication. All requests must include a valid JWT token in the Authorization header:

```http
Authorization: Bearer <your-jwt-token>
```

### Endpoints

#### `POST /api/validate`

Validates an email address with comprehensive checks.

**Request Body:**
```json
{
  "email": "test@example.com"
}
```

**Response (Success):**
```json
{
  "success": true,
  "stage": "mx_record",
  "message": "Email address is valid (syntax and domain checks passed).",
  "validationResults": {
    "syntax": {
      "passed": true,
      "message": "Email format is valid (RFC 5322)"
    },
    "mxRecord": {
      "passed": true,
      "message": "Found 2 MX record(s) for domain",
      "records": ["mail.example.com", "backup.example.com"]
    }
  },
  "authInfo": {
    "userId": "user-123",
    "clientId": "client-456",
    "isSalesforceJWT": true,
    "salesforceUserId": "005XXXXXXXXXXXXXXX",
    "salesforceOrgId": "00DXXXXXXXXXXXXXXX"
  }
}
```

**Response (Error):**
```json
{
  "success": false,
  "stage": "syntax",
  "message": "Invalid email format (RFC 5322)",
  "validationResults": {
    "syntax": {
      "passed": false,
      "message": "Invalid email format (RFC 5322)"
    },
    "mxRecord": {
      "passed": false,
      "message": "",
      "records": []
    }
  }
}
```

**HTTP Status Codes:**
- `200` - Validation successful
- `400` - Invalid email format or domain
- `401` - Invalid or missing authentication token
- `403` - Insufficient permissions (missing `email:validate` scope)

### OAuth Endpoints

- `GET /oauth/authorize` - OAuth 2.0 authorization endpoint
- `POST /oauth/token` - OAuth 2.0 token endpoint
- `POST /oauth/revoke` - OAuth 2.0 token revocation
- `GET /oauth/salesforce/authorize` - Salesforce OAuth authorization
- `GET /oauth/salesforce/callback` - Salesforce OAuth callback
- `POST /oauth/salesforce/token` - Salesforce token exchange

## 🏗️ Architecture

### Tech Stack

- **Frontend**: Next.js 15, React 19, TypeScript
- **Styling**: Tailwind CSS v4, shadcn/ui
- **Authentication**: OAuth 2.0, JWT, Salesforce OAuth
- **Validation**: Zod schema validation, DNS MX record lookup
- **Deployment**: Heroku-ready with Procfile

### Project Structure

```
email-check/
├── app/                    # Next.js App Router
│   ├── api/               # API routes
│   │   ├── oauth/         # OAuth 2.0 endpoints
│   │   └── validate/      # Email validation endpoint
│   ├── globals.css        # Global styles
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Home page
├── components/            # React components
│   ├── ui/               # shadcn/ui components
│   └── oauth-provider.tsx # OAuth context provider
├── lib/                  # Utility functions
│   ├── oauth2.ts         # OAuth 2.0 server logic
│   └── utils.ts          # Common utilities
├── salesforce-examples/  # Salesforce integration examples
└── public/               # Static assets
```

## 🔧 Configuration

### Salesforce Integration

For Salesforce integration, you'll need to set up a Connected App in your Salesforce org. See [salesforce-config.md](./salesforce-config.md) for detailed setup instructions.

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `JWT_SECRET` | Secret key for JWT token signing | Yes |
| `SALESFORCE_CLIENT_ID` | Salesforce Connected App Client ID | Yes |
| `SALESFORCE_CLIENT_SECRET` | Salesforce Connected App Client Secret | Yes |
| `SALESFORCE_REDIRECT_URI` | OAuth callback URL | Yes |
| `SALESFORCE_LOGIN_URL` | Salesforce login URL | Yes |
| `NEXT_PUBLIC_APP_URL` | Public application URL | Yes |

## 🚀 Deployment

### Heroku Deployment

1. **Create a Heroku app**
   ```bash
   heroku create your-email-validator-app
   ```

2. **Set environment variables**
   ```bash
   heroku config:set JWT_SECRET=your-production-jwt-secret
   heroku config:set SALESFORCE_CLIENT_ID=your-production-client-id
   heroku config:set SALESFORCE_CLIENT_SECRET=your-production-client-secret
   heroku config:set SALESFORCE_REDIRECT_URI=https://your-app.herokuapp.com/oauth/salesforce/callback
   heroku config:set NEXT_PUBLIC_APP_URL=https://your-app.herokuapp.com
   ```

3. **Deploy**
   ```bash
   git push heroku main
   ```

### Vercel Deployment

1. **Connect your repository to Vercel**
2. **Set environment variables in Vercel dashboard**
3. **Deploy automatically on push to main branch**

## 🧪 Testing

### Running Tests

```bash
# Run linting
npm run lint

# Type checking
npx tsc --noEmit
```

### Testing Email Validation

1. Start the development server
2. Navigate to the application
3. Log in with OAuth or Salesforce
4. Enter test email addresses:
   - Valid: `test@gmail.com`
   - Invalid syntax: `invalid-email`
   - Invalid domain: `test@nonexistentdomain12345.com`

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

### Development Guidelines

- Follow TypeScript best practices
- Use Prettier for code formatting
- Write meaningful commit messages
- Add tests for new features
- Update documentation as needed

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- 📧 **Email**: support@example.com
- 🐛 **Issues**: [GitHub Issues](https://github.com/yourusername/email-check/issues)
- 📖 **Documentation**: [Wiki](https://github.com/yourusername/email-check/wiki)

## 🙏 Acknowledgments

- [Next.js](https://nextjs.org/) for the amazing React framework
- [shadcn/ui](https://ui.shadcn.com/) for the beautiful component library
- [Tailwind CSS](https://tailwindcss.com/) for the utility-first CSS framework
- [Salesforce](https://www.salesforce.com/) for the robust platform integration

---

<div align="center">
  <p>Made with ❤️ by [Your Name]</p>
  <p>
    <a href="#-email-validator-api">⬆️ Back to top</a>
  </p>
</div>