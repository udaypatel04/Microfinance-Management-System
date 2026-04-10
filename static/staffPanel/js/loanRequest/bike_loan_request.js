let loanRequests = [];
let currentPage = 1;
const pageSize = getResponsivePageSize();
let searchTimer;
let scoreInterval;


function getResponsivePageSize() {
    const width = window.innerWidth;
    if (width < 768) return 3;
    if (width < 1280) return 4;
    return 6;
}



const createRequestCard = (req) => {
    const statusColor = req.status === 'approved' ? 'emerald' : req.status === 'rejected' ? 'rose' : 'blue';
    
    return `
    <div class="relative bg-white rounded-[2.2rem] border border-slate-100 p-1 shadow-sm hover:shadow-2xl hover:border-blue-200 transition-all duration-700 group animate__animated animate__fadeInUp overflow-hidden">
        <div class="absolute inset-0 flex items-center justify-center opacity-[0.02] group-hover:opacity-[0.05] transition-all duration-1000 pointer-events-none">
            <i class="fas fa-motorcycle text-[180px] -rotate-12 group-hover:rotate-0 group-hover:scale-125 transition-all duration-1000 text-slate-900 group-hover:text-blue-600"></i>
        </div>
        
        <div class="absolute top-4 right-6 flex items-center gap-1.5 z-20">
            <div class="w-1.5 h-1.5 bg-${statusColor}-500 rounded-full group-hover:animate-pulse"></div>
            <span class="text-[8px] font-black text-slate-400 uppercase tracking-widest">${req.status}</span>
        </div>

        <div class="p-5 relative z-10">
            <div class="flex items-start gap-3 mb-5">
                <div class="w-12 h-12 rounded-2xl bg-slate-900 text-blue-400 flex items-center justify-center shadow-lg group-hover:shadow-blue-200/50 transition-all duration-500 shrink-0">
                    <i class="fas fa-id-badge text-lg"></i>
                </div>
                <div class="overflow-hidden w-full">
                    <div class="flex flex-col">
                        
                        <div class="inline-flex items-center self-start mb-2 overflow-hidden rounded-lg border border-blue-200 shadow-sm">
                            <span class="bg-blue-600 px-1.5 py-0.5 text-[11px] font-black text-white uppercase tracking-tighter">
                                APP ID
                            </span>
                            <span class="bg-white px-2 py-0.5 font-mono text-[12px] font-black text-slate-700 tracking-tight">
                                ${req.app_no || 'GENERATING...'}
                            </span>
                        </div>

                        <h3 class="text-sm font-black text-slate-800 tracking-tight leading-none truncate">${req.name || 'Unknown'}</h3>
                        <p class="text-[9px] font-bold text-slate-400 mt-1.5 uppercase tracking-tighter truncate">${req.email || 'No Email'}</p>
                    </div>
                </div>
            </div>

            <div class="space-y-2 mb-5">
                <div class="grid grid-cols-2 gap-2">
                    <div class="flex items-center justify-between p-2.5 bg-slate-50/40 backdrop-blur-[2px] rounded-xl border border-slate-100 group-hover:bg-white transition-colors">
                        <i class="fas fa-phone text-[8px] text-slate-300"></i>
                        <span class="text-[10px] font-black text-blue-600 bg-blue-50/50 px-1.5 py-0.5 rounded-md">
                            ${req.phone ? req.phone.slice(-10) : 'N/A'}
                        </span>
                    </div>
                    <div class="flex items-center justify-between p-2.5 bg-slate-50/40 backdrop-blur-[2px] rounded-xl border border-slate-100 group-hover:bg-white transition-colors">
                        <i class="fas fa-motorcycle text-[8px] text-blue-500"></i>
                        <span class="text-[10px] font-black text-indigo-700 truncate border-l-2 border-indigo-500 pl-2">
                            ${req.bike_name || 'Bike Loan'}
                        </span>
                    </div>
                </div>

                <div class="flex items-center justify-between p-3 bg-slate-900 rounded-xl shadow-lg shadow-slate-200 group-hover:shadow-blue-900/20 transition-all duration-500 relative overflow-hidden">
                    <div class="flex items-center gap-2 relative z-10">
                        <div class="w-6 h-6 rounded-lg bg-blue-400/10 flex items-center justify-center border border-blue-400/20">
                            <i class="fas fa-wallet text-[10px] text-blue-400"></i>
                        </div>
                        <span class="text-[9px] font-black text-slate-400 uppercase tracking-widest">Loan Principal</span>
                    </div>
                    <span class="text-sm font-black text-white tracking-tight relative z-10">₹${Number(req.final_amount || 0).toLocaleString('en-IN')}</span>
                </div>
            </div>

            <button onclick="openModal(${req.id})" class="w-full py-3 bg-white/80 backdrop-blur-md border border-slate-200 text-slate-800 rounded-xl text-[9px] font-black uppercase tracking-[0.2em] hover:bg-slate-900 hover:text-white transition-all duration-300 active:scale-95">
                View Details
            </button>
        </div>
    </div>`;
};

async function fetchRequestsFromServer(query = "") {
    try {
        const response = await fetch('/bike-loan-requests-list', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ q: query })
        });
        if (!response.ok) throw new Error('Failed to fetch data');
        
        loanRequests = await response.json();
        if(query !== "") currentPage = 1;
        renderRequests(loanRequests);
    } catch (error) {
        console.error(error);
        if (typeof showNotify === "function") showNotify("Server connection failed", "danger");
    }
}

function renderRequests(data) {
    const container = document.getElementById('requestContainer');
    if (!container) return;
    container.innerHTML = '';

    if (data.length === 0) {
        container.innerHTML = `<div class="col-span-full py-20 text-center text-slate-400 font-bold uppercase tracking-widest">No bike loan requests found</div>`;
        updatePaginationInfo(0);
        return;
    }

    document.getElementById('pagination').classList.remove('hidden'); 
    const start = (currentPage - 1) * pageSize;
    const end = Math.min(start + pageSize, data.length);
    const paginatedItems = data.slice(start, end);

    paginatedItems.forEach(req => {
        container.innerHTML += createRequestCard(req);
    });

    updatePaginationInfo(start);
   
}

function updatePaginationInfo(start) {
    const total = loanRequests.length;
    const totalPages = Math.ceil(total / pageSize);
    const end = Math.min(start + pageSize, total);
    
    if (document.getElementById('startRange')) document.getElementById('startRange').innerText = total > 0 ? start + 1 : 0;
    if (document.getElementById('endRange')) document.getElementById('endRange').innerText = end;
    if (document.getElementById('totalEntries')) document.getElementById('totalEntries').innerText = total;
    
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
        btn.className = `w-9 h-9 rounded-xl text-xs font-bold transition-all ${isActive ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`;
        btn.onclick = () => { currentPage = i; renderRequests(loanRequests);  window.scrollTo(0, 0); };
        container.appendChild(btn);
    }

    createNavBtn("Last", totalPages, (currentPage === totalPages || totalPages === 0), container);
}

function createNavBtn(label, page, disabled, container) {
    const btn = document.createElement('button');
    btn.innerText = label;
    btn.className = `px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-600 text-[10px] font-black uppercase transition-all ${disabled ? 'opacity-40 cursor-not-allowed' : 'active:scale-95 hover:bg-slate-50'}`;
    btn.onclick = () => { if(!disabled) { currentPage = page; renderRequests(loanRequests);   window.scrollTo(0, 0);} };
    container.appendChild(btn);
}

function openModal(id) {
    const req = loanRequests.find(r => r.id === id);
    if (!req) return;

    document.getElementById('m_name').innerText = req.name || '---';
    document.getElementById('m_customer_status').innerText = req.customer_status || '---';
    document.getElementById('m_customer_id').innerText=req.customer_id;
    document.getElementById('m_app_no').innerText = req.app_no;
    document.getElementById('m_loan_request_id').innerText = req.id;
    document.getElementById('m_apply_date').innerText = req.date;

    document.getElementById('m_phone').innerText = req.phone;
    document.getElementById('m_email').innerText = req.email;
    document.getElementById('m_app_date').innerText = req.appointment_date || 'TBD';
    document.getElementById('m_app_time').innerText = req.appointment_time || '--:--';

    document.getElementById('m_bike_name').innerText = (req.company_name || '') + " " + (req.bike_name || '');
    document.getElementById('m_engine').innerText = (req.enginecc || '---') + " CC";
    document.getElementById('m_fuel').innerText = req.fuel_type || '---';
    document.getElementById('m_tenure').innerText = (req.expected_month || '0') + " Months Plan";
  
    document.getElementById('m_principal').innerText = "₹ " +Number(req.final_amount || 0.00).toLocaleString('en-IN');
    document.getElementById('m_emi').innerText = "₹ " + Number(req.monthly_emi || 0.00).toLocaleString('en-IN') ;
    
    document.getElementById('m_credit_score').innerText = req.credit_score=='0' ? '---':req.credit_score; ;

    document.getElementById('m_orp').innerText = "₹ " + Number(req.on_road_price || 0.00).toLocaleString('en-IN');

    document.getElementById('m_downpayment').innerText = "₹ " + Number(req.down_payment || 0.00).toLocaleString('en-IN');

    document.getElementById('m_roi').innerText =  (req.interest_rate || "0.00") + "%";
    
    document.getElementById('m_disburse').innerText = "₹ " + Number(req.final_amount-1180).toLocaleString('en-IN');
    
    const emiStatusSpan = document.getElementById('m_emi_status');
    if (emiStatusSpan) {
        if (req.status === 'approved') {
            emiStatusSpan.innerText = req.emi_completed === 1 ? "EMI COMPLETED" : "EMI ACTIVE";
            emiStatusSpan.className = "text-[9px] font-black uppercase opacity-80 italic " + 
                                    (req.emi_completed === 1 ? "text-emerald-400" : "text-blue-100");
        } else if (req.status === 'rejected') {
            emiStatusSpan.innerText = "LOAN REJECTED";
            emiStatusSpan.className = "text-[9px] font-black uppercase opacity-80 italic text-rose-300";
        } else {
            emiStatusSpan.innerText = "AWAITING APPROVAL";
            emiStatusSpan.className = "text-[9px] font-black uppercase opacity-80 italic text-slate-400";
        }
    }

    const staffTextarea = document.getElementById('staffReason');
    staffTextarea.value = req.description || '';

    const pendingActions = document.getElementById('pending_actions');
    const statusDisplay = document.getElementById('modal_status_display');
    const statusIcon = document.getElementById('status_icon');
    const statusText = document.getElementById('status_text');

    if (req.status !== 'pending') {
        pendingActions.classList.add('hidden');
        statusDisplay.classList.remove('hidden');
        staffTextarea.disabled = true;
        staffTextarea.classList.add('bg-slate-100', 'text-slate-500');

        if (req.status === 'approved') {
            statusDisplay.className = "w-full p-4 rounded-2xl flex items-center justify-center gap-3 border border-emerald-100 bg-emerald-50 text-emerald-600 animate__animated animate__fadeIn";
            statusIcon.className = "fas fa-check-circle text-lg";
            statusText.innerText = "Bike Loan Approved";
        } else {
            statusDisplay.className = "w-full p-4 rounded-2xl flex items-center justify-center gap-3 border border-rose-100 bg-rose-50 text-rose-600 animate__animated animate__fadeIn";
            statusIcon.className = "fas fa-times-circle text-lg";
            statusText.innerText = "Bike Loan Rejected";
        }
    } else {
        pendingActions.classList.remove('hidden');
        statusDisplay.classList.add('hidden');
        staffTextarea.disabled = false;
        staffTextarea.classList.remove('bg-slate-100', 'text-slate-500');

        document.getElementById('btn_approve').onclick = () => openCreditScoreModal('approve', req.id);
        document.getElementById('btn_reject').onclick = () => openCreditScoreModal('reject', req.id);
    }

    document.getElementById('detailsModal').classList.remove('hidden');
}

async function handleAction(type, id) {
    const reason = document.getElementById('staffReason').value;
    const btnApprove = document.getElementById('btn_approve');
    const btnReject = document.getElementById('btn_reject');
    const originalText = type === 'approve' ? btnApprove.innerHTML : btnReject.innerHTML;
    
    if(type === 'approve') btnApprove.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Processing...`;
    else btnReject.innerHTML = `<i class="fas fa-spinner fa-spin"></i>...`;
    Loader.show();
    try {
        const response = await fetch(`/bike-loan-requests/${id}/action`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: type, reason: reason })
        });
        const result = await response.json();
        
        if (response.ok) {
            if (typeof showNotify === "function") showNotify(result.message, "success");
            closeModal();
            fetchRequestsFromServer(); 
        } else {
            throw new Error(result.message);
        }
    } catch (error) {
        if (typeof showNotify === "function") showNotify(error.message, "danger");
    } finally {
        if(type === 'approve') btnApprove.innerHTML = originalText;
        else btnReject.innerHTML = originalText;

        Loader.hide()
    }
}

function handleSearch(e) {
    const query = e.target.value;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
        fetchRequestsFromServer(query);
    }, 400);
}

function closeModal() {
    document.getElementById('detailsModal').classList.add('hidden');
}

function changePage(dir) {
    currentPage += dir;
    renderRequests(loanRequests);
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

function openCreditScoreModal(type,id) {
    const modal = document.getElementById('creditScoreModal');
    if (!modal) return;
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    
    const currentScore = document.getElementById('m_credit_score').innerText;

    document.getElementById('m_request_status').innerText = type;
    document.getElementById('m_request_id').innerText = id;
    const val = (currentScore !== '---' && currentScore !== '') ? currentScore : '300';
    document.getElementById('input_credit_score').value = (val === '300') ? '' : val;
    
    setTimeout(() => animateGauge(val), 100);
}

function closeCreditScoreModal(id) {
    document.getElementById('creditScoreModal').classList.add('hidden');
    document.body.style.overflow = 'auto';
        
}


function NTC(){

     const type=document.getElementById('m_request_status').innerText;
     const id=document.getElementById('m_request_id').innerText;
     closeCreditScoreModal();
     closeModal();
     handleAction(type, id);
}



async function saveCreditScore() {

    const score = document.getElementById('input_credit_score').value;
    const userId = document.getElementById('m_customer_id').innerText;
    const loanRequestId=document.getElementById('m_loan_request_id').innerText;
    const loanType="Bike Loan";

    const type=document.getElementById('m_request_status').innerText;
    const id=document.getElementById('m_request_id').innerText;

    if (score < 300 || score > 900) {
        showNotify("Please enter a valid score (300-900)", "error");
        return;
    }

    closeCreditScoreModal();
    closeModal();
    try {
        const response = await fetch(`/customers/${loanType}/update-credit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                credit_score: score,
                loanRequestId:loanRequestId,
                userId:userId 
            })
        });

        const result = await response.json();
        if (response.ok) {
            document.getElementById('m_credit_score').innerText = score;
            
               
            handleAction(type, id);

        } else {
            showNotify(result.message, "error");
            throw new Error(result.message);
        }
    } catch (error) {
    
        showNotify(error.message, "error");
    }
}


document.addEventListener('DOMContentLoaded', () => {
    fetchRequestsFromServer();
    const searchInput = document.getElementById('requestSearch');
    if (searchInput) searchInput.addEventListener('input', handleSearch);
});