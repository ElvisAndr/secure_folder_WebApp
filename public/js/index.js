// Conversion Base64 <-> ArrayBuffer
function base64ToArrayBuffer(base64) {
    const binaryString = window.atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
}

function arrayBufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
}

// Déconnexion sécurisée
async function secureLogout() {
    await deletePrivateKey(); // Fonction de cryptoDB.js
    window.location.href = '/logout';
}

// Gestion du panneau de partage
function openSharePanel(button) {
    const fileId = button.getAttribute('data-id');
    const fileName = button.getAttribute('data-name');
    const encryptedAesKey = button.getAttribute('data-key');

    document.getElementById('share-file-id').value = fileId;
    document.getElementById('share-filename').innerText = fileName;
    document.getElementById('share-encrypted-aes').value = encryptedAesKey;
    document.getElementById('share-panel').classList.add('open');
    document.getElementById('share-status').innerText = "";
}

function closeSharePanel() {
    document.getElementById('share-panel').classList.remove('open');
}

// Mise à jour visuelle de l'input file
document.getElementById('file-input').addEventListener('change', function (e) {
    const fileNameDisplay = document.getElementById('file-name-display');
    const dropzone = document.getElementById('file-dropzone');

    if (this.files && this.files.length > 0) {
        fileNameDisplay.innerText = "📄 " + this.files[0].name;
        dropzone.classList.add('has-file');
    } else {
        fileNameDisplay.innerText = "Cliquez pour sélectionner un fichier";
        dropzone.classList.remove('has-file');
    }
});

// Téléversement sécurisé
document.getElementById('upload-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fileInput = document.getElementById('file-input');
    const statusText = document.getElementById('upload-status');
    const uploadBtn = document.getElementById('upload-btn');

    if (fileInput.files.length === 0) return;
    const file = fileInput.files[0];

    try {
        uploadBtn.disabled = true;
        statusText.innerText = "1. Chiffrement en cours...";
        const fileBuffer = await file.arrayBuffer();

        const fileAesKey = await crypto.subtle.generateKey(
            { name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]
        );
        const iv = crypto.getRandomValues(new Uint8Array(12));

        const encryptedFileBuffer = await crypto.subtle.encrypt(
            { name: "AES-GCM", iv: iv }, fileAesKey, fileBuffer
        );

        const publicKeyBuffer = base64ToArrayBuffer(window.MA_CLE_PUBLIQUE);
        const rsaPublicKey = await crypto.subtle.importKey(
            "spki", publicKeyBuffer, { name: "RSA-OAEP", hash: "SHA-256" }, false, ["encrypt"]
        );

        const exportedAesKey = await crypto.subtle.exportKey("raw", fileAesKey);
        const encryptedAesKeyBuffer = await crypto.subtle.encrypt(
            { name: "RSA-OAEP" }, rsaPublicKey, exportedAesKey
        );

        statusText.innerText = "2. Envoi au serveur...";
        const formData = new FormData();
        formData.append('file', new Blob([encryptedFileBuffer]), file.name);
        formData.append('originalName', file.name);
        formData.append('encryptedAesKey', arrayBufferToBase64(encryptedAesKeyBuffer));
        formData.append('iv', arrayBufferToBase64(iv));

        const response = await fetch('/upload', { method: 'POST', body: formData });
        if (response.ok) {
            statusText.style.color = "green"; statusText.innerText = "Succès !";
            setTimeout(() => window.location.reload(), 1500);
        } else throw new Error("Erreur serveur.");

    } catch (error) {
        statusText.style.color = "red"; statusText.innerText = "Erreur : " + error.message;
        uploadBtn.disabled = false;
    }
});

// Téléchargement et déchiffrement local
async function downloadFile(downloadUrl) {
    try {
        const privateKey = await getPrivateKey();
        if (!privateKey) throw new Error("Clé privée introuvable. Veuillez vous reconnecter.");

        const response = await fetch(downloadUrl);

        if (!response.ok) throw new Error("Fichier introuvable sur le serveur.");

        const encryptedAesKeyBase64 = response.headers.get('x-encrypted-aes-key');
        const ivBase64 = response.headers.get('x-iv');
        const originalName = decodeURIComponent(response.headers.get('x-original-name') || "fichier_dechiffre");

        const encryptedFileBuffer = await response.arrayBuffer();

        const encryptedAesKeyBuffer = base64ToArrayBuffer(encryptedAesKeyBase64);
        const exportedAesKey = await crypto.subtle.decrypt(
            { name: "RSA-OAEP" }, privateKey, encryptedAesKeyBuffer
        );

        const ivBuffer = base64ToArrayBuffer(ivBase64);
        const aesKey = await crypto.subtle.importKey(
            "raw", exportedAesKey, { name: "AES-GCM" }, false, ["decrypt"]
        );

        const decryptedFileBuffer = await crypto.subtle.decrypt(
            { name: "AES-GCM", iv: ivBuffer }, aesKey, encryptedFileBuffer
        );

        const blob = new Blob([decryptedFileBuffer]);
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = originalName;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        a.remove();

    } catch (error) {
        console.error(error);
        alert("Erreur de déchiffrement : " + error.message);
    }
}

// Partage sécurisé
document.getElementById('share-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fileId = document.getElementById('share-file-id').value;
    const recipientUsername = document.getElementById('share-recipient').value;
    const encryptedAesKeyBase64 = document.getElementById('share-encrypted-aes').value;
    const statusText = document.getElementById('share-status');
    const submitBtn = e.target.querySelector('button');

    try {
        submitBtn.disabled = true;
        statusText.style.color = "blue";

        statusText.innerText = "1. Recherche de la clé publique de " + recipientUsername + "...";
        const resUser = await fetch(`/api/user/${recipientUsername}/public-key`);
        if (!resUser.ok) throw new Error("Utilisateur introuvable.");
        
        const recipientData = await resUser.json();
        const recipientPublicKeyBase64 = recipientData.publicKey;
        const recipientId = recipientData.id;

        statusText.innerText = "2. Déverrouillage local de la clé du fichier...";
        const privateKey = await getPrivateKey();
        const encryptedAesKeyBuffer = base64ToArrayBuffer(encryptedAesKeyBase64);

        const rawAesKeyBuffer = await crypto.subtle.decrypt(
            { name: "RSA-OAEP" }, privateKey, encryptedAesKeyBuffer
        );

        statusText.innerText = "3. Verrouillage pour " + recipientUsername + "...";
        const recipientPublicKeyBuffer = base64ToArrayBuffer(recipientPublicKeyBase64);
        const rsaPublicKeyBob = await crypto.subtle.importKey(
            "spki", recipientPublicKeyBuffer, { name: "RSA-OAEP", hash: "SHA-256" }, false, ["encrypt"]
        );

        const newlyEncryptedAesKeyBuffer = await crypto.subtle.encrypt(
            { name: "RSA-OAEP" }, rsaPublicKeyBob, rawAesKeyBuffer
        );

        statusText.innerText = "4. Envoi au serveur...";
        const payload = {
            fileId: fileId,
            recipientId: recipientId,
            sharedEncryptedAesKey: arrayBufferToBase64(newlyEncryptedAesKeyBuffer)
        };

        const resShare = await fetch('/share', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!resShare.ok) throw new Error("Erreur serveur lors du partage.");

        statusText.style.color = "green";
        statusText.innerText = "Succès ! Le fichier est partagé.";
        setTimeout(() => closeSharePanel(), 2000);

    } catch (error) {
        console.error(error);
        statusText.style.color = "red";
        statusText.innerText = "Erreur : " + error.message;
    } finally {
        submitBtn.disabled = false;
    }
});

// Fonction de suppression de fichier liée directement au bouton
async function confirmDeleteFile(fileId, fileName) {
    const confirmation = confirm(`Êtes-vous sûr de vouloir supprimer DÉFINITIVEMENT le fichier "${fileName}" ?\n\nCette opération est irréversible et le fichier sera effacé du serveur.`);
    
    if (!confirmation) return;

    try {
        const response = await fetch(`/api/files/${fileId}`, {
            method: 'DELETE',
        });

        if (response.ok) {
            alert("Fichier supprimé avec succès.");
            window.location.reload(); 
        } else {
            const errorText = await response.text();
            throw new Error(errorText || "Erreur lors de la suppression sur le serveur.");
        }

    } catch (error) {
        console.error("Erreur de suppression :", error);
        alert(`Impossible de supprimer le fichier : ${error.message}`);
    }
}