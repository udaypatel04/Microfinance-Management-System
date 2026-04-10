let allCustomerRecords = [];
let customerRecords = [];
let currentPage = 1;
let totalPages = 1;
let pageSize = getResponsivePageSize();

let currentZoom = 1;
let currentImageData = {};

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

function mapCustomerData(item) {
    return {
        id: item.id,
        name: item.full_name,
        email: item.email,
        mobile: item.mobile_number,
        gender: item.gender,
        dob: item.dob,
        email: item.email,
        city: item.city,
        address: item.address,
        aadhar_card_photo: item.aadhar_card_photo,
        pan_card_photo: item.pan_card_photo,
        passport_photo: item.passport_photo,
        light_bill_photo: item.light_bill_photo,
        app_no: item.app_no
    };
}

async function loadCustomerData() {
    try {
        const response = await fetch("/get-customer-list", {
            method: "POST",
            headers: { "Content-Type": "application/json" }
        });
        const data = await response.json();
       
        if (data.success) {
            allCustomerRecords = data.customer_items.map(mapCustomerData);
            customerRecords = [...allCustomerRecords];
            console.log(customerRecords)
            renderRecords();
        } else {
            showNotify(data.message, "error");
        }
    } catch (error) {
        showNotify("Connection Error: Failed to fetch records", "error");
    }
}

async function filterCustomers() {
    const query = document.getElementById("customerSearch").value.trim();
    try {
        const response = await fetch("/search-customers", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query })
        });
        const data = await response.json();
        if (data.success) {
            customerRecords = data.customer_items.map(mapCustomerData);
            currentPage = 1;
            
            renderRecords();
        }
    } catch (error) {
        showNotify("Search failed", "error");
    }
}



function renderRecords() {
    const container = document.getElementById('customerContainer');
    if (!container) return;

    totalPages = Math.ceil(customerRecords.length / pageSize);
    const start = (currentPage - 1) * pageSize;
    const currentData = customerRecords.slice(start, start + pageSize);

    container.innerHTML = '';

    if (currentData.length === 0) {
        container.innerHTML = `<div class="col-span-full py-20 text-center text-slate-400 font-bold uppercase text-[10px] tracking-widest">No matching customers found</div>`;
        return;
    }

   document.getElementById('pagination').classList.remove('hidden'); 

   currentData.forEach(customer => {
   container.innerHTML += `
    <div class="group relative bg-white rounded-[2.5rem] p-1 border border-slate-100 shadow-sm hover:shadow-2xl hover:shadow-emerald-500/10 transition-all duration-500 overflow-hidden">
        
        <div class="absolute -right-6 -bottom-6 text-slate-50 text-9xl transition-all duration-700 group-hover:text-emerald-50/40 group-hover:-rotate-12 pointer-events-none">
            <i class="fas fa-user-tie"></i>
        </div>

        <div class="relative p-6 space-y-6">
            <div class="flex items-center space-x-4">
                <div class="relative">
                    <div class="w-16 h-16 rounded-2xl bg-slate-900 flex items-center justify-center shadow-xl shadow-slate-200 group-hover:bg-emerald-600 transition-colors duration-500">
                        <span class="font-black text-2xl text-white tracking-tighter">
                            ${customer.name.charAt(0)}${customer.name.split(' ').length > 1 ? customer.name.split(' ')[1].charAt(0) : ''}
                        </span>
                    </div>
                    <div class="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 border-2 border-white rounded-full"></div>
                </div>
                <div>
                    <h4 class="font-black text-slate-800 text-base tracking-tight leading-tight">${customer.name}</h4>
                    <div class="flex items-center text-slate-400 space-x-1.5 mt-1">
                        <i class="fas fa-location-dot text-[8px]"></i>
                        <span class="text-[9px] font-bold uppercase tracking-widest">${customer.city}</span>
                    </div>
                </div>
            </div>

            <div class="grid grid-cols-1 gap-3 p-5 bg-slate-50/80 backdrop-blur-sm rounded-[2rem] border border-slate-100/50">
                
                <div class="flex items-center justify-between pb-2 border-b border-slate-200/50">
                    <span class="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em]">CUST ID</span>
                    <span class="font-mono text-[10px] font-black text-blue-600 bg-white px-2 py-0.5 rounded-lg border border-slate-200 shadow-sm">
                        ${customer.app_no || 'REF-000'}
                    </span>
                </div>

                <div class="flex items-center justify-between">
                    <span class="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em]">Contact</span>
                    <span class="text-xs font-black text-slate-700">${customer.mobile}</span>
                </div>
                
                <div class="flex items-center justify-between pt-2 border-t border-slate-200/50">
                    <span class="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em]">Email</span>
                    <span class="text-[11px] font-bold text-slate-700 truncate max-w-[150px]">${customer.email}</span>
                </div>

                <div class="pt-2 border-t border-slate-200/50">
                    <span class="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] block mb-1">Address</span>
                    <p class="text-[11px] font-bold text-slate-500 leading-relaxed line-clamp-1 italic">
                        ${customer.address}
                    </p>
                </div>
            </div>
            <div class="flex items-center gap-2">
                <button onclick="viewCustomer(${customer.id})" 
                    class="group/btn flex-1 h-12 bg-slate-900 text-white hover:bg-slate-800 rounded-2xl transition-all duration-300 active:scale-95 flex items-center justify-center gap-2 overflow-hidden px-2">
                    <i class="fas fa-fingerprint text-sm"></i> 
                    <span class="hidden group-hover/btn:block text-[9px] font-black uppercase tracking-widest animate__animated animate__fadeInLeft">Profile</span>
                </button>

                <button onclick="updateDocuments(${customer.id})" 
                    class="group/btn flex-1 h-12 bg-emerald-600 text-white hover:bg-emerald-700 rounded-2xl transition-all duration-300 active:scale-95 flex items-center justify-center gap-2 overflow-hidden px-2 shadow-lg shadow-emerald-100">
                    <i class="fas fa-file-shield text-sm"></i> 
                    <span class="hidden group-hover/btn:block text-[9px] font-black uppercase tracking-widest animate__animated animate__fadeInLeft">Docs</span>
                </button>

                <button onclick="editCustomer(${customer.id})" 
                    class="group/btn flex-1 h-12 bg-blue-600 text-white hover:bg-blue-700 rounded-2xl transition-all duration-300 active:scale-95 flex items-center justify-center gap-2 overflow-hidden px-2 shadow-lg shadow-blue-100">
                    <i class="fas fa-user-pen text-sm"></i>
                    <span class="hidden group-hover/btn:block text-[9px] font-black uppercase tracking-widest animate__animated animate__fadeInLeft">Edit</span>
                </button>
                
                <button onclick="deleteCustomer(${customer.id})" 
                    class="group/btn flex-1 h-12 bg-white border border-red-100 text-red-500 hover:bg-red-500 hover:text-white rounded-2xl transition-all duration-300 active:scale-95 flex items-center justify-center gap-2 overflow-hidden px-2 shadow-sm">
                    <i class="fas fa-trash-can text-sm"></i>
                    <span class="hidden group-hover/btn:block text-[9px] font-black uppercase tracking-widest animate__animated animate__fadeInLeft">Del</span>
                </button>
            </div>
        </div>
    </div>`;



});


    updatePaginationInfo(start);
   
}

function viewCustomer(id) {
    const customer = customerRecords.find(c => c.id === id);
    if (!customer) return;

    document.getElementById('view-avatar').innerText = customer.name.charAt(0);
    document.getElementById('view-name').innerText = customer.name;
    document.getElementById('view-mobile').innerText = customer.mobile;
    document.getElementById('view-email').innerText = customer.email;
    document.getElementById('view-gender').innerText = customer.gender;
    document.getElementById('view-city').innerText = customer.city;
    document.getElementById('view-address').innerText = customer.address;
    
    if (customer.dob) {
        const dateObj = new Date(customer.dob);
       
        const formattedDate = dateObj.toLocaleDateString('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        });
        document.getElementById('view-dob').innerText = formattedDate;
    } else {
        document.getElementById('view-dob').innerText = "N/A";
    }
    
    
    currentImageData = {
        'aadhar': { src: customer.aadhar_card_photo, title: "Aadhar Card - " + customer.name },
        'pan': { src: customer.pan_card_photo, title: "PAN Card - " + customer.name },
        'passport': { src: customer.passport_photo, title: "Passport - " + customer.name },
        'utility': { src: customer.light_bill_photo, title: "Utility Bill - " + customer.name }
    };

    document.getElementById('viewCustomerModal').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

function closeViewModal() {
    
    document.getElementById('viewCustomerModal').classList.add('hidden');
    
    
    document.body.style.overflow = 'auto';
}


function editCustomer(id) {
    const customer = customerRecords.find(c => c.id === id);
    if (!customer) return;

    document.getElementById('edit_customer_id').value = customer.id;
    document.getElementById('edit_name').value = customer.name;
    document.getElementById('edit_mobile').value = customer.mobile;
    document.getElementById('edit_email').value = customer.email;
    document.getElementById('edit_gender').value = customer.gender || 'Male';
    document.getElementById('edit_city').value = customer.city;
    document.getElementById('edit_address').value = customer.address;

    if (customer.dob) {
        const dateObj = new Date(customer.dob);
        const year = dateObj.getFullYear();
        const month = String(dateObj.getMonth() + 1).padStart(2, '0');
        const day = String(dateObj.getDate()).padStart(2, '0');
        document.getElementById('edit_dob').value = `${year}-${month}-${day}`;
    } else {
        document.getElementById('edit_dob').value = "";
    }

    document.getElementById('editCustomerModal').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

function closeEditModal() {
    document.getElementById('editCustomerModal').classList.add('hidden');
    document.body.style.overflow = 'auto';
}

async function updateCustomer(e) {
    e.preventDefault();
    const id = document.getElementById('edit_customer_id').value;
    const btn = document.getElementById('btn_save_customer');
    const originalText = btn.innerHTML;

    btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Updating...`;
    btn.disabled = true;

    const updatedData = {
        name: document.getElementById('edit_name').value,
        mobile: document.getElementById('edit_mobile').value,
        email: document.getElementById('edit_email').value,
        dob: document.getElementById('edit_dob').value,
        gender: document.getElementById('edit_gender').value,
        city: document.getElementById('edit_city').value,
        address: document.getElementById('edit_address').value
    };

    try {
        const response = await fetch(`/customers/${id}/update`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updatedData)
        });

        const result = await response.json();
        if (response.ok) {
            showNotify(result.message, "success");
            
            if (typeof loadCustomerData === "function") loadCustomerData()  
        } else {
            throw new Error(result.message || "Failed to update record");
        }
    } catch (error) {
        showNotify(error.message, "danger");
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
    closeEditModal();
}


function updateDocuments(id) {
    document.getElementById('doc_customer_id').value = id;
    document.getElementById('updateDocForm').reset();
    
    currentImageData = {};

    document.querySelectorAll('#updateDocForm .group').forEach(box => {
        box.classList.add('border-dashed', 'border-slate-100');
        box.classList.remove('border-solid', 'bg-blue-500/5', 'border-blue-500/50');
        
        const input = box.querySelector('input[type="file"]');
        const textLabel = box.querySelector('p');
        const previewIcon = box.querySelector('.preview-box');

        if (input) {
            input.classList.add('inset-0');
            input.classList.remove('top-0', 'left-0', 'w-full', 'h-2/3');
        }

        if (previewIcon) {
            const img = previewIcon.querySelector('img');
            if (img) img.remove();
            // Icon logic removed: We no longer force icon to 'block' because we never hid it.
        }

        if (textLabel && input) {
            const originalTitle = input.getAttribute('name').replace(/_/g, ' ').toUpperCase();
            textLabel.innerText = originalTitle;
        }
    });

    document.getElementById('updateDocModal').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

document.querySelectorAll('#updateDocForm input[type="file"]').forEach(input => {
      input.addEventListener('change', function() {
        if (this.files && this.files[0]) {
            const file = this.files[0];
            const name = this.getAttribute('name');
            const parentBox = this.closest('.group');
            const textLabel = parentBox.querySelector('p');

            const reader = new FileReader();
            reader.onload = function(e) {
                currentImageData[name] = {
                    src: e.target.result,
                    fileName: file.name,
                    title: name.replace(/_/g, ' ').toUpperCase()
                };

                input.classList.remove('inset-0');
                input.classList.add('top-0', 'left-0', 'w-full', 'h-2/3');
                parentBox.classList.remove('border-dashed', 'border-slate-100');
                parentBox.classList.add('border-solid', 'bg-blue-500/5', 'border-blue-500/50');
                
                if (textLabel) {
                    textLabel.innerHTML = `
                        <div class="flex flex-col items-center gap-2 animate__animated animate__fadeIn">
                            <span class="text-blue-500 font-black text-[9px] tracking-widest">UPLOADED</span>
                            <button type="button" onclick="openImageModal('${name}')" 
                                class="relative z-30 px-4 py-2 bg-blue-600 text-white text-[9px] font-black rounded-xl uppercase tracking-widest hover:bg-blue-700 transition-all shadow-lg active:scale-95">
                                <i class="fas fa-eye mr-1"></i> View
                            </button>
                        </div>
                    `;
                }
            };
            reader.readAsDataURL(file);
        }
    });
});


function closeDocModal() {
    document.getElementById('updateDocModal').classList.add('hidden');
    document.body.style.overflow = 'auto';
}



async function submitDocuments(e) {
    e.preventDefault();
    const id = document.getElementById('doc_customer_id').value;
    const btn = document.getElementById('btn_save_docs');
    const form = document.getElementById('updateDocForm');
    const formData = new FormData(form);

    btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Uploading...`;
    btn.disabled = true;

    try {
        const response = await fetch(`/customers/${id}/update-docs`, {
            method: 'POST',
            body: formData
        });

        const result = await response.json();
        if (response.ok) {
            showNotify(result.message, "success");
            closeDocModal();
            if (typeof loadCustomerData === "function") loadCustomerData();
        } else {
            throw new Error(result.message);
        }
    } catch (error) {
        showNotify(error.message, "error");
    } finally {
        btn.innerHTML = `Update Documents <i class="fas fa-cloud-arrow-up text-sm"></i>`;
        btn.disabled = false;
    }
}



function openImageModal(key) {
    const modal = document.getElementById('imagePreviewModal');
    const modalImg = document.getElementById('previewImg');
    const modalTitle = document.getElementById('modalImageTitle');

    if (currentImageData[key] && currentImageData[key].src) {
        modalImg.src = currentImageData[key].src;
        modalTitle.innerText = currentImageData[key].title;
        resetZoom();
        modal.classList.remove('hidden');
        modal.style.zIndex = "150"; 
    } else {
        showNotify("This document was not uploaded.", "error");
    }
}

function closeImageModal() {
    document.getElementById('imagePreviewModal').classList.add('hidden');
}

function applyZoom() {
    const wrapper = document.getElementById('zoomWrapper');
    const percentLabel = document.getElementById('zoomPercent');
    const container = wrapper.parentElement; 
    
    if (wrapper) {
        if (currentZoom > 1) {
            wrapper.style.transformOrigin = "top center";
            container.classList.remove('items-center');
            container.classList.add('items-start');
            wrapper.style.margin = "20px auto"; 
        } else {
            wrapper.style.transformOrigin = "center center";
            container.classList.add('items-center');
            container.classList.remove('items-start');
            wrapper.style.margin = "0";
        }
        wrapper.style.transform = `scale(${currentZoom})`;
    }
    if (percentLabel) percentLabel.innerText = Math.round(currentZoom * 100) + "%";
}

function adjustZoom(delta) {
    currentZoom = Math.min(Math.max(0.5, currentZoom + delta), 4);
    applyZoom();
}

function resetZoom() {
    currentZoom = 1;
    applyZoom();
}


function updatePaginationInfo(start) {
    const end = Math.min(start + pageSize, customerRecords.length);
    const startRange = document.getElementById('startRange');
    const endRange = document.getElementById('endRange');
    const totalEntries = document.getElementById('totalEntries');

    if (startRange) startRange.innerText = customerRecords.length > 0 ? start + 1 : 0;
    if (endRange) endRange.innerText = end;
    if (totalEntries) totalEntries.innerText = customerRecords.length;

    document.getElementById('prevBtn').disabled = (currentPage === 1);
    document.getElementById('nextBtn').disabled = (currentPage * pageSize >= customerRecords.length);
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
        if (i < 1) continue;
        const btn = document.createElement('button');
        btn.innerText = i;
        const isActive = i === currentPage;
        btn.className = `w-9 h-9 rounded-xl text-xs font-bold transition-all ${isActive ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-200' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`;
        btn.onclick = () => { currentPage = i; renderRecords();  window.scrollTo(0, 0); };
        container.appendChild(btn);
    }
    createNavBtn("Last", totalPages, currentPage === totalPages, container);
}

function createNavBtn(label, page, disabled, container) {
    const btn = document.createElement('button');
    btn.innerText = label;
    btn.className = `px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-600 text-[10px] font-black uppercase transition-all ${disabled ? 'opacity-40 cursor-not-allowed' : 'active:scale-95 hover:bg-slate-50'}`;
    btn.onclick = () => { if(!disabled) { currentPage = page; renderRecords();  window.scrollTo(0, 0);} };
    container.appendChild(btn);
}

function changePage(direction) {
    const newPage = currentPage + direction;
    if (newPage >= 1 && newPage <= totalPages) {
        currentPage = newPage;
        renderRecords();
    }
}

document.addEventListener('keydown', (e) => {
    if (e.key === "Escape") closeImageModal();
});



async function deleteCustomer(id) {
    if (!confirm("Are you sure you want to permanently delete this customer and all their documents?")) return;

    try {
        const response = await fetch("/delete-customer", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: id })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showNotify(result.message, "success");
            
           
            allCustomerRecords = allCustomerRecords.filter(c => c.id !== id);
            customerRecords = customerRecords.filter(c => c.id !== id);
            
            renderRecords();
        } else {
            showNotify(result.message, "error");
        }
    } catch (error) {
        showNotify("Error: Could not connect to server", "error");
    }
}

document.addEventListener('DOMContentLoaded', loadCustomerData);