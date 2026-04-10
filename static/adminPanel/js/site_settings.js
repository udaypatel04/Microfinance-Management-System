document.addEventListener('DOMContentLoaded', async () => {
    try {
        const response = await fetch('/get-site-settings'); 
        const data = await response.json();

        if (data) {
            const mToggle = document.getElementById('maintenance-toggle');
            if (mToggle) {
                mToggle.checked = !!data.maintenance_mode;
                updateBadgeUI(data.maintenance_mode);
            }

            const form = document.getElementById('settings-form');
            const fieldMap = {
                'phone': data.contact_number,
                'email': data.email,
                'address': data.company_address,
                'fb': data.facebook_url,
                'ig': data.instagram_url,
                'li': data.linkedin_url,
                'map_url': data.map_url
            };

            Object.keys(fieldMap).forEach(key => {
                if(form.elements[key]) form.elements[key].value = fieldMap[key] || '';
            });

            if(data.map_url) liveUpdateMap(data.map_url);
        }
    } catch (err) {
        showNotify(`Initial load failed: ${err.message}`, "error");
    }
});

async function updateMaintenanceMode(checkbox) {
    const isActive = checkbox.checked;
    updateBadgeUI(isActive);

    try {
        const response = await fetch('/update-maintenance-mode', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: isActive })
        });
        
        const result = await response.json();
        if (!result.success) throw new Error(result.message);
        showNotify(result.message, "success");
    } catch (err) {
        showNotify(err.message, "error");
        checkbox.checked = !isActive;
        updateBadgeUI(!isActive);
    }
}

function updateBadgeUI(active) {
    const badge = document.getElementById('maintenance-status');
    if (!badge) return;
    badge.innerText = active ? "System in Maintenance" : "System Live";
    badge.className = `px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider ${active ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'}`;
}

async function updateGeneralSettings(event) {
    event.preventDefault();
    
    const btn = document.getElementById('main-save-btn');
    const form = event.target;
    const data = Object.fromEntries(new FormData(form).entries());

    btn.disabled = true;
    const originalText = btn.innerText;

    try {
        const response = await fetch('/update-site-settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        const result = await response.json();

        if (result.success) {
            btn.innerText = "Saved Successfully!";
            btn.classList.replace('bg-blue-600', 'bg-emerald-600');
            
            if(typeof fetchGlobalSettings === 'function') fetchGlobalSettings();

            setTimeout(() => {
                btn.innerText = originalText;
                btn.classList.replace('bg-emerald-600', 'bg-blue-600');
                btn.disabled = false;
            }, 2000);

            showNotify(result.message, "success");
        } else {
            throw new Error(result.message);
        }

    } catch (err) {
        showNotify(err.message, "error");
        btn.disabled = false;
        btn.innerText = originalText;
    }
}

function liveUpdateMap(url) {
    const frame = document.getElementById('map-frame');
    const placeholder = document.getElementById('map-placeholder');
    if (!frame || !placeholder) return;

    const isValidUrl = url && (url.startsWith('https://') || url.startsWith('http://'));
    frame.src = isValidUrl ? url : '';
    frame.classList.toggle('hidden', !isValidUrl);
    placeholder.classList.toggle('hidden', isValidUrl);
}