# Tripzy - Real-Time Ride Sharing App

![Tripzy Logo](https://img.shields.io/badge/Tripzy-Ride%20Sharing-blueviolet?style=for-the-badge)
![MERN Stack](https://img.shields.io/badge/MERN-Stack-green?style=for-the-badge)
![Socket.io](https://img.shields.io/badge/Socket.io-Real--Time-black?style=for-the-badge)

Tripzy is a modern, real-time ride-sharing application built with the MERN stack. It allows passengers to request rides and drivers to accept them, featuring real-time location tracking, secure payments, and a seamless map-based user interface.

### 🌐 Live Demo
**[Play with the Live App here!](https://frontend-tqo5k371p-suryas-projects-b65a9565.vercel.app)** *(Deployed on Vercel)*

---

## 🌟 Features

### For Passengers:
- **Instant Ride Booking:** Set pickup and drop-off locations using interactive maps.
- **Real-Time Tracking:** Watch your driver approach your location live on the map.
- **Secure Payments:** Integrated Razorpay checkout for seamless UPI and card payments.
- **Ride History & Ratings:** Review past trips and rate your drivers.

### For Drivers:
- **Online/Offline Status:** Drivers can toggle their availability instantly.
- **Live Ride Requests:** Instant notifications for nearby ride requests.
- **Earnings Dashboard:** Track daily/weekly ride earnings.
- **GPS Navigation:** Integrated route guidance using Leaflet maps.

---

## 🛠️ Technology Stack

- **Frontend:** React (Vite), React Router, Sass (SCSS)
- **Backend:** Node.js, Express.js
- **Database:** MongoDB (Atlas), Mongoose
- **Real-Time Communication:** Socket.io
- **Maps & Geolocation:** Leaflet, OpenStreetMap, Geolocation API
- **Payments:** Razorpay API
- **Hosting:** Vercel (Frontend), Render (Backend)

---

## 🚀 Local Installation

### Prerequisites
- Node.js (v18+)
- MongoDB Atlas Account
- Razorpay Account

### Setup Instructions

1. **Clone the Repository**
   ```bash
   git clone https://github.com/your-username/tripzy.git
   cd "Ride Sharing"
   ```

2. **Backend Setup**
   ```bash
   cd backend
   npm install
   ```
   Create a `.env` file in the `backend/` directory:
   ```env
   PORT=5000
   MONGODB_URI=your_mongodb_connection_string
   JWT_SECRET=your_secret_key
   RAZORPAY_KEY_ID=your_razorpay_key
   RAZORPAY_KEY_SECRET=your_razorpay_secret
   ```
   Start the backend:
   ```bash
   npm run dev
   ```

3. **Frontend Setup**
   ```bash
   cd ../frontend
   npm install
   ```
   Create a `.env` file in the `frontend/` directory (if needed):
   ```env
   VITE_API_URL=http://localhost:5000
   ```
   Start the frontend:
   ```bash
   npm run dev
   ```

## 📜 License
This project is for educational purposes. Feel free to use and modify it!
