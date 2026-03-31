const fs = require('fs').promises;
const path = require('path');
const Fichier = require('../models/fichier');
const Partage = require('../models/partage');
const Utilisateur = require('../models/utilisateur');

const fileController = {
    // Upload a file
    upload: async (req, res) => {
        try {
            if (!req.file) return res.status(400).send("Aucun fichier reçu.");

            const { originalName, encryptedAesKey, iv } = req.body;

            const nomFichierPhysique = Date.now() + '-' + Math.round(Math.random() * 1E9) + '.enc';
            const cheminStockage = path.join(__dirname, '../uploads', nomFichierPhysique);
            
            await fs.writeFile(cheminStockage, req.file.buffer);

            await Fichier.ajouter(
                req.session.userId,
                originalName,
                nomFichierPhysique,
                req.file.buffer.length,
                encryptedAesKey,
                iv
            );

            console.log(`Fichier Zero-Trust ${originalName} stocké avec succès !`);
            res.status(200).send("Fichier sécurisé et uploadé.");

        } catch (error) {
            console.error("Erreur d'upload :", error);
            res.status(500).send("Erreur serveur.");
        }
    },

    // Download a file
    download: async (req, res) => {
        try {
            const fichierId = req.params.id;

            const fichier = await Fichier.trouverParId(fichierId);

            if (!fichier) {
                return res.status(404).send("Fichier introuvable.");
            }

            if (fichier.proprietaire_id !== req.session.userId) {
                return res.status(403).send("Accès refusé.");
            }

            const cheminStockage = path.join(__dirname, '../uploads', fichier.chemin_stockage);

            res.set({
                'Access-Control-Expose-Headers': 'x-encrypted-aes-key, x-iv, x-original-name',
                'x-encrypted-aes-key': fichier.cle_aes_chiffree,
                'x-iv': fichier.iv_fichier,
                'x-original-name': encodeURIComponent(fichier.nom_fichier)
            });

            res.sendFile(cheminStockage);

        } catch (error) {
            console.error("Erreur de téléchargement :", error);
            res.status(500).send("Erreur serveur.");
        }
    },

    // Download a shared file
    downloadShared: async (req, res) => {
        try {
            const partageId = req.params.id;
            
            const partage = await Partage.recupererPartagePourTelechargement(partageId, req.session.userId);

            if (!partage) {
                return res.status(404).send("Fichier partagé introuvable ou accès refusé.");
            }

            const cheminStockage = path.join(__dirname, '../uploads', partage.chemin_stockage);

            res.set({
                'Access-Control-Expose-Headers': 'x-encrypted-aes-key, x-iv, x-original-name',
                'x-encrypted-aes-key': partage.cle_aes_partagee,
                'x-iv': partage.iv_fichier,
                'x-original-name': encodeURIComponent(partage.nom_fichier)
            });

            res.sendFile(cheminStockage);

        } catch (error) {
            console.error("Erreur de téléchargement partagé :", error);
            res.status(500).send("Erreur serveur.");
        }
    },

    deleteFile: async (req, res) => {
        try {
            const fichierId = req.params.id;
            const fichier = await Fichier.trouverParId(fichierId);

            if (!fichier) return res.status(404).send("Fichier introuvable.");

            if (fichier.proprietaire_id !== req.session.userId) return res.status(403).send("Accès refusé.");

            const cheminStockage = path.join(__dirname, '../uploads', fichier.chemin_stockage);

            await fs.unlink(cheminStockage).catch(err => console.log("Fichier physique introuvable."));

            await Fichier.supprimer(fichierId);

            res.status(200).send("Fichier supprimé définitivement.");
        } catch (error) {
            console.error("Erreur de suppression :", error);
            res.status(500).send("Erreur serveur.");
        }
    }
};

module.exports = fileController;