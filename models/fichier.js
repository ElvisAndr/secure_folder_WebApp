const db = require('./db');

const Fichier = {
    ajouter: async (proprietaireId, nomFichier, cheminStockage, tailleOctets, cleAesChiffree, ivFichier) => {
        const query = `
            INSERT INTO fichiers 
            (proprietaire_id, nom_fichier, chemin_stockage, taille_octets, cle_aes_chiffree, iv_fichier) 
            VALUES ($1, $2, $3, $4, $5, $6) 
            RETURNING *;
        `;
        const values = [proprietaireId, nomFichier, cheminStockage, tailleOctets, cleAesChiffree, ivFichier];
        const { rows } = await db.query(query, values);
        return rows[0];
    },

    recupererParProprietaire: async (proprietaireId) => {
        const query = `SELECT * FROM fichiers WHERE proprietaire_id = $1 ORDER BY date_upload DESC;`;
        const { rows } = await db.query(query, [proprietaireId]);
        return rows;
    },

    trouverParId: async (fichierId) => {
        const query = `SELECT * FROM fichiers WHERE id = $1;`;
        const { rows } = await db.query(query, [fichierId]);
        return rows[0];
    },

    supprimer: async (fichierId) => {
        const query = `DELETE FROM fichiers WHERE id = $1;`;
        await db.query(query, [fichierId]);
    }
};

module.exports = Fichier;