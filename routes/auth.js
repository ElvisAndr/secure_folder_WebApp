const express = require('express');
const router = express.Router(); // C'est l'outil magique d'Express pour déporter les routes

// Attention aux chemins : on recule d'un dossier (../) pour aller chercher le contrôleur
const authController = require('../controllers/authController');

// ==========================================
// ROUTES D'AFFICHAGE (Vues EJS)
// ==========================================
router.get('/register', (req, res) => {
    res.render('register');
});

router.get('/login', (req, res) => {
    res.render('login');
});

// ==========================================
// ROUTES DE TRAITEMENT (POST & GET)
// ==========================================
router.post('/register', authController.register);
router.post('/login', authController.login);
router.get('/logout', authController.logout);

module.exports = router; // On exporte le routeur pour que server.js puisse l'utiliser