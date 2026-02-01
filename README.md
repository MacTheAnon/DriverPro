# DriverPro 🚗💨

**The Ultimate Mileage & Expense Tracker for the Gig Economy.**

DriverPro is a full-stack mobile application built with **React Native (Expo)** and **Firebase** designed to help independent contractors, delivery drivers, and gig workers save thousands on taxes. It automates mileage tracking, logs expenses, and generates IRS-compliant reports.

## 🚀 Key Features

* **📍 Background GPS Tracking:** precise mileage tracking engine that runs even when the app is closed or the phone is locked. Optimized for battery life using `expo-task-manager` and `expo-location`.
* **🔒 Secure Local Storage:** "Privacy-First" architecture. Sensitive documents (Insurance/Registration) are encrypted and stored locally on the device file system, bypassing cloud storage risks and costs.
* **⚡ Offline-First Architecture:** Built with `AsyncStorage` persistence and Firebase Auth to allow instant app access and data logging without an internet connection.
* **💰 Real-Time Tax Savings:** Instantly calculates potential tax deductions based on current IRS mileage rates as you drive.
* **📊 Expense Management:** Log gas, repairs, and maintenance costs with categorical breakdowns.
* **☁️ Real-Time Sync:** seamless data synchronization across devices using Google Cloud Firestore.
* **📄 One-Tap Export:** Generates CSV tax reports compatible with standard accounting software.

## 🛠 Tech Stack

* **Frontend:** React Native, Expo SDK 54
* **Backend:** Firebase (Authentication, Cloud Firestore)
* **Build/CI:** Expo Application Services (EAS Build)
* **State Management:** React Hooks & Context API
* **Maps:** React Native Maps (Apple Maps/Google Maps)
* **Storage:**
    * *Cloud:* Firestore (User Data, Trips, Expenses)
    * *Local:* Expo File System (Document Images), Async Storage (Session & Background Points)

## 📸 Screenshots

| Dashboard | Mileage Tracker | Document Safe |
|:---:|:---:|:---:|
| | | |

## 🏁 Getting Started

### Prerequisites
* Node.js (v18+)
* Expo Go app on your physical device OR an iOS/Android Simulator.

### Installation

1.  **Clone the repository:**
    ```bash
    git clone [https://github.com/MacTheAnon/DriverPro.git](https://github.com/MacTheAnon/DriverPro.git)
    cd DriverPro
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    # OR
    yarn install
    ```

3.  **Setup Firebase:**
    * Create a project in the [Firebase Console](https://console.firebase.google.com/).
    * Enable **Authentication** (Email/Password).
    * Enable **Cloud Firestore** (Create database in test/production mode).
    * Copy your web configuration keys into `src/firebaseConfig.js`.

4.  **Run the App:**
    ```bash
    npx expo start
    ```

## ⚙️ Configuration

### Background Location Permissions
To test background tracking in the Simulator or on a real device, you must grant **"Always Allow"** location permissions when prompted.
* **iOS:** Update `app.json` -> `infoPlist` to include `NSLocationAlwaysUsageDescription`.
* **Android:** Update `app.json` -> `permissions` to include `ACCESS_BACKGROUND_LOCATION`.

### Building for Production (EAS)
DriverPro is configured for **Expo Application Services (EAS)**.

1.  **Install EAS CLI:**
    ```bash
    npm install -g eas-cli
    ```
2.  **Build iOS Binary:**
    ```bash
    eas build --profile production --platform ios
    ```
3.  **Submit to App Store:**
    ```bash
    eas submit --profile production --platform ios
    ```

## 🤝 Contributing

Contributions are welcome! Please follow these steps:
1.  Fork the project.
2.  Create your feature branch (`git checkout -b feature/AmazingFeature`).
3.  Commit your changes (`git commit -m 'Add some AmazingFeature'`).
4.  Push to the branch (`git push origin feature/AmazingFeature`).
5.  Open a Pull Request.

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.

## 📞 Contact

**Kaleb McIntosh**
* GitHub: [@MacTheAnon](https://github.com/MacTheAnon)
* Project Link: [https://github.com/MacTheAnon/DriverPro](https://github.com/MacTheAnon/DriverPro)
