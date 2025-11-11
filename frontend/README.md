## NAWA Frontend (React + Vite)

### Prereqs
- Node 18+ and npm
- Backend running at `http://127.0.0.1:8000`

### Setup
```bash
cd frontend
npm install
cp ENV.EXAMPLE .env
# edit .env if needed
npm run dev
```

### Tailwind CSS
Tailwind is configured with `tailwind.config.js` and `postcss.config.js`. Styles are imported via `src/styles.css` using Tailwind directives.

If classes are not applied, ensure dev server restarted after `npm install`.

### API base URL
Set `VITE_API_BASE_URL` in `.env`. Default is `http://127.0.0.1:8000/api`.

### Authentication
- Backend provides JWT at:
  - `POST /api/auth/login/` → `{ access, refresh }`
  - `GET /api/auth/me/` → `{ username, roles: [] }`
- Frontend stores tokens in localStorage and shows the real role in the header after login.
- To enforce role-based permissions in backend, set `ENFORCE_ROLE_PERMS=true` in `.env` and restart the server.

### Build
```bash
npm run build
npm run preview
```

### Features
- Crime Categories: list + create
- Crime Reports: list + filters + create + location metadata
- Map view powered by `/api/crimereportbook/map/` with React Leaflet
- React Query for fetching/caching, Axios client, React Router routing

