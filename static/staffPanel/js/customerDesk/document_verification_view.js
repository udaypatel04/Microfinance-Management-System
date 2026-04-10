let docRecords = []; 
let currentPage = 1;
let currentZoom = 1;
const pageSize = getResponsivePageSize();

function getResponsivePageSize() {
    const width = window.innerWidth;
    if (width < 768) return 3;
    if (width < 1280) return 4;
    return 6;
}

async function loadVerificationData(query="") {
    try {
        const response = await fetch("/get-document-verification-status", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ q: query })
        });
        const data = await response.json();

        if (data.success) {
            docRecords = data.customer_items.map(item => ({
                id: item.id,
                name: item.full_name,
                email: item.email,
                mobile: item.mobile_number,
                city: item.city,
                address: item.address,
                dob: new Date(item.dob).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
                status: item.status || 'Pending',
                aadharImg: item.aadhar_card_photo,
                panImg: item.pan_card_photo,
                passportImg: item.passport_photo,
                billImg: item.light_bill_photo,
                app_no:item.app_no
            }));
            renderDocs();
        }else{
            docRecords=[];
            renderDocs();
        }

    } catch (error) {
        if (typeof showNotify === "function") showNotify("Failed to load records", "error");
    }
}

function renderDocs(dataToRender = docRecords) {
    const container = document.getElementById('docContainer');
    if (!container) return;
    
    container.innerHTML = '';
    const start = (currentPage - 1) * pageSize;
    const paginatedData = dataToRender.slice(start, start + pageSize);

    if (paginatedData.length === 0) {
        container.innerHTML = `<div class="col-span-full py-20 text-center text-slate-400 font-black uppercase text-[10px] tracking-widest">No matching records found</div>`;
        return;
    }

    document.getElementById('pagination').classList.remove('hidden'); 

    paginatedData.forEach(item => {
        const statusKey = item.status.toLowerCase();
        const statusConfig = {
            'approved': {
                badgeClass: 'bg-emerald-50 text-emerald-600 border-emerald-100',
                footerClass: 'bg-emerald-500 text-white shadow-emerald-100',
                icon: 'fa-circle-check',
                label: 'Approved'
            },
            'rejected': {
                badgeClass: 'bg-red-50 text-red-600 border-red-100',
                footerClass: 'bg-red-500 text-white shadow-red-100',
                icon: 'fa-circle-xmark',
                label: 'Rejected'
            },
            'pending': {
                badgeClass: 'bg-amber-50 text-amber-600 border-amber-100',
                footerClass: 'bg-amber-400 text-white shadow-amber-100',
                icon: 'fa-clock',
                label: 'Pending'
            }
        };

        const config = statusConfig[statusKey] || statusConfig['pending'];

  container.innerHTML += `
    <div class="bg-white p-5 rounded-[2.2rem] border border-slate-100 shadow-sm hover:shadow-xl transition-all duration-500 flex flex-col justify-between h-full group">
        <div>
            <div class="flex justify-between items-start mb-4">
                <div class="flex items-center space-x-3">
                    <div class="w-12 h-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center font-black text-sm group-hover:bg-blue-600 transition-colors duration-500 shadow-lg shadow-slate-200 shrink-0">
                        ${item.name.charAt(0)}
                    </div>
                    <div class="overflow-hidden">
                        <h4 class="text-sm font-black text-slate-800 tracking-tight leading-none mb-1 truncate">${item.name}</h4>
                        <p class="text-[9px] text-slate-400 font-bold uppercase tracking-widest truncate">${item.city}</p>
                    </div>
                </div>
                <span class="${config.badgeClass} border-2 px-2.5 py-1 rounded-xl text-[7px] font-black uppercase tracking-widest flex items-center gap-1.5 shrink-0 shadow-sm">
                    <i class="fas ${config.icon} text-[8px]"></i>
                    ${item.status}
                </span>
            </div>

            <div class="grid grid-cols-1 gap-y-2 py-3 border-y border-slate-50 text-[12px]">
                
                <div class="flex justify-between items-center mb-0.5">
                    <span class="text-slate-400 font-black uppercase tracking-tighter text-[11px]">Application ID</span>
                    <span class="font-mono  font-black text-blue-600 bg-blue-50/50 px-1.5 py-0.5 rounded border border-blue-100 uppercase">
                        ${item.app_no || 'VN-000'}
                    </span>
                </div>

                <div class="flex justify-between"><span class="text-slate-400 font-black uppercase tracking-tighter ">Mobile:</span><span class="font-bold text-slate-700 ">${item.mobile}</span></div>
                <div class="flex justify-between"><span class="text-slate-400 font-black uppercase tracking-tighter ">Email:</span><span class="font-bold text-slate-700  truncate max-w-[140px]">${item.email}</span></div>
                <div class="flex justify-between"><span class="text-slate-400 font-black uppercase tracking-tighter ">DOB:</span><span class="font-bold text-slate-700 ">${item.dob}</span></div>
                
                <div class="flex flex-col pt-1">
                    <span class="text-slate-400 font-black  uppercase tracking-tighter mb-0.5">Address:</span>
                    <span class="font-bold text-slate-700  leading-tight italic line-clamp-1">${item.address}</span>
                </div>
            </div>

            <div class="grid grid-cols-4 gap-2 pt-4">
                ${renderThumbnail(item.aadharImg, 'Aadhar', item.name, 'ID')}
                ${renderThumbnail(item.panImg, 'PAN', item.name, 'PAN')}
                ${renderThumbnail(item.passportImg, 'Passport', item.name, 'PASS')}
                ${renderThumbnail(item.billImg, 'Utility', item.name, 'UTIL')}
            </div>
        </div>

        <div class="pt-3 mt-4">
            <div class="flex items-center justify-center gap-2 w-full py-3 ${config.footerClass} rounded-2xl text-[9px] font-black uppercase tracking-[0.2em] shadow-lg transition-all duration-300 active:scale-95">
                <i class="fas ${config.icon} text-[10px]"></i>
                ${config.label}
            </div>
        </div>
    </div>`;
    });

    updatePaginationUI(dataToRender.length, start);
}

function renderThumbnail(img, type, name, label) {
    if(!img) return `<div class="aspect-square bg-slate-50 rounded-xl flex items-center justify-center opacity-30"><i class="fas fa-eye-slash text-[10px]"></i></div>`;
    return `
        <div class="space-y-1 text-center cursor-pointer group" onclick="openImageModal('${img}', '${type}', '${name}')">
            <p class="text-[7px] text-slate-400 font-black uppercase group-hover:text-emerald-600">${label}</p>
            <div class="aspect-square bg-slate-50 rounded-xl overflow-hidden border border-slate-100 group-hover:border-emerald-500 transition-all">
                <img src="${img}" class="w-full h-full object-cover opacity-70 group-hover:opacity-100">
            </div>
        </div>`;
}

function updatePaginationUI(totalItems, start) {
    const totalPages = Math.ceil(totalItems / pageSize);
    document.getElementById('startRange').innerText = totalItems > 0 ? start + 1 : 0;
    document.getElementById('endRange').innerText = Math.min(start + pageSize, totalItems);
    document.getElementById('totalEntries').innerText = totalItems;
    
    document.getElementById('prevBtn').disabled = currentPage === 1;
    document.getElementById('nextBtn').disabled = currentPage === totalPages || totalPages === 0;
    
    renderPageNumbers(totalPages);
}

function renderPageNumbers(totalPages) {
    const container = document.getElementById('pageIndicator');
    if (!container) return;
    container.innerHTML = '';
    
    createNavBtn("First", 1, currentPage === 1, container);
    
    let start = Math.max(1, currentPage - 1);
    let end = Math.min(totalPages, start + 2);
    if (end === totalPages) start = Math.max(1, end - 2);
    
    for (let i = start; i <= end; i++) {
        if(i < 1) continue;
        const btn = document.createElement('button');
        btn.innerText = i;
        btn.className = `w-9 h-9 rounded-xl text-xs font-bold transition-all ${i === currentPage ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-200' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`;
        btn.onclick = () => { currentPage = i; updateView(); };
        container.appendChild(btn);
    }
    
    createNavBtn("Last", totalPages, currentPage === totalPages || totalPages === 0, container);
}

function createNavBtn(label, page, disabled, container) {
    const btn = document.createElement('button');
    btn.innerText = label;
    btn.className = `px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-600 text-[10px] font-black uppercase transition-all ${disabled ? 'opacity-40 cursor-not-allowed' : 'active:scale-95 hover:bg-slate-50'}`;
    btn.onclick = () => { if(!disabled) { currentPage = page; updateView(); } };
    container.appendChild(btn);
}

function updateView() {
    renderDocs();
    window.scrollTo(0, 0); 
}

function changePage(dir) {
    const totalPages = Math.ceil(docRecords.length / pageSize);
    const nextStep = currentPage + dir;
    if(nextStep >= 1 && nextStep <= totalPages) {
        currentPage = nextStep;
        updateView();
    }
}

function filterDocs() {
    const val = document.getElementById("docSearch").value;
    currentPage = 1;
    loadVerificationData(val);
}


function openImageModal(imgUrl, type, name) {
    const modal = document.getElementById('imagePreviewModal');
    const img = document.getElementById('previewImg');
    const title = document.getElementById('modalImageTitle');
    
    img.src = imgUrl; 
    title.innerText = `${name} | ${type}`;
    
    resetZoom(); 
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden'; 
}

function closeImageModal() {
    document.getElementById('imagePreviewModal').classList.add('hidden');
    document.body.style.overflow = 'auto';
}

function applyZoom() {
    const wrapper = document.getElementById('zoomWrapper');
    const percentLabel = document.getElementById('zoomPercent');
    const container = wrapper.parentElement; 
    
    if (wrapper) {
        if (currentZoom > 1) {
            wrapper.style.transformOrigin = "top center";
            container.classList.replace('items-center', 'items-start');
            wrapper.style.margin = "20px auto"; 
        } else {
            wrapper.style.transformOrigin = "center center";
            container.classList.replace('items-start', 'items-center');
            wrapper.style.margin = "0";
        }
        wrapper.style.transform = `scale(${currentZoom})`;
    }
    if (percentLabel) percentLabel.innerText = Math.round(currentZoom * 100) + "%";
}

function adjustZoom(delta) {
    currentZoom = Math.min(Math.max(0.5, currentZoom + delta), 3);
    applyZoom();
}

function resetZoom() {
    currentZoom = 1;
    applyZoom();
}

document.addEventListener('keydown', (e) => {
    if (e.key === "Escape") closeImageModal();
});


document.addEventListener('DOMContentLoaded', () => loadVerificationData(""));