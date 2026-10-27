# Comprehensive Production Launch Requisition & Setup Guide
### Project: TeFFe Meat & Seafood Delivery Platform (Web, Customer App, Rider App & Store Admin)

---

## Executive Summary 

To make the TeFFe platform live for real customers, real riders, and real payments, we need several cloud services, payment gateways, and developer accounts activated on the client's official business accounts.


## 1. Firebase Setup (Project, Apps, SMS OTP & Push Notifications)

Firebase is Google's cloud service that powers three essential features in TeFFe:
1. **SMS Phone Login (OTP):** Sending 6-digit verification codes to customer phones.
2. **Push Notifications:** Instant pop-up alerts on customer phones and rider phones when an order is placed, dispatched, or delivered.
3. **Store Loud Alarm:** Audible ringing in the store manager's browser whenever a new fresh butchery order arrives.

---

### Step 1.1: Create ONE Single Firebase Project
* Go to [https://console.firebase.google.com/](https://console.firebase.google.com/) using the company's official Google account.
* Click **"Add project"**.
* Name the project: **`teffe-production`** (or `teffe-official`).
* Enable Google Analytics (recommended) and click **Create Project**.
* **Note:** You only need **ONE** project for the entire company. Do NOT create separate projects for Customer, Rider, and Website. Everything lives in this one project.

---

### Step 1.2: Upgrade to the "Blaze" (Pay As You Go) Plan
* **Why this is compulsory:** By default, Firebase creates projects on the free **"Spark"** plan. The free plan **DOES NOT SEND REAL SMS TO INDIAN MOBILE NUMBERS**. If you stay on the free plan, only pre-configured test numbers can log in, and real customers will get an error saying SMS quota exceeded.
* **How to upgrade:**
  1. In the bottom-left corner of the Firebase Console, click on **Upgrade** next to "Spark Plan".
  2. Select the **Blaze (Pay as you go)** plan.
  3. Link a valid credit/debit card.
* **Cost estimate:** Firebase gives **10,000 free phone verifications every month**. After that, it costs a fraction of a rupee per SMS. For a normal startup, this is virtually free or very low cost (a few hundred rupees per month).

---

### Step 1.3: Enable "Phone Authentication"
1. In the left sidebar of the Firebase Console, go to **Build** → **Authentication**.
2. Click **Get Started**.
3. Under the **Sign-in method** tab, click on **Phone**.
4. Switch the toggle to **Enable**.
5. Click **Save**.

---

### Step 1.4: How Many Apps to Create Inside This One Firebase Project?
Inside this single Firebase project, you must register **5 Apps**:

| # | App Type | Platform | Name / Package ID to enter | Purpose |
|---|---|---|---|---|
| **1** | Android App | Customer | `com.teffes.customer_app` | Customer Android App (OTP login & order notifications) |
| **2** | Android App | Rider | `com.teffes.rider_app` | Rider Android App (Delivery alerts & OTP verification) |
| **3** | iOS App | Customer | `com.teffes.customer_app` | Customer iPhone App (Apple push & login) |
| **4** | iOS App | Rider | `com.teffes.rider_app` | Rider iPhone App (Apple push & delivery alerts) |
| **5** | Web App | Website | `Teffe Website & Store Admin` | Website customer ordering & Store Admin loud sound alarm |

#### How to Add Each App:
* On the Project Overview page (top-left home icon), click on the **Android icon**, **Apple icon**, or **Web icon (`</>`)**.
* Enter the exact Package ID / Bundle ID listed in the table above.
* **For Android Apps:** When asked for the SHA-1 signing fingerprint, paste your release certificate SHA-1 (ask your developer or find it from your Google Play Console).

---

### Step 1.5: Files & Keys to Download and Send to Developer

1. **`google-services.json` (for Android):**
   * Go to *Project Settings (gear icon) → General → Your apps*.
   * Click on the Customer Android app → Download `google-services.json`.
   * Click on the Rider Android app → Download its `google-services.json`.
2. **`GoogleService-Info.plist` (for iOS):**
   * Click on Customer iOS app → Download `GoogleService-Info.plist`.
   * Click on Rider iOS app → Download its `GoogleService-Info.plist`.
3. **`serviceAccountKey.json` (Backend Secret File):**
   * Go to *Project Settings → Service Accounts*.
   * Click the button **"Generate new private key"**.
   * A JSON file will download. This file gives our backend secure permission to send notifications and verify tokens.
4. **Web Configuration Keys:**
   * Go to *Project Settings → General → Web App*.
   * Copy the configuration values: `apiKey`, `authDomain`, `projectId`, `storageBucket`, `messagingSenderId`, `appId`.
5. **Web Push Certificate (VAPID Key):**
   * Go to *Project Settings → Cloud Messaging tab*.
   * Scroll down to **Web configuration** → **Web Push certificates**.
   * Click **Generate key pair**. Copy the generated long string (VAPID key).

---

## 2. Google Cloud Platform (Google Maps & Location Services)

Google Maps is used in TeFFe for:
* Finding the customer's delivery doorstep.
* Showing the exact meat butchery hub location.
* Giving the rider real-time turn-by-turn navigation.
* Showing the customer a live moving bike icon on the map with accurate road arrival minutes (ETA).

---

### Step 2.1: Add Billing to Google Cloud Console
* Go to [https://console.cloud.google.com/](https://console.cloud.google.com/).
* Ensure **Billing** is active and linked to a payment card.
* **Warning:** If Google Cloud billing is inactive, Google Maps will show a grey screen or a watermark saying *"For development purposes only"*, and address search will fail. Google gives **$200 free credit every month**, which covers thousands of orders before any charge applies.

---

### Step 2.2: Enable the 6 Required Maps APIs
In the Google Cloud search bar at the top, search for each of the following and click **"Enable"**:
1. **Routes API** (Calculates true road driving distance and two-wheeler bike travel minutes).
2. **Geocoding API** (Converts GPS latitude/longitude into human-readable street addresses).
3. **Places API (New)** (Provides customer address autocomplete when searching colony/road names).
4. **Maps SDK for Android** (Displays the interactive map inside the Android mobile app).
5. **Maps SDK for iOS** (Displays the interactive map inside the iPhone mobile app).
6. **Maps JavaScript API** (Displays the map on the website and Store Admin desktop portal).

---

### Step 2.3: Generate 3 (or 4) Restricted API Keys
Never use one unrestricted key everywhere because someone could steal it from your website source code. Create separate restricted keys under **APIs & Services → Credentials → Create Credentials → API Key**:

#### Key A: Server-Side API Key (`GOOGLE_MAPS_SERVER_API_KEY`)
* **Used by:** The Node.js backend server.
* **Why:** Safely calculates road minutes and searches addresses without exposing your key to the public.
* **Restriction:** Restrict API usage to: *Routes API, Geocoding API, Places API (New)*.

#### Key B: Android Maps API Key (`GOOGLE_MAPS_ANDROID_KEY`)
* **Used by:** The Android Customer App and Rider App.
* **Why:** Renders the map view inside Android phones.
* **Restriction:**
  * Select **Android apps**.
  * Add Package Name: `com.teffes.customer_app` + your SHA-1 fingerprint.
  * Add Package Name: `com.teffes.rider_app` + your SHA-1 fingerprint.
  * Restrict API usage to: *Maps SDK for Android*.

#### Key C: iOS Maps API Key (`GOOGLE_MAPS_IOS_KEY`)
* **Used by:** The iOS Customer App and Rider App.
* **Why:** Renders the map view inside iPhones.
* **Restriction:**
  * Select **iOS apps**.
  * Add Bundle Identifier: `com.teffes.customer_app` and `com.teffes.rider_app`.
  * Restrict API usage to: *Maps SDK for iOS*.

#### Key D: Website Maps API Key (`NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`)
* **Used by:** The Next.js website.
* **Why:** Shows the map on the desktop browser.
* **Restriction:**
  * Select **Websites (HTTP Referrers)**.
  * Add allowed websites: `https://teffes.com/*`, `https://*.teffes.com/*`.
  * Restrict API usage to: *Maps JavaScript API*.

---

## 3. Razorpay Payment Gateway (Live Online Payments & UPI)

Razorpay allows customers to pay via **Google Pay, PhonePe, Paytm, UPI, Credit/Debit Cards, and Netbanking**.

---

### What to Request from the Client:
1. **Complete Razorpay Business KYC:**
   * Log in to [https://dashboard.razorpay.com/](https://dashboard.razorpay.com/).
   * Upload Business PAN, Bank Account Cancelled Cheque, and GSTIN.
   * Ensure account status is changed from "Test Mode" to **"Live Mode"**.
2. **Razorpay Live Key ID & Secret:**
   * In the Razorpay Dashboard, toggle the switch from "Test Mode" to **"Live Mode"** in the top header.
   * Go to **Settings** → **API Keys** → **Generate Key**.
   * Copy:
     * **Key ID** (Starts with `rzp_live_...`).
     * **Key Secret** (A secret password string shown only once).
3. **Razorpay Webhook Setup:**
   * Go to **Settings** → **Webhooks** → **Add New Webhook**.
   * **Webhook URL:** `https://api.teffes.com/api/payment/webhook` (replace with your live domain).
   * **Secret:** Choose a strong secret password (e.g. `TeffeRazorpayLiveWebhook2026`).
   * **Active Events to check:**
     * `order.paid`
     * `payment.captured`
     * `payment.failed`
   * *Why this is important:* If a customer pays on Google Pay and closes their app before returning to TeFFe, Razorpay sends a silent server notification so the order is marked "Paid" instantly and the butchery can begin cutting meat immediately.

---

## 4. Production Domain & Server Hosting (Website & Backend)

### 4.1: Domain Name (e.g., `teffes.com`)
* The client must purchase their official domain (from GoDaddy, Namecheap, Hostinger, etc.).
* Provide **DNS Management Access** or add the following records:
  * `teffes.com` and `www.teffes.com` → Point to Frontend Website (e.g., Vercel / Cloud server).
  * `api.teffes.com` → Point to Node.js Backend Server.

### 4.2: Production Server / Cloud Platform
* The backend runs on Node.js with real-time Socket.IO communication.
* Recommended hosting providers:
  * **Option A (Easiest & Fastest):** **Render.com** (Team invite to developer) or **Vercel + Railway**.
  * **Option B (Enterprise):** **AWS (Amazon Web Services)** EC2 / Lightsail or **DigitalOcean Droplet**.
* What we need from client: An admin invite or credentials to the selected hosting platform.

---

## 5. Production Database (MongoDB Atlas)

TeFFe stores user accounts, products, butchery cutting preferences, coupons, and orders in MongoDB.

### What to Do:
1. Log in to [https://www.mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas) with the company email.
2. Create a Production Cluster (e.g. M10 or serverless plan for production reliability and automated daily backups).
3. Under **Database Access**, create a user (e.g. `teffes_prod_admin`) with a secure password.
4. Under **Network Access**, add `0.0.0.0/0` (Allow access from anywhere) so the cloud server can connect with its username and password.
5. Click **Connect** → **Drivers** → Copy the **Connection String**:
   ```
   mongodb+srv://teffes_prod_admin:<password>@cluster0.xxxxx.mongodb.net/teffes?retryWrites=true&w=majority
   ```

---

## 6. App Publishing Accounts (Google Play Store & Apple App Store)

To make both the Customer App and Rider App downloadable by the public:

### 6.1: Google Play Console (Android)
* Cost: One-time $25 fee to Google.
* Link: [https://play.google.com/console/](https://play.google.com/console/)
* What to provide:
  * Invite developer email as an **Admin** or **Release Manager**.
  * If this is an existing app on Google Play, provide the **Upload Keystore (`.jks`) file**, alias name, and keystore passwords. If it is brand new, let the developer generate a new production keystore.

### 6.2: Apple Developer Program (iOS / iPhone)
* Cost: $99 / year paid to Apple.
* Link: [https://developer.apple.com/programs/](https://developer.apple.com/programs/)
* What to provide:
  * Invite developer email in [App Store Connect](https://appstoreconnect.apple.com/) as **Admin** or **App Manager**.
  * APNs Key (`.p8` file), Key ID, and Team ID (for enabling Apple push notifications).

---

## 7. Store Operations & Legal Details (Invoicing & Printing)

Under Indian consumer protection and food safety laws, commercial meat delivery applications must display valid licenses on invoices and thermal receipts:

| Item | Description | Why It Is Mandatory |
|---|---|---|
| **FSSAI License Number** | 14-digit Food Safety License | Legally required by Food Safety and Standards Authority of India to be printed on raw meat/seafood packaging, delivery bills, and kitchen tickets. |
| **GSTIN Number** | 15-digit GST Identification Number | Printed on customer tax invoices and used for B2B/B2C accounting. |
| **Store / Hub Physical Address** | E.g., Kishore Ganj Hub, Ranchi | Default pickup origin coordinates for measuring road distance to customer homes. |
| **Store GPS Coordinates** | Latitude & Longitude (e.g., `23.3685, 85.3240`) | Used by Google Maps to navigate the rider from the meat cutting station to the customer's house. |
| **Customer Support Phone & WhatsApp** | Official helpline number | Connected to the "Call Support" and "Help & Support" buttons inside the app. |
| **Support Email** | E.g., `support@teffes.com` | Displayed on order confirmation receipts. |

---

## 8. Final Checklist of Files & Keys to Send

When ready, the client should send the developer a folder or secure document containing:

### 1. Credentials & Secret Keys
- [ ] `GOOGLE_MAPS_SERVER_API_KEY` (Google Cloud Server Key)
- [ ] `GOOGLE_MAPS_ANDROID_KEY` (Google Cloud Android Key)
- [ ] `GOOGLE_MAPS_IOS_KEY` (Google Cloud iOS Key)
- [ ] `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` (Google Cloud Web Key)
- [ ] `RAZORPAY_KEY_ID` (Live Key starting with `rzp_live_...`)
- [ ] `RAZORPAY_KEY_SECRET` (Live Secret)
- [ ] `RAZORPAY_WEBHOOK_SECRET` (Webhook Secret)
- [ ] `MONGO_URI` (Production MongoDB connection string)

### 2. Downloaded Configuration Files
- [ ] `google-services.json` (from Firebase for Customer Android: `com.teffes.customer_app`)
- [ ] `google-services.json` (from Firebase for Rider Android: `com.teffes.rider_app`)
- [ ] `GoogleService-Info.plist` (from Firebase for iOS Customer: `com.teffes.customer_app`)
- [ ] `GoogleService-Info.plist` (from Firebase for iOS Rider: `com.teffes.rider_app`)
- [ ] `serviceAccountKey.json` (Firebase Admin private key file)
- [ ] Firebase Web Config & VAPID Key string

### 3. Business & Account Access
- [ ] Domain DNS Login or Namecheap/GoDaddy access
- [ ] Hosting Server Access (Render / AWS / VPS)
- [ ] Google Play Console Invite / Keystore
- [ ] Apple Developer Team Invite
- [ ] FSSAI License Number & GSTIN
- [ ] Exact Kishore Ganj Hub GPS coordinates & support phone number

---

*This guide contains everything required to take TeFFe from development to a fully functioning commercial release within 2 days.*
