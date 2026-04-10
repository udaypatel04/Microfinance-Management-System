let allStaffRecords = [];
let staffRecords = [];
let currentPage = 1;
let totalPages = 1;
let pageSize = getResponsivePageSize();

function getResponsivePageSize() {
    const width = window.innerWidth;
    if (width < 768) return 3;
    if (width < 1280) return 4;
    return 6;
}

window.addEventListener('resize', () => {
    const newSize = getResponsivePageSize();
    if (newSize !== pageSize) {
        pageSize = newSize;
        renderRecords();
    }
});

async function loadStaffData() {
    try {
        const response = await fetch("/get-staff-list", {
            method: "POST",
            headers: { "Content-Type": "application/json" }
        });
        const data = await response.json();

        if (data.success) {
            const formattedData = data.staff_items.map(item => ({
                id: item.id,
                name: item.full_name,
                address: item.address,
                city: item.city,
                mobile: item.mob_number,
                gender: item.gender,
                email: item.email,
                dob: item.dob,
                joining: item.joining_date,
                staff_id:item.app_no
            }));
    
            allStaffRecords = [...formattedData];
            staffRecords = [...formattedData];
            renderRecords();
        } else {
            showNotify(data.message, "error");
        }
    } catch (error) {
        showNotify("Connection Error: Failed to load staff", "error");
    }
}

function renderRecords() {
    totalPages = Math.ceil(staffRecords.length / pageSize);
    if (currentPage > totalPages && totalPages > 0) currentPage = totalPages;
    else if (totalPages === 0) currentPage = 1;

    const container = document.getElementById('staffContainer');
    if (!container) return;
    
    container.innerHTML = '';
    const start = (currentPage - 1) * pageSize;
    const currentData = staffRecords.slice(start, start + pageSize);

    if (currentData.length === 0) {
        container.innerHTML = `<div class="col-span-full py-20 text-center text-slate-400 font-bold uppercase text-[10px]">No Records Found</div>`;
        return;
    }

    document.getElementById('pagination').classList.remove('hidden'); 
    
    currentData.forEach(staff => {
        container.innerHTML += `
    <div class="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all group min-h-[350px] flex flex-col justify-between">
        <div>
            <div class="flex justify-between items-start mb-4">
                <div class="flex items-center space-x-3">
                    <div class="w-11 h-11 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-black text-base shadow-sm shrink-0">
                        ${staff.name.charAt(0)}
                    </div>
                    <div class="overflow-hidden">
                        <div class="inline-flex items-center mb-1.5 overflow-hidden rounded-lg border border-slate-200 shadow-sm">
                            <span class="bg-slate-900 px-1.5 py-0.5 text-[11px] font-black text-white uppercase tracking-wider">
                                STAFF ID
                            </span>
                            <span class="bg-white px-2 py-0.5 font-mono text-[13px] font-black text-indigo-600 tracking-tight whitespace-nowrap">
                                ${staff.staff_id || 'STF-000'}
                            </span>
                        </div>
                        
                        <h4 class="text-sm font-black text-slate-800 tracking-tight leading-none mb-1">${staff.name}</h4>
                        <div class="text-[9px] text-slate-400 font-bold uppercase tracking-wider">${staff.city}</div>
                    </div>
                </div>
                <span class="bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider border border-emerald-100">
                    Active
                </span>
            </div>

            <div class="space-y-2.5 py-3.5 border-y border-slate-50">
                <div class="flex justify-between items-center">
                    <span class="text-[10px] text-slate-400 font-black uppercase tracking-widest">Mobile</span>
                    <span class="text-xs font-bold text-slate-700">${staff.mobile}</span>
                </div>
                <div class="flex justify-between items-center">
                    <span class="text-[10px] text-slate-400 font-black uppercase tracking-widest">Email</span>
                    <span class="text-xs font-bold text-slate-700 truncate max-w-[140px]" title="${staff.email}">${staff.email}</span>
                </div>
                <div class="flex flex-col pt-1">
                    <span class="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1">Address</span>
                    <span class="text-[13px] font-semibold text-slate-500 line-clamp-1 italic">${staff.address}</span>
                </div>
            </div>
        </div>

        <div class="mt-3">
            <div class="grid grid-cols-2 gap-2 mb-2">
                <button onclick="viewStaff(${staff.id})" class="flex items-center justify-center gap-2 py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl text-[9px] font-black uppercase transition-all active:scale-95">
                    <i class="fas fa-eye text-[10px]"></i> View
                </button>
                <button onclick="editStaff(${staff.id})" class="flex items-center justify-center gap-2 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-xl text-[9px] font-black uppercase transition-all active:scale-95">
                    <i class="fas fa-edit text-[10px]"></i> Edit
                </button>
            </div>
            <button onclick="removeStaff(${staff.id})" class="w-full py-2.5 border border-red-100 bg-white hover:bg-red-50 text-red-600 rounded-xl text-[9px] font-black uppercase active:scale-95 transition-all">
                Remove Staff Member
            </button>
        </div>
    </div>`;

    });
    updatePaginationInfo(start);
   
}

function updatePaginationInfo(start) {
    const end = Math.min(start + pageSize, staffRecords.length);
    const startRange = document.getElementById('startRange');
    const endRange = document.getElementById('endRange');
    const totalEntries = document.getElementById('totalEntries');

    if (startRange) startRange.innerText = staffRecords.length > 0 ? start + 1 : 0;
    if (endRange) endRange.innerText = end;
    if (totalEntries) totalEntries.innerText = staffRecords.length;

    document.getElementById('prevBtn').disabled = currentPage === 1;
    document.getElementById('nextBtn').disabled = currentPage * pageSize >= staffRecords.length;
    renderPageNumbers();
}

function renderPageNumbers() {
    const container = document.getElementById('pageIndicator');
    if (!container) return;
    container.innerHTML = '';
    
    createNavBtn("First", 1, currentPage === 1, container);
    
    let startPage = Math.max(1, currentPage - 1);
    let endPage = Math.min(totalPages, startPage + 2);
    if (endPage === totalPages) startPage = Math.max(1, endPage - 3);

    for (let i = startPage; i <= endPage; i++) {
        const btn = document.createElement('button');
        btn.innerText = i;
        const isActive = i === currentPage;
        btn.className = `w-9 h-9 rounded-xl text-xs font-bold transition-all ${isActive ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`;
        btn.onclick = () => { currentPage = i; renderRecords();   window.scrollTo(0, 0);};
        container.appendChild(btn);
    }
    createNavBtn("Last", totalPages, currentPage === totalPages, container);
}

function createNavBtn(label, page, disabled, container) {
    const btn = document.createElement('button');
    btn.innerText = label;
    btn.className = `px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-600 text-[10px] font-black uppercase transition-all ${disabled ? 'opacity-40 cursor-not-allowed' : 'active:scale-95 hover:bg-slate-50'}`;
    btn.onclick = () => { if(!disabled) { currentPage = page; renderRecords();   window.scrollTo(0, 0);} };
    container.appendChild(btn);
}

async function filterStaff() {
    const query = document.getElementById("staffSearch").value.trim();
    try {
        const response = await fetch("/search-staff", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query })
        });
        const data = await response.json();
        if (data.success) {
            staffRecords = data.staff_items.map(item => ({
                id: item.id,
                name: item.full_name,
                address: item.address,
                city: item.city,
                mobile: item.mob_number,
                gender: item.gender,
                email: item.email,
                dob: item.dob,
                joining: item.joining_date,
                staff_id:item.app_no
            }));
            currentPage = 1; 
            renderRecords(); 
        }
    } catch {
        showNotify("Search failed", "error");
    }
}

function viewStaff(id) {
    const staff = allStaffRecords.find(s => s.id === id);
    if (!staff) return;

    document.getElementById('view-avatar').innerText = staff.name.charAt(0);
    document.getElementById('view-name').innerText = staff.name;
    document.getElementById('view-mobile').innerText = staff.mobile;
    document.getElementById('view-email').innerText = staff.email;
    document.getElementById('view-gender').innerText = staff.gender;
    document.getElementById('view-city').innerText = staff.city;
    document.getElementById('view-address').innerText = staff.address;
    document.getElementById('view-dob').innerText = staff.dob;
    document.getElementById('view-joining').innerText = staff.joining;
    document.getElementById('view-staff-id').innerText = staff.staff_id;

    document.getElementById('viewStaffModal').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

function closeViewModal() {
    document.getElementById('viewStaffModal').classList.add('hidden');
    document.body.style.overflow = 'auto';
}

function editStaff(id) {
    const staff = allStaffRecords.find(s => s.id === id);
    if (!staff) return;

    document.getElementById('edit-staff-id').value = staff.id;
    document.getElementById('edit-name').value = staff.name;
    document.getElementById('edit-city').value = staff.city;
    document.getElementById('edit-mobile').value = staff.mobile;
    document.getElementById('edit-email').value = staff.email;
    document.getElementById('edit-address').value = staff.address;
    document.getElementById('edit-dob').value = staff.dob;
    document.getElementById('edit-joining').value = staff.joining;

    document.getElementById('editStaffModal').classList.remove('hidden');
}

document.getElementById('edit-staff-form').addEventListener('submit', async function (e) {
    e.preventDefault();
    const updatedData = {
        id: document.getElementById('edit-staff-id').value,
        full_name: document.getElementById('edit-name').value,
        city: document.getElementById('edit-city').value,
        mob_number: document.getElementById('edit-mobile').value,
        email: document.getElementById('edit-email').value,
        address: document.getElementById('edit-address').value,
        dob: document.getElementById('edit-dob').value,
        joining_date: document.getElementById('edit-joining').value
    };

    try {
        const response = await fetch("/update-staff-details", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(updatedData)
        });
        const result = await response.json();
        if (result.success) {
            showNotify(result.message, "success");
            closeEditModal();
            loadStaffData();
        }
    } catch (error) {
        showNotify(`Error: ${error.message}`, "error");
    }
});

function closeEditModal() {
    document.getElementById('editStaffModal').classList.add('hidden');
}

async function removeStaff(id) {
    if (!confirm("Permanently remove this staff member?")) return;
    try {
        const response = await fetch("/delete-staff-details", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id })
        });
        const result = await response.json();
        if (result.success) {
            allStaffRecords = allStaffRecords.filter(s => s.id !== id);
            staffRecords = staffRecords.filter(s => s.id !== id);
            showNotify(result.message, "success");
            renderRecords(); 
        }
    } catch {
        showNotify("Delete failed", "error");
    }
}

document.addEventListener('DOMContentLoaded', loadStaffData);