const bcrypt = require('bcrypt');
const crypto = require('crypto');
const Utilisateur = require('../models/utilisateur');

const authController = {
    register: async (req, res) => {
        try {
            // Le serveur reçoit maintenant des données DÉJÀ traitées par le navigateur
            const { username, email, passwordHashClient, publicKey, encryptedPrivateKey, salt, iv } = req.body;

            const userExists = await Utilisateur.trouverParNom(username);
            if (userExists) return res.status(400).send("Nom d'utilisateur déjà pris !");

            // Le serveur re-hache le hash fourni par le client pour le stocker (Double sécurité)
            // Comme ça, même si la base fuite, on n'a pas le "vrai" hash qui sert à s'authentifier
            const finalPasswordHash = await bcrypt.hash(passwordHashClient, 10);

            // On sauvegarde bêtement dans PostgreSQL
            await Utilisateur.creer(
                username, 
                email, 
                finalPasswordHash, 
                publicKey, 
                encryptedPrivateKey, 
                salt, 
                iv
            );
            
            res.send("Compte E2EE créé avec succès !"); // On renvoie un succès au JS
        } catch (error) {
            console.error(error);
            res.status(500).send("Erreur lors de l'inscription.");
        }
    },

    login: async (req, res) => {
        try {
            const { username, passwordHashClient } = req.body;

            const user = await Utilisateur.trouverParNom(username);
            if (!user) {
                return res.status(401).send("Identifiants incorrects.");
            }

            // Vérifie bien que ta colonne s'appelle "mot_de_passe_hash" ou "mot_de_passe" dans ta BDD
            const isMatch = await bcrypt.compare(passwordHashClient, user.mot_de_passe_hash);
            if (!isMatch) {
                return res.status(401).send("Identifiants incorrects.");
            }

            // Succès ! On crée la session
            req.session.userId = user.id;
            req.session.username = user.nom_utilisateur;

            // ==========================================
            // C'EST ICI QU'IL FAUT CHANGER : PLUS DE REDIRECT !
            // On renvoie un objet JSON pur au navigateur
            // ==========================================
            res.json({
                message: "Connexion réussie",
                salt: user.sel_crypto,               // Vérifie le nom de ta colonne
                iv: user.iv_crypto,                  // Vérifie le nom de ta colonne
                encryptedPrivateKey: user.cle_privee_chiffree // Vérifie le nom de ta colonne
            });

        } catch (error) {
            console.error("Erreur de connexion :", error);
            res.status(500).send("Erreur interne du serveur.");
        }
    },

    logout: (req, res) => {
        req.session.destroy((err) => {
            if (err) console.error("Erreur lors de la déconnexion :", err);
            res.redirect('/login');
        });
    }
};

module.exports = authController;