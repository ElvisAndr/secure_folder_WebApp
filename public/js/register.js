// Génère un code de secours aléatoire et sécurisé
function generateRecoveryCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Évite les caractères ambigus
    let result = '';
    const randomArray = new Uint8Array(16);
    window.crypto.getRandomValues(randomArray);

    for (let i = 0; i < 16; i++) {
        result += chars[randomArray[i] % chars.length];
        if ((i + 1) % 4 === 0 && i !== 15) result += '-';
    }
    return result;
}

// Convertit un ArrayBuffer en Base64 pour l'envoi au serveur
function arrayBufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
}

// Gestion de l'inscription utilisateur
document.getElementById('register-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const username = document.getElementById('username').value;
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const statusText = document.getElementById('status-message');
    const submitBtn = document.getElementById('submit-btn');

    try {
        submitBtn.disabled = true;
        statusText.innerText = "Création de vos clés cryptographiques en cours (ne fermez pas la page)...";

        // Étape 1 : Hachage du mot de passe
        const passwordBuffer = new TextEncoder().encode(password);
        const hashBuffer = await crypto.subtle.digest('SHA-256', passwordBuffer);
        const passwordHashClient = arrayBufferToBase64(hashBuffer);

        // Étape 2 : Génération de la paire de clés RSA
        statusText.innerText = "Génération de la paire de clés RSA...";
        const keyPair = await crypto.subtle.generateKey(
            {
                name: "RSA-OAEP",
                modulusLength: 2048,
                publicExponent: new Uint8Array([1, 0, 1]),
                hash: "SHA-256"
            },
            true,
            ["encrypt", "decrypt"]
        );

        const publicKeyBuffer = await crypto.subtle.exportKey("spki", keyPair.publicKey);
        const publicKeyBase64 = arrayBufferToBase64(publicKeyBuffer);
        const privateKeyBuffer = await crypto.subtle.exportKey("pkcs8", keyPair.privateKey);

        // Étape 3 : Création de la clé AES pour chiffrer la clé privée
        statusText.innerText = "Sécurisation de votre clé privée...";
        const salt = crypto.getRandomValues(new Uint8Array(16));
        const baseKey = await crypto.subtle.importKey(
            "raw", passwordBuffer, { name: "PBKDF2" }, false, ["deriveKey"]
        );
        const masterAesKey = await crypto.subtle.deriveKey(
            {
                name: "PBKDF2",
                hash: "SHA-256",
                salt: salt,
                iterations: 100000,
            },
            baseKey,
            { name: "AES-GCM", length: 256 },
            false,
            ["encrypt"]
        );

        const iv = crypto.getRandomValues(new Uint8Array(12));
        const encryptedPrivateKeyBuffer = await crypto.subtle.encrypt(
            { name: "AES-GCM", iv: iv },
            masterAesKey,
            privateKeyBuffer
        );
        const encryptedPrivateKeyBase64 = arrayBufferToBase64(encryptedPrivateKeyBuffer);

        // Étape 4 : Génération et chiffrement avec le code de secours
        const recoveryCode = generateRecoveryCode();
        const recoveryCodeBuffer = new TextEncoder().encode(recoveryCode);
        const recoveryKeyMaterial = await crypto.subtle.importKey(
            "raw", recoveryCodeBuffer, { name: "PBKDF2" }, false, ["deriveBits", "deriveKey"]
        );
        const backupAesMasterKey = await crypto.subtle.deriveKey(
            { name: "PBKDF2", salt: salt, iterations: 100000, hash: "SHA-256" },
            recoveryKeyMaterial,
            { name: "AES-GCM", length: 256 },
            false,
            ["encrypt", "decrypt"]
        );
        const encryptedPrivateKeyBackupBuffer = await crypto.subtle.encrypt(
            { name: "AES-GCM", iv: iv },
            backupAesMasterKey,
            privateKeyBuffer
        );
        const encryptedPrivateKeyBackupBase64 = arrayBufferToBase64(encryptedPrivateKeyBackupBuffer);

        // Étape 5 : Envoi des données au serveur
        statusText.innerText = "Envoi des données sécurisées au serveur...";
        const payload = {
            username,
            email,
            passwordHashClient,
            publicKey: publicKeyBase64,
            encryptedPrivateKey: encryptedPrivateKeyBase64,
            encryptedPrivateKeyBackup: encryptedPrivateKeyBackupBase64,
            salt: arrayBufferToBase64(salt),
            iv: arrayBufferToBase64(iv)
        };

        const response = await fetch('/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            document.getElementById('recovery-code-display').innerText = recoveryCode;
            document.getElementById('recovery-modal').style.display = 'flex';
            document.getElementById('modal-confirm-btn').addEventListener('click', () => {
                window.location.href = '/login';
            });
        } else {
            const errorMsg = await response.text();
            statusText.style.color = "red";
            statusText.innerText = "Erreur : " + errorMsg;
            submitBtn.disabled = false;
        }

    } catch (error) {
        console.error("Erreur cryptographique :", error);
        statusText.style.color = "red";
        statusText.innerText = "Une erreur est survenue lors de la génération des clés.";
        submitBtn.disabled = false;
    }
});