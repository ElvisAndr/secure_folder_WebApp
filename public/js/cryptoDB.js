const dbName = "BaseDeDonneesCrypto";
const storeName = "ClesPrivees";

// 1. Initialiser ou ouvrir la base de données du navigateur
function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(dbName, 1);
        
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(storeName)) {
                db.createObjectStore(storeName); // Crée la "table"
            }
        };
        
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject("Erreur d'ouverture IndexedDB");
    });
}

// 2. Sauvegarder la clé (L'objet CryptoKey inviolable)
async function savePrivateKey(cryptoKeyObject) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], "readwrite");
        const store = transaction.objectStore(storeName);
        const request = store.put(cryptoKeyObject, "maClePrivee");
        
        request.onsuccess = () => resolve();
        request.onerror = () => reject("Erreur de sauvegarde de la clé");
    });
}

// 3. Récupérer la clé (Pour déchiffrer les fichiers plus tard)
async function getPrivateKey() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], "readonly");
        const store = transaction.objectStore(storeName);
        const request = store.get("maClePrivee");
        
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject("Erreur de récupération de la clé");
    });
}

// 4. Supprimer la clé (À appeler lors de la déconnexion !)
async function deletePrivateKey() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], "readwrite");
        const store = transaction.objectStore(storeName);
        const request = store.delete("maClePrivee");
        request.onsuccess = () => resolve();
    });
}