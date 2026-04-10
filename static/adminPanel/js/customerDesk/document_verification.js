let docRecords = []; 
let currentPage = 1;
let pageSize = getResponsivePageSize();
let currentZoom = 1;
let scoreInterval = null;

function getResponsivePageSize() {
    const width = window.innerWidth;
    if (width < 768) return 3;
    if (width < 1024) return 4;
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
                number: item.mobile_number,
                city: item.city,
                address: item.address,
                dob:  new Date(item.dob).toISOString().split('T')[0] ,
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

async function updateStatus(id, newStatus) {
    Loader.show()
    try {
        const response = await fetch("/update-verification-status", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
                user_id: id, 
                status: newStatus 
            })
        });

        const data = await response.json();

        if (data.success) {
            
            const index = docRecords.findIndex(r => r.id == id);
          
            if(index != -1) {
                docRecords[index].status = newStatus;
                console.log(data.message);
                if (typeof showNotify === "function") showNotify(data.message, "success");
                renderDocs();
            }
        } else {
            if (typeof showNotify === "function") showNotify(data.message, "error");
        }
    } catch (error) {
        if (typeof showNotify === "function") showNotify("Server communication failed", "error");
    }
    Loader.hide()
}

function renderDocs() {
    const container = document.getElementById('docContainer');
    if (!container) return;
    container.innerHTML = '';
    
    const start = (currentPage - 1) * pageSize;
    const currentData = docRecords.slice(start, start + pageSize);

    if (currentData.length === 0) {
        container.innerHTML = `<div class="col-span-full py-20 text-center text-slate-400 font-bold uppercase text-[10px] tracking-widest">No records found</div>`;
        return;
    }

     document.getElementById('pagination').classList.remove('hidden'); 
     
    currentData.forEach(item => {
        const statusKey = item.status.toLowerCase();
        const statusClass = statusKey === "approved" ? "bg-emerald-50 text-emerald-600" : 
                           (statusKey === "pending" ? "bg-amber-50 text-amber-600" : "bg-red-50 text-red-600");

        let actionContent = '';
        
        if (statusKey === 'pending') {
            actionContent = `
                <div class="grid grid-cols-2 gap-3 mt-6 animate__animated animate__fadeIn">
                    <button onclick="openCreditScoreModal(${item.id}, 'approved')" class="py-2.5 bg-emerald-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all shadow-md shadow-emerald-100">
                        <i class="fas fa-check mr-1"></i> Approve
                    </button>
                    <button onclick="openCreditScoreModal(${item.id}, 'rejected')" class="py-2.5 bg-red-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all shadow-md shadow-red-100">
                        <i class="fas fa-times mr-1"></i> Reject
                    </button>
                </div>`;
        } else {
            const finalColor = statusKey === 'approved' ? 'bg-emerald-500' : 'bg-red-500';
            const finalIcon = statusKey === 'approved' ? 'fa-check-circle' : 'fa-times-circle';
            
            actionContent = `
                <div class="mt-6 py-2.5 ${finalColor} text-white rounded-xl text-[10px] font-black uppercase tracking-[0.2em] text-center shadow-lg flex items-center justify-center gap-2">
                    <i class="fas ${finalIcon}"></i>
                    ${item.status}
                </div>`;
        }

        container.innerHTML += `
        <div class="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300 group">
         <div class="flex justify-between items-start mb-5">
            <div class="flex items-center space-x-4">
                <div class="w-12 h-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center font-black text-sm shadow-sm shrink-0">${item.name.charAt(0)}</div>
                <div>
                    <h4 class="text-base font-black text-slate-800 tracking-tight leading-none mb-1.5">${item.name}</h4>
                    <p class="text-[10px] text-slate-400 font-bold uppercase tracking-widest">CITY: ${item.city}</p>
                </div>
            </div>
            <span class="${statusClass} px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider border border-current/10">${item.status}</span>
        </div>

        <div class="grid grid-cols-1 gap-y-3 py-4 border-t border-slate-50 text-[12px]">
            <div class="flex justify-between items-center bg-blue-50/50 p-2 rounded-xl border border-blue-100/50 mb-1">
                <span class="text-blue-400 font-black uppercase tracking-tighter text-[8px]">Application ID:</span>
                <span class="font-mono font-black text-blue-700 bg-white px-2 py-0.5 rounded shadow-sm border border-blue-100">
                    ${item.app_no || 'VN-0000-00'}
                </span>
            </div>

            <div class="flex justify-between px-1"><span class="text-slate-400 font-black uppercase tracking-tighter">Mobile:</span><span class="font-bold text-slate-700">${item.number}</span></div>
            <div class="flex justify-between px-1"><span class="text-slate-400 font-black uppercase tracking-tighter">Email:</span><span class="font-bold text-slate-700 truncate max-w-[140px]">${item.email}</span></div>
            <div class="flex justify-between px-1"><span class="text-slate-400 font-black uppercase tracking-tighter">DOB:</span><span class="font-bold text-slate-700">${item.dob}</span></div>
            <div class="flex flex-col mt-1 px-1"><span class="text-slate-400 font-black uppercase mb-1 tracking-tighter">Address:</span><span class="font-bold text-slate-700 leading-relaxed italic line-clamp-2">${item.address}</span></div>
        </div>

        <div class="grid grid-cols-4 gap-2 pt-4 border-t border-slate-50">
            ${renderThumbnail(item.aadharImg, 'Aadhar Card', item.name, 'ID')}
            ${renderThumbnail(item.panImg, 'PAN Card', item.name, 'PAN')}
            ${renderThumbnail(item.passportImg, 'Passport Photo', item.name, 'PASS')}
            ${renderThumbnail(item.billImg, 'Light Bill', item.name, 'UTIL')}
        </div>
        ${actionContent}
    </div>`;
    });
    updatePaginationUI(start);
   
}


function renderThumbnail(img, type, name, label) {
    if(!img) return `<div class="aspect-square bg-slate-50 rounded-xl flex items-center justify-center opacity-30"><i class="fas fa-eye-slash text-[10px]"></i></div>`;
    return `
        <div class="space-y-1 text-center cursor-pointer group" onclick="openImageModal('${img}', '${type}', '${name}')">
            <p class="text-[7px] text-slate-400 font-black uppercase group-hover:text-blue-500">${label}</p>
            <div class="aspect-square bg-slate-100 rounded-xl overflow-hidden border border-slate-200 group-hover:border-blue-500 transition-all">
                <img src="${img}" class="w-full h-full object-cover opacity-70 group-hover:opacity-100">
            </div>
        </div>`;
}

function updatePaginationUI(start) {
    document.getElementById('startRange').innerText = start + 1;
    document.getElementById('endRange').innerText = Math.min(start + pageSize, docRecords.length);
    document.getElementById('totalEntries').innerText = docRecords.length;
    document.getElementById('prevBtn').disabled = currentPage === 1;
    document.getElementById('nextBtn').disabled = currentPage * pageSize >= docRecords.length;
    renderPageNumbers();
}

function renderPageNumbers() {
    const container = document.getElementById('pageIndicator');
    if (!container) return;
    const totalPages = Math.ceil(docRecords.length / pageSize);
    container.innerHTML = '';
    createNavBtn("First", 1, currentPage === 1, container);
    
    let start = Math.max(1, currentPage - 1);
    let end = Math.min(totalPages, start + 3);
    if (end === totalPages) start = Math.max(1, end - 3);

    for (let i = start; i <= end; i++) {
        if(i < 1) continue;
        const btn = document.createElement('button');
        btn.innerText = i;
        btn.className = `w-9 h-9 rounded-xl text-xs font-bold transition-all ${i === currentPage ? 'bg-blue-600 text-white shadow-lg' : 'bg-white border border-slate-200 text-slate-600'}`;
        btn.onclick = () => { currentPage = i; renderDocs();  window.scrollTo({ top: 0, behavior: 'smooth' }); };
        container.appendChild(btn);
    }
    createNavBtn("Last", totalPages, currentPage === totalPages, container);
}

function createNavBtn(label, page, active, container) {
    const btn = document.createElement('button');
    btn.innerText = label;
    btn.className = `px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-600 text-[10px] font-black uppercase transition-all ${active ? 'opacity-40 cursor-not-allowed' : 'active:scale-95'}`;
    btn.onclick = () => { if(!active) { currentPage = page; renderDocs();  window.scrollTo({ top: 0, behavior: 'smooth' });  } };
    container.appendChild(btn);
}

function openImageModal(imgUrl, type, name) {
    const modal = document.getElementById('imagePreviewModal');
    const img = document.getElementById('previewImg');
    const title = document.getElementById('modalImageTitle');
    img.src = imgUrl; 
    title.innerText = `${name} - ${type}`;
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

function changePage(dir) { 
    currentPage += dir; 
    renderDocs(); 
}

function filterDocs() {
    const val = document.getElementById("docSearch").value;
    currentPage = 1;
    loadVerificationData(val);
}



function animateGauge(val) {
    const needle = document.getElementById('needle');
    const label = document.getElementById('live_status_label');
    const numDisplay = document.getElementById('live_score_num');
    
    let targetScore = parseInt(val);
    if (isNaN(targetScore) || targetScore < 300) targetScore = 300;
    if (targetScore > 900) targetScore = 900;

    const rotation = ((targetScore - 300) / (900 - 300)) * 180 - 90;
    needle.style.transform = `rotate(${rotation}deg)`;

    let currentScore = parseInt(numDisplay.innerText) || 300;
    clearInterval(scoreInterval);
    scoreInterval = setInterval(() => {
        if (currentScore === targetScore) {
            clearInterval(scoreInterval);
        } else {
            const step = targetScore > currentScore ? 1 : -1;
            const diff = Math.abs(targetScore - currentScore);
            const speed = diff > 50 ? 5 : 1;
            currentScore += (step * speed);
            
            if ((step > 0 && currentScore > targetScore) || (step < 0 && currentScore < targetScore)) {
                currentScore = targetScore;
            }
            numDisplay.innerText = currentScore;
        }
    }, 10);

    if (targetScore < 580) {
        updateGaugeStatus(label, 'bg-red-500', 'text-white', 'BAD');
    } else if (targetScore < 670) {
        updateGaugeStatus(label, 'bg-amber-500', 'text-white', 'FAIR');
    } else if (targetScore < 740) {
        updateGaugeStatus(label, 'bg-yellow-400', 'text-slate-900', 'GOOD');
    } else if (targetScore < 820) {
        updateGaugeStatus(label, 'bg-green-300', 'text-green-900', 'VERY GOOD');
    } else {
        updateGaugeStatus(label, 'bg-emerald-500', 'text-white', 'EXCELLENT');
    }
}

function updateGaugeStatus(el, bg, text, status) {
    el.className = `text-[10px] font-black px-4 py-1 mt-2 rounded-full uppercase tracking-widest transition-all duration-500 ${bg} ${text}`;
    el.innerText = status;
}

function openCreditScoreModal(userId,newStatus) {
    const modal = document.getElementById('creditScoreModal');
    if (!modal) return;
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    document.getElementById('m_customer_id').innerText = userId;
    document.getElementById('verification_status').innerText = newStatus;

    
    setTimeout(() => animateGauge(300), 100);
}

function closeCreditScoreModal(id) {
    document.getElementById('creditScoreModal').classList.add('hidden');
    document.body.style.overflow = 'auto';
    
}


function NTC(){

    const userId = document.getElementById('m_customer_id').innerText;
    const newStatus = document.getElementById('verification_status').innerText;

    closeCreditScoreModal();
    updateStatus(userId, newStatus)
}

async function saveCreditScore() {

    let score = document.getElementById('input_credit_score').value;
    const userId = document.getElementById('m_customer_id').innerText;
    const newStatus = document.getElementById('verification_status').innerText;
    const context="profile"
    if (score < 300 || score > 900) {
        showNotify("Please enter a valid score (300-900)", "error");
        
        closeCreditScoreModal();

        setTimeout(() => openCreditScoreModal(userId), 3000);
    }
    else{
            try {
                const response = await fetch(`/customers/${context}/update-credit`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        credit_score: score,
                        userId:userId 
                    })
                });

                const result = await response.json();
                if (response.ok) {
                    
                    closeCreditScoreModal();

                    setTimeout(() => updateStatus(userId, newStatus), 300);

                } else {
                    showNotify(result.message, "error");
                    throw new Error(result.message);
                }
            } catch (error) {
            
                showNotify(error.message, "error");
            }
        }
      
}


document.addEventListener('DOMContentLoaded', () => loadVerificationData(""));