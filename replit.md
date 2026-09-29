# ANPR México - Directorio de Proveedores de Equipamiento Urbano

## Overview
ANPR México is a comprehensive business directory platform designed to connect companies and specialized providers of urban equipment. Its main purpose is to facilitate the search for services and products through advanced geolocation features, robust membership management, secure payment processing, and comprehensive administrative tools. The platform aims to create a complete business ecosystem for the urban equipment sector in Mexico, fostering connections and streamlining business operations.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture
### Frontend Architecture
The frontend is built using React 18 with TypeScript, adhering to a modern component-based architecture. It utilizes `shadcn/ui` for a consistent design system, `TanStack Query` for server state management, and `React Hook Form` for form state. Routing is handled by `Wouter`, and styling is managed with `Tailwind CSS` using custom theme variables. `Vite` is used for fast development and optimized builds. Firebase Authentication is integrated for user authentication.

### Backend Architecture
The backend follows a RESTful API design implemented with Express.js on Node.js and TypeScript. It includes middleware for CORS, session management, and file uploads. `Drizzle ORM` is used for type-safe database operations, and `multer` handles file uploads to the local file system. The API provides RESTful endpoints with comprehensive error handling.

### Database Architecture
The system uses a PostgreSQL database with a normalized schema design. Key areas include user management integrated with Firebase UIDs, comprehensive company profiles with geolocation data, a flexible membership system with various pricing options, and content management for categories, certificates, projects, and user opinions. Dynamic system configuration, including homepage settings, is also managed within the database.

### Core Features & Design Decisions
- **Authentication System**: Secure authentication via Firebase, supporting email/password and Google OAuth. Implements role-based access for Admin, Representative, and User roles, along with persistent session management.
- **Business Directory**: Features rich company profiles with multimedia, hierarchical categorization, interactive maps with location-based search, and project portfolios with image galleries.
- **Membership Management**: Supports flexible membership types and pricing periods. Integrates with Stripe for secure payment processing and webhooks, enabling automatic renewal and expiration tracking. Membership limits (e.g., products, projects, photos) are enforced at the backend and displayed on the frontend.
- **Content Management**: Utilizes `TinyMCE` for rich text editing and provides robust file upload validation for images and documents. Supports dynamic configuration of elements like home page banners and highlights.
- **Administrative Tools**: Includes comprehensive user lifecycle management, content moderation for opinions and reviews, an analytics dashboard for business metrics, and configurable platform settings for branding and features.
- **UI/UX Decisions**: Employs a consistent design system (`shadcn/ui`), uses Tailwind CSS for styling with a focus on modern aesthetics, and provides a clear, intuitive user experience. Specific UI enhancements include visual icons for categories, drag-and-drop file upload interfaces, and clear error messaging for payment processes. The system allows administrators to customize header, menu, footer, contact information, social media links, and custom styling.
- **Feature Specifications**:
    - **Company Management**: Detailed company profiles including contact info, social media, membership details, and geographic data. Supports bulk import/export via Excel/CSV.
    - **WordPress Integration**: Comprehensive MemberPress integration with transaction expiration date synchronization. When assigning WordPress representatives to companies, membership dates are automatically updated based on transaction expiration dates from MemberPress.
    - **Project Management**: Project creation and management is exclusively handled through dashboard interfaces for representatives.
    - **Certificate Management**: System for assigning and managing certificates, with role-based visibility.
    - **Review System**: Differentiated systems for company opinions and platform reviews, with distinct interfaces and moderation.
    - **Payment Receipts**: Generates professional PDF receipts for transactions.
    - **System Branding**: Centralized system for managing logos, favicons, titles, and overall platform branding.

## External Dependencies

### Payment Processing
- **Stripe**: Utilized for the complete payment infrastructure, including subscriptions, invoicing, and webhook processing to ensure PCI compliance.

### Authentication
- **Firebase Authentication**: Provides core user authentication, password recovery, and session management.
- **Google OAuth**: Integrated for social login capabilities.

### WordPress/MemberPress Integration
- **WordPress API**: Direct integration with WordPress REST API for user synchronization and membership validation.
- **MemberPress API**: Advanced integration for accessing membership transactions, subscription data, and expiration dates.
- **Automatic Date Synchronization**: When assigning WordPress representatives to companies, the system automatically retrieves transaction expiration dates from MemberPress and updates company membership dates accordingly.

### Maps and Geolocation
- **Google Maps API**: Used for interactive maps, geocoding, and location-based search functionalities.
- **Leaflet**: Available as an alternative mapping solution for specific use cases.

### Content Management
- **TinyMCE**: Integrated as a rich text editor for content creation.
- **Image Processing**: Client-side image optimization and validation are implemented.

### File Storage
- **Cloudinary**: Cloud storage for images and documents. Enabled when Cloudinary credentials are configured (CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET). Images persist across deployments in production.
- **Local Storage**: Fallback when Cloudinary is not configured. Files are stored in `/uploads/` directory (development only, not persistent in production).

### Development Tools
- **Drizzle Kit**: Used for database migrations and schema management.
- **ESLint/Prettier**: Employed for code quality enforcement and formatting.
- **TypeScript**: Ensures type safety across the entire application stack.