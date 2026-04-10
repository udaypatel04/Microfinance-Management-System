let bikeRecords = []; 
let currentPage = 1;

function getResponsivePageSize() {
    const width = window.innerWidth;
    if (width < 768) return 3;
    if (width < 1280) return 4;
    return 6;
}

let pageSize = getResponsivePageSize();

document.addEventListener("DOMContentLoaded", () => {
    fetchBikeItems();
    const addForm = document.getElementById("add-bike-info-form");
    if (addForm) addForm.onsubmit = handleAddBike;
    const editForm = document.getElementById("edit-bike-info-form");
    if (editForm) editForm.onsubmit = handleUpdateBike;
});

window.addEventListener('resize', () => {
    const newSize = getResponsivePageSize();
    if (newSize !== pageSize) {
        pageSize = newSize;
        renderRecords();
    }
});

async function fetchBikeItems() {
    try {
        const response = await fetch("/get-bike-info", { method: "POST" });
        const data = await response.json();
        if (data.success) {
            bikeRecords = data.bike_items.map(item => ({
                id: item.id,
                loan: "Bike Loan",
                type: item.bike_type, 
                name: item.bike_name,
                company: item.company_name,
                model: item.bike_model,
                engine: item.enginecc,
                showroom: item.showroom_price,
                onroad: item.on_road_price,
                fuel: item.fuel_type,
                gst: item.gst_rate,
                vehicle_id: item.app_no
            }));
            renderRecords();
        } else {
            bikeRecords = [];
            renderRecords();
            showNotify(`Error: ${data.message}`, "error");
        }
    } catch (error) {
        showNotify("Failed to load bike data", "error");
    }
}

async function handleAddBike(e) {
    e.preventDefault();
    const submitBtn = this.querySelector('button[type="submit"]');
    const fields = {
        bike_type: "Bike Type", bike_name: "Bike Name", company_name: "Company Name",
        bike_model: "Bike Model", engine_cc: "Engine CC", showroom_price: "Showroom Price",
        onroad_price: "Onroad Price", fuel_type: "Fuel Type", gst_rate: "GST Rate"
    };
    const bikeData = {};
    for (const [id, label] of Object.entries(fields)) {
        const val = document.getElementById(id)?.value.trim();
        if (!val) {
            showNotify(`${label} is required`, "error");
            document.getElementById(id)?.focus();
            return;
        }
        bikeData[id] = val;
    }
    if (submitBtn) submitBtn.disabled = true;
    try {
        const response = await fetch("/add-bike-info-master", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(bikeData)
        });
        const data = await response.json();
        if (data.success) {
            showNotify(data.message, "success");
            this.reset();
            await fetchBikeItems();
        } else {
            showNotify(data.message, "error");
        }
    } catch {
        showNotify("Connection error", "error");
    } finally {
        if (submitBtn) submitBtn.disabled = false;
    }
}

async function handleUpdateBike(e) {
    e.preventDefault();
    const submitBtn = this.querySelector('button[type="submit"]');
    const updatedData = {
        id: document.getElementById("editId").value,
        bike_type: document.getElementById("editType").value,
        bike_name: document.getElementById("editName").value.trim(),
        company_name: document.getElementById("editCompany").value.trim(),
        bike_model: document.getElementById("editModel").value,
        engine_cc: document.getElementById("editEngine").value.trim(),
        fuel_type: document.getElementById("editFuel").value,
        showroom_price: document.getElementById("editShowroom").value,
        onroad_price: document.getElementById("editOnroad").value,
        gst_rate: document.getElementById("editGst").value
    };
    for (const [key, value] of Object.entries(updatedData)) {
        if (!value && value !== 0) {
            showNotify(`Please fill out the ${key.replace('_', ' ')} field`, "error");
            return;
        }
    }
    if (submitBtn) submitBtn.disabled = true;
    try {
        const response = await fetch("/update-bike-master", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(updatedData)
        });
        const data = await response.json();
        if (data.success) {
            showNotify(data.message, "success");
            closeEditModal();
            await fetchBikeItems();
        } else {
            showNotify(data.message, "error");
        }
    } catch {
        showNotify("Connection error. Please try again.", "error");
    } finally {
        if (submitBtn) submitBtn.disabled = false;
    }
}

async function handleDelete(id) {
    if (!confirm("Are you sure?")) return;
    try {
        const response = await fetch(`/delete-bike-item/${id}`, { method: "DELETE" });
        const data = await response.json();
        if (data.success) {
            showNotify(data.message, "success");
            await fetchBikeItems();
        }
    } catch {
        showNotify("Delete failed", "error");
    }
}

async function filterBikeCards() {
    const searchTerm = document.getElementById("bikeSearch").value.trim();
    try {
        const response = await fetch("/filter-bike-info", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query: searchTerm })
        });
        const data = await response.json();
        if (data.success) {
            bikeRecords = data.bike_items.map(item => ({
                id: item.id,
                type: item.bike_type,
                name: item.bike_name,
                company: item.company_name,
                model: item.bike_model,
                engine: item.enginecc,
                showroom: item.showroom_price,
                onroad: item.on_road_price,
                fuel: item.fuel_type,
                gst: item.gst_rate,
                vehicle_id: item.app_no
            }));
            currentPage = 1;
            renderRecords(); 
        }
    } catch (error) {
        console.error("Search Error:", error);
    }
}

const formatPrice = (num) => {
    if (!num || isNaN(num)) return "0.00L";
    return (num / 100000).toFixed(2) + "L";
};




function renderRecords() {
    const container = document.getElementById('cardContainer');
    if (!container) return;
    const totalPages = Math.ceil(bikeRecords.length / pageSize);
    if (currentPage > totalPages && totalPages > 0) currentPage = totalPages;
    container.innerHTML = '';
    const start = (currentPage - 1) * pageSize;
    const currentData = bikeRecords.slice(start, start + pageSize);
    if (currentData.length === 0) {
        container.innerHTML = `<div class="col-span-full p-20 text-center text-slate-400">No bikes found.</div>`;
        return;
    }
    document.getElementById('pagination').classList.remove('hidden'); 
   currentData.forEach(item => {
    const additionalCosts = item.onroad - item.showroom;
    container.innerHTML += `
        <div class="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all group relative overflow-hidden">
            
            <div class="absolute top-5 right-6 flex items-center gap-2">
                <span class="px-2 py-1 bg-amber-50 text-amber-600 rounded-lg text-[9px] font-black uppercase tracking-tight">GST ${item.gst}%</span>
                <span class="px-2 py-1 bg-blue-50 text-blue-600 rounded-lg text-[9px] font-black uppercase tracking-tight">${item.fuel}</span>
            </div>

            <div class="flex justify-between items-start mb-6">
                <div class="pr-20"> 
                    <div class="inline-flex items-center mb-2 overflow-hidden rounded-lg text-xl shadow-sm">
                        <span class="bg-slate-900 px-1.5 py-0.5 text-[7px] font-black text-white uppercase tracking-wider whitespace-nowrap">
                            VEHICLE ID
                        </span>
                        <span class="bg-white px-2 py-0.5 font-mono text-[11px] font-black text-blue-600 tracking-tight whitespace-nowrap">
                            ${item.vehicle_id || 'VN-000'}
                        </span>
                    </div>

                    <h4 class="text-lg font-black text-slate-800 uppercase tracking-tight leading-tight">${item.name}</h4>
                    <div class="flex items-center gap-1.5 mt-0.5 text-[10px] text-slate-400 font-bold uppercase tracking-wide">
                        <span>${item.company}</span>
                        <span class="w-1 h-1 rounded-full bg-slate-300"></span>
                        <span>${item.type}</span>
                    </div>
                </div>

                <div class="text-right pt-5 shrink-0"> 
                    <p class="text-[9px] font-black text-slate-400 uppercase leading-none mb-1">On-Road Price</p>
                    <span class="text-blue-600 font-black text-lg">₹${formatPrice(item.onroad)}</span>
                </div>
            </div>

            <div class="grid grid-cols-2 gap-y-6 py-6 border-y border-slate-50">
                <div>
                    <p class="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1">Bike Model</p>
                    <p class="text-sm font-bold text-slate-700">${item.model}</p>
                </div>
                <div>
                    <p class="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1">Engine CC</p>
                    <p class="text-sm font-bold text-slate-700">${item.engine}cc</p>
                </div>
                <div>
                    <p class="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1">Showroom</p>
                    <p class="text-sm font-bold text-slate-700">₹${formatPrice(item.showroom)}</p>
                </div>
                <div>
                    <p class="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1">Addl. Costs</p>
                    <p class="text-sm font-bold text-emerald-600">+ ₹${(additionalCosts / 1000).toFixed(1)}k</p>
                </div>
            </div>

            <div class="flex space-x-3 mt-6">
                <button onclick="openEditModal(${item.id})" class="flex-1 py-3 bg-blue-600 text-white rounded-2xl text-xs font-bold active:scale-95 transition-all shadow-lg shadow-blue-100 flex items-center justify-center gap-2">
                    <i class="fas fa-edit"></i> Edit
                </button>
                <button onclick="handleDelete(${item.id})" class="flex-1 py-3 bg-red-50 text-red-600 rounded-2xl text-xs font-bold active:scale-95 transition-all flex items-center justify-center gap-2">
                    <i class="fas fa-trash"></i> Delete
                </button>
            </div>
        </div>`;
});
    updatePaginationUI(start);

    
   
}


function updatePaginationUI(start) {
    document.getElementById('startRange').innerText = bikeRecords.length > 0 ? start + 1 : 0;
    document.getElementById('endRange').innerText = Math.min(start + pageSize, bikeRecords.length);
    document.getElementById('totalEntries').innerText = bikeRecords.length;
    document.getElementById('prevBtn').disabled = currentPage === 1;
    document.getElementById('nextBtn').disabled = currentPage * pageSize >= bikeRecords.length;
    renderPageWindow();
    
    
}

function renderPageWindow() {
    const container = document.getElementById('pageIndicator');
    const totalPages = Math.ceil(bikeRecords.length / pageSize);
    if(!container) return;
    container.innerHTML = '';
    createNavBtn("First", 1, currentPage === 1, container);
    let start = Math.max(1, currentPage - 1);
    let end = Math.min(totalPages, start + 2);
    if (end === totalPages) start = Math.max(1, end - 3);
    for (let i = start; i <= end; i++) {
        if(i < 1) continue;
        const btn = document.createElement('button'); 
        btn.innerText = i;
        btn.className = `w-8 h-8 rounded-xl text-xs font-bold transition-all ${i===currentPage ? 'bg-blue-600 text-white shadow-lg' : 'bg-white border border-slate-200 text-slate-600'}`;
        btn.onclick = () => { currentPage = i; renderRecords(); };
        container.appendChild(btn);
    }
    createNavBtn("Last", totalPages, currentPage === totalPages, container);
}

function createNavBtn(label, page, disabled, container) {
    const btn = document.createElement('button'); 
    btn.innerText = label;
    btn.className = `px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-600 text-[10px] font-black uppercase ${disabled ? 'opacity-40 cursor-not-allowed' : 'active:scale-95 hover:bg-slate-50'}`;
    btn.onclick = () => { if(!disabled) { currentPage = page; renderRecords();} };
    container.appendChild(btn);
}




function changePage(dir) { 
    const totalPages = Math.ceil(bikeRecords.length / pageSize);
    const next = currentPage + dir;
    if(next >= 1 && next <= totalPages) {
        currentPage = next; 

        renderRecords();  
    }
}



function openEditModal(id) {
    const item = bikeRecords.find(r => r.id === id);
    if (item) {
        document.getElementById('editId').value = item.id;
        document.getElementById('editType').value = item.type;
        document.getElementById('editName').value = item.name;
        document.getElementById('editCompany').value = item.company;
        document.getElementById('editModel').value = item.model;
        document.getElementById('editEngine').value = item.engine;
        document.getElementById('editFuel').value = item.fuel;
        document.getElementById('editGst').value = item.gst;
        document.getElementById('editShowroom').value = item.showroom;
        document.getElementById('editOnroad').value = item.onroad;
        document.getElementById('editBikeModal').classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    } else {
        showNotify("Error: Record not found", "error");
    }
}

function closeEditModal() {
    document.getElementById('editBikeModal').classList.add('hidden');
    document.body.style.overflow = 'auto';
    document.getElementById('edit-bike-info-form').reset();
}