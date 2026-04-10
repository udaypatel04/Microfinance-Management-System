document.getElementById('login-form').onsubmit = async function(e) {
    e.preventDefault();

    const submitBtn = e.target.querySelector('button[type="submit"]');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const roleInput = document.getElementsByName('role')[0];

    const email = emailInput.value.trim();
    const password = passwordInput.value.trim();
    const role = roleInput ? roleInput.value : 'admin';

    if (!email || !password) {
        showNotify('Please enter both email and password', 'error');
        return;
    }

    submitBtn.disabled = true;

    try {
        const response = await fetch('/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, role })
        });

        const data = await response.json();

        if (data.success) {
            showNotify('Access Granted. Redirecting to Portal...', 'success');
            setTimeout(() => {
                window.location.href = data.url;
            }, 1500);
        } else {
            throw new Error(data.message || 'Invalid administrative credentials');
        }
    } catch (error) {
        console.error('Login Error:', error);
        showNotify(error.message, 'error');
        submitBtn.disabled = false;
    }
};

function showNotify(message, type = 'success') {
    const container = document.getElementById('notification-container');
    if (!container) return;

    const notification = document.createElement('div');
    const isSuccess = type === 'success';
    const bgColor = isSuccess ? 'bg-emerald-500' : 'bg-red-500';
    const icon = isSuccess ? 'fa-check-circle' : 'fa-exclamation-triangle';

    notification.className = `
        animate__animated animate__fadeInRight animate__faster
        flex items-center space-x-4 p-5 rounded-[1.5rem] shadow-2xl shadow-slate-200 
        bg-white/80 backdrop-blur-xl border border-white min-w-[320px] pointer-events-auto
    `;

    notification.innerHTML = `
        <div class="w-10 h-10 rounded-xl ${bgColor} text-white flex items-center justify-center shadow-lg">
            <i class="fas ${icon}"></i>
        </div>
        <div class="flex-1">
            <p class="text-xs font-bold text-slate-800">${message}</p>
        </div>
    `;

    container.appendChild(notification);

    setTimeout(() => {
        notification.classList.replace('animate__fadeInRight', 'animate__fadeOutRight');
        setTimeout(() => notification.remove(), 500);
    }, 4000);
}