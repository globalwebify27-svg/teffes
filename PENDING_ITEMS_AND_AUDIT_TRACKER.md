# TeFFe Platform: Production Readiness & Pending Items Tracker
> **Project:** TeFFe Meat & Seafood Delivery Platform (Customer Web & Mobile, Rider Mobile, Store Admin & Backend)  
> **Last Audit Date:** October 26, 2026  
> **Status:** Pre-Launch Audit & Remediation Tracking

This document maintains an actionable, itemized tracking record of all pending third-party integrations, test/development keys, hardcoded dummy values, and missing production configurations across the entire codebase.

---

## 1. Critical Third-Party Credentials & API Keys (Dev / Test Mode)

| Status | Service | Files & Locations | Current Value | Reason & Required Action |
| :---: | :--- | :--- | :--- | :--- |
| [ ] | **Razorpay Payment Gateway** | `server/.env`<br>`client/.env.local`<br>`customer_app/lib/core/constants/app_config.dart`<br>`customer_app/lib/core/constants/api_endpoints.dart` | `rzp_test_TkyiIn9CcaHTah`<br>`rzp_test_1DP5mmOlF5G5ag` | **Test Mode Key:** Client has not yet provided live Razorpay credentials (`rzp_live_...`). Real customer credit/debit card, UPI (GPay/PhonePe/Paytm), and Netbanking payments cannot be captured until replaced with live keys. |
| [x] | **SMS Gateway (Firebase Phone Auth)** | `server/.env`<br>`server/src/utils/otp.js` | Firebase Phone Auth (Google Identity Toolkit) | **Twilio Removed:** Customer phone OTP login is 100% handled via Firebase Phone Authentication across web and mobile. All obsolete Twilio code and `.env` keys have been removed. |
| [ ] | **Email Service (Nodemailer)** | `server/.env`<br>`server/src/services/emailService.js` | `EMAIL_USER=pananrocks18@gmail.com`<br>`EMAIL_PASS=xxxx xxxx xxxx` | **Nodemailer Configured:** Super Admin password resets use the `nodemailer` Node.js package. Currently configured with Gmail SMTP; client can supply custom company email credentials (e.g. `noreply@teffes.com` via SendGrid/SES) if desired. |
| [ ] | **MongoDB Atlas Database** | `server/.env` (Line 4) | `pananrocks18_db_user:...@teffes-cluster.fc1nv19.mongodb.net/teffes` | **Developer Cluster:** Connected to developer's personal Atlas cluster, not the client's official company-owned production cluster. Need client to provide production MongoDB connection URI. |
| [ ] | **JWT Secrets** | `server/.env` (Lines 6–7) | `JWT_ACCESS_SECRET=teffes_access_secret_dev_change_in_prod_xK9mP2nQ`<br>`JWT_REFRESH_SECRET=teffes_refresh_secret_dev_change_in_prod_yR7vL4jW` | **Default Dev Strings:** Standard dev placeholder secret strings. Must be replaced with cryptographically randomized 64-character strings in production for auth token security. |

---

## 2. Customer Mobile Application (`customer_app`)

| Status | Feature / Item | File & Line | Current Implementation | Reason & Required Action |
| :---: | :--- | :--- | :--- | :--- |
| [x] | **Rider Details in Live Tracking** | `lib/screens/orders/order_tracking_screen.dart` | Real rider data or dynamic *"Assigning Fleet Partner..."* | **Fixed:** Removed fake placeholder name (*"Md. Imran Ansari"*) and fake stats. Dynamically displays assigned rider or clean preparation state. |
| [x] | **Call Rider & WhatsApp Action Handlers** | `lib/screens/orders/order_tracking_screen.dart` | `url_launcher` (`tel:`, `https://wa.me/`) | **Fixed:** Replaced dummy SnackBars with real native phone dialer (`tel:`) and direct WhatsApp chat launcher (`https://wa.me/`) for assigned riders. |
| [ ] | **API Base URL Fallback** | `lib/core/constants/api_endpoints.dart` (L23, L28, L33) | `https://teffes.onrender.com/api` | **Staging Hostname:** Hardcoded default points to Render staging backend. Needs client's official live API domain (e.g., `https://api.teffes.com/api`). |
| [x] | **Google Maps Android SDK Key** | `lib/core/constants/app_config.dart` (L13)<br>`android/.../strings.xml` | `AIzaSyB_ZC0cTMgCcoLByus4krDNd4RA27qnjMs` | **Configured:** Live client Google Maps API key synced into both `strings.xml` and `app_config.dart`. |
| [ ] | **iOS Firebase Configuration** | `ios/Runner/` | Missing `GoogleService-Info.plist` | **Pending iOS File:** Android has `google-services.json`, but the iOS app cannot connect to Firebase Authentication or Push Notifications until the client generates and downloads the iOS config from Firebase Console. |

---

## 3. Rider Mobile Application (`rider_app`)

| Status | Feature / Item | File & Line | Current Implementation | Reason & Required Action |
| :---: | :--- | :--- | :--- | :--- |
| [x] | **Store Dispatch Desk Call Action** | `lib/screens/support/support_screen.dart` | `url_launcher` (`tel:`) | **Fixed:** Wired real native phone dialer to call store dispatch desk and removed dummy *"Rahul Sharma"* fallback. |
| [x] | **Weekly Earnings Fallback** | `lib/screens/earnings/rider_earnings_screen.dart` (L98) | `CurrencyFormatter.format(earnings?.weekEarnings ?? 0.0)` | **Fixed:** Replaced hardcoded ₹3,450.00 fallback with clean `0.0`. |
| [ ] | **API Base URL Fallback** | `lib/core/constants/api_endpoints.dart` (L20, L25, L30) | `https://teffes.onrender.com/api` | **Staging Hostname:** Points to Render staging instead of client's live production backend domain. |
| [ ] | **iOS Firebase Configuration** | `ios/Runner/` | Missing `GoogleService-Info.plist` | **Pending iOS File:** Missing `GoogleService-Info.plist` for rider iOS build. |

---

## 4. Website & Admin Portals (`client`)

| Status | Feature / Item | File & Line | Current Implementation | Reason & Required Action |
| :---: | :--- | :--- | :--- | :--- |
| [ ] | **Mock Admin Credentials** | `src/lib/auth.ts` (L106–L129) | `superadmin@teffes.com` (`Super@12345`)<br>`storeadmin@teffes.com` (`Store@12345`) | **Dev Mock Accounts:** Hardcoded mock login object `DEMO_ADMIN_USERS` left over from early UI prototyping. Must be removed so only authenticated backend admins can log in. |
| [x] | **Official Super Admin Contact Details** | Header, Dashboard, Super Admin, Legal & Policy pages, SiteSettings | Phone: `+91 92796 82955`<br>Email: `rakeshroshanteffes@gmail.com`<br>WhatsApp: `919279682955` | **Updated:** Super Admin contacts updated across all web and legal/SEO pages. Store admin contacts preserved as requested. |
| [x] | **Admin Login Demo Credentials UI** | `client/src/components/auth/AdminLoginForm.tsx` | Demo & Super Admin Credentials card removed | **Removed from UI:** Credentials card removed from login interface while keeping backend accounts intact in database. |
| [x] | **Auth Route Guards for Logged-In Users** | `client/src/app/(auth)/login/page.tsx`<br>`client/src/app/(auth)/admin-login/page.tsx` | `GuestOnlyGuard` implemented | **Standard Redirect Implemented:** When already authenticated users navigate directly to `/login`, they are automatically redirected to `/` (Home page) or their appropriate dashboard. |
| [ ] | **App Download Links** | Footer & Promotion components | App Store and Google Play buttons link to `#` or are omitted | **Awaiting Store URLs:** Official Play Store and iOS App Store listing URLs are pending until apps are published. |
| [ ] | **Render Staging URLs** | `client/.env.local` (L1, L3) | `NEXT_PUBLIC_API_URL=https://teffes.onrender.com/api`<br>`NEXT_PUBLIC_SOCKET_URL=https://teffes.onrender.com` | **Staging URLs:** Needs client's production domain (e.g. `https://api.teffes.com`). |

---

## 5. Live Database Records with Dummy / Test Data

| Status | Collection / Record | Database Value | Reason & Required Action |
| :---: | :--- | :--- | :--- |
| [ ] | **Store Hub S004 (Doranda)** | `phone: "1234567891"` | **Dummy Test Phone:** Store phone was seeded with a test number `1234567891`. Update with real store manager contact. |
| [ ] | **Store Hub S003 (Harmu)** | `phone: "—"` | **Missing Phone:** No contact number is assigned to this hub. |
| [ ] | **Store Hubs S001 & S003 Coordinates** | `[85.3096, 23.3441]` | **Approximate Coordinates:** Both hubs currently share the same general Ranchi center coordinates. Need the exact GPS coordinates for Kishore Ganj and Harmu bypass for pinpoint rider distance calculation. |

---

## 6. App Store & Play Store Release Configurations

| Status | Platform | Configuration File | Status | Action Needed for Production |
| :---: | :--- | :--- | :--- | :--- |
| [ ] | **Android Apps (Customer & Rider)** | `android/app/build.gradle.kts` (Line 38) | `signingConfig = signingConfigs.getByName("debug")` | **Debug Keystore:** Both apps currently sign with debug keys. A production `.jks` release keystore and key password must be configured before generating release AAB bundles for Google Play. |
| [ ] | **Apple iOS (Customer & Rider)** | Apple Developer Account & APNs | Pending Client Enrollment | **Apple Developer Account ($99/yr):** Required to generate APNs push certificates for iPhones and publish to TestFlight / App Store. |

---

## How to Complete These Points (Execution Order)

1. **Phase 1: Code Cleanups (Immediate Developer Action)**
   - Connect native phone dialers (`url_launcher` `tel:`) & WhatsApp (`https://wa.me/`) in Customer and Rider apps.
   - Replace dummy rider fallback (*"Md. Imran Ansari"*) with a clean *"Assigning delivery partner..."* state.
   - Remove hardcoded mock credentials in `client/src/lib/auth.ts`.
   - Fix hardcoded weekly earnings fallback in Rider App (`3450.0` -> `0.0`).
   - Clean up dummy store phone in DB (`1234567891`).
2. **Phase 2: Client Credentials & Assets**
   - Provide Razorpay Live API keys (`rzp_live_...`).
   - Confirm official support phone & WhatsApp numbers.
   - Provide production MongoDB cluster credentials.
3. **Phase 3: Store Publishing & Production Domain**
   - Generate production Android signing keystores (`.jks`).
   - Configure custom production domains (`teffes.com` and `api.teffes.com`).
