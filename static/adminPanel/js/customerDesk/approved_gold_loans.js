let goldRecords = [];
let currentPage = 1;
const pageSize = 3;
let totalPages = 1;
let total=1;

async function fetchGoldLoans(query = "") {
    try {
        const response = await fetch('/get-gold-records', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ search: query })
        });
        if (!response.ok) throw new Error('Fetch failed');
        goldRecords = await response.json();
        renderGoldLoans();
    } catch (error) {
        console.error(error);
        const container = document.getElementById('goldContainer');
        if (container) {
            container.innerHTML = `<div class="col-span-full py-20 text-center text-rose-500 font-bold uppercase tracking-widest">Error connecting to server</div>`;
        }
    }
}

function renderGoldLoans() {
    const container = document.getElementById('goldContainer');
    if (!container) return;
    container.innerHTML = '';
    
    if (goldRecords.length === 0) {
        container.innerHTML = `<div class="col-span-full py-20 text-center text-slate-400 font-bold uppercase tracking-widest">No records found</div>`;
        updatePaginationUI();
        return;
    }

    document.getElementById('pagination').classList.remove('hidden'); 

    const start = (currentPage - 1) * pageSize;
    const currentData = goldRecords.slice(start, start + pageSize);

    currentData.forEach(item => {
    container.innerHTML += `
    <div class="relative bg-white rounded-[1.5rem] border border-slate-100 shadow-sm hover:shadow-xl transition-all duration-500 overflow-hidden group mb-4">
        
        <div class="absolute -right-6 -top-6 opacity-[0.03] group-hover:opacity-[0.1] group-hover:-rotate-12 transition-all duration-1000 pointer-events-none hidden sm:block">
            <i class="fas fa-coins text-[120px] text-yellow-600 animate-float"></i>
        </div>

        <div class="p-4 md:p-5 relative z-10">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
                <div class="flex items-center space-x-3">
                    <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-yellow-400 to-yellow-600 text-white flex items-center justify-center text-sm shadow-lg shadow-yellow-200/50 flex-shrink-0 group-hover:rotate-[360deg] transition-transform duration-700">
                        <i class="fas fa-coins"></i>
                    </div>
                    <div>
                        <h2 class="text-sm md:text-base font-black text-slate-800 leading-none">${item.name}</h2>
                        <div class="flex flex-wrap items-center gap-2 mt-1.5">
                            
                            <div class="inline-flex items-center overflow-hidden rounded-md border border-slate-900/10 shadow-sm">
                                <span class="bg-slate-900 px-1.5 py-0.5 text-[10px] font-black text-white uppercase tracking-tighter whitespace-nowrap">LOAN ID</span>
                                <span class="bg-white px-2 py-0.5 font-mono text-[12px] font-black text-yellow-600 tracking-tighter whitespace-nowrap">
                                    ${item.app_no || 'GL-0000'}
                                </span>
                            </div>

                            <span class="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-600 text-[8px] font-black uppercase border border-emerald-100/50">${item.status}</span>
                        </div>
                    </div>
                </div>
                
                <button onclick="navigateToEMIStatus('${item.id}')" class="w-full sm:w-auto px-5 py-2.5 bg-slate-900 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-indigo-600 transition-all duration-300 shadow-lg shadow-slate-200 active:scale-95">
                    <i class="fas fa-receipt mr-2 text-yellow-400"></i> EMI Status
                </button>
            </div>

            <div class="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-6 items-start border-t border-b border-slate-50 py-4">
                
                <div class="space-y-1">
                    <p class="text-[12px] font-black text-slate-400 uppercase tracking-widest">Contact Info</p>
                    <div class="flex flex-col leading-tight">
                        <span class="text-[13px] sm:text-[11px] font-bold text-slate-700">${item.phone}</span>
                        <span class="text-[12px] sm:text-[10px] text-slate-400 truncate max-w-[120px] sm:max-w-[140px] hover:max-w-none transition-all cursor-help" title="${item.email}">
                            ${item.email}
                        </span>
                    </div>
                </div>

                <div class="space-y-1 sm:border-l border-slate-100 sm:pl-4">
                    <p class="text-[12px] font-black text-slate-400 uppercase tracking-widest">Collateral</p>
                    <div class="flex flex-col leading-tight">
                        <span class="text-[12px] sm:text-[11px] font-bold text-slate-700 truncate">${item.gold_weight}g • ${item.gold_type}</span>
                        
                        <span class="text-[11px] sm:text-[10px] text-slate-500 font-medium">Val: ₹${Number(item.est_amount).toLocaleString('en-IN')}</span>
                        
                        <div class="mt-1.5 flex items-center gap-1.5">
                            <span class="bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-md text-[11px] font-black border border-blue-100/50">
                                ${item.interest_rate || '0.85'}% <span class="text-[10px] font-bold opacity-70">ROI</span>
                            </span>
                        </div>
                    </div>
                </div>

                <div class="space-y-1 sm:border-l border-slate-100 sm:pl-4">
                    <p class="text-[12px] font-black text-yellow-600 uppercase tracking-widest">Financials</p>
                    <div class="flex flex-col">
                        <span class="text-[13px] sm:text-[13px] font-black text-slate-800 leading-none">₹${Number(item.loan_amount).toLocaleString('en-IN')}</span>
                        <span class="text-[11px] sm:text-[10px] font-black text-emerald-600 mt-1">EMI: ₹${Number(item.monthly_emi).toLocaleString('en-IN')}</span>
                    </div>
                </div>

                <div class="space-y-1 border-l border-slate-100 pl-4">
                    <p class="text-[12px] font-black text-slate-400 uppercase tracking-widest">Appointment</p>
                    <div class="flex flex-col leading-tight">
                        <span class="text-[12px] sm:text-[11px] font-bold text-slate-700">${item.appt_date}</span>
                        <span class="text-[11px] sm:text-[10px] text-slate-500">${item.appt_time}</span>
                    </div>
                </div>
            </div>

            <div class="mt-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                <div class="flex items-center gap-2 flex-1 min-w-0">
                    <i class="fas fa-info-circle text-slate-300 text-[10px] flex-shrink-0"></i>
                    <p class="text-[13px] sm:text-[10px] text-slate-400 italic truncate group-hover:text-slate-600 transition-colors">"${item.description}"</p>
                </div>
                <div class="text-[13px] sm:text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] whitespace-nowrap self-end sm:self-auto">
                    <i class="far fa-calendar-alt mr-1"></i> Issued: ${item.date}
                </div>
            </div>
        </div>
    </div>`;
});

    updatePaginationUI();
}

function updatePaginationUI() {
    total = goldRecords.length;
    totalPages = Math.ceil(total / pageSize);
    const container = document.getElementById('pageIndicator');
    
    const startRange = document.getElementById('startRange');
    const endRange = document.getElementById('endRange');
    const totalEntries = document.getElementById('totalEntries');

    if (startRange) startRange.innerText = total === 0 ? 0 : (currentPage - 1) * pageSize + 1;
    if (endRange) endRange.innerText = Math.min(currentPage * pageSize, total);
    if (totalEntries) totalEntries.innerText = total;

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
        btn.className = `h-11 w-11 rounded-xl text-xs font-bold transition-all ${i === currentPage ? 'bg-yellow-500 text-white shadow-lg shadow-yellow-200' : 'bg-white border border-slate-200 text-slate-500 hover:bg-yellow-50'}`;
        btn.onclick = () => goToPage(i);
        container.appendChild(btn);
    }

    container.appendChild(createNavBtn("Last", totalPages, currentPage === totalPages || total === 0));
}

function createNavBtn(label, page, disabled) {
    const btn = document.createElement('button');
    btn.innerText = label;
    btn.className = `h-11 px-4 rounded-xl border border-slate-100 bg-white text-slate-500 text-[10px] font-black uppercase transition-all ${disabled ? 'opacity-30 cursor-not-allowed' : 'hover:bg-yellow-50 hover:text-yellow-600 active:scale-95'}`;
    if(!disabled) btn.onclick = () => goToPage(page);
    return btn;
}

function goToPage(page) {
    currentPage = page;
    renderGoldLoans();
    window.scrollTo({top: 0, behavior: 'smooth'});
}

function changePage(dir){

    if(currentPage + dir >= 1 && currentPage + dir <= totalPages) goToPage(currentPage + dir);
}


function filterGoldLoans() {
    const val = document.getElementById("goldSearch").value;
    currentPage = 1;
    fetchGoldLoans(val);
}



function navigateToEMIStatus(loan_id) {
    window.location.href = `/loan-approved-details/gold/emil-status/${loan_id}`;
}

document.addEventListener('DOMContentLoaded', () => fetchGoldLoans());
