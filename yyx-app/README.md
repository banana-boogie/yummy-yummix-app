# YummyYummix App 🍳

YummyYummix is a cross-platform recipe discovery application that makes cooking easy and enjoyable. Available on web, Android, and iOS platforms.

## ✨ Features

- 📱 Cross-platform support (Web, Android, iOS)
- 🔍 Recipe exploration and discovery
- 👩‍💼 Admin Panel for content management
- 🤖 AI-powered recipe generation and population
- 📱 Responsive and intuitive user interface

## 🛠️ Technologies

- **Frontend**
  - React Native
  - Expo (for cross-platform development)
  - TypeScript

- **Backend & Infrastructure**
  - Supabase
    - Authentication
    - Database
    - Storage
    - Edge Functions
  - OpenAI API Integration

## 🚀 Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm
- Xcode (for iOS development)
- Android Studio (for Android development)
- Supabase account

### Installation

```bash
# Install dependencies
npm install

# Run on iOS
npm run ios

# Run on Android
npm run android
```

## ⚙️ Environment Setup

Create a `.env.local` file in the `yyx-app/` directory with the following variables:

```plaintext
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
EXPO_PUBLIC_DEV_LOGIN_EMAIL=your_test_email
EXPO_PUBLIC_DEV_LOGIN_PASSWORD=your_test_password
EXPO_PUBLIC_OPENAI_KEY=your_openai_key
EXPO_PUBLIC_APP_URL=https://yummyyummix.com
```

> **Note**: Regarding environment variables security:
> - Never commit the `.env` file to version control
> - Add `.env` to your `.gitignore` file
> - Consider providing a `.env.example` file with dummy values
> - For production, use secure environment variable management through your deployment platform

## 👩‍💻 For Developers

This repository is intended for YummyYummix developers. To get started with development:

1. Request access to the Supabase project
2. Set up your local environment variables
3. Follow the installation steps above
4. Refer to our internal documentation for API endpoints and database schema

## 🧪 Development Workflow

YummyYummix uses **Supabase Cloud** (no local Supabase instance). See the root [CLAUDE.md](../CLAUDE.md) for detailed setup and development commands.

### Quick Start
```bash
npm run ios           # Run on physical iPhone
npm run ios:sim       # Run on iOS Simulator
npm run android       # Run on physical Android
```

### Dev Login
On the login screen, tap **"Dev Login"** to sign in with pre-configured dev credentials (requires `EXPO_PUBLIC_DEV_LOGIN_EMAIL` and `EXPO_PUBLIC_DEV_LOGIN_PASSWORD` in `.env.local`).

## 📝 Contributing
We welcome contributions from the YummyYummix development team. Please:

1. Create a new branch for your feature
2. Follow our coding standards and conventions in the DEVELOPMENT_GUIDE.md
3. Test your changes thoroughly
4. Submit a pull request with a clear description of your changes

### Branch Naming Convention

Use the following format:
- Feature branches: `feature/description-in-kebab-case`
- Bug fixes: `fix/issue-description`
- Hotfixes: `hotfix/urgent-fix-description`
- Releases: `release/version-number`

Examples:
- `feature/add-recipe-search`
- `fix/login-validation`
- `hotfix/critical-auth-issue`
- `release/1.2.0`

### Git Commit Messages

Follow the Conventional Commits specification:

Types:
- feat: New feature
- fix: Bug fix
- docs: Documentation changes
- style: Code style changes (formatting, etc.)
- refactor: Code refactoring
- test: Adding or modifying tests
- chore: Maintenance tasks

Examples:
```git
feat(recipe): add search by ingredients
fix(auth): resolve login timeout issue
docs: update API documentation
```

## 🤝 Support

For internal support and questions, please contact the development team through our usual channels.

## 📚 Documentation

### API Documentation
Access to the Supabase DB are located in the `services/` folder.
Supabase Edge Functions are located in the `yyx-server` repository:

### Database Schema

Our database schema is managed through Supabase and SQL migration files located in `yyx-server/supabase/migrations/`.


## 🚀 Deployment

### Web Application
- Deployed via Vercel
- Automatic deployments from the main branch
- Preview deployments for pull requests

### Mobile Applications
- Built and deployed using EAS CLI
- Supports both development and production builds
- Available on iOS App Store and Google Play Store

## 🔒 Security

- Authentication handled by Supabase
- Role-based access control (RBAC)
- Environment variables managed through deployment platforms
- Regular security audits and updates
- Data encryption in transit and at rest

## 📈 Version Control

### Version Numbering
- Format: `MAJOR.MINOR.PATCH` (e.g., 1.0.0)
- MAJOR: Breaking changes
- MINOR: New features
- PATCH: Bug fixes
