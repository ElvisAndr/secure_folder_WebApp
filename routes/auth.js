const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// ==========================================
// Routes d'affichage (Vues EJS)
// ==========================================
router.get('/register', (req, res) => {
    res.render('register');
});

router.get('/login', (req, res) => {
    res.render('login');
});

// ==========================================
// Routes de traitement (POST & GET)
// ==========================================
router.post('/register', authController.register);
router.post('/login', authController.login);
router.get('/logout', authController.logout);

router.delete('/api/user/delete', authController.deleteAccount);

module.exports = router;