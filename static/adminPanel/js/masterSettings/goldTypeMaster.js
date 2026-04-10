let goldRecords = [];
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

async function fetchGoldItems() {
    try {
        const response = await fetch("/get-gold-items", { method: "POST" });
        const data = await response.json();

        if (data.success) {
            goldRecords = data.gold_items.map((item) => ({
                id: item.id,
                name: item.item_name,
                icon: item.icon,
            }));
        } else {
            goldRecords = [];
            showNotify(`Error: ${data.message}`, "error");
        }
        renderRecords();
    } catch (error) {
        showNotify("Failed to load items from server", "error");
    }
}

document.getElementById("gold-item-add-form").onsubmit = async function (e) {
    e.preventDefault();
    const itemInput = document.getElementById("itemNameInput");
    const submitBtn = this.querySelector('button[type="submit"]');
    const itemName = itemInput.value.trim();

    if (!itemName) return showNotify("Please enter an item name.", "error");
    if (submitBtn) submitBtn.disabled = true;

    try {
        const response = await fetch("/add-gold-item-name", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ itemName }),
        });
        const data = await response.json();
        if (data.success) {
            showNotify(data.message, "success");
            itemInput.value = "";
            await fetchGoldItems();
        } else {
            showNotify(data.message, "error");
        }
    } catch {
        showNotify("Connection error", "error");
    } finally {
        if (submitBtn) submitBtn.disabled = false;
    }
};

function renderRecords() {
    const totalPages = Math.ceil(goldRecords.length / pageSize);
    if (currentPage > totalPages && totalPages > 0) currentPage = totalPages;
    else if (totalPages === 0) currentPage = 1;

    const cardContainer = document.getElementById("cardContainer");
    if (!cardContainer) return;

    cardContainer.innerHTML = "";
    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize;
    const currentData = goldRecords.slice(start, end);

    if (currentData.length === 0) {
        cardContainer.innerHTML = `
            <div class="col-span-full p-10 text-center space-y-3">
                <i class="fas fa-box-open text-4xl text-slate-200"></i>
                <p class="text-slate-400 font-medium text-sm">No gold items found.</p>
            </div>`;
    }

    document.getElementById('pagination').classList.remove('hidden'); 
    
    currentData.forEach((item, index) => {
        const overallIndex = start + index;
        const bgColor = overallIndex % 2 === 0 ? "bg-slate-50 border-slate-100" : "bg-sky-50 border-sky-100";

        cardContainer.innerHTML += `
            <div class="p-5 space-y-4 ${bgColor} rounded-3xl hover:-translate-y-1 transition-all border shadow-sm group">
                <div class="flex justify-between items-center mb-4">
                    <div class="flex items-center space-x-3">
                        <div class="w-10 h-10 rounded-xl bg-white text-amber-600 flex items-center justify-center shadow-sm">
                            <i class="fas ${item.icon || 'fa-gem'} text-sm"></i>
                        </div>
                        <span class="bg-white/50 text-slate-500 px-2 py-1 rounded-lg font-bold text-[10px] uppercase tracking-wider">Gold Loan</span>
                    </div>
                </div>
                <div class="pl-1 border-l-2 border-amber-400">
                    <p class="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-2 mb-1">Item Type</p>
                    <h4 class="text-sm font-bold text-slate-800 ml-2">${item.name}</h4>
                </div>
                <div class="flex space-x-2 pt-4 border-t border-white/50 mt-2">
                    <button onclick="openEditModal('${item.id}', '${item.name}')" class="flex-1 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold shadow-sm active:scale-95 transition-all">Edit</button>
                    <button onclick="deleteRecord('${item.id}')" class="flex-1 px-4 py-2 bg-red-50 text-red-600 rounded-xl text-xs font-bold active:scale-95 transition-all">Delete</button>
                </div>
            </div>`;
    });
    updatePaginationUI(start, end);
}

function updatePaginationUI(start, end) {
    document.getElementById("startRange").innerText = goldRecords.length > 0 ? start + 1 : 0;
    document.getElementById("endRange").innerText = Math.min(end, goldRecords.length);
    document.getElementById("totalEntries").innerText = goldRecords.length;
    document.getElementById("prevBtn").disabled = currentPage === 1;
    document.getElementById("nextBtn").disabled = end >= goldRecords.length;
    renderPageWindow();
}

function renderPageWindow() {
    const container = document.getElementById("pageIndicator");
    if (!container) return;
    const totalPages = Math.ceil(goldRecords.length / pageSize);
    container.innerHTML = "";

    createNavBtn("First", 1, currentPage === 1, container);
    let start = Math.max(1, currentPage - 1);
    let end = Math.min(totalPages, start + 2);
    if (end === totalPages) start = Math.max(1, end - 3);

    for (let i = start; i <= end; i++) {
        if (i < 1) continue;
        const btn = document.createElement("button");
        btn.innerText = i;
        const isActive = i === currentPage;
        btn.className = `w-10 h-10 rounded-xl text-xs font-bold transition-all active:scale-95 ${isActive ? "bg-blue-600 text-white shadow-md shadow-blue-200" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"}`;
        btn.onclick = () => goToPage(i);
        container.appendChild(btn);
    }
    createNavBtn("Last", totalPages, currentPage === totalPages, container);
}

function createNavBtn(label, page, disabled, container) {
    const btn = document.createElement("button");
    btn.innerText = label;
    btn.className = `px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-600 text-[10px] font-black uppercase transition-all ${disabled ? "opacity-40 cursor-not-allowed" : "active:scale-95 hover:bg-slate-50"}`;
    btn.onclick = () => goToPage(page);
    btn.disabled = disabled;
    container.appendChild(btn);
}

function goToPage(p) {
    currentPage = p;
    renderRecords();
}

function openEditModal(id, name) {
    document.getElementById("editId").value = id;
    document.getElementById("editGold").value = name;
    document.getElementById("editModal").classList.remove("hidden");
    document.body.style.overflow = "hidden";
}

function closeEditModal() {
    document.getElementById("editModal").classList.add("hidden");
    document.body.style.overflow = "auto";
}

async function deleteRecord(id) {
    if (!confirm("Are you sure?")) return;
    try {
        const response = await fetch(`/delete-gold-item/${id}`, { method: "DELETE" });
        const data = await response.json();
        if (data.success) {
            showNotify(data.message, "success");
            await fetchGoldItems();
        } else {
            showNotify(data.message, "error");
        }
    } catch {
        showNotify("Network error occurred", "error");
    }
}

document.getElementById("gold-item-edit-form").onsubmit = async function (e) {
    e.preventDefault();
    const id = document.getElementById("editId").value;
    const itemName = document.getElementById("editGold").value.trim();
    const saveBtn = this.querySelector('button[type="submit"]');

    if (!itemName) return showNotify("Item name cannot be empty", "error");
    if (saveBtn) saveBtn.disabled = true;

    try {
        const response = await fetch("/update-gold-item", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id, itemName }),
        });
        const data = await response.json();
        if (data.success) {
            showNotify(data.message, "success");
            closeEditModal();
            await fetchGoldItems();
        } else {
            showNotify(data.message, "error");
        }
    } catch {
        showNotify("Network error occurred", "error");
    } finally {
        if (saveBtn) saveBtn.disabled = false;
    }
};

async function filterGoldCards() {
    const search = document.getElementById("goldSearch").value;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(async () => {
        try {
            const response = await fetch("/filter-gold-items", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ search }),
            });
            const data = await response.json();
            if (data.success) {
                goldRecords = data.gold_items.map((item) => ({
                    id: item.id,
                    name: item.item_name,
                    icon: item.icon,
                }));
                currentPage = 1;
                renderRecords();
            }
        } catch (error) {
            showNotify(`Search Error: ${error.message}`, "error");
        }
    }, 300);
}

document.addEventListener("DOMContentLoaded", fetchGoldItems);
window.onclick = (e) => { if (e.target.classList.contains("bg-slate-900/60")) closeEditModal(); };