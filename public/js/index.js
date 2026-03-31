// Convertit une chaîne Base64 en ArrayBuffer pour les opérations de chiffrement.
function base64ToArrayBuffer(base64) {
    const binaryString = window.atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
    return bytes.buffer;
}

// Convertit un ArrayBuffer en chaîne Base64 pour l'envoi au serveur.
function arrayBufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
    return window.btoa(binary);
}

// Déchiffre la clé AES chiffrée avec la clé RSA privée de l'utilisateur.
async function getRawAesKeyBuffer(encryptedAesKeyBase64, privateKey) {
    return await crypto.subtle.decrypt(
        { name: "RSA-OAEP" }, privateKey, base64ToArrayBuffer(encryptedAesKeyBase64)
    );
}

// Déchiffre le nom du fichier chiffré en AES-GCM et retourne le nom clair.
async function decryptFileName(encryptedNameString, aesKey) {
    if (!encryptedNameString || !encryptedNameString.includes(':')) return "Fichier inconnu";
    const [ivBase64, encBase64] = encryptedNameString.split(':');
    const decryptedBuffer = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: base64ToArrayBuffer(ivBase64) },
        aesKey,
        base64ToArrayBuffer(encBase64)
    );
    return new TextDecoder().decode(decryptedBuffer);
}

// Lors du chargement de la page, déchiffre et affiche chaque nom de fichier chiffré.
document.addEventListener('DOMContentLoaded', async () => {
    const nameElements = document.querySelectorAll('.encrypted-filename');
    if (nameElements.length === 0) return;

    const privateKey = await getPrivateKey();
    if (!privateKey) return;

    for (const el of nameElements) {
        try {
            const encryptedNameString = el.getAttribute('data-enc-name');
            const encryptedAesKeyBase64 = el.getAttribute('data-enc-key');

            const rawAesKeyBuffer = await getRawAesKeyBuffer(encryptedAesKeyBase64, privateKey);
            const aesKey = await crypto.subtle.importKey("raw", rawAesKeyBuffer, { name: "AES-GCM" }, false, ["decrypt"]);
            
            const finalName = await decryptFileName(encryptedNameString, aesKey);
            el.innerText = finalName;

            const parentDiv = el.closest('.file-item');
            const shareBtn = parentDiv.querySelector('.share-btn');
            const deleteBtn = parentDiv.querySelector('button[title="Supprimer définitivement ce fichier"]');
            
            if (shareBtn) shareBtn.setAttribute('data-name', finalName);
            if (deleteBtn && shareBtn) {
                const fileId = shareBtn.getAttribute('data-id');
                deleteBtn.setAttribute('onclick', `confirmDeleteFile('${fileId}', '${finalName.replace(/'/g, "\\'")}')`);
            }
        } catch (err) {
            el.innerText = "Erreur de déchiffrement";
            el.style.color = "red";
        }
    }
});

// Déconnecte proprement l'utilisateur en supprimant la clé privée locale.
async function secureLogout() {
    await deletePrivateKey();
    window.location.href = '/logout';
}

// Ouvre le panneau de partage et préremplit les champs avec les métadonnées du fichier.
function openSharePanel(button) {
    document.getElementById('share-file-id').value = button.getAttribute('data-id');
    document.getElementById('share-filename').innerText = button.getAttribute('data-name');
    document.getElementById('share-encrypted-aes').value = button.getAttribute('data-key');
    document.getElementById('share-panel').classList.add('open');
    document.getElementById('share-status').innerText = "";
}

function closeSharePanel() {
    document.getElementById('share-panel').classList.remove('open');
}

// Met à jour l'UI lorsque l'utilisateur sélectionne un fichier dans le champ input.
document.getElementById('file-input').addEventListener('change', function () {
    const fileNameDisplay = document.getElementById('file-name-display');
    const dropzone = document.getElementById('file-dropzone');

    if (this.files && this.files.length > 0) {
        fileNameDisplay.innerText = "📄 " + this.files.name;
        dropzone.classList.add('has-file');
    } else {
        fileNameDisplay.innerText = "Cliquez pour sélectionner un fichier";
        dropzone.classList.remove('has-file');
    }
});

// Chiffre le fichier localement, prépare les métadonnées chiffrées et envoie le tout au serveur.
document.getElementById('upload-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fileInput = document.getElementById('file-input');
    const statusText = document.getElementById('upload-status');
    const uploadBtn = document.getElementById('upload-btn');

    if (fileInput.files.length === 0) return;
    const file = fileInput.files;

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

        const fileNameBuffer = new TextEncoder().encode(file.name);
        const fileNameIv = crypto.getRandomValues(new Uint8Array(12));
        const encryptedFileNameBuffer = await crypto.subtle.encrypt(
            { name: "AES-GCM", iv: fileNameIv }, fileAesKey, fileNameBuffer
        );

        const rsaPublicKey = await crypto.subtle.importKey(
            "spki", base64ToArrayBuffer(window.MA_CLE_PUBLIQUE), { name: "RSA-OAEP", hash: "SHA-256" }, false, ["encrypt"]
        );

        const exportedAesKey = await crypto.subtle.exportKey("raw", fileAesKey);
        const encryptedAesKeyBuffer = await crypto.subtle.encrypt(
            { name: "RSA-OAEP" }, rsaPublicKey, exportedAesKey
        );

        statusText.innerText = "2. Envoi au serveur...";
        const formData = new FormData();
        formData.append('file', new Blob([encryptedFileBuffer]), "fichier.enc"); 
        formData.append('encryptedFileName', arrayBufferToBase64(encryptedFileNameBuffer));
        formData.append('fileNameIv', arrayBufferToBase64(fileNameIv));
        formData.append('encryptedAesKey', arrayBufferToBase64(encryptedAesKeyBuffer));
        formData.append('iv', arrayBufferToBase64(iv));

        const response = await fetch('/upload', { method: 'POST', body: formData });
        if (response.ok) {
            statusText.style.color = "green"; 
            statusText.innerText = "Succès !";
            setTimeout(() => window.location.reload(), 1500);
        } else throw new Error("Erreur serveur.");

    } catch (error) {
        statusText.style.color = "red"; 
        statusText.innerText = "Erreur : " + error.message;
        uploadBtn.disabled = false;
    }
});

// Télécharge le fichier chiffré, le déchiffre localement puis déclenche l'enregistrement côté client.
async function downloadFile(downloadUrl) {
    try {
        const privateKey = await getPrivateKey();
        if (!privateKey) throw new Error("Clé privée introuvable. Veuillez vous reconnecter.");

        const response = await fetch(downloadUrl);
        if (!response.ok) throw new Error("Fichier introuvable sur le serveur.");

        const encryptedAesKeyBase64 = response.headers.get('x-encrypted-aes-key');
        const ivBase64 = response.headers.get('x-iv');
        const encryptedNameString = response.headers.get('x-encrypted-name');
        const encryptedFileBuffer = await response.arrayBuffer();

        const rawAesKeyBuffer = await getRawAesKeyBuffer(encryptedAesKeyBase64, privateKey);
        const aesKey = await crypto.subtle.importKey(
            "raw", rawAesKeyBuffer, { name: "AES-GCM" }, false, ["decrypt"]
        );

        const decryptedFileBuffer = await crypto.subtle.decrypt(
            { name: "AES-GCM", iv: base64ToArrayBuffer(ivBase64) }, aesKey, encryptedFileBuffer
        );

        const finalFileName = await decryptFileName(encryptedNameString, aesKey);

        const blob = new Blob([decryptedFileBuffer]);
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = finalFileName; 
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        a.remove();

    } catch (error) {
        console.error(error);
        alert("Erreur de déchiffrement : " + error.message);
    }
}

// Partage la clé AES chiffrée du fichier avec un autre utilisateur via sa clé publique.
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
        statusText.innerText = "Recherche de l'utilisateur...";

        const resUser = await fetch(`/api/user/${recipientUsername}/public-key`);
        if (!resUser.ok) throw new Error("Utilisateur introuvable.");
        
        const recipientData = await resUser.json();
        
        statusText.innerText = "Sécurisation pour le destinataire...";
        const privateKey = await getPrivateKey();
        const rawAesKeyBuffer = await getRawAesKeyBuffer(encryptedAesKeyBase64, privateKey);

        const rsaPublicKeyBob = await crypto.subtle.importKey(
            "spki", base64ToArrayBuffer(recipientData.publicKey), { name: "RSA-OAEP", hash: "SHA-256" }, false, ["encrypt"]
        );

        const newlyEncryptedAesKeyBuffer = await crypto.subtle.encrypt(
            { name: "RSA-OAEP" }, rsaPublicKeyBob, rawAesKeyBuffer
        );

        statusText.innerText = "Envoi...";
        const payload = {
            fileId: fileId,
            recipientId: recipientData.id,
            sharedEncryptedAesKey: arrayBufferToBase64(newlyEncryptedAesKeyBuffer)
        };

        const resShare = await fetch('/share', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!resShare.ok) throw new Error("Erreur serveur lors du partage.");

        statusText.style.color = "green";
        statusText.innerText = "Fichier partagé avec succès.";
        setTimeout(() => closeSharePanel(), 2000);

    } catch (error) {
        console.error(error);
        statusText.style.color = "red";
        statusText.innerText = "Erreur : " + error.message;
    } finally {
        submitBtn.disabled = false;
    }
});

// Demande confirmation et supprime définitivement le fichier sur le serveur.
async function confirmDeleteFile(fileId, fileName) {
    if (!confirm(`Supprimer définitivement "${fileName}" ?`)) return;

    try {
        const response = await fetch(`/api/files/${fileId}`, { method: 'DELETE' });
        if (response.ok) {
            window.location.reload(); 
        } else {
            throw new Error(await response.text());
        }
    } catch (error) {
        console.error(error);
        alert(`Erreur : ${error.message}`);
    }
}

// Demande confirmation et supprime le compte utilisateur ainsi que toutes ses données.
async function confirmDeleteAccount() {
    if (!confirm("ATTENTION : Cette action supprimera tous vos fichiers.\nContinuer ?")) return;
    if (prompt("Tapez SUPPRIMER pour confirmer") !== "SUPPRIMER") return;

    try {
        if (typeof deletePrivateKey === 'function') await deletePrivateKey(); 

        const response = await fetch('/api/user/delete', { method: 'DELETE' });
        if (response.ok) {
            alert("Compte supprimé.");
            window.location.href = '/register';
        } else {
            throw new Error(await response.text());
        }
    } catch (error) {
        console.error(error);
        alert(`Erreur : ${error.message}`);
    }
}