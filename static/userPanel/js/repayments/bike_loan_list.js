let bikeRecords = [];
let currentPage = 1;
const pageSize = 5;
let totalPages = 1;

async function fetchMyBikeLoans(query = "") {
    try {
        const response = await fetch('/get-customer-bike-records', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ search: query })
        });
        if (!response.ok) throw new Error('Fetch failed');
        bikeRecords = await response.json();
        if (query !== "") currentPage = 1;
        renderMyBikeLoans();
    } catch (error) {
        console.error(error);
        const container = document.getElementById('bikeContainer');
        if (container) {
            container.innerHTML = `<div class="col-span-full py-20 text-center text-rose-500 font-black uppercase tracking-widest text-xs">Error connecting to server</div>`;
        }
    }
}

function renderMyBikeLoans() {
    const container = document.getElementById('bikeContainer');
    if (!container) return;
    container.innerHTML = '';

    const approvedLoans = bikeRecords.filter(item => item.status.toLowerCase() === 'approved');

    if (approvedLoans.length === 0) {
        container.innerHTML = `<div class="col-span-full py-20 text-center text-slate-400 font-bold uppercase tracking-widest text-xs">No active bike loans found</div>`;
        updatePaginationUI(0);
        return;
    }

     document.getElementById('pagination').classList.remove('hidden');
     
    const start = (currentPage - 1) * pageSize;
    const currentData = approvedLoans.slice(start, start + pageSize);

    currentData.forEach(item => {
        container.innerHTML += `
        <div class="relative bg-white p-4 md:p-5 md:px-8 rounded-[1.5rem] border border-slate-100 border-t-4 border-t-blue-500 shadow-sm hover:shadow-xl transition-all duration-500 group mb-4 animate__animated animate__fadeInUp">
            
            <div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <div class="flex items-center gap-4">
                    <div class="w-12 h-12 rounded-xl bg-slate-900 text-blue-400 flex items-center justify-center text-lg shadow-lg group-hover:bg-blue-600 group-hover:text-white transition-all shrink-0">
                        <i class="fas fa-motorcycle"></i>
                    </div>
                    <div>
                        <h2 class="text-base md:text-lg font-black text-slate-800 leading-none">${item.bike_name || 'Two Wheeler'}</h2>
                        <div class="flex items-center gap-2 mt-2">
                            <div class="inline-flex items-center overflow-hidden rounded border border-slate-900/10 shadow-sm">
                                <span class="bg-slate-900 px-1.5 py-0.5 text-[10px] font-black text-white uppercase tracking-tighter"><p>Loan ID</p></span>
                                <span class="bg-white px-2 py-0.5 font-mono text-[12px] font-black text-blue-600 tracking-tighter">
                                    ${item.app_no || 'BL-PENDING'}
                                </span>
                            </div>
                            <span class="bg-emerald-50 text-emerald-600 px-2.5 py-0.5 rounded text-[8px] font-black uppercase border border-emerald-100/50">Approved</span>
                        </div>
                    </div>
                </div>

                <button onclick="navigateToEMIStatus('${item.id}')" class="w-full md:w-auto flex items-center justify-center gap-3 px-7 py-3 bg-[#0F172A] text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 transition-all shadow-lg active:scale-95">
                    <i class="fas fa-receipt text-blue-400"></i> EMI STATUS
                </button>
            </div>

            <div class="grid grid-cols-2 md:grid-cols-4 gap-6 items-start border-t border-b border-slate-50 py-4 mb-4">
                <div class="space-y-1">
                    <p class="text-[9px] font-black text-slate-400 uppercase tracking-widest">Specifications</p>
                    <div class="flex flex-col leading-tight">
                        <span class="text-xs font-black text-slate-700">${item.bike_condition || 'New'}</span>
                        <span class="text-[10px] text-slate-400 font-bold">${item.fuel_type || 'Petrol'} • ${item.bike_model || '2026'}</span>
                    </div>
                </div>

                <div class="space-y-1 md:border-l border-slate-100 md:pl-6">
                    <p class="text-[9px] font-black text-slate-400 uppercase tracking-widest">Plan Details</p>
                    <div class="flex flex-col leading-tight">
                        <span class="text-xs font-black text-slate-700">${item.expected_month} Months</span>
                        <span class="text-[10px] text-blue-500 font-bold italic">${item.interest_rate || '9.5'}% Annual ROI</span>
                    </div>
                </div>

                <div class="space-y-1 md:border-l border-slate-100 md:pl-6">
                    <p class="text-[9px] font-black text-blue-600 uppercase tracking-widest">Financials</p>
                    <div class="flex flex-col leading-tight">
                        <span class="text-base font-black text-slate-800">₹${Number(item.final_amount).toLocaleString('en-IN')}</span>
                        <span class="text-[10px] font-black text-emerald-600 mt-1 uppercase">EMI: ₹${Number(item.monthly_emi).toLocaleString('en-IN')}/m</span>
                    </div>
                </div>

                <div class="space-y-1 md:border-l border-slate-100 md:pl-6">
                    <p class="text-[9px] font-black text-slate-400 uppercase tracking-widest">Disbursement</p>
                    <div class="flex flex-col leading-tight">
                        <span class="text-xs font-black text-slate-700">${item.appointment_date || 'TBD'}</span>
                        <span class="text-[10px] text-slate-400 font-bold">${item.appointment_time || '--:--'}</span>
                    </div>
                </div>
            </div>

            <div class="flex flex-col sm:flex-row items-center justify-between gap-3">
                <div class="flex items-center gap-2 text-slate-400 italic text-[11px] font-medium">
                    <i class="fas fa-info-circle text-slate-300 text-[10px]"></i>
                    "${item.description || 'Congratulations! Your Bike Loan has been approved.'}"
                </div>
                <div class="text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5 self-end">
                    <i class="far fa-calendar-alt"></i> ISSUED: ${item.date}
                </div>
            </div>
        </div>`;
    });

    updatePaginationUI(approvedLoans.length);
}

function updatePaginationUI(totalApproved) {
    totalPages = Math.ceil(totalApproved / pageSize);
    const container = document.getElementById('pageIndicator');
    
    if (document.getElementById('startRange')) document.getElementById('startRange').innerText = totalApproved === 0 ? 0 : (currentPage - 1) * pageSize + 1;
    if (document.getElementById('endRange')) document.getElementById('endRange').innerText = Math.min(currentPage * pageSize, totalApproved);
    if (document.getElementById('totalEntries')) document.getElementById('totalEntries').innerText = totalApproved;

    document.getElementById('prevBtn').disabled = currentPage === 1;
    document.getElementById('nextBtn').disabled = currentPage === totalPages || totalApproved === 0;

    if (!container) return;
    container.innerHTML = '';

    container.appendChild(createNavBtn("First", 1, currentPage === 1));

    let start = Math.max(1, currentPage - 1);
    let end = Math.min(totalPages, start + 2);
    if (end === totalPages) start = Math.max(1, end - 2);

    for (let i = start; i <= end; i++) {
        if (i < 1) continue;
        const btn = document.createElement('button');
        btn.innerText = i;
        btn.className = `h-10 w-10 rounded-xl text-xs font-bold transition-all ${i === currentPage ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'bg-white border border-slate-200 text-slate-500 hover:bg-blue-50'}`;
        btn.onclick = () => goToPage(i);
        container.appendChild(btn);
    }

    container.appendChild(createNavBtn("Last", totalPages, currentPage === totalPages || totalApproved === 0));
}

function createNavBtn(label, page, disabled) {
    const btn = document.createElement('button');
    btn.innerText = label;
    btn.className = `h-10 px-4 rounded-xl border border-slate-100 bg-white text-slate-500 text-[10px] font-black uppercase transition-all ${disabled ? 'opacity-30 cursor-not-allowed' : 'hover:bg-blue-50 hover:text-blue-600 active:scale-95'}`;
    if(!disabled) btn.onclick = () => goToPage(page);
    return btn;
}

function goToPage(page) {
    currentPage = page;
    renderMyBikeLoans();
    window.scrollTo({top: 0, behavior: 'smooth'});
}

function changePage(dir) {
    if(currentPage + dir >= 1 && currentPage + dir <= totalPages) {
        goToPage(currentPage + dir);
    }
}

function filterMyBikeLoans() {
    const val = document.getElementById("bikeSearch").value;
    fetchMyBikeLoans(val);
}

function navigateToEMIStatus(loan_id) {
    window.location.href =`/bike/emil-payment/${loan_id}`;
}

document.addEventListener('DOMContentLoaded', () => fetchMyBikeLoans());