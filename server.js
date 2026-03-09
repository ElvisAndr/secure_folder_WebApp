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

// ==========================================
// 3. ROUTES D'AFFICHAGE (GET)
// ==========================================
app.get('/', (req, res) => {
    // Si l'utilisateur n'est pas connecté, on le jette vers la page de login
    if (!req.session.userId) {
        return res.redirect('/login');
    }
    // S'il est connecté, on affiche son espace sécurisé
    res.render('index', { username: req.session.username });
});

app.get('/register', (req, res) => {
    res.render('register');
});

app.get('/login', (req, res) => {
    res.render('login');
});

// ==========================================
// 4. ROUTE D'INSCRIPTION (POST)
// ==========================================
app.post('/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;

        // A. Vérifier si l'utilisateur existe déjà
        const userExists = await Utilisateur.trouverParNom(username);
        if (userExists) {
            return res.status(400).send("Ce nom d'utilisateur est déjà pris !");
        }

        // B. Génération de la paire de clés RSA (Asymétrique)
        const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
            modulusLength: 2048,
            publicKeyEncoding: { type: 'spki', format: 'pem' },
            privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
        });

        // C. Dérivation du mot de passe en clé AES forte (Symétrique)
        const salt = crypto.randomBytes(16).toString('hex');
        const aesKey = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256');

        // D. Chiffrement de la Clé Privée RSA avec la clé AES
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv('aes-256-cbc', aesKey, iv);
        let encryptedPrivateKey = cipher.update(privateKey, 'utf8', 'hex');
        encryptedPrivateKey += cipher.final('hex');

        // E. Hachage du mot de passe pour la connexion (bcrypt)
        // Le mot de passe ne doit jamais être stocké en clair [cite: 18]
        const passwordHash = await bcrypt.hash(password, 10);

        // F. Sauvegarde en Base de Données via notre DAO
        const nouvelUser = await Utilisateur.creer(
            username,
            email,
            passwordHash,
            publicKey,
            encryptedPrivateKey,
            salt,
            iv.toString('hex')
        );

        console.log(`Nouvel utilisateur créé avec succès : ${nouvelUser.nom_utilisateur}`);
        res.redirect('/login');

    } catch (error) {
        console.error("Erreur critique lors de l'inscription :", error);
        res.status(500).send("Erreur interne du serveur lors de l'inscription.");
    }
});

// ==========================================
// 5. LANCEMENT DU SERVEUR
// ==========================================
server.listen(PORT, () => {
    console.log(`Serveur Sécurisé (avec WebSockets) démarré sur http://localhost:${PORT}`);
});