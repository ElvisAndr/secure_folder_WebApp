const express = require('express');
const router = express.Router();
const multer = require('multer');
const fileController = require('../controllers/fileController');
const Utilisateur = require('../models/utilisateur');
const Fichier = require('../models/fichier');
const Partage = require('../models/partage');

// Configuration de Multer isolée ici
const upload = multer({ storage: multer.memoryStorage() });

// ==========================================
// TABLEAU DE BORD
// ==========================================
router.get('/', async (req, res) => {
    try {
        if (!req.session.userId) return res.redirect('/login');

        // On récupère tes infos (dont ta clé publique)
        const user = await Utilisateur.trouverParNom(req.session.username);
        
        const mesFichiers = await Fichier.recupererParProprietaire(req.session.userId);
        
        // (Garde la ligne des partages si tu l'avais mise)
        const mesPartages = await Partage.recupererFichiersRecus(req.session.userId);

        res.render('index', { 
            username: user.nom_utilisateur,
            publicKey: user.cle_publique, // <-- LA NOUVEAUTÉ EST LÀ
            fichiers: mesFichiers,
            fichiersPartages: mesPartages
        });

    } catch (error) {
        console.error("Erreur de chargement du dashboard :", error);
        res.status(500).send("Erreur serveur.");
    }
});

// ==========================================
// UPLOAD DE FICHIERS
// ==========================================
router.post('/upload', upload.single('file'), fileController.upload);

// ==========================================
// TÉLÉCHARGEMENT DE FICHIER
// ==========================================
router.get('/download/:id', async (req, res) => {
    // Petite protection au cas où l'utilisateur ne serait pas connecté
    if (!req.session.userId) {
        return res.status(401).send("Veuillez vous connecter.");
    }
    // On passe le relais au contrôleur
    await fileController.download(req, res);
});

// ==========================================
// API : RÉCUPÉRER LA CLÉ PUBLIQUE D'UN UTILISATEUR
// ==========================================
router.get('/api/user/:username/public-key', async (req, res) => {
    try {
        if (!req.session.userId) return res.status(401).send("Non autorisé");
        
        const user = await Utilisateur.trouverParNom(req.params.username);
        if (!user) return res.status(404).send("Utilisateur introuvable");
        
        // On renvoie juste l'ID et la Clé Publique
        res.json({ id: user.id, publicKey: user.cle_publique });
    } catch (error) {
        console.error(error);
        res.status(500).send("Erreur serveur");
    }
});

// ==========================================
// API : SAUVEGARDER LE PARTAGE
// ==========================================
router.post('/share', async (req, res) => {
    try {
        if (!req.session.userId) return res.status(401).send("Non autorisé");
        
        const { fileId, recipientId, sharedEncryptedAesKey } = req.body;

        // ==========================================
        // ZONE D'ESPIONNAGE
        // ==========================================
        console.log("--- TENTATIVE DE PARTAGE REÇUE ---");
        console.log("Fichier ID :", fileId);
        console.log("Expéditeur (Toi) ID :", req.session.userId);
        console.log("Destinataire (Bob) ID :", recipientId);
        console.log("Clé AES rechiffrée (début) :", sharedEncryptedAesKey.substring(0, 20) + "...");
        // ==========================================

        // Vérifie bien que tu as importé et appelé ton modèle Partage ici !
        await Partage.creer(fileId, recipientId, sharedEncryptedAesKey);

        console.log("--- PARTAGE ENREGISTRÉ EN BDD AVEC SUCCÈS ---");
        res.status(200).send("Partage réussi !");
    } catch (error) {
        console.error("Erreur détaillée lors du partage :", error); // On veut voir l'erreur !
        res.status(500).send("Erreur serveur");
    }
});

// ==========================================
// TÉLÉCHARGEMENT D'UN FICHIER PARTAGÉ
// ==========================================
router.get('/download-shared/:id', async (req, res) => {
    if (!req.session.userId) return res.status(401).send("Veuillez vous connecter.");
    await fileController.downloadShared(req, res);
});

module.exports = router;