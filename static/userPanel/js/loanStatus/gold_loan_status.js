let loanRequests = []; 
let currentPage = 1;
const pageSize = getResponsivePageSize(); 
let searchTimer;

function getResponsivePageSize() {
    const width = window.innerWidth;
    if (width < 768) return 3;
    if (width < 1280) return 4;
    return 6;
}

const createRequestCard = (req) => {
    const statusColor = req.status === 'approved' ? 'emerald' : req.status === 'rejected' ? 'rose' : 'amber';
    
    return `
    <div class="relative bg-white rounded-[2.2rem] border border-slate-100 p-1 shadow-sm hover:shadow-2xl transition-all duration-700 group animate__animated animate__fadeInUp overflow-hidden">
        <div class="absolute inset-0 flex items-center justify-center opacity-[0.02] group-hover:opacity-[0.05] transition-all duration-1000 pointer-events-none">
            <i class="fas fa-coins text-[180px] -rotate-12 group-hover:rotate-0 transition-all duration-1000 text-slate-900"></i>
        </div>
        
        <div class="absolute top-4 right-6 flex items-center gap-1.5 z-20">
            <div class="w-1.5 h-1.5 bg-${statusColor}-500 rounded-full group-hover:animate-pulse"></div>
            <span class="text-[8px] font-black text-slate-400 uppercase tracking-widest">${req.status}</span>
        </div>

        <div class="p-5 relative z-10">
            <div class="flex items-start gap-3 mb-5">
                <div class="w-12 h-12 rounded-2xl bg-slate-900 text-amber-400 flex items-center justify-center shadow-lg group-hover:bg-indigo-600 group-hover:text-white transition-all duration-500 shrink-0">
                    <i class="fas fa-gem text-lg"></i>
                </div>
                <div class="overflow-hidden w-full">
                    <div class="flex flex-col">
                        <span class="text-[12px] font-black text-indigo-500 uppercase tracking-widest mb-1">
                            ${req.app_no || 'ID PENDING'}
                        </span>
                        <h3 class="text-[10px] font-black text-slate-800 tracking-tight leading-none truncate">Gold Loan</h3>
                        <p class="text-[9px] font-bold text-slate-400 mt-1.5 uppercase tracking-tighter">Applied: ${req.apply_date}</p>
                    </div>
                </div>
            </div>

            <div class="space-y-2 mb-5">
                <div class="grid grid-cols-2 gap-2">
                    <div class="flex items-center justify-between p-2.5 bg-slate-50/50 rounded-xl border border-slate-100">
                        <i class="fas fa-weight-hanging text-[8px] text-slate-300"></i>
                        <span class="text-[10px] font-black text-slate-700">${req.gold_weight}g</span>
                    </div>
                    <div class="flex items-center justify-between p-2.5 bg-slate-50/50 rounded-xl border border-slate-100">
                        <i class="fas fa-certificate text-[8px] text-amber-500"></i>
                        <span class="text-[10px] font-black text-slate-700">${req.gold_purity}K</span>
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

async function fetchRequestsFromServer(query = "") {
    try {
        const response = await fetch('/get-customer-gold-loans', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ q: query })
        });
        if (!response.ok) throw new Error('Network error');
        loanRequests = await response.json();
        if(query !== "") currentPage = 1;

       

        renderRequests(loanRequests);
    } catch (error) {
        console.error(error);
    }
}

function renderRequests(data) {
    const container = document.getElementById('requestContainer');
    if (!container) return;
    container.innerHTML = '';
    if (data.length === 0) {
        container.innerHTML = `<div class="col-span-full py-20 text-center text-slate-400 font-bold uppercase tracking-widest">No requests found</div>`;
        updatePaginationInfo(0);
        return;
    }
    document.getElementById('pagination').classList.remove('hidden');
    
    const start = (currentPage - 1) * pageSize;
    const end = Math.min(start + pageSize, data.length);
    data.slice(start, end).forEach(req => container.innerHTML += createRequestCard(req));
    updatePaginationInfo(start);
}

function updatePaginationInfo(start) {
    const total = loanRequests.length;
    const end = Math.min(start + pageSize, total);
    const totalPages = Math.ceil(total / pageSize);
    const startRange = document.getElementById('startRange');
    const endRange = document.getElementById('endRange');
    const totalEntries = document.getElementById('totalEntries');

    if (startRange) startRange.innerText = total > 0 ? start + 1 : 0;
    if (endRange) endRange.innerText = end;
    if (totalEntries) totalEntries.innerText = total;

    document.getElementById('prevBtn').disabled = currentPage === 1;
    document.getElementById('nextBtn').disabled = currentPage * pageSize >= total;
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
        btn.onclick = () => { currentPage = i; renderRequests(loanRequests); window.scrollTo(0, 0); };
        container.appendChild(btn);
    }
    
    createNavBtn("Last", totalPages, (currentPage === totalPages || totalPages === 0), container);
}

function createNavBtn(label, page, disabled, container) {
    const btn = document.createElement('button');
    btn.innerText = label;
    btn.className = `px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-600 text-[10px] font-black uppercase transition-all ${disabled ? 'opacity-40 cursor-not-allowed' : 'active:scale-95 hover:bg-slate-50'}`;
    btn.onclick = () => { if(!disabled) { currentPage = page; renderRequests(loanRequests); window.scrollTo(0, 0); } };
    container.appendChild(btn);
}

function changePage(step) {
    const total = loanRequests.length;
    const newPage = currentPage + step;
    const totalPages = Math.ceil(total / pageSize);
    if (newPage >= 1 && newPage <= totalPages) {
        currentPage = newPage;
        renderRequests(loanRequests);
        window.scrollTo(0, 0);
    }
}

function openModal(id) {
    const req = loanRequests.find(r => r.id === id);
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
        document.getElementById('m_status_title').innerText = "Appraisal Pending";
        document.getElementById('m_status_desc').innerText = "Please bring your gold ornaments to the branch on your appointment date.";
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
    
    document.getElementById('m_est_val').innerText = '₹' + Number(req.estimated_amount || 0).toLocaleString('en-IN');
    document.getElementById('m_purity').innerText = (req.gold_purity || '--') + ' K';
    document.getElementById('m_weight').innerText = Number(req.gold_weight || 0).toFixed(3) + ' g';
    document.getElementById('m_roi').innerText = (req.interest_rate || 0) + '%';
    document.getElementById('m_tenure').innerText = months + ' Months';

   
    const fee = Number(req.processing_fee || 0);
    const payout = principal - fee;

    document.getElementById('m_principal').innerText = '₹' + principal.toLocaleString('en-IN');
    document.getElementById('m_processing').innerText = '- ₹' + fee.toLocaleString('en-IN');
    document.getElementById('m_payout').innerText = '₹' + payout.toLocaleString('en-IN');

   
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
    document.getElementById('m_desc').innerText = "This application has been withdrawn by the customer.";
    
  
    document.getElementById('m_app_date').classList.add('text-slate-400');
   } else {
    document.getElementById('m_app_date').innerText = req.appointment_date || 'To Be Decided';
    document.getElementById('m_app_time').innerText = req.appointment_time || '--:--';
    document.getElementById('m_desc').innerText = req.description || "Under appraisal review.";
    
   
    document.getElementById('m_app_date').classList.remove('text-slate-400');
   
    }

    
    document.getElementById('detailsModal').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}



async function withdrawApplication() {
    const btn = document.getElementById('btn_withdraw');
    const id = btn.getAttribute('data-id');

    if (!confirm("Are you sure you want to withdraw this loan application?")) return;
    Loader.show();
    try {
        const response = await fetch(`/cancel-gold-loan-request/${id}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });

        if (response.ok) {
            closeModal();
            fetchRequestsFromServer();
            showNotify("Application Withdrawn Successfully", "success");

        } else {
            const result = await response.json();
            showNotify(result.message, "error");
        }
    } catch (error) {
        console.error("Error withdrawing:", error);
        showNotify("Connection error occurred", "error");
    }
    Loader.hide();
}


function updateStatusBanner(status, customDesc) {
    const banner = document.getElementById('m_status_banner');
    const icon = document.getElementById('m_status_icon');
    const title = document.getElementById('m_status_title');
    const desc = document.getElementById('m_status_desc');

    banner.classList.remove('animate__fadeIn');
    void banner.offsetWidth; 
    banner.classList.add('animate__fadeIn');

    if (status === 'approved') {
        banner.className = "p-2.5 rounded-xl flex items-center gap-3 border border-emerald-100 bg-emerald-50 text-emerald-600";
        icon.className = "fas fa-check-circle text-base";
        title.innerText = "Application Approved";
        desc.innerText = "Gold verified. Disbursement is ready.";
    } else if (status === 'rejected') {
        banner.className = "p-2.5 rounded-xl flex items-center gap-3 border border-rose-100 bg-rose-50 text-rose-600";
        icon.className = "fas fa-times-circle text-base";
        title.innerText = "Application Rejected";
        desc.innerText = customDesc || "Requirements not met.";
    } else {
        banner.className = "p-2.5 rounded-xl flex items-center gap-3 border border-amber-100 bg-amber-50 text-amber-600";
        icon.className = "fas fa-clock text-base";
        title.innerText = "Appraisal Pending";
        desc.innerText = "Bring gold ornaments on your appointment date.";
    }
}

function closeModal() {
    document.getElementById('detailsModal').classList.add('hidden');
    document.body.style.overflow = 'auto';
}

function handleSearch(e) {
    const query = e.target.value;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
        fetchRequestsFromServer(query);
    }, 400);
}

document.addEventListener('DOMContentLoaded', () => {
    fetchRequestsFromServer();
    const searchInput = document.getElementById('requestSearch');
    if (searchInput) searchInput.addEventListener('input', handleSearch);
});



function openRescheduleInterface() {
    const loanId = document.getElementById('btn_reschedule').getAttribute('data-id');
    document.getElementById('reschedule_loan_id').value = loanId;
    document.getElementById('rescheduleModal').classList.remove('hidden');
    docu
}

function closeRescheduleModal(){
     document.getElementById('rescheduleModal').classList.add('hidden');
     closeModal();
}


async function submitReschedule() {
    const id = document.getElementById('reschedule_loan_id').value;
    const date = document.getElementById('new_appt_date').value;
    const time = document.getElementById('new_appt_time').value;

    if (!date || !time) {
        showNotify("Please select both date and time", "error");
        return;
    }
    closeRescheduleModal();
    Loader.show();
    try {
        const response = await fetch(`/reschedule-gold-loan/${id}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ date: date, time: time })
        });
        const result = await response.json();

        if (result.success) {
      
            fetchRequestsFromServer(); 
            showNotify("Gold Appraisal Rescheduled Successfully", "success");
        } else {
            showNotify(result.message, "error");
        }
    } catch (e) { console.error(e); }
     Loader.hide();
}