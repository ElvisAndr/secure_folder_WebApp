const bcrypt = require('bcrypt');
const crypto = require('crypto');
const Utilisateur = require('../models/utilisateur');
const Fichier = require('../models/fichier');

const authController = {
    // Register a new user
    register: async (req, res) => {
        try {
            const { username, email, passwordHashClient, publicKey, encryptedPrivateKey, encryptedPrivateKeyBackup, salt, iv } = req.body;

            const userExists = await Utilisateur.trouverParNom(username);
            if (userExists) return res.status(400).send("Nom d'utilisateur déjà pris !");

            const finalPasswordHash = await bcrypt.hash(passwordHashClient, 10);

            await Utilisateur.creer(
                username, 
                email, 
                finalPasswordHash, 
                publicKey, 
                encryptedPrivateKey, 
                salt, 
                iv,
                encryptedPrivateKeyBackup,
            );
            
            res.send("Compte E2EE créé avec succès !");
        } catch (error) {
            console.error(error);
            res.status(500).send("Erreur lors de l'inscription.");
        }
    },

    // Login a user
    login: async (req, res) => {
        try {
            const { username, passwordHashClient } = req.body;

            const user = await Utilisateur.trouverParNom(username);
            if (!user) {
                return res.status(401).send("Identifiants incorrects.");
            }

            const isMatch = await bcrypt.compare(passwordHashClient, user.mot_de_passe_hash);
            if (!isMatch) {
                return res.status(401).send("Identifiants incorrects.");
            }

            req.session.userId = user.id;
            req.session.username = user.nom_utilisateur;

            res.json({
                message: "Connexion réussie",
                salt: user.sel_crypto,
                iv: user.iv_crypto,
                encryptedPrivateKey: user.cle_privee_chiffree,
                encryptedPrivateKeyBackup: user.encrypted_private_key_backup
            });

        } catch (error) {
            console.error("Erreur de connexion :", error);
            res.status(500).send("Erreur interne du serveur.");
        }
    },

    // Logout a user
    logout: (req, res) => {
        req.session.destroy((err) => {
            if (err) console.error("Erreur lors de la déconnexion :", err);
            res.redirect('/login');
        });
    },

    deleteAccount: async (req, res) => {
        try {
            const userId = req.session.userId;

            const fichiers = await Fichier.recupererParProprietaire(userId);
            
            for (const fichier of fichiers) {
                const cheminStockage = path.join(__dirname, '../uploads', fichier.chemin_stockage);
                await fs.unlink(cheminStockage).catch(err => console.log("Fichier physique introuvable, suite logique."));
            }

            await Utilisateur.supprimer(userId);

            req.session.destroy((err) => {
                if (err) throw err;
                res.status(200).send("Compte et données supprimés définitivement.");
            });

        } catch (error) {
            console.error("Erreur d'auto-destruction :", error);
            res.status(500).send("Erreur serveur lors de la suppression du compte.");
        }
    }
};

module.exports = authController;