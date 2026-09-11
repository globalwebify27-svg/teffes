# TeFFe's Customer Mobile Application (Flutter)

A high-performance, ultra-smooth Flutter application for Teffe's fresh meat, poultry, and seafood delivery customers. Built to pixel-perfection matching the Stitch design system (`Remix of Teffes Website Modern Redesign`) and connected directly to the existing Node.js + Express backend.

---

## 📱 Features & Highlights

- **Pixel-Perfect Stitch Alignment**:
  - **Home Screen**: Location header, search bar, "CRISPY TREATY BINGE!" promo card, 2x2 "Shop by categories" grid, and "Fresh Butchery Cuts" list.
  - **Category Listing Screen**: Top horizontal category switchers, subcategory filters, cold-chain trust promise, and horizontal cards with live quantity steppers.
  - **Product Detail Page (PDP)**: Studio imagery, cut specifications, antibiotic-free guarantee, and sticky add-to-cart bar.
  - **Cart & Checkout**: Real-time cart calculations, coupon discount engine, delivery fee waiver bar, payment selection (COD / Razorpay / Wallet), and address selector.
  - **Live Order Tracking**: Dispatched ETA radar, cold-box temperature indicator, and rider contact card.
  - **My Account & Wallet**: Teffe's Cash wallet balance, loyalty tier badge, and saved addresses.

- **DRY Reusable Widget Library**:
  - `ProductCard` (Supports both horizontal and compact grid formats)
  - `QuantityStepper` (Smooth animated `- 1 +` counter and `+ ADD` toggle)
  - `LocationHeader` (Interactive address dropdown + notification bell)
  - `CategoryIconPill` & `CategoryCard`
  - `ColdChainPromiseCard` (0°-4°C Chilled, 100% Halal)
  - `PromoBanner` ("BINGE!" promo card with action trigger)
  - `TeffeBottomNavBar` (Home, Wishlist, Categories, Account)

- **Architecture**:
  - State Management: **Provider** (clean reactive separation of concerns, zero-jank 60/120fps transitions).
  - Network: **Dio** with automatic JWT authentication interceptor and dynamic host resolution (Android Emulator `10.0.2.2:5000`, iOS Simulator `localhost:5000`, or custom IP).
  - Typography: **Plus Jakarta Sans** (Headlines & Labels) + **Inter** (Body & Specs).

---

## 🚀 How to Run

### 1. Ensure Backend is Running
Make sure your server is active on port `5000`:
```bash
cd server
npm start
```

### 2. Run the Flutter App
From the `customer_app` directory:
```bash
cd customer_app
flutter pub get
flutter run
```

### 3. Testing on Physical Device
If running on a physical phone connected over Wi-Fi, provide your computer's local IP:
```bash
flutter run --dart-define=API_HOST=192.168.1.100
```
