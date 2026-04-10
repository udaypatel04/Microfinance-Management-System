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
    if (!sidebar) return;
    
    if (window.innerWidth <= 1024) {
        sidebar.classList.toggle('open');
        sidebar.classList.toggle('-translate-x-full'); 
        const isOpen = sidebar.classList.contains('open');
        if (overlay) {
            overlay.classList.toggle('hidden', !isOpen);
            overlay.classList.toggle('show', isOpen);
        }
        document.body.style.overflow = isOpen ? 'hidden' : 'auto';
    } else {
        sidebar.classList.toggle('mini');
        if (sidebar.classList.contains('mini')) closeAllDropdowns();
    }
}

function toggleDropdown(id) {
    const menu = document.getElementById(id);
    const icon = document.getElementById(id.replace('-menu', '-icon'));
    if (!menu) return;
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

function showNotify(message, type = 'success') {
    const container = document.getElementById('notification-container');
    if (!container) return;
    const notification = document.createElement('div');
    const isSuccess = type === 'success';
    notification.className = `animate__animated animate__fadeInRight animate__faster flex items-center space-x-4 p-5 rounded-[1.5rem] shadow-2xl shadow-slate-200 bg-white/80 backdrop-blur-xl border border-white min-w-[320px] pointer-events-auto mb-3`;
    notification.innerHTML = `
        <div class="w-10 h-10 rounded-xl ${isSuccess ? 'bg-emerald-500' : 'bg-red-500'} text-white flex items-center justify-center shadow-lg">
            <i class="fas ${isSuccess ? 'fa-check-circle' : 'fa-exclamation-triangle'}"></i>
        </div>
        <div class="flex-1">
            <p class="text-xs font-black text-slate-800">${message}</p>
        </div>`;
    container.appendChild(notification);
    setTimeout(() => {
        
        notification.classList.remove('animate__fadeInRight');
    
       notification.classList.add('animate__fadeOutRight');

        setTimeout(() => notification.remove(), 500);
    }, 4000);
}

document.addEventListener('DOMContentLoaded', () => {
    const dragContainer = document.getElementById("floating-toggle");
    const dragHandle = document.getElementById("drag-handle") || dragContainer;
    
    let isDragging = false, 
        currentX, currentY, 
        initialX, initialY, 
        startX, startY,
        xOffset = 24, yOffset = 24;

    const savedPos = getToggleCookie();
    if (savedPos && dragContainer) {
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
        currentX = clientX - initialX;
        currentY = clientY - initialY;
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
        if (moveDist < 5) toggleSidebar();
        isDragging = false;
        dragContainer.style.transition = 'transform 0.2s cubic-bezier(0.18, 0.89, 0.32, 1.28)';
        setToggleCookie(xOffset, yOffset);
    }

    if (dragHandle) {
        dragHandle.addEventListener("touchstart", dragStart, { passive: false });
        dragHandle.addEventListener("mousedown", dragStart);
        document.addEventListener("touchmove", drag, { passive: false });
        document.addEventListener("mousemove", drag);
        document.addEventListener("touchend", dragEnd);
        document.addEventListener("mouseup", dragEnd);
    }

    const overlay = document.getElementById('sidebar-overlay');
    if (overlay) overlay.addEventListener('click', toggleSidebar);
});

function openStaffProfile() {
    document.getElementById('staffProfileModal').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

function closeStaffProfile() {
    document.getElementById('staffProfileModal').classList.add('hidden');
    document.body.style.overflow = 'auto';
}

function openStaffSecurityModal() {
    document.getElementById('staffProfileModal').classList.add('hidden');
    document.getElementById('staffSecurityModal').classList.remove('hidden');
}

function closeStaffSecurity() {
    document.getElementById('staffSecurityModal').classList.add('hidden');
    document.getElementById('staffProfileModal').classList.remove('hidden');
}


async function uploadStaffImage(input) {
    if (input.files && input.files[0]) {
        const formData = new FormData();
        formData.append('staff_image', input.files[0]);
        const response = await fetch("/upload-staff-profile", { method: "POST", body: formData });
        const result = await response.json();
        if (result.success) {
            document.getElementById('staff-preview-img').src = result.new_url;
            if(document.getElementById('sidebar-staff-img')) document.getElementById('sidebar-staff-img').src = result.new_url;
            showNotify("Profile photo updated!", "success");
        } else {
            showNotify(result.message, "error");
        }
    }
}


function togglePassVisibility(id) {
    const input = document.getElementById(id);
    const icon = input.nextElementSibling;
    const isPass = input.type === "password";
    input.type = isPass ? "text" : "password";
    icon.classList.replace(isPass ? 'fa-eye' : 'fa-eye-slash', isPass ? 'fa-eye-slash' : 'fa-eye');
}

async function updateStaffCredentials(e) {
    e.preventDefault();
    const password = document.getElementById('new-staff-password');
    const confirm = document.getElementById('confirm-staff-password');
    
    if (password.value.length < 5) 
    {
       
        showNotify("Password too short", "warning");
        document.getElementById('staffSecurityModal').classList.add('hidden');
    
        password.value = '';
        confirm.value = '';
    
        
        setTimeout(() => {
                    document.getElementById('staffSecurityModal').classList.remove('hidden');
            }, 3000);
        return;
    }
        

    if (password.value !== confirm.value){
        
      showNotify("Passwords do not match!", "error");
      document.getElementById('staffSecurityModal').classList.add('hidden');
    
      password.value = '';
      confirm.value = '';
    
      
      setTimeout(() => {
                document.getElementById('staffSecurityModal').classList.remove('hidden');
        }, 3000);
      return;
    }
        


    const formData = new FormData();
    formData.append('password', password.value);

    try {
        const response = await fetch("/update-staff-credentials", { 
            method: "POST", 
            body: formData 
        });
        const result = await response.json();

        if (result.success) {
            showNotify(result.message, "success");
            document.getElementById('staffSecurityModal').classList.add('hidden');
        } else {
            showNotify(result.message, "error");
            document.getElementById('staffSecurityModal').classList.add('hidden');
            
            setTimeout(() => {
                document.getElementById('staffSecurityModal').classList.remove('hidden');
            }, 3000);
        }
    } catch {
        showNotify("Communication failed", "error");

        document.getElementById('staffSecurityModal').classList.add('hidden');
            
        setTimeout(() => {
                document.getElementById('staffSecurityModal').classList.remove('hidden');
        }, 3000);
    }
    password.value='';
    confirm.value='';
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

