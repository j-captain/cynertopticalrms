ProjectCynertOpticalReccordsMS/
│
├── .gitignore
├── README.md
│
├── server/
│   ├── .gitignore
│   ├── .env.example
│   ├── .env                          ← (you create this locally, not committed)
│   ├── package.json
│   ├── server.js
│   │
│   ├── config/
│   │   ├── db.js
│   │   └── env.js
│   │
│   ├── controllers/
│   │   ├── auditController.js
│   │   ├── authController.js
│   │   ├── orderActionsController.js
│   │   ├── orderController.js
│   │   ├── patientController.js
│   │   ├── reportController.js
│   │   ├── settingsController.js
│   │   └── usersController.js
│   │
│   ├── middleware/
│   │   ├── audit.js
│   │   ├── auth.js
│   │   └── errorHandler.js
│   │
│   ├── models/
│   │   ├── AuditLog.js
│   │   ├── OrderLog.js
│   │   ├── Patient.js
│   │   ├── Settings.js
│   │   └── User.js
│   │
│   ├── routes/
│   │   ├── audit.js
│   │   ├── auth.js
│   │   ├── orders.js
│   │   ├── patients.js
│   │   ├── reports.js
│   │   ├── settings.js
│   │   └── users.js
│   │
│   └── utils/
│       ├── bootstrapAdmin.js
│       └── mailer.js
│
└── client/
    ├── .gitignore
    ├── index.html
    ├── package.json
    ├── postcss.config.js
    ├── tailwind.config.js
    ├── vite.config.js
    │
    ├── public/
    │   └── logo.svg
    │
    └── src/
        ├── App.jsx
        ├── index.css
        ├── main.jsx
        │
        ├── components/
        │   ├── Layout.jsx
        │   ├── Logo.jsx
        │   ├── Modal.jsx
        │   ├── OrderModal.jsx
        │   ├── ProtectedRoute.jsx
        │   └── StatCard.jsx
        │
        ├── context/
        │   └── AuthContext.jsx
        │
        ├── lib/
        │   └── api.js
        │
        └── pages/
            ├── Audit.jsx
            ├── Dashboard.jsx
            ├── Login.jsx
            ├── Orders.jsx
            ├── PatientForm.jsx
            ├── Patients.jsx
            ├── Profile.jsx
            ├── Reports.jsx
            ├── Settings.jsx
            └── Users.jsx