let installments = [];
let currentPage = 1;
let pageSize = 4; 

const getRequestID = () => window.location.pathname.split('/').pop();


function calculateDynamicPageSize(total) {
    if (total <= 12) return 4;
    if (total <= 24) return 8;
    return 12;
}


async function fetchInstallments() {
    const requestID = getRequestID();
    const container = document.getElementById('emiScheduleContainer');

    try {
        const response = await fetch(`/get-bike-loan-emi/${requestID}`, {
            method: 'POST'
        });
        
        if (!response.ok) throw new Error('Fetch failed');
        
        const result = await response.json();
        const dbInstallments = result.installments || [];
        const totalTenure = parseInt(result.emi_month) || 0;

        installments = [...dbInstallments];

        installments = dbInstallments.map(inst => ({
            no: inst.installment_no,
            date: inst.date,
            pay_date: inst.pay_date,
            amount: inst.amount,
            status: inst.status,
            lateFee: inst.late_fee || 0,
            emiTime: inst.emi_time || '--:--',
            isVirtual: false
        }));


        if (installments.length < totalTenure) {
            const today = new Date();
            today.setHours(0, 0, 0, 0); 

            const startDateStr = document.getElementById("loan_start_date").innerText.trim();
            const parts = startDateStr.split('-').map(Number);
            const startYear = parts[0];
            const startMonth = parts[1]; 
            const startDay = parts[2]; // e.g., 25

            let baseAmount = dbInstallments.length > 0 ? dbInstallments[0].amount : parseFloat(document.getElementById("emi_amount").innerText.replace(/[^0-9.-]+/g,"")) || 0;
            const remainingCount = totalTenure - installments.length;

            for (let i = 1; i <= remainingCount; i++) {
                const currentNo = installments.length + 1;
                
                // 1. Anchor to start components 
                // JS Months are 0-11, so we do 
                let nextDate = new Date(startYear, (startMonth - 1) + currentNo, startDay);
                
                // 2. SNAP RULE: If day is 29, 30, or 31 and month is shorter
                // This forces it to the last day of the correct month
                if (nextDate.getDate() !== startDay && startDay > 28) {
                    nextDate.setDate(0); 
                }
                nextDate.setHours(0, 0, 0, 0);

                // 3. THE FIX: Build the YYYY-MM-DD string MANUALLY (Avoiding UTC shift)
                const y = nextDate.getFullYear();
                const m = String(nextDate.getMonth() + 1).padStart(2, '0');
                const d = String(nextDate.getDate()).padStart(2, '0');
                const formattedDate = `${y}-${m}-${d}`;

                // 4. Calculate Status
                let currentStatus = 'pending';
                let currentLateFee = 0;
                const msPerDay = 24 * 60 * 60 * 1000;
                const diffDays = Math.floor((today - nextDate) / msPerDay);

                if (diffDays >= 1) {
                    currentStatus = 'overdue';
                    currentLateFee = Math.min(diffDays * 100, 500);
                }

                installments.push({
                    no: currentNo,
                    date: formattedDate, // Now strictly YYYY-MM-25
                    pay_date:'--:--:--',
                    amount: baseAmount,
                    status: currentStatus, 
                    lateFee: currentLateFee,
                    emiTime: '--:--',
                    isVirtual: true 
                });
            }
        }
        
        pageSize = calculateDynamicPageSize(installments.length);
        renderSchedule();
        updateGlobalProgress();

    } catch (error) {
        console.error("Fetch error:", error);
        if (container) {
            container.innerHTML = `
                <div class="col-span-full py-20 text-center animate__animated animate__fadeIn">
                    <p class="text-rose-500 font-black uppercase tracking-widest text-xs">Failed to load schedule</p>
                </div>`;
        }
    }
}

/**
 * Render the Square Card Tiles
 */
function renderSchedule() {
    const container = document.getElementById('emiScheduleContainer');
    if (!container) return;
    
    container.className = "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6";
    container.innerHTML = ''; 

    const loanRequestID=getRequestID();

    const start = (currentPage - 1) * pageSize;
    const paginatedData = installments.slice(start, start + pageSize);

    if (!installments || installments.length === 0) {
        container.className = "block"; 
        container.innerHTML = `<div class="py-20 text-center uppercase text-slate-400 font-black text-[10px]">No schedule found</div>`;
        return;
    }

    const firstUnpaidIndex = installments.findIndex(inst => inst.status.toLowerCase() !== 'paid');

    paginatedData.forEach((item, index) => {
        const currentStatus = (item.status || 'pending').toLowerCase();
        const globalIndex = start + index;
        const isEligibleForPayment = (globalIndex === firstUnpaidIndex);

        const statusConfigs = {
            'paid': { 
                style: 'border-t-emerald-500', 
                badge: 'bg-emerald-50 text-emerald-700',
                text: 'PAID',
                icon: 'fa-check-circle',
                btn: `
                    <button onclick="printReceipt(${item.no},${loanRequestID})" class="w-full mt-3 py-2 rounded-xl bg-white border border-slate-100 text-slate-400 flex items-center justify-center gap-2 hover:bg-slate-50 transition-all active:scale-95 shadow-sm">
                        <i class="fas fa-print text-[9px]"></i>
                        <span class="text-[9px] font-black uppercase tracking-widest">Receipt</span>
                    </button>`
            },
            'overdue': { style: 'border-t-red-500', badge: 'bg-red-50 text-red-700', text: 'OVERDUE', icon: 'fa-exclamation-circle' },
            'pending': { style: 'border-t-blue-500', badge: 'bg-amber-50 text-amber-700', text: 'PENDING', icon: 'fa-credit-card' }
        };

        const config = statusConfigs[currentStatus] || statusConfigs['pending'];

     
        let actionBtn = '<div class="mt-3 h-10"></div>'; 
        if (currentStatus === 'paid') {
            actionBtn = config.btn;
        } else if (isEligibleForPayment) {

           
            const emi_amount = parseFloat(document.getElementById("emi_amount").innerText.replace(/[^0-9.-]+/g,"")) || 0;

            const diffInDays = Math.floor((new Date() - new Date(item.date)) / (1000 * 60 * 60 * 24));
            const calculatedFee = diffInDays > 0 ? diffInDays * 100 : 0;
            item.lateFee = Math.min(calculatedFee, 500);

            actionBtn = `
                <button onclick="payEMI('${item.no}','${loanRequestID}',${emi_amount},'bike loan','${item.date}',${item.lateFee})" class="w-full mt-3 py-2.5 rounded-xl bg-[#0F172A] text-white flex items-center justify-center gap-2 hover:bg-slate-800 transition-all shadow-lg active:scale-95">
                    <i class="fas fa-wallet text-amber-400 text-[10px]"></i>
                    <span class="text-[9px] font-black uppercase tracking-[0.1em]">Pay Now</span>
                </button>`;
        }

        container.innerHTML += `
            <div class="relative bg-white p-4 md:p-5 rounded-[2rem] border border-slate-100 border-t-4 ${config.style} shadow-sm flex flex-col items-center text-center transition-all duration-300 animate__animated animate__fadeInUp">
                
                <div class="w-8 h-8 mb-3 rounded-full bg-slate-50 border border-slate-100 text-slate-400 flex items-center justify-center font-black text-[10px]">
                    ${item.no.toString().padStart(2, '0')}
                </div>

                <div class="mb-3 leading-none">
                    <span class="text-[10px] text-slate-400 font-black uppercase block tracking-widest mb-1"><p>Due Date<p/></span>
                    <p class="text-[12px] font-black text-slate-700">${item.date}</p>
                </div>

                
                <div class="mb-3 leading-none">
                    <span class="text-[10px] text-slate-400 font-black uppercase block tracking-widest mb-1">Payment Date</span>
                    <p class="text-[12px] font-black text-slate-700">${item.pay_date}</p>
                    <p class="text-[10px] text-amber-500 font-bold mt-0.5">${item.emiTime || '--:--'}</p>
                </div>

                <div class="mb-3 w-full py-2 bg-slate-50/60 rounded-xl border border-slate-50/50">
                    <span class="text-[12px] text-slate-400 font-black uppercase block tracking-tighter mb-0.5">Installment</span>
                    <p class="text-base font-black text-slate-800">₹${Number(item.amount).toLocaleString('en-IN', { 
                            minimumFractionDigits: 2, 
                            maximumFractionDigits: 2 
                        })}</p>
                </div>

                <div class="mb-3">
                    <p class="text-[12px] font-black ${item.lateFee > 0 ? 'text-red-500' : 'text-slate-300'} mb-2">
                        Fee: ₹${Number(item.lateFee).toLocaleString('en-IN', { 
                            minimumFractionDigits: 2, 
                            maximumFractionDigits: 2 
                        })}
                    </p>
                    <div class="inline-flex items-center px-2 py-1 rounded-lg ${config.badge} gap-1.5">
                        <i class="fas ${config.icon} text-[8px]"></i>
                        <span class="text-[8px] font-black uppercase tracking-wider">${config.text}</span>
                    </div>
                </div>

                <div class="w-full mt-auto">
                    ${actionBtn}
                </div>
            </div>`;
    });
    
     updatePaginationUI();
}



function updatePaginationUI() {
    const total = installments.length;
    const totalPages = Math.ceil(total / pageSize);
    const start = (currentPage - 1) * pageSize;

    if (document.getElementById('startRange')) document.getElementById('startRange').innerText = total === 0 ? 0 : start + 1;
    if (document.getElementById('endRange')) document.getElementById('endRange').innerText = Math.min(start + pageSize, total);
    if (document.getElementById('totalEntries')) document.getElementById('totalEntries').innerText = total;

    if (document.getElementById('prevBtn')) document.getElementById('prevBtn').disabled = currentPage === 1;
    if (document.getElementById('nextBtn')) document.getElementById('nextBtn').disabled = currentPage * pageSize >= total;

    renderPageNumbers(totalPages);
}

function renderPageNumbers(totalPages) {
    const container = document.getElementById('pageIndicator');
    if (!container) return;
    container.innerHTML = '';
    
    createNavBtn("First", 1, currentPage === 1, container);
    
    let start = Math.max(1, currentPage - 1);
    let end = Math.min(totalPages, start + 3);
    if (end === totalPages) start = Math.max(1, end - 3);

    for (let i = start; i <= end; i++) {
        if (i < 1) continue;
        const btn = document.createElement('button');
        btn.innerText = i;
        btn.className = (i === currentPage) 
            ? "h-10 w-10 rounded-xl bg-blue-600 text-white text-xs font-black shadow-lg shadow-blue-500/20 scale-105 transition-all" 
            : "h-10 w-10 rounded-xl text-slate-500 border border-slate-100 text-xs font-bold hover:bg-blue-50 transition-all";
        btn.onclick = () => goToPage(i);
        container.appendChild(btn);
    }
    
    createNavBtn("Last", totalPages, currentPage === totalPages, container);
}

function createNavBtn(label, page, isActive, container) {
    const btn = document.createElement('button');
    btn.innerText = label;
    btn.className = `px-4 h-10 rounded-xl border border-slate-100 bg-white text-slate-600 text-[10px] font-black uppercase transition-all ${
        isActive ? 'opacity-40 cursor-not-allowed' : 'active:scale-95 hover:bg-slate-50'
    }`;
    btn.onclick = () => { if (!isActive) goToPage(page); };
    container.appendChild(btn);
}

function goToPage(page) { 
    currentPage = page; 
    renderSchedule(); 
    window.scrollTo({ top: 0, behavior: 'smooth' }); 
}

function changePage(dir) { 
    const totalPages = Math.ceil(installments.length / pageSize);
    const target = currentPage + dir;
    if (target >= 1 && target <= totalPages) goToPage(target); 
}

function updateGlobalProgress() {
    if (installments.length === 0) return;
    const paidCount = installments.filter(i => (i.status || '').toLowerCase() === "paid").length;
    const totalCount = installments.length;
    const percent = ((paidCount / totalCount) * 100).toFixed(1);

    if (document.getElementById('progressBarFill')) document.getElementById('progressBarFill').style.width = percent + '%';
    if (document.getElementById('progressPercentText')) document.getElementById('progressPercentText').innerText = percent + '%';
    if (document.getElementById('progressCountText')) document.getElementById('progressCountText').innerText = `${paidCount} of ${totalCount} Paid`;
}

document.addEventListener('DOMContentLoaded', fetchInstallments);


async function printReceipt(installmentNo, loanRequestID) {
    loan_id=document.getElementById('b_loan_id').innerText;
    try {
        // 1. Show a "Processing" state
        if (typeof showNotify === 'function') {
            showNotify('Generating your receipt...', 'success');
        }

        // 2. Call the PDF Generation API
        const response = await fetch('/generate-receipt-view/bike-loan', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                installment_no: installmentNo,
                loan_request_id: loanRequestID
            })
        });

        if (!response.ok) throw new Error('Failed to load receipt');

        // 1. Get the HTML text from the server
        const htmlContent = await response.text();

        // 2. Open a new blank tab
        const receiptWindow = window.open('', '_blank');

        // 3. Write the HTML content into that new tab
        receiptWindow.document.write(htmlContent);
        receiptWindow.document.title = `FinTrack Receipt #${loan_id}-${installmentNo}`;
        receiptWindow.document.close(); // Necessary for the browser to render properly



    } catch (error) {
        console.error('Error:', error);
        alert('Could not open receipt view');
    }
}