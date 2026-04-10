let bikeRecords = [];
let currentPage = 1;
const pageSize = 4;
let totalPages = 1;
let total=1;

async function fetchBikeLoans(query = "") {
    try {
        const response = await fetch('/get-bike-loan-records', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ q: query })
        });
        if (!response.ok) throw new Error('Fetch failed');
        bikeRecords = await response.json();
        renderBikeLoans();
    } catch (error) {
        console.error(error);
        const container = document.getElementById('bikeContainer');
        if (container) {
            container.innerHTML = `
                <div class="col-span-full py-20 text-center">
                    <p class="text-rose-500 font-black uppercase tracking-widest text-xs">Error connecting to server</p>
                </div>`;
        }
    }
}

function renderBikeLoans() {
    const container = document.getElementById('bikeContainer');
    if (!container) return;
    container.innerHTML = '';
    
    if (bikeRecords.length === 0) {
        container.innerHTML = `<div class="col-span-full py-20 text-center text-slate-400 font-bold uppercase tracking-widest text-xs">No bike loan records found</div>`;
        updatePaginationUI();
        return;
    }

    document.getElementById('pagination').classList.remove('hidden'); 
    const start = (currentPage - 1) * pageSize;
    const currentData = bikeRecords.slice(start, start + pageSize);

   
    currentData.forEach(item => {
   container.innerHTML += `
    <div class="relative bg-white rounded-[1.5rem] border border-slate-100 shadow-sm hover:shadow-xl transition-all duration-500 overflow-hidden group mb-4">
        
        <div class="absolute -right-6 -top-6 opacity-[0.03] group-hover:opacity-[0.1] group-hover:-rotate-12 transition-all duration-1000 pointer-events-none hidden sm:block">
            <i class="fas fa-motorcycle text-[120px] text-blue-600 animate-float"></i>
        </div>

        <div class="p-4 md:p-5 relative z-10">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
                <div class="flex items-center space-x-3">
                    <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 text-white flex items-center justify-center text-sm shadow-lg shadow-blue-200/50 flex-shrink-0 group-hover:rotate-[360deg] transition-transform duration-700">
                        <i class="fas fa-motorcycle"></i>
                    </div>
                    <div>
                        <h2 class="text-sm md:text-base font-black text-slate-800 leading-none">${item.name || 'Unknown User'}</h2>
                        <div class="flex flex-wrap items-center gap-2 mt-1.5">
                            
                            <div class="inline-flex items-center overflow-hidden rounded-md border border-slate-900/10 shadow-sm">
                                <span class="bg-slate-900 px-1.5 py-0.5 text-[10px] font-black text-white uppercase tracking-tighter">LOAN ID</span>
                                <span class="bg-white px-2 py-0.5 font-mono text-[12px] font-black text-blue-600 tracking-tighter">
                                    ${item.app_no || 'BL-0000'}
                                </span>
                            </div>

                            <span class="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-600 text-[8px] font-black uppercase border border-emerald-100/50">${item.status}</span>
                        </div>
                    </div>
                </div>
                
                <button onclick="navigateToEMIStatus('${item.id}')" class="w-full sm:w-auto px-5 py-2.5 bg-slate-900 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-blue-600 transition-all duration-300 shadow-lg shadow-slate-200 active:scale-95">
                    <i class="fas fa-receipt mr-2 text-blue-400"></i> EMI Status
                </button>
            </div>

            <div class="grid grid-cols-2 md:grid-cols-4 gap-4 items-start border-t border-b border-slate-50 py-4">
                
                <div class="space-y-1">
                    <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest">Contact & Work</p>
                    <div class="flex flex-col leading-tight">
                        <span class="text-[12px] sm:text-[11px] font-bold text-slate-700">${item.phone || 'N/A'}</span>
                        <span class="text-[11px] sm:text-[10px] text-slate-500 truncate" title="${item.email}">${item.email || 'No Email'}</span>
                        <span class="text-[10px] text-blue-600 font-black mt-1 uppercase truncate">${item.company_name || 'Private Sector'}</span>
                    </div>
                </div>

                <div class="space-y-1 md:border-l border-slate-100 md:pl-4">
                    <p class="text-[8px] font-black text-blue-600 uppercase tracking-widest">Vehicle Detail</p>
                   <div class="flex flex-col leading-tight">
                        <span class="text-[12px] sm:text-[11px] font-bold text-slate-700 truncate">
                            ${item.bike_name || 'Bike Loan'}
                        </span>

                        <span class="text-[11px] sm:text-[10px] text-slate-500 font-medium">
                            ${item.fuel_type || 'Petrol'} • ${item.bike_model || '2026'}
                        </span>

                        <div class="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1.5">
                            <div class="flex items-center gap-1 bg-blue-50 px-1.5 py-0.5 rounded-md border border-blue-100/50">
                                <span class="text-[12px] font-black text-blue-600 uppercase tracking-tighter">
                                    ${item.interest_rate || '9.5'}%
                                </span>
                                <span class="text-[11px] font-bold text-blue-400">ROI</span>
                            </div>

                            <div class="flex items-center gap-1 bg-emerald-50 px-1.5 py-0.5 rounded-md border border-emerald-100/50">
                                <span class="text-[12px] font-black text-emerald-600 tracking-tighter">
                                    ₹${item.down_payment || '15,000'}
                                </span>
                                <span class="text-[11px] font-bold text-emerald-400 uppercase">DP</span>
                            </div>

                            <span class="text-[12px] text-slate-300 font-bold uppercase italic ml-auto">
                                ${item.bike_type || 'Commuter'}
                            </span>
                        </div>
                    </div>
                </div>

                <div class="space-y-1 md:border-l border-slate-100 md:pl-4 bg-blue-50/30 p-2 rounded-lg">
                    <p class="text-[8px] font-black text-blue-700 uppercase tracking-widest">Financials</p>
                    <div class="flex flex-col leading-none space-y-1.5">
                        <div class="flex justify-between items-end">
                            <span class="text-[13px] sm:text-[13px] font-black text-slate-800">₹${Number(item.final_amount || 0).toLocaleString('en-IN')}</span>
                            <span class="text-[10px] font-bold text-blue-500">GST:${item.gst_rate || '28%'}</span>
                        </div>
                        <span class="text-[12px] sm:text-[10px] font-black text-emerald-600">EMI: ₹${Number(item.monthly_emi || 0).toLocaleString('en-IN')}/m</span>
                        <span class="text-[10px] text-slate-400 font-bold border-t border-blue-100/50 pt-1">ORP: ₹${Number(item.onroad_price || 0).toLocaleString('en-IN')}</span>
                    </div>
                </div>

                <div class="space-y-1 md:border-l border-slate-100 md:pl-4">
                    <p class="text-[8px] font-black text-slate-400 uppercase tracking-widest">Appointment</p>
                    <div class="flex flex-col leading-tight">
                        <span class="text-[13px] sm:text-[11px] font-bold text-slate-700">${item.appointment_date || 'TBD'}</span>
                        <span class="text-[11px] sm:text-[10px] text-slate-500">${item.appointment_time || '--:--'}</span>
                        <span class="text-[10px] text-slate-400 font-black mt-1 uppercase">EXP: ${item.expected_month || 'N/A'}</span>
                    </div>
                </div>
            </div>

            <div class="mt-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                <div class="flex items-center gap-2 flex-1">
                    <i class="fas fa-info-circle text-slate-300 text-[10px]"></i>
                    <p class="text-[12px] sm:text-[12px] text-slate-400 italic truncate group-hover:text-slate-600 transition-colors">"${item.description || 'No additional details provided.'}"</p>
                </div>
                <div class="text-[10px] sm:text-[12px] text-slate-400 font-black uppercase tracking-[0.2em] whitespace-nowrap self-end">
                    <i class="far fa-calendar-alt mr-1"></i> Issued: ${item.date || 'N/A'}
                </div>
            </div>
        </div>
    </div>`;
});
    updatePaginationUI();
}

function updatePaginationUI() {
    total = bikeRecords.length;
    totalPages = Math.ceil(total / pageSize);
    const container = document.getElementById('pageIndicator');
    
    if (document.getElementById('startRange')) document.getElementById('startRange').innerText = total === 0 ? 0 : (currentPage - 1) * pageSize + 1;
    if (document.getElementById('endRange')) document.getElementById('endRange').innerText = Math.min(currentPage * pageSize, total);
    if (document.getElementById('totalEntries')) document.getElementById('totalEntries').innerText = total;

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

    container.appendChild(createNavBtn("Last", totalPages, currentPage === totalPages || total === 0));
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
    renderBikeLoans();
    window.scrollTo({top: 0, behavior: 'smooth'});
}

function changePage(dir){
    if(currentPage + dir >= 1 && currentPage + dir <= totalPages) goToPage(currentPage + dir);
}


function filterBikeLoans() {
    const val = document.getElementById("bikeSearch").value;
    currentPage = 1;
    fetchBikeLoans(val);
}



function navigateToEMIStatus(loan_id) {
    window.location.href = `/loan-approved-details/bike/emil-status/${loan_id}`;
}

document.addEventListener('DOMContentLoaded', () => fetchBikeLoans());


