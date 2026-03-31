const express = require('express');
const router = express.Router();
const multer = require('multer');
const fileController = require('../controllers/fileController');
const Utilisateur = require('../models/utilisateur');
const Fichier = require('../models/fichier');
const Partage = require('../models/partage');

// Multer configuration
const upload = multer({ storage: multer.memoryStorage() });

// ==========================================
// Dashboard
// ==========================================
router.get('/', async (req, res) => {
    try {
        if (!req.session.userId) return res.redirect('/login');

        const user = await Utilisateur.trouverParNom(req.session.username);
        const mesFichiers = await Fichier.recupererParProprietaire(req.session.userId);
        const mesPartages = await Partage.recupererFichiersRecus(req.session.userId);

        res.render('index', { 
            username: user.nom_utilisateur,
            publicKey: user.cle_publique,
            fichiers: mesFichiers,
            fichiersPartages: mesPartages
        });

    } catch (error) {
        console.error("Erreur de chargement du dashboard :", error);
        res.status(500).send("Erreur serveur.");
    }
});

// ==========================================
// Upload de fichiers
// ==========================================
router.post('/upload', upload.single('file'), fileController.upload);

// ==========================================
// Téléchargement de fichier
// ==========================================
router.get('/download/:id', async (req, res) => {
    if (!req.session.userId) {
        return res.status(401).send("Veuillez vous connecter.");
    }
    await fileController.download(req, res);
});

// ==========================================
// API : Récupérer la clé publique d'un utilisateur
// ==========================================
router.get('/api/user/:username/public-key', async (req, res) => {
    try {
        if (!req.session.userId) return res.status(401).send("Non autorisé");
        
        const user = await Utilisateur.trouverParNom(req.params.username);
        if (!user) return res.status(404).send("Utilisateur introuvable");
        
        res.json({ id: user.id, publicKey: user.cle_publique });
    } catch (error) {
        console.error(error);
        res.status(500).send("Erreur serveur");
    }
});

// ==========================================
// API : Sauvegarder le partage
// ==========================================
router.post('/share', async (req, res) => {
    try {
        if (!req.session.userId) return res.status(401).send("Non autorisé");
        
        const { fileId, recipientId, sharedEncryptedAesKey } = req.body;
        await Partage.creer(fileId, recipientId, sharedEncryptedAesKey);

        res.status(200).send("Partage réussi !");
    } catch (error) {
        console.error("Erreur lors du partage :", error);
        res.status(500).send("Erreur serveur");
    }
});

// ==========================================
// Téléchargement d'un fichier partagé
// ==========================================
router.get('/download-shared/:id', async (req, res) => {
    if (!req.session.userId) return res.status(401).send("Veuillez vous connecter.");
    await fileController.downloadShared(req, res);
});

module.exports = router;