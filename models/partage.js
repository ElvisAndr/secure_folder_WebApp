const db = require('./db');

const Partage = {
    creer: async (fichierId, destinataireId, cleAesPartagee) => {
        const query = `
            INSERT INTO partages_fichiers 
            (fichier_id, destinataire_id, cle_aes_partagee) 
            VALUES ($1, $2, $3) 
            RETURNING *;
        `;
        const values = [fichierId, destinataireId, cleAesPartagee];
        const { rows } = await db.query(query, values);
        return rows[0];
    },

    recupererFichiersRecus: async (destinataireId) => {
        const query = `
            SELECT p.id as partage_id, f.nom_fichier, f.taille_octets, p.cle_aes_partagee, p.date_partage, u.nom_utilisateur as proprietaire
            FROM partages_fichiers p
            JOIN fichiers f ON p.fichier_id = f.id
            JOIN utilisateurs u ON f.proprietaire_id = u.id
            WHERE p.destinataire_id = $1
            ORDER BY p.date_partage DESC;
        `;
        const { rows } = await db.query(query, [destinataireId]);
        return rows;
    },

    recupererPartagePourTelechargement: async (partageId, destinataireId) => {
        const query = `
            SELECT f.chemin_stockage, f.nom_fichier, f.iv_fichier, p.cle_aes_partagee
            FROM partages_fichiers p
            JOIN fichiers f ON p.fichier_id = f.id
            WHERE p.id = $1 AND p.destinataire_id = $2
        `;
        const { rows } = await db.query(query, [partageId, destinataireId]);
        return rows[0];
    }
};

module.exports = Partage;