

// Open Edit Modal with current spread values
function openEditModal(id, type, currentSpread) {
    document.getElementById('editId').value = id;
    document.getElementById('editType').value = type;
    document.getElementById('editSpread').value = currentSpread;
    document.getElementById('editModal').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

function closeEditModal() { 
    document.getElementById('editModal').classList.add('hidden'); 
    document.body.style.overflow = 'auto'; 
}

// Close modal on backdrop click
window.onclick = (e) => { 
    if (e.target.classList.contains('bg-slate-900/60')) closeEditModal(); 
};

/**
 * Fetch loan details and the current Repo Rate from the backend
 * Renders cards showing Final Rate = Repo + Spread
 */
async function loadLatestLoanDetails() {
    try {
        const response = await fetch('/loan-details', { method: 'POST' });
        const data = await response.json();

        if (data.success) {
            const container = document.getElementById('cardContainer');
            if (!container) return;
            container.innerHTML = '';

            // Use the repo_rate provided by the API (or fallback to 5.25 if API fails)
            const currentRepo = parseFloat(data.repo_rate || 0.00);
            
            // Update the Repo Rate display in the UI header
            const repoDisplay = document.getElementById('display_repo_rate');
            if (repoDisplay) repoDisplay.innerText = `${currentRepo.toFixed(2)}%`;

            data.loan_details.forEach((loan, index) => {
            const spreadRate = parseFloat(loan.interest_spread || 0);

            // ONLY proceed if the spread value is greater than 0
            if (spreadRate > 0) {
                const typeLower = loan.loan_type.toLowerCase();
                const currentRepo = parseFloat(data.repo_rate || 0.00);
                const finalInterest = (currentRepo + spreadRate).toFixed(2);

                // Dynamic UI coloring
                let color = 'slate';
                if (typeLower.includes('gold')) color = 'amber';
                else if (typeLower.includes('bike') || typeLower.includes('motor')) color = 'blue';

                container.innerHTML += `
                    <div class="group relative bg-white rounded-[2.5rem] p-2 border border-slate-100 shadow-xl shadow-slate-200/60 hover:shadow-2xl hover:shadow-${color}-100/50 transition-all duration-500 animate__animated animate__zoomIn" 
                        style="animation-delay: ${index * 0.1}s">
                        <div class="bg-slate-50/50 rounded-[2rem] p-6 transition-all duration-500 group-hover:bg-white">
                            <div class="flex justify-between items-start mb-8">
                                <div class="w-16 h-16 rounded-3xl bg-${color}-50 text-${color}-600 flex items-center justify-center shadow-inner group-hover:scale-110 group-hover:rotate-6 transition-all duration-500">
                                    <i class="fas ${loan.icon || 'fa-hand-holding-usd'} text-2xl"></i>
                                </div>
                                <div class="bg-white px-3 py-1 rounded-full border border-slate-100 shadow-sm">
                                    <span class="text-[10px] font-black text-${color}-600 uppercase tracking-widest">Spread: ${spreadRate.toFixed(2)}%</span>
                                </div>
                            </div>
                            <div class="mb-8">
                                <p class="text-[12px] font-black text-slate-400 uppercase tracking-widest leading-none mb-2">Final Annual Interest</p>
                                <div class="flex items-baseline space-x-1">
                                    <h2 class="text-4xl font-black text-slate-900 tracking-tighter">${finalInterest}</h2>
                                    <span class="text-lg font-bold text-slate-300">%</span>
                                </div>
                                <p class="text-[11px] font-bold text-slate-400 mt-1 uppercase">Repo (${currentRepo}%) + Margin (${spreadRate}%)</p>
                            </div>
                            <div class="space-y-4">
                                <div class="flex flex-col">
                                    <h4 class="text-lg font-black text-slate-800 tracking-tight leading-none">${loan.loan_type}</h4>
                                    <p class="text-[11px] font-medium text-slate-400 mt-2">Floating Market Logic</p>
                                </div>
                                <div class="flex items-center space-x-2 pt-4 border-t border-slate-100/50">
                                    <button onclick="openEditModal(${loan.id}, '${loan.loan_type}', ${spreadRate})" 
                                            class="flex-1 py-3 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-${color}-600 transition-all active:scale-95 shadow-lg shadow-slate-200">
                                        Edit Spread
                                    </button>
                                    <button onclick="if(confirm('Delete this interest configuration?')) handleDelete('${loan.id}')"
                                            class="w-12 h-12 flex items-center justify-center bg-red-50 text-red-500 rounded-2xl hover:bg-red-500 hover:text-white transition-all active:scale-95">
                                        <i class="fas fa-trash-alt"></i>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>`;
            }
        });
        }
    } catch (error) {
        if(typeof showNotify === "function") showNotify("Failed to load loan data", 'error');
    }
}


document.getElementById("loan-interest-set-form").onsubmit = async function(e) {
    e.preventDefault();
    const loan_id = document.getElementById('loan_id').value;
    const interest_spread = document.getElementById('interest_spread').value;
    const submitBtn = this.querySelector('button[type="submit"]');

    if (!loan_id || isNaN(interest_spread) || interest_spread === '') {
        return showNotify('Please Select A Loan Type And Enter A Valid Spread', 'error');
    }

    if (submitBtn) submitBtn.disabled = true;
   
    try {
        const response = await fetch('/loan-spread-set', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                loan_id: parseInt(loan_id), 
                interest_spread: parseFloat(interest_spread) 
            })
        });
        const data = await response.json();
        if (data.success) {
            showNotify(data.message, 'success');
            this.reset(); 
            loadLatestLoanDetails();
        } else {
            showNotify(data.message, 'error');
        }
    } catch (err) {
        showNotify('Network error. Please try again.', 'error');
    } finally {
        if (submitBtn) submitBtn.disabled = false;
    }
};


document.getElementById("editForm").onsubmit = async function(e) {
    e.preventDefault();
    const id = document.getElementById('editId').value;
    const spread = document.getElementById('editSpread').value;
    const submitBtn = this.querySelector('button[type="submit"]');

    if (!id || isNaN(spread) || spread === '') {
        return showNotify('Please enter a valid spread rate', 'error');
    }

    if (submitBtn) submitBtn.disabled = true;
    closeEditModal();
    try {
        const response = await fetch('/update-loan-spread', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                id: id, 
                spread: parseFloat(spread) 
            })
        });
        const data = await response.json();
        if (data.success) {
            showNotify(data.message, 'success');
            loadLatestLoanDetails();
           
        } else {
            showNotify(data.message, 'error');
        }
    } catch {
        showNotify('Failed to update. Check your connection.', 'error');
    } finally {
        if (submitBtn) submitBtn.disabled = false;
    }
};

// Delete Configuration
async function handleDelete(loan_id) {
    try {
        const response = await fetch(`/delete-loan-spread/${loan_id}`, { method: 'DELETE' });
        const data = await response.json();
        if (data.success) {
            showNotify(data.message, 'success');
             loadLatestLoanDetails();
        } else {
            showNotify(data.message, 'error');
        }
    } catch {
        showNotify('Failed to delete. Check your connection.', 'error');
    }
}

// Initial Load
document.addEventListener('DOMContentLoaded', loadLatestLoanDetails);