let purityRecords = [];
let currentPage = 1;
let searchTimer;

function getResponsivePageSize() {
    const width = window.innerWidth;
    if (width < 768) return 2;
    if (width < 1024) return 4;
    return 6;
}

let pageSize = getResponsivePageSize();

window.addEventListener('resize', () => {
    const newSize = getResponsivePageSize();
    if (newSize !== pageSize) {
        pageSize = newSize;
        renderRecords();
    }
});

function renderRecords() {
    const totalPages = Math.ceil(purityRecords.length / pageSize);
    if (currentPage > totalPages && totalPages > 0) currentPage = totalPages;
    else if (totalPages === 0) currentPage = 1;

    const cardContainer = document.getElementById('cardContainer');
    if (!cardContainer) return;

    cardContainer.innerHTML = '';
    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize;
    const currentData = purityRecords.slice(start, end);

    if (currentData.length === 0) {
        cardContainer.innerHTML = `
            <div class="col-span-full p-12 text-center">
                <div class="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-50 mb-4">
                    <i class="fas fa-certificate text-2xl text-slate-200"></i>
                </div>
                <p class="text-slate-400 font-medium">No purity settings found in database.</p>
            </div>`;
        return;
    }

    document.getElementById('pagination').classList.remove('hidden'); 
    currentData.forEach((item, index) => {
        const overallIndex = start + index;
        const bgColor = (overallIndex % 2 === 0) ? 'bg-white border-slate-100' : 'bg-slate-50/50 border-slate-200';

        cardContainer.innerHTML += `
            <div class="p-4 space-y-4 ${bgColor} rounded-3xl hover:-translate-y-1 transition-all border shadow-sm group">
                <div class="flex justify-between items-center">
                    <div class="flex items-center space-x-2">
                        <div class="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shadow-sm">
                            <i class="fas fa-certificate text-[10px]"></i>
                        </div>
                        <span class="text-[11px] font-black text-slate-400 uppercase tracking-wider">Purity Master</span>
                    </div>
                    <span class="bg-blue-50 text-blue-600 px-2 py-1 rounded-lg text-[11px] font-black uppercase">Gold Loan</span>
                </div>
                <div class="py-1">
                    <p class="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1 pl-1">Purity Level</p>
                    <h4 class="text-xl font-black text-slate-800 ml-1">${item.purity}K</h4>
                </div>
                <div class="flex space-x-2 pt-3 border-t border-slate-100">
                    <button onclick="openEditModal('${item.id}', '${item.purity}')" class="flex-1 py-2 bg-blue-600 text-white rounded-xl text-[10px] font-bold active:scale-95 shadow-md shadow-blue-50 hover:bg-blue-700 transition-all">Edit</button>
                    <button onclick="handleDelete('${item.id}')" class="flex-1 px-3 py-2 bg-red-50 text-red-600 rounded-xl text-[10px] font-bold active:scale-95 hover:bg-red-100 transition-all">Delete</button>
                </div>
            </div>`;
    });

    const startRange = document.getElementById('startRange');
    const endRange = document.getElementById('endRange');
    const totalEntries = document.getElementById('totalEntries');

    if(startRange) startRange.innerText = purityRecords.length > 0 ? start + 1 : 0;
    if(endRange) endRange.innerText = Math.min(end, purityRecords.length);
    if(totalEntries) totalEntries.innerText = purityRecords.length;

    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    if(prevBtn) prevBtn.disabled = currentPage === 1;
    if(nextBtn) nextBtn.disabled = end >= purityRecords.length;

    renderPageNumbers();
}

function renderPageNumbers() {
    const container = document.getElementById('pageIndicator');
    if (!container) return;
    const totalPages = Math.ceil(purityRecords.length / pageSize);
    container.innerHTML = '';
    createBtn("First", 1, currentPage === 1, container, true);
    let start = Math.max(1, currentPage - 1);
    let end = Math.min(totalPages, start + 2);
    if (end === totalPages) start = Math.max(1, end - 3);
    for (let i = start; i <= end; i++) if(i >= 1) createBtn(i, i, i === currentPage, container, false);
    createBtn("Last", totalPages, currentPage === totalPages, container, true);
}

function createBtn(label, page, active, container, isJump) {
    const btn = document.createElement('button');
    btn.innerText = label;
    const bClass = isJump ? "px-3 py-2 rounded-xl border border-slate-200 text-slate-600 text-[10px] font-black uppercase" : "w-9 h-9 rounded-xl text-xs font-bold";
    const sClass = active && !isJump ? "bg-blue-600 text-white shadow-md shadow-blue-200" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50";
    btn.className = `${bClass} ${sClass} transition-all active:scale-95 ${active && isJump ? 'opacity-40 cursor-not-allowed' : ''}`;
    btn.onclick = () => { if(!(active && isJump)) { currentPage = page; renderRecords(); } };
    container.appendChild(btn);
}

function changePage(dir) { currentPage += dir; renderRecords(); }

function openEditModal(id, val) { 
    document.getElementById('editId').value = id; 
    document.getElementById('editPurityInput').value = val; 
    document.getElementById('editModal').classList.remove('hidden'); 
    document.body.style.overflow = 'hidden'; 
}

function closeEditModal() { 
    document.getElementById('editModal').classList.add('hidden'); 
    document.body.style.overflow = 'auto'; 
}

async function filterPurityCards() {
    const searchTerm = document.getElementById("puritySearch").value;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(async () => {
        try {
            const response = await fetch('/filter-gold-purities', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ search: searchTerm })
            });
            const data = await response.json();
            if (data.success) {
                purityRecords = data.purities;
                currentPage = 1;
                renderRecords();
            }
        } catch (error) {
            console.error("Search Error:", error);
        }
    }, 300);
}

document.getElementById("add-gold-purity").onsubmit = async function (e) {
    e.preventDefault();
    const purityInput = document.getElementById("purityInput");
    const submitBtn = this.querySelector('button[type="submit"]');
    const purity = purityInput.value.trim();

    if (!purity) return showNotify("Purity value is required.", "error");
    if (submitBtn) submitBtn.disabled = true;

    try {
        const response = await fetch("/add-gold-purity", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ purity }),
        });
        const data = await response.json();
        if (data.success) {
            showNotify(data.message, "success");
            this.reset();
            await loadPurityDetails();
        } else {
            showNotify(data.message, "error");
        }
    } catch {
        showNotify("Network error. Please try again.", "error");
    } finally {
        if (submitBtn) submitBtn.disabled = false;
    }
};

document.getElementById("edit-gold-purity-Form").onsubmit = async function (e) {
    e.preventDefault();
    const id = document.getElementById('editId').value;
    const purity = document.getElementById('editPurityInput').value.trim();
    const submitBtn = this.querySelector('button[type="submit"]');

    if (!purity) return showNotify("Purity value is required", "error");
    if (submitBtn) submitBtn.disabled = true;

    try {
        const response = await fetch('/update-gold-purity', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, purity })
        });
        const data = await response.json();
        if (data.success) {
            showNotify(data.message, "success");
            closeEditModal();
            await loadPurityDetails();
        } else {
            showNotify(data.message, "error");
        }
    } catch (error) {
        showNotify(`Error: ${error.message}`, "error");
    } finally {
        if (submitBtn) submitBtn.disabled = false;
    }
};

async function handleDelete(purity_id) {
    if (!confirm("Are you sure?")) return;
    try {
        const response = await fetch(`/delete-gold-purity/${purity_id}`, { method: 'DELETE' });
        const data = await response.json();
        if (data.success) {
            showNotify(data.message, "success");
            await loadPurityDetails(); 
        } else {
            showNotify(data.message, "error");
        }
    } catch {
        showNotify("Network error", "error");
    }
}

async function loadPurityDetails() {
    try {
        const response = await fetch('/get-gold-purities', { method: 'POST' });
        const data = await response.json();
        if (data.success) {
            purityRecords = data.purities;
            renderRecords();
        } else {
            showNotify(data.message, 'error');
        }
    } catch (error) {
        showNotify(`Error: ${error.message}`, 'error');
    }
}

document.addEventListener('DOMContentLoaded', loadPurityDetails);