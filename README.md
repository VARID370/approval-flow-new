# ApprovalFlow

A production-ready, full-stack document approval workflow system built with Node.js, Express, MongoDB Atlas, and vanilla HTML/CSS/JavaScript.

## Features

- **Multi-Level Approval Workflow**: Employee → Manager → Director → Completed
- **Role-Based Access Control**: Employee, Manager, Director, Admin with department isolation
- **Real-Time Notifications**: Socket.IO powered instant notifications
- **Document Management**: Upload PDF/DOC/DOCX (10MB max), preview, download, versioning
- **Analytics Dashboard**: Charts, stats, trends (Canvas-rendered, no libraries)
- **Activity Logging**: Complete audit trail of all user actions
- **Email Notifications**: Nodemailer integration for approval events
- **Dark/Light Mode**: Theme toggle with localStorage persistence
- **Responsive Design**: Mobile-first, works on all screen sizes

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | HTML5, CSS3, Vanilla JavaScript (ES6) |
| Backend | Node.js, Express.js |
| Database | MongoDB Atlas (Mongoose) |
| Auth | JWT, bcrypt |
| File Upload | Multer |
| Real-Time | Socket.IO |
| Validation | Express Validator |
| Email | Nodemailer |

## Project Structure

```
ApprovalFlow/
├── backend/
│   ├── config/          # Database & Multer configuration
│   ├── controllers/     # Route handlers (7 controllers)
│   ├── middleware/       # Auth, error handler, validation
│   ├── models/          # Mongoose models (5 models)
│   ├── routes/          # API routes (7 route files)
│   ├── services/        # Email & notification services
│   ├── socket/          # Socket.IO handler
│   ├── uploads/         # File storage (documents, profile)
│   ├── utils/           # Constants, helpers, admin seeder
│   ├── server.js        # Entry point
│   ├── package.json
│   └── .env
├── frontend/
│   ├── css/styles.css   # Complete design system
│   ├── js/              # Application modules (12 files)
│   ├── index.html       # Landing page
│   ├── login.html       # Login page
│   ├── register.html    # Registration page
│   ├── dashboard.html   # Role-specific dashboards
│   ├── upload.html      # Document upload & management
│   ├── approvals.html   # Approval workflow
│   ├── analytics.html   # Charts & analytics
│   ├── users.html       # Admin user management
│   └── profile.html     # User profile
└── README.md
```

## Setup Instructions

### Prerequisites

- Node.js v18+
- MongoDB Atlas account (free tier works)

### 1. Clone & Install

```bash
cd ApprovalFlow/backend
npm install
```

### 2. Configure Environment

Edit `backend/.env` with your settings:

```env
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/approvalflow
JWT_SECRET=your_secure_random_string_here
```

### 3. Start the Server

```bash
cd backend
npm start
```

The app will be available at `http://localhost:5000`

### 4. Default Admin Account

On first run, a default admin is created:
- **Email**: admin@approvalflow.com
- **Password**: Admin@123

> Change this password immediately after first login.

## API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login |
| POST | `/api/auth/logout` | Logout |
| GET | `/api/auth/me` | Get current user |
| PUT | `/api/auth/profile` | Update profile |
| PUT | `/api/auth/password` | Change password |
| PUT | `/api/auth/avatar` | Upload avatar |

### Documents
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/documents/upload` | Upload document |
| GET | `/api/documents/my` | Get my documents |
| GET | `/api/documents/pending` | Get pending approvals |
| GET | `/api/documents/history` | Get approval history |
| GET | `/api/documents/all` | Get all documents (Admin) |
| GET | `/api/documents/:id` | Get document details |
| PUT | `/api/documents/:id` | Update draft |
| DELETE | `/api/documents/:id` | Delete draft |
| PUT | `/api/documents/:id/submit` | Submit for approval |
| PUT | `/api/documents/:id/approve` | Approve document |
| PUT | `/api/documents/:id/reject` | Reject document |
| PUT | `/api/documents/:id/revision` | Request revision |
| GET | `/api/documents/:id/download` | Download document |

### Users (Admin Only)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/users` | List all users |
| GET | `/api/users/:id` | Get user details |
| PUT | `/api/users/:id/role` | Change user role |
| PUT | `/api/users/:id/toggle-status` | Activate/deactivate |
| DELETE | `/api/users/:id` | Delete user |

### Notifications
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/notifications` | Get notifications |
| GET | `/api/notifications/unread-count` | Get unread count |
| PUT | `/api/notifications/read-all` | Mark all as read |
| PUT | `/api/notifications/:id/read` | Mark one as read |

### Analytics
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/analytics/dashboard` | Dashboard stats |
| GET | `/api/analytics/full` | Full analytics |

### Activity
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/activity` | Activity logs (Admin) |
| GET | `/api/activity/my` | My activity |

### Comments
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/comments/:documentId` | Add comment |
| GET | `/api/comments/:documentId` | Get comments |

## Roles & Permissions

| Permission | Employee | Manager | Director | Admin |
|-----------|----------|---------|----------|-------|
| Upload Documents | ✅ | ❌ | ❌ | ❌ |
| View Own Documents | ✅ | ❌ | ❌ | ✅ |
| Approve/Reject | ❌ | ✅ | ✅ | ✅ |
| Manage Users | ❌ | ❌ | ❌ | ✅ |
| View Analytics | ❌ | ✅ | ✅ | ✅ |
| View Activity Logs | ❌ | ❌ | ❌ | ✅ |

## License

MIT
