let widgetId;
let trialCount = 0;

function toggleModal(id) {
    const modal = document.getElementById(id);
    if (!modal) return;
    modal.classList.toggle('hidden');
    document.body.style.overflow = modal.classList.contains('hidden') ? 'auto' : 'hidden';
}

function toggleMobileMenu() {
    const menu = document.getElementById('mobile-menu');
    const icon = document.getElementById('menu-icon');
    if (!menu || !icon) return;
    menu.classList.toggle('hidden');
    const isHidden = menu.classList.contains('hidden');
    icon.classList.replace(isHidden ? 'fa-times' : 'fa-bars', isHidden ? 'fa-bars' : 'fa-times');
}

function handleReveal() {
    const reveals = document.querySelectorAll(".reveal");
    const windowHeight = window.innerHeight;
    reveals.forEach(el => {
        const elementTop = el.getBoundingClientRect().top;
        if (elementTop < windowHeight - 100) el.classList.add("active");
    });
}

window.addEventListener('scroll', () => {
    const nav = document.getElementById('navbar');
    if (nav) {
        const scrolled = window.scrollY > 30;
        nav.classList.toggle('nav-scrolled', scrolled);
        nav.classList.toggle('bg-white/95', scrolled);
    }
    handleReveal();
});

window.addEventListener('click', (e) => {
    const modal = document.getElementById('login-modal');
    if (e.target === modal) toggleModal('login-modal');
});

window.addEventListener('load', handleReveal);

let currentTenure = 12;
const amountInput = document.getElementById('loan-amount');
const rateInput = document.getElementById('interest-rate');
const emiResult = document.getElementById('emi-result');

function calculateEMI() {
    if (!amountInput || !rateInput) return;
    const P = parseFloat(amountInput.value);
    const R = parseFloat(rateInput.value) / 12 / 100;
    const N = currentTenure;
    const emi = (P * R * Math.pow(1 + R, N)) / (Math.pow(1 + R, N) - 1);
    emiResult.innerText = Math.round(emi).toLocaleString('en-IN');
    document.getElementById('amount-display').innerText = P.toLocaleString('en-IN');
    document.getElementById('rate-display').innerText = rateInput.value;
}

function updateTenure(months, btn) {
    currentTenure = months;
    document.querySelectorAll('.tenure-btn').forEach(b => {
        b.classList.remove('border-blue-600', 'bg-blue-50', 'text-blue-600');
        b.classList.add('border-slate-100');
    });
    btn.classList.add('border-blue-600', 'bg-blue-50', 'text-blue-600');
    btn.classList.remove('border-slate-100');
    calculateEMI();
}

if (amountInput) amountInput.addEventListener('input', calculateEMI);
if (rateInput) rateInput.addEventListener('input', calculateEMI);
calculateEMI();

function showNotify(message, type = 'success') {
    const container = document.getElementById('notification-container');
    const notification = document.createElement('div');
    const isSuccess = type === 'success';
    notification.className = `animate__animated animate__fadeInRight animate__faster flex items-center space-x-4 p-5 rounded-[1.5rem] shadow-2xl shadow-slate-200 bg-white/80 backdrop-blur-xl border border-white min-w-[320px] pointer-events-auto`;
    notification.innerHTML = `
        <div class="w-10 h-10 rounded-xl ${isSuccess ? 'bg-emerald-500' : 'bg-red-500'} text-white flex items-center justify-center shadow-lg">
            <i class="fas ${isSuccess ? 'fa-check-circle' : 'fa-exclamation-triangle'}"></i>
        </div>
        <div class="flex-1">
            <p class="text-xs font-bold text-slate-800">${message}</p>
        </div>`;
    container.appendChild(notification);
    setTimeout(() => {
        notification.classList.replace('animate__fadeInRight', 'animate__fadeOutRight');
        setTimeout(() => notification.remove(), 400);
    }, 3000);
}

function handleRoleChange() {
    const selectedRadio = document.querySelector('input[name="role"]:checked');
    document.getElementById('role').value = selectedRadio ? selectedRadio.value : 'user';
    
    const role = selectedRadio.value;
    const passkeyInfo = document.getElementById('passkey_info');
    
    
    if (role == 'user') {
        passkeyInfo.innerText="Sign in with Customer Passkey"
    }else if(role == 'admin') {
        passkeyInfo.innerText="Sign in with Admin Passkey"
    }else{
        passkeyInfo.innerText="Sign in with Staff Passkey"
    }
}

async function login() {
  
    const role = document.getElementById('role').value;
    const email = document.getElementById('roleEmail').value.trim();
    const password = document.getElementById('password').value;
    
    toggleModal('login-modal');

    try {
        const response = await fetch('/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, role })
        });

      
        const data = await response.json();

        if (data.success) {
            showNotify('Login Successful', 'success');
            
            // Redirect after 2 seconds
            setTimeout(() => { 
                window.location.href = data.url; 
            }, 2000);
        } else {
            showNotify(data.message || 'Invalid credentials', 'error');
        }

    } catch (error) {
       
        showNotify('Server connection failed', 'error');
        console.error('Login Error:', error);
    }
};


const Loader = (function() {
    let overlay, text;
    function init() {
        overlay = document.getElementById('global-loader');
        text = document.getElementById('loader-text');
    }
    return {
        show: function(msg = "Processing") {
            if (!overlay) init(); 
            if (overlay && text) {
                text.textContent = msg;
                overlay.classList.remove('hidden');
                overlay.classList.add('flex');
                document.body.style.overflow = 'hidden';
                document.body.style.userSelect = 'none';
            }
        },
        hide: function() {
            if (overlay) {
                overlay.classList.add('hidden');
                overlay.classList.remove('flex');
                document.body.style.overflow = '';
                document.body.style.userSelect = 'auto';
            }
        }
    };
})();


function openVerificationGate() {
    const modal = document.getElementById('verification-modal');
    if (!modal) return;

    modal.classList.remove('hidden');
    modal.style.display = 'flex';
    
    const card = modal.querySelector('.animate__animated');
    if (card) {
        card.classList.remove('animate__fadeOutDown');
        card.classList.add('animate__zoomIn');
    }

    document.getElementById('turnstile-step').classList.remove('hidden');
    document.getElementById('status-box').classList.add('hidden');
    document.getElementById('slider-step').classList.add('hidden');
    document.getElementById('auth-status-text').innerText = "Identity Challenge";

    if (typeof turnstile !== 'undefined') {
        if (!widgetId) {
            widgetId = turnstile.render('#turnstile-container', {
                sitekey: '', // Your Cloudflare Turnstile Site Key
                theme: 'light',
                callback: function(token) {
                    verifyWithBackend(token);
                }
            });
        } else {
            turnstile.reset(widgetId);
        }
    }
}

async function verifyWithBackend(token) {
    const statusBox = document.getElementById('status-box');
    const statusText = document.getElementById('status-text');
    const turnstileStep = document.getElementById('turnstile-step');
    const spinner = document.getElementById('spinner');

    turnstileStep.classList.add('hidden');
    statusBox.classList.remove('hidden');
    if (spinner) spinner.classList.remove('hidden');
    statusText.innerText = "Verifying...";
    statusText.className = "text-[9px] font-black uppercase tracking-widest text-slate-500";

    try {
        const formData = new FormData();
        formData.append('cf-turnstile-response', token);

        const response = await fetch('/verify-user', {
            method: 'POST',
            body: formData
        });

        const result = await response.json();

        if (result.status === 'success') {
            statusBox.classList.add('hidden');
            document.getElementById('slider-step').classList.remove('hidden');
            document.getElementById('auth-status-text').innerText = "Identity Confirmed";
            initGoldSlider();
        } else {
            throw new Error(result.msg || "Verification Failed");
        }

    } catch (error) {
        if (spinner) spinner.classList.add('hidden');
        statusText.innerText = "❌ " + error.message;
        statusText.classList.replace('text-slate-500', 'text-red-600');
        
       setTimeout(() => {
            if(trialCount < 2) { // 0, 1, 2 = 3 total attempts
                trialCount++; 
                statusBox.classList.add('hidden');
                turnstileStep.classList.remove('hidden');
                if (widgetId) turnstile.reset(widgetId);
            } else {
                if (widgetId) turnstile.reset(widgetId);
               
                const card = document.querySelector('#verification-modal .animate__animated');
                card.classList.add('animate__headShake');
                trialCount = 0;
                setTimeout(() => {
                    closeVerificationGate();
                }, 500);
            }
        }, 1200);
    }
}

function closeVerificationGate() {
    const modal = document.getElementById('verification-modal');
    const card = modal.querySelector('.animate__animated');
    
    if (card) {
        card.classList.replace('animate__zoomIn', 'animate__fadeOutDown');
    }

    setTimeout(() => {
        modal.classList.add('hidden');
        modal.style.display = 'none';
        if (widgetId) turnstile.reset(widgetId);
    }, 200);
}

function initGoldSlider() {
    const handle = document.getElementById('slider-handle');
    const track = document.getElementById('slider-track');
    const fill = document.getElementById('slider-fill');
    
    let isDragging = false;
    let startX = 0;
    
    // Calculate center and boundaries
    const trackWidth = track.offsetWidth;
    const handleWidth = handle.offsetWidth;
    const centerX = (trackWidth / 2) - (handleWidth / 2);
    const maxSlide = trackWidth - handleWidth - 10;
    const minSlide = 10;

    // Set Initial Position (Center)
    handle.style.left = centerX + 'px';
    handle.style.transform = 'none';
    fill.style.width = '0px';

    const onStart = (e) => {
        isDragging = true;
        startX = (e.type.includes('mouse') ? e.pageX : e.touches[0].pageX) - handle.offsetLeft;
        handle.style.transition = 'none';
    };

    const onMove = (e) => {
        if (!isDragging) return;
        let x = (e.type.includes('mouse') ? e.pageX : e.touches[0].pageX) - startX;
        
        // Constrain movement
        x = Math.max(minSlide, Math.min(x, maxSlide));
        handle.style.left = x + 'px';

        // Fill logic (only green when sliding right towards Login)
        if (x > centerX) {
            const fillWidth = x - centerX + (handleWidth / 2);
            fill.style.width = fillWidth + 'px';
        } else {
            fill.style.width = '0px';
        }

        // Trigger Login if reached far right
        if (x >= maxSlide - 5) {
            isDragging = false;
            successRedirect();
        }
        
        // Trigger Back/Close if reached far left
        if (x <= minSlide + 5) {
            isDragging = false;
            closeVerificationGate();
        }
    };

    const onEnd = () => {
        if (!isDragging) return;
        isDragging = false;
        // Snap back to center
        handle.style.transition = 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
        fill.style.transition = 'all 0.4s ease';
        handle.style.left = centerX + 'px';
        fill.style.width = '0px';
    };

    function successRedirect() {
        handle.style.left = maxSlide + 'px';
        fill.style.width = '100%';
        handle.innerHTML = `<i class="fas fa-check"></i>`;
        
        setTimeout(() => {
            closeVerificationGate();
            login();
        }, 300);
    }

    handle.onmousedown = onStart;
    handle.ontouchstart = onStart;
    window.onmousemove = onMove;
    window.ontouchmove = onMove;
    window.onmouseup = onEnd;
    window.ontouchend = onEnd;
}


document.addEventListener('DOMContentLoaded', () => {
    const emailInput = document.getElementById('roleEmail');
    const passInput = document.getElementById('password');
    const verifyBtn = document.getElementById('verify-btn');

    const validateForm = () => {
        const isEmailFilled = emailInput.value.trim() !== "";
        const isPassFilled = passInput.value.trim() !== "";

        if (isEmailFilled && isPassFilled) {
            // UNLOCK: Remove disabled state and restore styling
            verifyBtn.disabled = false;
            verifyBtn.classList.remove('opacity-50', 'pointer-events-none');
            verifyBtn.classList.add('hover:bg-blue-600', 'hover:text-white');
        } else {
            // LOCK: Re-apply disabled state and styling
            verifyBtn.disabled = true;
            verifyBtn.classList.add('opacity-50', 'pointer-events-none');
            verifyBtn.classList.remove('hover:bg-blue-600', 'hover:text-white');
        }
    };

    // Listen for typing in both fields
    emailInput.addEventListener('input', validateForm);
    passInput.addEventListener('input', validateForm);
});


function openForgotModal() {
    toggleModal('login-modal'); 
    setTimeout(() => {
        const modal = document.getElementById('forgot-modal');
        modal.classList.remove('hidden');
        modal.style.display = 'flex';
    }, 300);
}


function openForgotModal() {
    toggleModal('login-modal'); 
    setTimeout(() => {
        const modal = document.getElementById('forgot-modal');
        modal.classList.remove('hidden');
        modal.style.display = 'flex';
    }, 300);
}



function closeForgotModal(){
    const modal = document.getElementById('forgot-modal');
    modal.classList.add('hidden');
    modal.style.display = 'none';
}

async function handleResetRequest() {
    const email = document.getElementById('resetEmail').value.trim();
    const role = document.getElementById('resetRole').value;

    closeForgotModal();

    if (!email) {

        return showNotify('Please enter your email address', 'error');
    }

    try {

        const response = await fetch('/account-password-recovery', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, role })
        });

        const data = await response.json();
        

        if (data.success) {
            showNotify(data.message, 'success');
           
            document.getElementById('resetEmail').value = '';
        } else {
            showNotify(data.message || 'Account not found', 'error');
        }

    } catch (error) {
        showNotify('Server error. Please try again later.', 'error');
        console.error('Recovery Error:', error);
    }
    
}



const bufferFromBase64 = (base64) => {
    const binary = window.atob(base64.replace(/-/g, '+').replace(/_/g, '/'));
    return Uint8Array.from(binary, c => c.charCodeAt(0));
};

const bufferToBase64 = (buffer) => {
    return btoa(String.fromCharCode(...new Uint8Array(buffer)))
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
};




async function initiatePasskeyLogin() {
    try {
        // 1. Identify the selected role from the radio buttons
        const roleRadio = document.querySelector('input[name="role"]:checked');
        if (!roleRadio) {
            showNotify("Please select your role first.", "warning");
            return;
        }
        const selectedRole = roleRadio.value; // 'admin', 'staff', or 'user'

        // 2. Get Authentication Options (Pass the role to the server)
        const response = await fetch('/login-passkey-options', { 
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ role: selectedRole }) 
        });
        const data = await response.json();

        if (!data.success) throw new Error(data.message);

        const options = data.options;
        options.challenge = bufferFromBase64(options.challenge);

        // Convert allowed credentials to bytes
        if (options.allowCredentials) {
            options.allowCredentials.forEach(c => c.id = bufferFromBase64(c.id));
        }

        // 3. Trigger Hardware Signature Request
        const assertion = await navigator.credentials.get({ publicKey: options });

        if (!assertion) throw new Error("Biometric check failed.");

        // 4. Encode Response & include the role for backend routing
        const assertionJSON = {
            id: assertion.id,
            rawId: bufferToBase64(assertion.rawId),
            type: assertion.type,
            role: selectedRole, // <--- Tells backend which of the 3 tables to search
            response: {
                authenticatorData: bufferToBase64(assertion.response.authenticatorData),
                clientDataJSON: bufferToBase64(assertion.response.clientDataJSON),
                signature: bufferToBase64(assertion.response.signature),
                userHandle: assertion.response.userHandle ? bufferToBase64(assertion.response.userHandle) : null,
            }
        };

        // 5. Verify Signature with Server
        const verifyRes = await fetch('/login-passkey-verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(assertionJSON)
        });

        const result = await verifyRes.json();
        
        if (result.success) {
            showNotify('Login Successful!', 'success');
            // Backend handles the logic of where to send them (Admin, Staff, or User Dashboard)
            window.location.href = result.url;
        } else {
            showNotify(result.message, 'error');
        }

    } catch (err) {
        console.error("Passkey Login Error:", err);
        
        if (err.name !== 'NotAllowedError' && err.name !== 'AbortError') {
            showNotify('Passkey Login failed: ' + err.message, 'error');
        }
    }

    // Always close the modal after the process
    toggleModal('login-modal');
}
