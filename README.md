# 🛰️ NAWA — Neighbourhood Alert Watch App  

**Nawa** (Neighbourhood Alert Watch Application) is a community safety and reporting system built to connect residents, local authorities, and law enforcement through real-time alerts.  
Users can report incidents such as crimes, safety hazards, or emergencies — and view them on an interactive map.  

---

## 🌍 Overview  
Nawa empowers communities to:  
- **Report** incidents instantly (crime, fire, accident, etc.)  
- **View** alerts happening nearby in real time  
- **Receive** SMS or app notifications for urgent cases  
- **Collaborate** with local response teams  
- **Promote** safer and more informed neighbourhoods  

---

## ⚙️ Tech Stack  

### **Backend (Django / REST Framework)**  
- Django 5 + Django REST Framework  
- PostgreSQL / SQLite  
- JWT Authentication  
- Africa’s Talking API for SMS integration  
- Admin Dashboard for reviewing and moderating reports  
- Map endpoints for alert geolocation  

### **Frontend (React + Vite + TailwindCSS)**  
- React 18 (Vite for fast builds)  
- Tailwind CSS for styling  
- Axios for API calls  
- React Router DOM for navigation  
- Leaflet.js for map rendering and markers  
- Component-based modular structure  

---

## 🧱 Project Structure    

---

## 🚀 Getting Started  

### **Backend Setup**  
```bash
cd core
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Configure your environment variables (API keys, DB, etc.)
python manage.py migrate
python manage.py runserver

cd frontend
npm install
cp .env.example .env
# Add your backend URL, e.g.:
# VITE_API_URL=http://127.0.0.1:8000/api
npm run dev

Access the app:
Frontend: http://localhost:5173
Backend API: http://127.0.0.1:8000/api

DJANGO_SECRET_KEY=your_secret_key
DEBUG=True
DATABASE_URL=sqlite:///db.sqlite3
AFRICASTALKING_USERNAME=sandbox
AFRICASTALKING_API_KEY=your_api_key
⚠️ Make sure .env files are in your .gitignore.

VITE_API_URL=http://127.0.0.1:8000/api

| Endpoint                    | Method | Description                           |
| --------------------------- | ------ | ------------------------------------- |
| `/api/reports/`             | GET    | List all incident reports             |
| `/api/reports/`             | POST   | Create a new report                   |
| `/api/users/register/`      | POST   | Register a new user                   |
| `/api/users/login/`         | POST   | Log in and get token                  |
| `/api/crimereportbook/map/` | GET    | Retrieve all reports with geolocation |

🗺️ Map Integration

Nawa uses Leaflet.js for displaying real-time reports on a map.
Each report includes:

Location name (auto-geocoded)

Latitude/Longitude

Type of incident

Timestamp

📤 Deployment
1. Build frontend
cd frontend
npm run build

2. Collect static files (Django)
cd core
python manage.py collectstatic

3. Configure environment for production
Set:
DEBUG=False
ALLOWED_HOSTS=yourdomain.com

You can deploy:
Backend: Render, Railway, or DigitalOcean
Frontend: Netlify, Vercel, or GitHub Pages

🧪 Testing
python manage.py test

Frontend tests:
npm test

🤝 Contributing
1. Fork the repo
2. Create a feature branch

git checkout -b feature/add-map-layer

3. Commit your changes
git commit -m "Added Leaflet map integration"

Push and create a Pull Request

📄 License

This project is licensed under the MIT License — see the LICENSE
 file for details.

👤 Author

Evans Githinji
CEO, TECHNERV
📧 technervke@gmail.com
🌐 https://technerv.github.io
