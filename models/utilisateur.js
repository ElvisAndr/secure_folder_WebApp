const db = require('./db');

const Utilisateur = {
    creer: async (nomUtilisateur, email, motDePasseHash, clePublique, clePriveeChiffree, selCrypto, ivCrypto) => {
        const query = `
            INSERT INTO utilisateurs 
            (nom_utilisateur, email, mot_de_passe_hash, cle_publique, cle_privee_chiffree, sel_crypto, iv_crypto) 
            VALUES ($1, $2, $3, $4, $5, $6, $7) 
            RETURNING id, nom_utilisateur, email;
        `;
        const values = [nomUtilisateur, email, motDePasseHash, clePublique, clePriveeChiffree, selCrypto, ivCrypto];
        const { rows } = await db.query(query, values);
        return rows[0];
    },

    trouverParNom: async (nomUtilisateur) => {
        const query = `SELECT * FROM utilisateurs WHERE nom_utilisateur = $1;`;
        const { rows } = await db.query(query, [nomUtilisateur]);
        return rows[0];
    },

    trouverParEmail: async (email) => {
        const query = `SELECT * FROM utilisateurs WHERE email = $1;`;
        const { rows } = await db.query(query, [email]);
        return rows[0];
    }
};

module.exports = Utilisateur;