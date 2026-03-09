const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT || 5432,
});

// Test rapide pour vérifier que la base répond bien au démarrage
pool.query('SELECT NOW()', (err, res) => {
    if (err) {
        console.error('Erreur de connexion à PostgreSQL :', err.stack);
    } else {
        console.log('Connecté à PostgreSQL avec succès à :', res.rows[0].now);
    }
});

module.exports = {
    query: (text, params) => pool.query(text, params),
};