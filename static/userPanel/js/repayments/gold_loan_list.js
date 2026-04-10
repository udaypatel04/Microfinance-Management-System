let goldRecords = [];
let currentPage = 1;
const pageSize = 6;
let totalPages = 1;

async function fetchMyLoans(query = "") {
    try {
        const response = await fetch('/get-customer-gold-records', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ search: query })
        });
        if (!response.ok) throw new Error('Fetch failed');
        goldRecords = await response.json();
        if (query !== "") currentPage = 1;
        renderLoans();
    } catch (error) {
        console.error(error);
        const container = document.getElementById('loanContainer');
        if (container) {
            container.innerHTML = `<div class="col-span-full py-20 text-center text-rose-500 font-black uppercase tracking-widest">Error connecting to server</div>`;
        }
    }
}

function renderLoans() {
    const container = document.getElementById('loanContainer');
    if (!container) return;
    container.innerHTML = '';

    // 1. Filter only Approved Loans
    const approvedLoans = goldRecords.filter(item => item.status.toLowerCase() === 'approved');

    if (approvedLoans.length === 0) {
        container.innerHTML = `<div class="col-span-full py-20 text-center text-slate-400 font-bold uppercase tracking-widest">No approved records found</div>`;
        updatePaginationUI();
        return;
    }

     document.getElementById('pagination').classList.remove('hidden');

    const start = (currentPage - 1) * pageSize;
    const currentData = approvedLoans.slice(start, start + pageSize);

    currentData.forEach(item => {
    container.innerHTML += `
    <div class="relative bg-white rounded-[1.5rem] border border-slate-100 shadow-sm hover:shadow-xl transition-all duration-500 overflow-hidden group mb-4 animate__animated animate__fadeInUp">
        <div class="p-4 md:p-5">
            
            <div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4">
                <div class="flex items-center gap-4">
                    <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-yellow-400 to-yellow-600 text-white flex items-center justify-center text-lg shadow-lg shadow-yellow-200/50 transition-transform group-hover:rotate-12">
                        <i class="fas fa-coins"></i>
                    </div>
                    <div>
                        <h2 class="text-lg font-black text-slate-800 leading-none">${item.name}</h2>
                        <div class="flex items-center gap-2 mt-1.5">
                            <div class="inline-flex items-center overflow-hidden rounded border border-slate-900/10">
                                <span class="bg-slate-900 px-1.5 py-0.5 text-[10px] font-black text-white uppercase tracking-tighter">LOAN ID</span>
                                <span class="bg-white px-1.5 py-0.5 font-mono text-[12px] font-black text-yellow-600 tracking-tighter">
                                    ${item.app_no || 'GL-0000'}
                                </span>
                            </div>
                            <span class="bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded text-[8px] font-black uppercase border border-emerald-100">Approved</span>
                        </div>
                    </div>
                </div>

                <button onclick="navigateToEMIStatus('${item.id}')" 
                class="w-full md:w-auto flex items-center justify-center gap-2 px-5 py-3 bg-[#0F172A] text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg active:scale-95">
                    <i class="fas fa-receipt text-yellow-500"></i> EMI STATUS
                </button>
            </div>

            <div class="grid grid-cols-2 md:grid-cols-4 gap-4 pb-4">
                
                <div class="leading-tight">
                    <p class="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Contact Info</p>
                    <div class="flex flex-col">
                        <span class="text-xs font-black text-slate-700">${item.phone}</span>
                        <span class="text-[10px] text-slate-400 font-bold truncate">${item.email}</span>
                    </div>
                </div>

                <div class="leading-tight md:border-l border-slate-100 md:pl-6">
                    <p class="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Collateral</p>
                    <div class="flex flex-col">
                        <span class="text-xs font-black text-slate-700">${item.gold_weight}g • Gold Loan</span>
                        <span class="text-[10px] text-slate-400 font-bold">Val: ₹${Number(item.est_amount).toLocaleString('en-IN')}</span>
                    </div>
                </div>

                <div class="leading-tight md:border-l border-slate-100 md:pl-6">
                    <p class="text-[9px] font-black text-yellow-600 uppercase tracking-widest mb-1">Financials</p>
                    <div class="flex flex-col">
                        <span class="text-base font-black text-slate-800">₹${Number(item.loan_amount).toLocaleString('en-IN')}</span>
                        <span class="text-[10px] font-black text-emerald-600 uppercase">EMI: ₹${Number(item.monthly_emi).toLocaleString('en-IN')}</span>
                    </div>
                </div>

                <div class="leading-tight md:border-l border-slate-100 md:pl-6">
                    <p class="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Appointment</p>
                    <div class="flex flex-col">
                        <span class="text-xs font-black text-slate-700">${item.appt_date}</span>
                        <span class="text-[10px] text-slate-400 font-bold">${item.appt_time}</span>
                    </div>
                </div>
            </div>

            <div class="pt-3 border-t border-slate-50 flex flex-col md:flex-row justify-between items-center gap-2">
                <div class="flex items-center gap-2 text-slate-400 italic text-[11px] font-medium">
                    <i class="fas fa-info-circle text-slate-300 text-[10px]"></i>
                    "${item.description || 'Your Gold Loan application has been approved.'}"
                </div>
                <div class="text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                    <i class="far fa-calendar-alt"></i> ISSUED: ${item.date}
                </div>
            </div>

        </div>
    </div>`;

    });

    updatePaginationUI();
}

function updatePaginationUI() {
    const totalRecords = goldRecords.length;
    totalPages = Math.ceil(totalRecords / pageSize);
    const container = document.getElementById('pageIndicator');
    
    document.getElementById('startRange').innerText = totalRecords === 0 ? 0 : (currentPage - 1) * pageSize + 1;
    document.getElementById('endRange').innerText = Math.min(currentPage * pageSize, totalRecords);
    document.getElementById('totalEntries').innerText = totalRecords;

    document.getElementById('prevBtn').disabled = currentPage === 1;
    document.getElementById('nextBtn').disabled = currentPage === totalPages || totalRecords === 0;

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
        btn.className = `h-11 w-11 rounded-xl text-xs font-bold transition-all ${i === currentPage ? 'bg-amber-500 text-white shadow-lg shadow-amber-200' : 'bg-white border border-slate-200 text-slate-500 hover:bg-amber-50'}`;
        btn.onclick = () => goToPage(i);
        container.appendChild(btn);
    }

    container.appendChild(createNavBtn("Last", totalPages, currentPage === totalPages || totalRecords === 0));
}

function createNavBtn(label, page, disabled) {
    const btn = document.createElement('button');
    btn.innerText = label;
    btn.className = `h-11 px-4 rounded-xl border border-slate-100 bg-white text-slate-500 text-[10px] font-black uppercase transition-all ${disabled ? 'opacity-30 cursor-not-allowed' : 'hover:bg-amber-50 hover:text-amber-600 active:scale-95'}`;
    if(!disabled) btn.onclick = () => goToPage(page);
    return btn;
}

function goToPage(page) {
    currentPage = page;
    renderLoans();
    window.scrollTo({top: 0, behavior: 'smooth'});
}

function changePage(dir) {
    if(currentPage + dir >= 1 && currentPage + dir <= totalPages) {
        goToPage(currentPage + dir);
    }
}

function filterMyLoans() {
    const val = document.getElementById("loanSearch").value;
    fetchMyLoans(val);
}

function navigateToEMIStatus(loan_id) {
    window.location.href = `/gold/emil-payment/${loan_id}`;
}

document.addEventListener('DOMContentLoaded', () => fetchMyLoans());