let bikeRequests = []; 
let currentPage = 1;
let pageSize = getResponsivePageSize(); 
let searchTimer;

document.addEventListener('DOMContentLoaded', () => {
    fetchBikeRequests();
    const searchInput = document.getElementById('requestSearch');
    if (searchInput) searchInput.addEventListener('input', handleSearch);
    
    window.addEventListener('resize', () => {
        pageSize = getResponsivePageSize();
        renderRequests();
    });
});

function getResponsivePageSize() {
    const width = window.innerWidth;
    if (width < 768) return 3;
    if (width < 1280) return 4;
    return 6;
}

async function fetchBikeRequests(query = "") {
    try {
        const response = await fetch('/get-customer-bike-loans', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ q: query })
        });
        
        if (!response.ok) throw new Error('Network error');
        
        bikeRequests = await response.json();
        currentPage = 1;

        renderRequests();
    } catch (error) {
        console.error("Fetch error:", error);
        if(window.showNotify) showNotify("Failed to load bike loans", "error");
    }
}

function renderRequests() {
    const container = document.getElementById('requestContainer');
    if (!container) return;
    container.innerHTML = '';

    if (bikeRequests.length === 0) {
        container.innerHTML = `<div class="col-span-full py-20 text-center text-slate-400 font-bold uppercase tracking-widest">No requests found</div>`;
        updatePaginationInfo(0);
        return;
    }
    document.getElementById('pagination').classList.remove('hidden'); 
    
    const start = (currentPage - 1) * pageSize;
    const end = Math.min(start + pageSize, bikeRequests.length);
    
    bikeRequests.slice(start, end).forEach(req => {
        container.innerHTML += createRequestCard(req);
    });

    updatePaginationInfo(start);
}

const createRequestCard = (req) => {
    const statusColor = req.status === 'approved' ? 'emerald' : req.status === 'rejected' ? 'rose' : 'amber';
    
    return `
    <div class="relative bg-white rounded-[2.2rem] border border-slate-100 p-1 shadow-sm hover:shadow-2xl transition-all duration-700 group animate__animated animate__fadeInUp overflow-hidden">
        <div class="absolute inset-0 flex items-center justify-center opacity-[0.02] group-hover:opacity-[0.05] transition-all duration-1000 pointer-events-none">
            <i class="fas fa-motorcycle text-[180px] -rotate-12 group-hover:rotate-0 transition-all duration-1000 text-slate-900"></i>
        </div>
        
        <div class="absolute top-4 right-6 flex items-center gap-1.5 z-20">
            <div class="w-1.5 h-1.5 bg-${statusColor}-500 rounded-full group-hover:animate-pulse"></div>
            <span class="text-[8px] font-black text-slate-400 uppercase tracking-widest">${req.status}</span>
        </div>

        <div class="p-5 relative z-10">
            <div class="flex items-start gap-3 mb-5">
                <div class="w-12 h-12 rounded-2xl bg-slate-900 text-indigo-400 flex items-center justify-center shadow-lg group-hover:bg-indigo-600 group-hover:text-white transition-all duration-500 shrink-0">
                    <i class="fas fa-motorcycle text-lg"></i>
                </div>
                <div class="overflow-hidden w-full">
                    <div class="flex flex-col">
                        <span class="text-[12px] font-black text-indigo-500 uppercase tracking-widest mb-1">
                            ${req.app_no || 'ID PENDING'}
                        </span>
                        <h3 class="text-[12px] font-black text-slate-800 tracking-tight leading-none truncate">${req.bike_name || 'Bike Loan'}</h3>
                        <p class="text-[10px] font-bold text-slate-400 mt-1.5 uppercase tracking-tighter">Applied: ${req.apply_date}</p>
                    </div>
                </div>
            </div>

            <div class="space-y-2 mb-5">
                <div class="grid grid-cols-2 gap-2">
                    <div class="flex items-center justify-between p-2.5 bg-slate-50/50 rounded-xl border border-slate-100">
                        <i class="fas fa-tag text-[8px] text-slate-300"></i>
                        <span class="text-[10px] font-black text-slate-700">${req.bike_condition || 'N/A'}</span>
                    </div>
                    <div class="flex items-center justify-between p-2.5 bg-slate-50/50 rounded-xl border border-slate-100">
                        <i class="fas fa-calendar-alt text-[8px] text-indigo-400"></i>
                        <span class="text-[10px] font-black text-slate-700">${req.expected_month}M</span>
                    </div>
                </div>

                <div class="flex items-center justify-between p-3 bg-slate-900 rounded-xl shadow-lg">
                    <span class="text-[9px] font-black text-slate-400 uppercase tracking-widest">Principal</span>
                    <span class="text-sm font-black text-white tracking-tight">₹${Number(req.loan_amount).toLocaleString('en-IN')}</span>
                </div>
            </div>

            <button onclick="openModal(${req.id})" class="w-full py-3 bg-indigo-50 text-indigo-600 rounded-xl text-[9px] font-black uppercase tracking-[0.2em] hover:bg-slate-900 hover:text-white transition-all duration-300 active:scale-95">
                Track Application
            </button>
        </div>
    </div>`;
};

function updatePaginationInfo(start) {
    const total = bikeRequests.length;
    const end = Math.min(start + pageSize, total);
    const totalPages = Math.ceil(total / pageSize);
    
    const startRange = document.getElementById('startRange');
    const endRange = document.getElementById('endRange');
    const totalEntries = document.getElementById('totalEntries');

    if (startRange) startRange.innerText = total > 0 ? start + 1 : 0;
    if (endRange) endRange.innerText = end;
    if (totalEntries) totalEntries.innerText = total;

    document.getElementById('prevBtn').disabled = currentPage === 1;
    document.getElementById('nextBtn').disabled = currentPage * pageSize >= total || total === 0;
    renderPageNumbers(totalPages);
}

function renderPageNumbers(totalPages) {
    const container = document.getElementById('pageIndicator');
    if (!container) return;
    container.innerHTML = '';
    
    createNavBtn("First", 1, currentPage === 1, container);
    
    let startPage = Math.max(1, currentPage - 1);
    let endPage = Math.min(totalPages, startPage + 2);
    
    if (endPage === totalPages) startPage = Math.max(1, endPage - 2);
    
    for (let i = startPage; i <= endPage; i++) {
        if(i < 1) continue;
        const btn = document.createElement('button');
        btn.innerText = i;
        const isActive = i === currentPage;
        btn.className = `w-9 h-9 rounded-xl text-xs font-bold transition-all ${isActive ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`;
        btn.onclick = () => { currentPage = i; renderRequests(); window.scrollTo(0, 0); };
        container.appendChild(btn);
    }
    
    createNavBtn("Last", totalPages, (currentPage === totalPages || totalPages === 0), container);
}

function createNavBtn(label, page, disabled, container) {
    const btn = document.createElement('button');
    btn.innerText = label;
    btn.className = `px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-600 text-[10px] font-black uppercase transition-all ${disabled ? 'opacity-40 cursor-not-allowed' : 'active:scale-95 hover:bg-slate-50'}`;
    btn.onclick = () => { if(!disabled) { currentPage = page; renderRequests(); window.scrollTo(0, 0); } };
    container.appendChild(btn);
}

function changePage(step) {
    const totalPages = Math.ceil(bikeRequests.length / pageSize);
    const nextStep = currentPage + step;
    if (nextStep >= 1 && nextStep <= totalPages) {
        currentPage = nextStep;
        renderRequests();
        window.scrollTo(0, 0);
    }
}

function handleSearch(e) {
    const query = e.target.value;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => fetchBikeRequests(query), 400);
}

function openModal(id) {
    const req = bikeRequests.find(r => r.id === id);
    if (!req) return;

    const banner = document.getElementById('m_status_banner');
    const withdrawBtn = document.getElementById('btn_withdraw');
    const rescheduleBtn = document.getElementById('btn_reschedule');

    if (req.status === 'pending') {
        banner.classList.remove('hidden');
        withdrawBtn.classList.remove('hidden');
        withdrawBtn.setAttribute('data-id', req.id);

        rescheduleBtn.classList.remove('hidden');
        rescheduleBtn.setAttribute('data-id', req.id);
        
        document.getElementById('m_status_icon').className = "fas fa-clock text-amber-500 text-2xl";
        document.getElementById('m_status_title').innerText = "Under Review";
        document.getElementById('m_status_desc').innerText = "Our underwriting team is verifying your credit and documents.";
        banner.className = "p-4 rounded-[1.5rem] flex items-center gap-5 border border-amber-100 bg-amber-50/50 transition-all";
    } else {
        banner.classList.add('hidden');
        withdrawBtn.classList.add('hidden');
        rescheduleBtn.classList.add('hidden');
    }

    document.getElementById('m_app_no').innerText = req.app_no || 'PENDING';
    document.getElementById('m_apply_date').innerText = req.apply_date || '---';

    const principal = Number(req.loan_amount || 0);
    const months = Number(req.expected_month || 0);
    const fee = Number(req.processing_fee || 1180);
    
    document.getElementById('m_price').innerText = '₹' + Number(req.bike_price || 0).toLocaleString('en-IN');
    document.getElementById('m_condition').innerText = req.bike_condition || 'N/A';
    document.getElementById('m_dp').innerText = '₹' + Number(req.down_payment || 0).toLocaleString('en-IN');
    document.getElementById('m_roi').innerText = (req.interest_rate || 0) + '%';
    document.getElementById('m_tenure').innerText = months + ' Months';

    document.getElementById('m_principal').innerText = '₹' + principal.toLocaleString('en-IN');
    document.getElementById('m_processing').innerText = '- ₹' + fee.toLocaleString('en-IN');
    document.getElementById('m_payout').innerText = '₹' + (principal - fee).toLocaleString('en-IN');

    const emi = Number(req.loan_emi || 0);
    const totalRepay = emi * months;
    const totalInterest = totalRepay - principal;

    document.getElementById('m_emi').innerText = '₹' + emi.toLocaleString('en-IN');
    document.getElementById('m_repay_calc').innerText = `₹${emi.toLocaleString('en-IN')} × ${months} Months`;
    document.getElementById('m_total_interest').innerText = '+ ₹' + (totalInterest > 0 ? totalInterest : 0).toLocaleString('en-IN');
    document.getElementById('m_total_repayment').innerText = '₹' + totalRepay.toLocaleString('en-IN');

   if (req.status === 'withdrawn') {
    document.getElementById('m_app_date').innerText = 'Cancelled';
    document.getElementById('m_app_time').innerText = '--:--';
    document.getElementById('m_desc').innerText = "Application withdrawn by customer.";
    
    // Optional: Visual cue to show the date is inactive
    document.getElementById('m_app_date').classList.add('text-slate-400');
    } else {
    document.getElementById('m_app_date').innerText = req.appointment_date || 'TBD';
    document.getElementById('m_app_time').innerText = req.appointment_time || '--:--';
    document.getElementById('m_desc').innerText = req.description || "Credit score review in progress.";
    
    // Reset color for active states
    document.getElementById('m_app_date').classList.remove('text-slate-400');
    }

    document.getElementById('detailsModal').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

function closeModal() {
    document.getElementById('detailsModal').classList.add('hidden');
    document.body.style.overflow = 'auto';
}

async function withdrawApplication() {
    const id = document.getElementById('btn_withdraw').getAttribute('data-id');
    if (!confirm("Are you sure you want to withdraw this bike loan request?")) return;
    closeModal();
    Loader.show();
    try {
        const response = await fetch(`/cancel-bike-loan-request/${id}`, { method: 'POST' });
        const result = await response.json();
        if (result.success) {
            fetchBikeRequests();
            if(window.showNotify) showNotify("Application Withdrawn Successfully", "success");
        }
    } catch (e) { console.error(e); }
    Loader.hide();
}




function openRescheduleInterface() {
    const loanId = document.getElementById('btn_reschedule').getAttribute('data-id');
    document.getElementById('reschedule_loan_id').value = loanId;
    document.getElementById('rescheduleModal').classList.remove('hidden');
}

function closeRescheduleModal() {
    document.getElementById('rescheduleModal').classList.add('hidden');
}


async function submitReschedule() {
    const id = document.getElementById('reschedule_loan_id').value;
    const date = document.getElementById('new_appt_date').value;
    const time = document.getElementById('new_appt_time').value;

    if (!date || !time) {
        if(window.showNotify) showNotify("Please select both date and time", "error");
        return;
    }
   closeModal(); 
   Loader.show();
    try {
        const response = await fetch(`/reschedule-bike-loan/${id}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ date: date, time: time })
        });
        const result = await response.json();

        if (result.success) {
            closeRescheduleModal();
            fetchBikeRequests(); 
            if(window.showNotify) showNotify("Appointment Rescheduled Successfully", "success");
        } else {
            if(window.showNotify) showNotify(result.message, "error");
        }
    } catch (e) {
        console.error(e);
    }
   Loader.hide();
}