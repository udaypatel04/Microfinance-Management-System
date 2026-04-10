let currentPage = 1;
let installments = [];
let pageSize = 4;
let emi_month=0;
const getRequestID = () => window.location.pathname.split('/').pop();


function calculateDynamicPageSize(total) {
    if (total <= 12) return 4;
    if (total <= 24) return 6;
    return 8;
}

async function fetchInstallments() {
    const requestID = getRequestID();
    const container = document.getElementById('emiScheduleContainer');
    
    try {
        const response = await fetch(`/get-gold-loan-emi/${requestID}`, {
            method: 'POST'
        });
        if (!response.ok) throw new Error('Fetch failed');
        
        const result = await response.json();
        const dbInstallments = result.installments || [];
        const totalTenure = parseInt(result.emi_month) || 0;
       

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

            let baseAmount = (dbInstallments.length > 0 ? dbInstallments[0].amount : parseFloat(document.getElementById("emi_amount").innerText.replace(/[^0-9.-]+/g,"")) || 0).toFixed(2);
            const remainingCount = totalTenure - installments.length;

            for (let i = 1; i <= remainingCount; i++) {
                const currentNo = installments.length + 1;
                
                // 1. Anchor to start components (plus currentNo)
                // JS Months are 0-11 (startMonth - 1)
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
            container.innerHTML = `<div class="col-span-full py-20 text-center text-rose-500 font-black tracking-widest uppercase text-xs">Failed to load schedule</div>`;
        }
    }
}

function renderSchedule() {
    const container = document.getElementById('emiScheduleContainer');
    if (!container) return;
    
    // Set container to a responsive grid for square tiles
    container.className = "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6";
    container.innerHTML = ''; 

    const loanRequestID=getRequestID();
     
       
   

    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize;
    const paginatedData = installments.slice(start, end);

    if (!installments || installments.length === 0) {
        container.className = "block"; // Reset grid for empty state
        container.innerHTML = `
            <div class="py-20 flex flex-col items-center justify-center text-center animate__animated animate__fadeIn">
                <div class="w-16 h-16 mb-4 bg-slate-50 rounded-full flex items-center justify-center text-slate-300">
                    <i class="fas fa-calendar-times text-3xl"></i>
                </div>
                <p class="text-slate-400 font-black uppercase tracking-widest text-[10px]">No repayment schedule found</p>
            </div>`;
        updatePaginationUI();
        if(document.getElementById("paginationCard")) document.getElementById("paginationCard").style.display = "none";
        return;
    }

    const firstUnpaidIndex = installments.findIndex(inst => inst.status.toLowerCase() !== 'paid');

    paginatedData.forEach((item, index) => {
        const currentStatus = (item.status || 'pending').toLowerCase();
        const globalIndex = start + index;
        const isEligibleForPayment = (globalIndex === firstUnpaidIndex);

        const statusConfigs = {
            'paid': { 
                style: 'border-t-emerald-500 bg-emerald-50/20', 
                badge: 'bg-emerald-100 text-emerald-700',
                text: 'PAID',
                icon: 'fa-check-circle',
                btn: `
                    <button onclick="printReceipt('${item.no}', '${loanRequestID}')" class="w-full mt-auto py-2.5 rounded-xl bg-white border border-slate-100 text-slate-400 flex items-center justify-center gap-2 hover:bg-amber-50 hover:text-amber-600 transition-all shadow-sm active:scale-95">
                        <i class="fas fa-print text-[10px]"></i>
                        <span class="text-[9px] font-black uppercase">Receipt</span>
                    </button>`
            },
            'overdue': { 
                style: 'border-t-red-500 bg-red-50/10', 
                badge: 'bg-red-100 text-red-700',
                text: 'OVERDUE',
                icon: 'fa-exclamation-circle'
            },
            'pending': { 
                style: 'border-t-amber-500 bg-white', 
                badge: 'bg-amber-100 text-amber-700',
                text: 'PENDING',
                icon: 'fa-credit-card'
            }
        };

        const config = statusConfigs[currentStatus] || statusConfigs['pending'];

        let actionBtn = '<div class="mt-auto h-10"></div>';
        if (currentStatus === 'paid') {
            actionBtn = config.btn;
        } else if (isEligibleForPayment) {

           // Clean the string to ensure it's a pure number
            const emi_amount = parseFloat(document.getElementById("emi_amount").innerText.replace(/[^0-9.-]+/g,"")) || 0;

            const diffInDays = Math.floor((new Date() - new Date(item.date)) / (1000 * 60 * 60 * 24));
            const calculatedFee = diffInDays > 0 ? diffInDays * 100 : 0;
            item.lateFee = Math.min(calculatedFee, 500);

            actionBtn = `
                <button onclick="payEMI('${item.no}','${loanRequestID}',${emi_amount},'gold loan','${item.date}',${item.lateFee})" class="w-full mt-auto py-2.5 rounded-xl bg-slate-900 text-white flex items-center justify-center gap-2 hover:bg-amber-600 transition-all shadow-md active:scale-95">
                    <i class="fas fa-wallet text-[10px] text-yellow-400"></i>
                    <span class="text-[9px] font-black uppercase tracking-widest">Pay Now</span>
                </button>`;
        }

       container.innerHTML += `
      <div class="relative bg-white p-4 rounded-[1.5rem] border border-slate-100 border-t-4 ${config.style} shadow-sm flex flex-col items-center text-center group hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 animate__animated animate__fadeInUp">
         
        <div class="w-8 h-8 mb-2 rounded-full bg-slate-50 border border-slate-100 text-slate-400 group-hover:border-amber-200 group-hover:text-amber-600 flex items-center justify-center font-black text-[10px] transition-all shrink-0">
            ${item.no.toString().padStart(2, '0')}
        </div>

        <div class="mb-2.5">
            <span class="text-[10px] text-slate-400 font-black uppercase block tracking-tighter"><p>Due Date</p></span>
            <p class="text-[12px] font-bold text-slate-700 leading-tight">${item.date}</p>
           
        </div>

         <div class="mb-2.5">
            <span class="text-[10px] text-slate-400 font-black uppercase block tracking-tighter">Payment Date</span>
            <p class="text-[12px] font-bold text-slate-700 leading-tight">${item.pay_date}</p>
            <p class="text-[10px] text-amber-600 font-bold">${item.emiTime || '--:--'}</p>
        </div>

        <div class="mb-3 w-full py-1.5 bg-slate-50/50 rounded-xl border border-slate-50">
            <span class="text-[12px] text-slate-400 font-black uppercase block tracking-tighter">Installment</span>
            <p class="text-xs font-black text-slate-800">₹${Number(item.amount).toLocaleString('en-IN', { 
                            minimumFractionDigits: 2, 
                            maximumFractionDigits: 2 
                        })}</p>
        </div>

        <div class="flex flex-col items-center gap-2 mb-3 w-full">
            <div>
                <span class="text-[12px] text-slate-400 font-black uppercase block tracking-tighter">Late Fee</span>
                <p class="text-[9px] font-bold ${item.lateFee > 0 ? 'text-red-600' : 'text-slate-300'}">
                    ₹ ${Number(item.lateFee).toLocaleString('en-IN', { 
                            minimumFractionDigits: 2, 
                            maximumFractionDigits: 2 
                        })}
                </p>
            </div>

            <div class="inline-flex items-center px-2 py-0.5 rounded-full ${config.badge} gap-1 shrink-0">
                <i class="fas ${config.icon} text-[7px]"></i>
                <span class="text-[7px] font-black uppercase tracking-tight">${config.text}</span>
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
            ? "h-10 w-10 rounded-xl bg-amber-600 text-white text-xs font-black shadow-lg shadow-amber-500/20 scale-105 transition-all" 
            : "h-10 w-10 rounded-xl text-slate-500 border border-slate-100 text-xs font-bold hover:bg-amber-50 transition-all";
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

function changePage(direction) {
    const totalPages = Math.ceil(installments.length / pageSize);
    const targetPage = currentPage + direction;

    if (targetPage >= 1 && targetPage <= totalPages) {
        goToPage(targetPage);
    }
}

function updateGlobalProgress() {
    if (installments.length === 0) return;
    const paidCount = installments.filter(i => (i.status || '').toLowerCase() === "paid").length;
    const totalCount = installments.length;
    const percent = ((paidCount / totalCount) * 100).toFixed(1);

    const bar = document.getElementById('progressBarFill');
    if (bar) {
        bar.style.width = percent + '%';
        bar.className = "h-full bg-amber-500 transition-all duration-500";
    }
    if (document.getElementById('progressPercentText')) document.getElementById('progressPercentText').innerText = percent + '%';
    if (document.getElementById('progressCountText')) document.getElementById('progressCountText').innerText = `${paidCount} of ${totalCount} Installments Paid`;
}

document.addEventListener('DOMContentLoaded', fetchInstallments);



async function printReceipt(installmentNo, loanRequestID) {
     loan_id=document.getElementById('g_loan_id').innerText;
    try {
        // 1. Show a "Processing" state
        if (typeof showNotify === 'function') {
            showNotify('Generating your receipt...', 'success');
        }

        // 2. Call the PDF Generation API
        const response = await fetch('/generate-receipt-view/gold-loan', {
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