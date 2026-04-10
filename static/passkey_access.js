/** * BINARY HELPERS
 * WebAuthn requires raw bytes (Uint8Array), but JSON only supports strings.
 */
const bufferFromBase64 = (base64) => {
    const binary = window.atob(base64.replace(/-/g, '+').replace(/_/g, '/'));
    return Uint8Array.from(binary, c => c.charCodeAt(0));
};

const bufferToBase64 = (buffer) => {
    return btoa(String.fromCharCode(...new Uint8Array(buffer)))
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
};

/**
 * 1. PASSKEY REGISTRATION
 * Used when a user is already logged in and wants to link their device.
 */
async function initiatePasskeyRegistration() {
    try {
        const response = await fetch('/register-passkey-options', { method: 'POST' });
        const data = await response.json();

        if (!data.success) throw new Error(data.message || "Registration failed");

        const options = data.options;
        const currentHost = window.location.hostname;
        
        // Dynamic Domain Fix
        if (options.rp.id !== currentHost) {
            options.rp.id = currentHost; 
        }

        options.challenge = bufferFromBase64(options.challenge);
        options.user.id = bufferFromBase64(options.user.id);
        
        if (options.excludeCredentials) {
            options.excludeCredentials.forEach(c => c.id = bufferFromBase64(c.id));
        }

        const credential = await navigator.credentials.create({ publicKey: options });
        if (!credential) throw new Error("Hardware verification failed.");

        const credentialJSON = {
            id: credential.id,
            rawId: bufferToBase64(credential.rawId),
            type: credential.type,
            response: {
                attestationObject: bufferToBase64(credential.response.attestationObject),
                clientDataJSON: bufferToBase64(credential.response.clientDataJSON),
            }
        };

        const verifyRes = await fetch('/register-passkey-verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(credentialJSON)
        });

        const result = await verifyRes.json();
        if (result.success) {
            fintrack_cred_unique_id = getUniqueKey();
            localStorage.setItem(fintrack_cred_unique_id, credentialJSON.rawId);
            showNotify('Biometric Security Activated!', 'success');
            setTimeout(() => location.reload(), 1500);
        } else {
            throw new Error(result.message);
        }

    } catch (err) {
        console.error("Registration Error:", err);
        showNotify(err.name === 'SecurityError' ? 'Use localhost:5000' : err.message, 'error');
    }
}


function getUniqueKey() {
    const meta = document.getElementById('user-meta');
    const role = meta.dataset.role;
    const id = meta.dataset.id;
    return `fintrack_cred_id_${role}_${id}`;
}

/**
 * 2. PASSKEY LOGIN (Authenticate with Biometrics)
 */

async function removePasskey() {
    const confirm = await Swal.fire({
        title: 'Disable Biometrics?',
        text: "You will need your password for your next login. Continue?",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#4f46e5',
        confirmButtonText: 'Yes, Remove It',
        cancelButtonText: 'Cancel',
        customClass: { popup: 'rounded-[2rem]' }
    });

    if (confirm.isConfirmed) {
        try {
            const response = await fetch('/remove-passkey', { method: 'POST' });
            const data = await response.json();
            
            if (data.success) {
                fintrack_cred_unique_id = getUniqueKey();
                localStorage.removeItem( fintrack_cred_unique_id);
                showNotify(data.message, 'success');
                setTimeout(() => location.reload(), 1000);
            } else {
                showNotify(data.message, 'error');
            }
        } catch (err) {
            showNotify('Action failed', 'error');
        }
    }
}


function updatePasskeyButtonUI() {
    const storageKey = getUniqueKey();
    if (!storageKey) return;

    const removeBtn = document.getElementById('btn-passkey-remove');
    const registerBtn = document.getElementById('btn-passkey-register');

    if (!removeBtn || !registerBtn) return;

    // Check if THIS user has a key on THIS device
    const localKeyExists = localStorage.getItem(storageKey);

    if (localKeyExists) {
        removeBtn.style.display = 'flex';
        registerBtn.style.display = 'none';
    } else {
        let key_info=document.getElementById('key_info').innerText
        if(key_info=='Not Registered')
        {
            removeBtn.style.display = 'none';
            registerBtn.style.display = 'flex';
        }
    }
}

// Run on page load
document.addEventListener('DOMContentLoaded', updatePasskeyButtonUI);