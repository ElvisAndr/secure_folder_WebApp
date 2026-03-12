require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const crypto = require('crypto');
const bcrypt = require('bcrypt');

const Utilisateur = require('./models/utilisateur');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 7070;

// ==========================================
// 1. CONFIGURATION EXPRESS & MIDDLEWARES
// ==========================================
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.json());

app.use(express.urlencoded({ extended: true })); // Pour lire les formulaires POST
app.use(express.static(path.join(__dirname, 'public'))); // Pour le CSS

// Configuration sécurisée de la session
const sessionMiddleware = session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: false, // À passer à 'true' si tu déploies en HTTPS plus tard
        httpOnly: true, // Sécurité : empêche le JavaScript côté client de lire le cookie (anti-XSS)
        maxAge: 1000 * 60 * 60 * 24 // 1 jour
    }
});
app.use(sessionMiddleware);

// ==========================================
// 2. CONFIGURATION SOCKET.IO (Temps Réel Sécurisé)
// ==========================================
// On partage la session Express avec Socket.IO pour savoir QUI est connecté
io.engine.use(sessionMiddleware);

io.on('connection', (socket) => {
    const session = socket.request.session;
    
    // Si l'utilisateur est connecté via Express, on l'autorise sur le WebSocket
    if (session && session.userId) {
        console.log(`Utilisateur connecté au temps réel (ID DB: ${session.userId})`);
        // On le place dans une "room" privée portant son ID pour lui envoyer des notifications secrètes
        socket.join(`user_${session.userId}`);
    } else {
        console.log('Connexion WebSocket refusée : utilisateur non authentifié');
        socket.disconnect(); // On coupe la connexion si c'est un intrus
    }

    socket.on('disconnect', () => {
        console.log('Utilisateur déconnecté du temps réel');
    });
});

const authRoutes = require('./routes/auth');
const fileRoutes = require('./routes/files');

// On dit à Express d'utiliser ces routes
app.use('/', authRoutes);
app.use('/', fileRoutes);

const authController = require('./controllers/authController');

app.post('/register', authController.register);
app.post('/login', authController.login);
app.get('/logout', authController.logout);

server.listen(PORT, () => {
    console.log(`Serveur Sécurisé (avec WebSockets) démarré sur http://localhost:${PORT}`);
});