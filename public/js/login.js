const encoder = new TextEncoder();

// Convertit une chaîne Base64 en ArrayBuffer
function base64ToArrayBuffer(base64) {
    const binaryString = window.atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
}

// Gestion de la soumission du formulaire de connexion
document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const statusText = document.getElementById('status-message');
    const submitBtn = document.getElementById('submit-btn');

    try {
        submitBtn.disabled = true;
        statusText.style.color = "blue";
        statusText.innerText = "1. Authentification en cours...";

        // Étape 1 : Hachage du mot de passe côté client
        const passwordBuffer = encoder.encode(password);
        const hashBuffer = await crypto.subtle.digest('SHA-256', passwordBuffer);

        let binary = '';
        const bytes = new Uint8Array(hashBuffer);
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        const passwordHashClient = window.btoa(binary);

        // Étape 2 : Envoi des identifiants au serveur
        const response = await fetch('/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, passwordHashClient })
        });

        if (!response.ok) {
            throw new Error(await response.text());
        }

        const data = await response.json();
        statusText.innerText = "2. Déchiffrement local de vos clés...";

        // Étape 3 : Déchiffrement de la clé privée
        const saltBuffer = base64ToArrayBuffer(data.salt);
        const ivBuffer = base64ToArrayBuffer(data.iv);
        const encryptedPrivateKeyBuffer = base64ToArrayBuffer(data.encryptedPrivateKey);

        const baseKey = await crypto.subtle.importKey(
            "raw", passwordBuffer, { name: "PBKDF2" }, false, ["deriveKey"]
        );
        const aesKey = await crypto.subtle.deriveKey(
            { name: "PBKDF2", salt: saltBuffer, iterations: 100000, hash: "SHA-256" },
            baseKey,
            { name: "AES-GCM", length: 256 },
            false, ["decrypt"]
        );

        const decryptedPrivateKeyBuffer = await crypto.subtle.decrypt(
            { name: "AES-GCM", iv: ivBuffer },
            aesKey,
            encryptedPrivateKeyBuffer
        );

        statusText.innerText = "3. Sécurisation anti-XSS de la clé...";

        // Étape 4 : Importation de la clé privée déchiffrée
        const privateKeyObject = await crypto.subtle.importKey(
            "pkcs8", decryptedPrivateKeyBuffer, { name: "RSA-OAEP", hash: "SHA-256" }, false, ["decrypt"]
        );

        // Étape 5 : Sauvegarde sécurisée de la clé privée
        await savePrivateKey(privateKeyObject);

        statusText.style.color = "green";
        statusText.innerText = "Succès ! Forteresse activée.";

        setTimeout(() => window.location.href = '/', 1000);

    } catch (error) {
        console.error("Erreur Zero-Trust :", error);
        statusText.style.color = "red";
        statusText.innerText = "Erreur : Identifiants incorrects.";
        submitBtn.disabled = false;
    }
});