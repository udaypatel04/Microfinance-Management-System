document.addEventListener('DOMContentLoaded', () => {
    
    fetchCurrentPrice();

   
    const autoSyncToggle = document.getElementById('autoSyncToggle');
    if (autoSyncToggle) {
        autoSyncToggle.addEventListener('change', async function() {
            const isAuto = this.checked;
              
            handleToggleState(isAuto);

            try {
                // Update the toggle value in the database
                const response = await fetch('/update-sync-status', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ is_realtime: isAuto })
                });
                const data = await response.json();

                if (data.success) {
                    // If turned ON, fetch the latest price from API immediately
                    if (isAuto) {
                        fetchCurrentPrice();
                    }
                    if (typeof showNotify === 'function') {
                        showNotify(`Auto-Sync ${isAuto ? 'Enabled' : 'Disabled'}`, "success");
                    }
                }
            } catch (err) {
                console.error("Toggle update failed:", err);
                if (typeof showNotify === 'function') showNotify("Failed to update sync settings", "error");
            }
        });
    }
});

// Function to handle UI disabling/enabling based on toggle
function handleToggleState(isAuto) {
    const gramInput = document.getElementById('gramPrice');
    const submitBtn = document.getElementById('submitBtn');
    const syncStatusLabel = document.getElementById('syncStatusLabel');

    if (syncStatusLabel) {
        syncStatusLabel.innerText = isAuto ? "ON" : "OFF";
        syncStatusLabel.classList.toggle('text-emerald-500', isAuto);
    }

    gramInput.disabled = isAuto;
    submitBtn.disabled = isAuto;

    if (isAuto) {
        submitBtn.classList.add('opacity-50', 'cursor-not-allowed');
        submitBtn.querySelector('span').innerText = "Auto-Sync Active";
        gramInput.classList.add('bg-slate-100', 'cursor-not-allowed');
    } else {
        submitBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        submitBtn.querySelector('span').innerText = "Sync Market Price";
        gramInput.classList.remove('bg-slate-100', 'cursor-not-allowed');
    }
}

async function fetchCurrentPrice() {
    const displayPrice = document.getElementById('displayPrice');
    displayPrice.classList.add('animate-pulse');

    try {
        const response = await fetch('/get-gold-price', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
        });
        const data = await response.json();
        if (data.success) {
            // Pass the database flag to set the toggle state correctly on load
            updateUI(data.price, data.is_realtime);
            
        }else{
            showNotify(data.message, "error");
            fetchCurrentPrice();
            
        }
    } catch (err) {
        if (typeof showNotify === 'function') showNotify("Database sync error", "error");
    } finally {
        displayPrice.classList.remove('animate-pulse');
    }
}

function updateUI(price, is_realtime = null) {
    const formattedPrice = parseFloat(price);
    
    document.getElementById('displayPrice').innerText = formattedPrice.toLocaleString('en-IN');

    // Update toggle state only if is_realtime is explicitly provided (from DB)
    if (is_realtime !== null) {
        const toggle = document.getElementById('autoSyncToggle');
        toggle.checked = is_realtime;
        handleToggleState(is_realtime);
    }
    
    document.getElementById('gramPrice').value = formattedPrice;
}

document.getElementById('goldPriceForm').onsubmit = async function(e) {
    e.preventDefault();
    
    if (document.getElementById('autoSyncToggle').checked) return;

    const price = document.getElementById('gramPrice').value;
    const btn = document.getElementById('submitBtn');

    btn.disabled = true;
    btn.querySelector('span').innerText = "Processing Update...";

    try {
        const response = await fetch('/update-gold-price', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ price: price, type: "Gold Loan" })
        });
        const data = await response.json();
        
        if (data.success) {
            // After manual update, we ensure the UI knows it's NOT real-time
            updateUI(price, false);
            if (typeof showNotify === 'function') showNotify("Gold Price Updated", "success");
        }
    } catch (err) {
        if (typeof showNotify === 'function') showNotify("Update failed", "error");
    } finally {
        if (!document.getElementById('autoSyncToggle').checked) {
            btn.disabled = false;
            btn.querySelector('span').innerText = "Sync Market Price";
        }
    }
};

function editPrice() {
    if (document.getElementById('autoSyncToggle').checked) {
        if (typeof showNotify === 'function') showNotify("Disable Auto-Sync to edit manually", "warning");
        return;
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
    document.getElementById('gramPrice').focus();
}

async function deletePrice() {
    if (document.getElementById('autoSyncToggle').checked) return;
    if (!confirm("Reset Gold Rate To Zero?")) return;
    
    
    updateUI(0, false);
    if (typeof showNotify === 'function') showNotify("Gold Price Reset", "success");
}