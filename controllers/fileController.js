const fs = require('fs').promises;
const path = require('path');
const Fichier = require('../models/fichier');
const Partage = require('../models/partage');
const Utilisateur = require('../models/utilisateur');

const fileController = {
    upload: async (req, res) => {
        try {
            if (!req.file) return res.status(400).send("Aucun fichier reçu.");

            // Le serveur reçoit tout en texte depuis le FormData du navigateur
            const { originalName, encryptedAesKey, iv } = req.body;

            // 1. On sauvegarde le fichier tel quel (il est DÉJÀ chiffré !)
            const nomFichierPhysique = Date.now() + '-' + Math.round(Math.random() * 1E9) + '.enc';
            const cheminStockage = path.join(__dirname, '../uploads', nomFichierPhysique);
            
            // req.file.buffer contient les octets chiffrés envoyés par le client
            await fs.writeFile(cheminStockage, req.file.buffer);

            // 2. On enregistre en base de données
            await Fichier.ajouter(
                req.session.userId,
                originalName,
                nomFichierPhysique,
                req.file.buffer.length,
                encryptedAesKey, // La clé AES déjà chiffrée en RSA par le client
                iv               // L'IV du fichier
            );

            console.log(`Fichier Zero-Trust ${originalName} stocké avec succès !`);
            res.status(200).send("Fichier sécurisé et uploadé.");

        } catch (error) {
            console.error("Erreur d'upload :", error);
            res.status(500).send("Erreur serveur.");
        }
    },

    download: async (req, res) => {
        try {
            const fichierId = req.params.id;

            // 1. On va chercher les infos du fichier dans la base de données
            const fichier = await Fichier.trouverParId(fichierId);

            if (!fichier) {
                return res.status(404).send("Fichier introuvable.");
            }

            // Vérification de sécurité (pour l'instant, seul le proprio peut télécharger)
            if (fichier.proprietaire_id !== req.session.userId) {
                return res.status(403).send("Accès refusé.");
            }

            // 2. On prépare le chemin physique vers le fichier .enc sur le disque
            const cheminStockage = path.join(__dirname, '../uploads', fichier.chemin_stockage);

            // 3. LA MAGIE DES HEADERS : 
            // On injecte les données cryptographiques dans l'en-tête de la réponse
            // (Il faut autoriser le navigateur à lire ces en-têtes personnalisés avec Access-Control-Expose-Headers)
            res.set({
                'Access-Control-Expose-Headers': 'x-encrypted-aes-key, x-iv, x-original-name',
                'x-encrypted-aes-key': fichier.cle_aes_chiffree,
                'x-iv': fichier.iv_fichier, // <-- L'ERREUR ÉTAIT LÀ ! 
                'x-original-name': encodeURIComponent(fichier.nom_fichier)
            });

            // 4. On envoie le fichier chiffré brut
            res.sendFile(cheminStockage);

        } catch (error) {
            console.error("Erreur de téléchargement :", error);
            res.status(500).send("Erreur serveur.");
        }
    },

    downloadShared: async (req, res) => {
        try {
            const partageId = req.params.id;
            
            // On cherche le partage avec la fonction qu'on vient de créer
            const partage = await Partage.recupererPartagePourTelechargement(partageId, req.session.userId);

            if (!partage) {
                return res.status(404).send("Fichier partagé introuvable ou accès refusé.");
            }

            const cheminStockage = path.join(__dirname, '../uploads', partage.chemin_stockage);

            // On glisse la clé de BOB dans les Headers !
            res.set({
                'Access-Control-Expose-Headers': 'x-encrypted-aes-key, x-iv, x-original-name',
                'x-encrypted-aes-key': partage.cle_aes_partagee, // <-- LA CLÉ POUR BOB
                'x-iv': partage.iv_fichier,
                'x-original-name': encodeURIComponent(partage.nom_fichier)
            });

            res.sendFile(cheminStockage);

        } catch (error) {
            console.error("Erreur de téléchargement partagé :", error);
            res.status(500).send("Erreur serveur.");
        }
    }
};

module.exports = fileController;