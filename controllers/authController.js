const bcrypt = require('bcrypt');
const crypto = require('crypto');
const Utilisateur = require('../models/utilisateur');

const authController = {
    register: async (req, res) => {
        try {
            const { username, email, password } = req.body;

            const userExists = await Utilisateur.trouverParNom(username);
            if (userExists) return res.status(400).send("Nom d'utilisateur déjà pris !");

            const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
                modulusLength: 2048,
                publicKeyEncoding: { type: 'spki', format: 'pem' },
                privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
            });

            const salt = crypto.randomBytes(16).toString('hex');
            const aesKey = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256');

            const iv = crypto.randomBytes(16);
            const cipher = crypto.createCipheriv('aes-256-cbc', aesKey, iv);
            let encryptedPrivateKey = cipher.update(privateKey, 'utf8', 'hex');
            encryptedPrivateKey += cipher.final('hex');

            const passwordHash = await bcrypt.hash(password, 10);

            await Utilisateur.creer(username, email, passwordHash, publicKey, encryptedPrivateKey, salt, iv.toString('hex'));
            
            res.redirect('/login');
        } catch (error) {
            console.error(error);
            res.status(500).send("Erreur lors de l'inscription.");
        }
    },

    login: async (req, res) => {
        try {
            const { username, password } = req.body;

            const user = await Utilisateur.trouverParNom(username);
            if (!user) {
                return res.status(401).send("Identifiants incorrects.");
            }

            const isMatch = await bcrypt.compare(password, user.mot_de_passe_hash);
            if (!isMatch) {
                return res.status(401).send("Identifiants incorrects.");
            }

            req.session.userId = user.id;
            req.session.username = user.nom_utilisateur;

            console.log(`${user.nom_utilisateur} vient de se connecter !`);

            res.redirect('/');

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