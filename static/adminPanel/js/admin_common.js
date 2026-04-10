function setToggleCookie(x, y) {
    const d = new Date();
    d.setTime(d.getTime() + (7 * 24 * 60 * 60 * 1000));
    const value = JSON.stringify({ x, y });
    document.cookie = `fintrack_toggle_pos=${value}; expires=${d.toUTCString()}; path=/; SameSite=Lax`;
}

function getToggleCookie() {
    const name = "fintrack_toggle_pos=";
    const ca = decodeURIComponent(document.cookie).split(';');
    for (let i = 0; i < ca.length; i++) {
        let c = ca[i].trim();
        if (c.indexOf(name) === 0) return JSON.parse(c.substring(name.length, c.length));
    }
    return null;
}

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    if (window.innerWidth <= 1024) {
        sidebar.classList.toggle('open');
        sidebar.classList.toggle('-translate-x-full'); 
        const isOpen = sidebar.classList.contains('open');
        overlay.classList.toggle('hidden', !isOpen);
        overlay.classList.toggle('show', isOpen);
        document.body.style.overflow = isOpen ? 'hidden' : 'auto';
    } else {
        sidebar.classList.toggle('mini');
        if (sidebar.classList.contains('mini')) closeAllDropdowns();
    }
}

function toggleDropdown(id) {
    const menu = document.getElementById(id);
    const icon = document.getElementById(id.replace('-menu', '-icon'));
    const isOpening = !menu.classList.contains('show');
    closeAllDropdowns();
    if (isOpening) {
        menu.style.display = 'block';
        setTimeout(() => {
            menu.classList.add('show');
            if (icon) icon.classList.add('rotate-180');
        }, 10);
    }
}

function closeAllDropdowns() {
    document.querySelectorAll('.submenu-container').forEach(menu => {
        menu.classList.remove('show');
        setTimeout(() => { if (!menu.classList.contains('show')) menu.style.display = 'none'; }, 500);
    });
    document.querySelectorAll('.chevron-rotate').forEach(icon => icon.classList.remove('rotate-180'));
}


document.addEventListener('DOMContentLoaded', () => {
    const dragContainer = document.getElementById("floating-toggle");
    const dragHandle = document.getElementById("drag-handle") || dragContainer;
    
    if (!dragContainer) return;

    let isDragging = false;
    let xOffset = 24; 
    let yOffset = 24; 
    let initialX, initialY, startX, startY;

   
    const savedPos = (typeof getToggleCookie === 'function') ? getToggleCookie() : null;
    if (savedPos) {
        xOffset = savedPos.x;
        yOffset = savedPos.y;
        dragContainer.style.transform = `translate3d(${xOffset - 24}px, ${yOffset - 24}px, 0)`;
    }

  
    function dragStart(e) {
        const clientX = e.type === "touchstart" ? e.touches[0].clientX : e.clientX;
        const clientY = e.type === "touchstart" ? e.touches[0].clientY : e.clientY;

        startX = clientX;
        startY = clientY;
        initialX = clientX - xOffset;
        initialY = clientY - yOffset;

        if (e.target === dragHandle || dragHandle.contains(e.target)) {
            isDragging = true;
            dragContainer.style.transition = 'none';
        }
    }

    function drag(e) {
        if (!isDragging) return;
        if (e.cancelable) e.preventDefault();

        const clientX = e.type === "touchmove" ? e.touches[0].clientX : e.clientX;
        const clientY = e.type === "touchmove" ? e.touches[0].clientY : e.clientY;

        let currentX = clientX - initialX;
        let currentY = clientY - initialY;

        const bounds = dragContainer.getBoundingClientRect();
        xOffset = Math.max(0, Math.min(currentX, window.innerWidth - bounds.width));
        yOffset = Math.max(0, Math.min(currentY, window.innerHeight - bounds.height));

        requestAnimationFrame(() => {
            dragContainer.style.transform = `translate3d(${xOffset - 24}px, ${yOffset - 24}px, 0)`;
        });
    }

    function dragEnd(e) {
        if (!isDragging) return;

        const clientX = (e.type === "touchend") ? e.changedTouches[0].clientX : e.clientX;
        const clientY = (e.type === "touchend") ? e.changedTouches[0].clientY : e.clientY;

        const moveDist = Math.hypot(clientX - startX, clientY - startY);
        
       
        if (moveDist < 5 && typeof toggleSidebar === 'function') {
            toggleSidebar();
        }

        isDragging = false;
        dragContainer.style.transition = 'transform 0.2s cubic-bezier(0.18, 0.89, 0.32, 1.28)';
        
        if (typeof setToggleCookie === "function") {
            setToggleCookie(xOffset, yOffset);
        }
    }

    
    dragHandle.addEventListener("touchstart", dragStart, { passive: false });
    dragHandle.addEventListener("mousedown", dragStart);
    
    document.addEventListener("touchmove", drag, { passive: false });
    document.addEventListener("mousemove", drag);
    
    document.addEventListener("touchend", dragEnd);
    document.addEventListener("mouseup", dragEnd);

   
    const overlay = document.getElementById('sidebar-overlay');
    if (overlay) overlay.addEventListener('click', toggleSidebar);
});

function showNotify(message, type = 'success') {
    const container = document.getElementById('notification-container');
    const notification = document.createElement('div');
    const isSuccess = type === 'success';
    notification.className = `animate__animated animate__fadeInRight animate__faster flex items-center space-x-4 p-5 rounded-[1.5rem] shadow-2xl shadow-slate-200 bg-white/80 backdrop-blur-xl border border-white min-w-[320px] pointer-events-auto`;
    notification.innerHTML = `<div class="w-10 h-10 rounded-xl ${isSuccess ? 'bg-emerald-500' : 'bg-red-500'} text-white flex items-center justify-center shadow-lg"><i class="fas ${isSuccess ? 'fa-check-circle' : 'fa-exclamation-triangle'}"></i></div><div class="flex-1"><p class="text-xs font-bold text-slate-800">${message}</p></div>`;
    container.appendChild(notification);
    setTimeout(() => {
        notification.classList.replace('animate__fadeInRight', 'animate__fadeOutRight');
        setTimeout(() => notification.remove(), 500);
    }, 4000);
}

async function openAdminProfile() {
    const modal = document.getElementById('adminProfileModal');
    if (!modal) return;
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

function closeAdminProfile() {
    const modal = document.getElementById('adminProfileModal');
    if (modal) {
        modal.classList.add('hidden');
        document.body.style.overflow = 'auto';
    }
}

function openUpdateCredentialsModal() {
    document.getElementById('adminProfileModal').classList.add('hidden');
    document.getElementById("new-admin-email").value = document.getElementById("admin-display-email").innerText;
    document.getElementById('updateCredentialsModal').classList.remove('hidden');
}

function closeUpdateCredentials() {
    document.getElementById('updateCredentialsModal').classList.add('hidden');
    document.getElementById('adminProfileModal').classList.remove('hidden');
}

function togglePassVisibility(id) {
    const input = document.getElementById(id);
    const icon = input.nextElementSibling;
    const isPass = input.type === "password";
    input.type = isPass ? "text" : "password";
    icon.classList.replace(isPass ? 'fa-eye' : 'fa-eye-slash', isPass ? 'fa-eye-slash' : 'fa-eye');
}

async function uploadAdminImage(input) {
    if (input.files && input.files[0]) {
        const file = input.files[0];
        const reader = new FileReader();
        reader.onload = (e) => {
            document.getElementById('admin-preview-img').src = e.target.result;
            document.getElementById('sidebar-admin-img').src = e.target.result;
            document.getElementById('admin-preview-img').classList.remove('hidden');
            document.getElementById('admin-default-icon').classList.add('hidden');
        }
        reader.readAsDataURL(file);
        const formData = new FormData();
        formData.append('admin_image', file);
        try {
            const response = await fetch("/upload-admin-profile", { method: "POST", body: formData });
            const result = await response.json();
            if (result.success) showNotify(result.message, "success");
        } catch {
            showNotify("Failed to save image", "error");
        }
    }
}

async function updateAdminCredentials(e) {
    e.preventDefault();
    const email = document.getElementById('new-admin-email').value;
    const password = document.getElementById('new-admin-password').value;
    const confirm = document.getElementById('confirm-admin-password').value;
    if (password !== confirm) return showNotify("Passwords do not match!", "error");
    if (password.length < 5) return showNotify("Password too short", "warning");
    try {
        const response = await fetch("/update-admin-credentials", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password })
        });
        const result = await response.json();
        if (result.success) {
            showNotify(result.message, "success");
            e.target.reset();
        } else {
            showNotify(result.message, "error");
        }
    } catch {
        showNotify("Server communication failed", "error");
    }
    document.getElementById('updateCredentialsModal').classList.add('hidden');
}

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
