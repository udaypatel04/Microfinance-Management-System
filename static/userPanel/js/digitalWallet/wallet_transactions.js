
let fullLedger = [];     
let filteredData = [];  
let currentPage = 1;   
const pageSize = 6;     

document.addEventListener('DOMContentLoaded', fetchLedger);

async function fetchLedger() {
    try {
        const response = await fetch('/get-wallet-history');
        const result = await response.json();

        if (result.success && result.data.length > 0) {
            fullLedger = result.data;
            filteredData = [...fullLedger];
            renderUI();
        } else {
            showEmptyState();
        }
    } catch (error) {
        console.error("API Fetch Error:", error);
        document.getElementById('transaction-grid').innerHTML = `<p class="col-span-full text-center text-red-500 font-bold p-10 bg-red-50 rounded-3xl">Gateway Timeout: Unable to load Ledger.</p>`;
    }
}

/**
 * Main Render Controller
 */
function renderUI() {
    const grid = document.getElementById('transaction-grid');
    const emptyState = document.getElementById('empty-state');
    const paginationCard = document.getElementById('paginationCard');

    const total = filteredData.length;
    const start = (currentPage - 1) * pageSize;
    const paginatedItems = filteredData.slice(start, start + pageSize);

    if (total === 0) {
        grid.classList.add('hidden');
        paginationCard.classList.add('hidden');
        emptyState.classList.remove('hidden');
        return;
    }

    grid.classList.remove('hidden');
    emptyState.classList.add('hidden');
    paginationCard.classList.remove('hidden');

    grid.innerHTML = paginatedItems.map(tx => {
            // New logic to handle 3 types: credit, debit, revert
            let theme = 'rose';
            let icon = 'fa-arrow-up-right';
            let label = 'EMI Payment';
            let sign = '-';

            if (tx.trans_type === 'credit') {
                theme = 'emerald';
                icon = 'fa-arrow-down-left';
                label = 'Wallet Top-up';
                sign = '+';
            } else if (tx.trans_type === 'revert') {
                theme = 'indigo'; // Indigo for system reversals
                icon = 'fa-rotate-left';
                label = 'Payment Reversal';
                sign = '+';
            }

            const receiptDate = tx.created_at; 
            const receiptTime = tx.payment_time.replace(/:/g, '-'); 
            const formattedID = tx.id.toString().padStart(3, '0'); 
            
            const fullReceiptName = `Wallet_Receipt_TXN_${receiptDate}_${receiptTime}_${formattedID}`;

            return `
                <div class="group relative bg-white rounded-3xl p-5 border border-slate-100 shadow-sm hover:shadow-xl hover:shadow-${theme}-500/10 transition-all duration-300 overflow-hidden flex flex-col h-full">
                    
                    <div class="flex items-center justify-between mb-4">
                        <div class="flex items-center space-x-3">
                            <div class="w-10 h-10 bg-${theme}-50 text-${theme}-600 rounded-2xl flex items-center justify-center group-hover:bg-${theme}-600 group-hover:text-white transition-all duration-500">
                                <i class="fas ${icon} text-sm"></i>
                            </div>
                            <div>
                                <h4 class="text-[13px] font-black text-slate-900 leading-tight">${tx.display_date}</h4>
                                <span class="text-[12px] font-bold text-slate-400 uppercase tracking-tighter">${label}</span>
                            </div>
                        </div>
                        <div class="text-right">
                            <span class="inline-flex items-center bg-${theme}-50 text-${theme}-600 px-2 py-0.5 rounded-lg text-[8px] font-black border border-${theme}-100 uppercase">
                                ${tx.trans_type}
                            </span>
                        </div>
                    </div>

                    <div class="flex items-end justify-between py-3 border-y border-slate-50 flex-grow">
                        <div>
                            <p class="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Value</p>
                            <h3 class="text-2xl font-black text-${theme}-600 tracking-tighter">
                                ${sign} ₹${parseFloat(tx.amount).toLocaleString('en-IN', {minimumFractionDigits: 2})}
                            </h3>
                        </div>
                        <div class="text-right flex flex-col items-end">
                            <div class="flex items-center space-x-1 text-slate-400 mb-1">
                                <i class="far fa-clock text-[12px]"></i>
                                <span class="text-[12px] font-black uppercase">${tx.display_time}</span>
                            </div>
                            <code class="text-[9px] font-mono text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">${tx.payment_id.substring(0, 10)}...</code>
                        </div>
                    </div>

                    <div class="flex items-center justify-between mt-4">
                        <div class="flex items-center space-x-1.5 text-slate-300">
                            <i class="fas fa-fingerprint text-[10px]"></i>
                            <span class="text-[12px] font-mono opacity-60">${tx.digital_signature.substring(0, 10)}...</span>
                        </div>
                        
                        <button onclick="printWalletReceipt(${tx.id}, '${fullReceiptName}')" class="flex items-center text-[10px] font-black text-slate-900 hover:text-${theme}-600 transition-colors group/btn uppercase tracking-widest">
                            <i class="fas fa-print mr-1.5 text-[9px]"></i> Receipt
                        </button>
                    </div>

                    <div class="absolute -bottom-4 -right-4 w-12 h-12 bg-${theme}-500/5 rounded-full blur-xl group-hover:bg-${theme}-500/10 transition-colors"></div>
                </div>
            `;
        }).join('');

    updatePaginationUI(total);
}

/**
 * Filter Management
 */
function filterType(type) {
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('bg-white', 'shadow-sm', 'text-slate-900', 'active');
        btn.classList.add('text-slate-400');
        if (btn.innerText.toLowerCase().includes(type) || (type === 'all' && btn.innerText === 'ALL')) {
            btn.classList.add('bg-white', 'shadow-sm', 'text-slate-900', 'active');
            btn.classList.remove('text-slate-400');
        }
    });

    currentPage = 1;
    filteredData = (type === 'all') ? [...fullLedger] : fullLedger.filter(t => t.trans_type === type);
    renderUI();
}

/**
 * Advanced Pagination UI
 */
function updatePaginationUI(total) {
    const totalPages = Math.ceil(total / pageSize);
    const start = (currentPage - 1) * pageSize;

    document.getElementById('startRange').innerText = total === 0 ? 0 : start + 1;
    document.getElementById('endRange').innerText = Math.min(start + pageSize, total);
    document.getElementById('totalEntries').innerText = total;

    document.getElementById('prevBtn').disabled = (currentPage === 1);
    document.getElementById('nextBtn').disabled = (currentPage >= totalPages || total === 0);

    renderPageNumbers(totalPages);
}

function renderPageNumbers(totalPages) {
    const container = document.getElementById('pageIndicator');
    if (!container) return;
    container.innerHTML = '';
    
    // Jump to First
    createNavBtn("First", 1, currentPage === 1, container);
    
    let start = Math.max(1, currentPage - 1);
    let end = Math.min(totalPages, start + 2);
    if (end === totalPages) start = Math.max(1, end - 2);

    for (let i = start; i <= end; i++) {
        if (i < 1) continue;
        const btn = document.createElement('button');
        btn.innerText = i;
        btn.className = (i === currentPage) 
            ? "h-10 w-10 rounded-xl bg-emerald-600 text-white text-[10px] font-black shadow-lg shadow-emerald-500/20 scale-105 transition-all" 
            : "h-10 w-10 rounded-xl text-slate-400 border border-transparent text-[10px] font-bold hover:bg-emerald-50 hover:text-emerald-600 transition-all";
        btn.onclick = () => goToPage(i);
        container.appendChild(btn);
    }
    
    // Jump to Last
    createNavBtn("Last", totalPages, currentPage === totalPages || totalPages === 0, container);
}

function createNavBtn(label, page, isActive, container) {
    const btn = document.createElement('button');
    btn.innerText = label;
    btn.className = `px-4 h-10 rounded-xl border border-slate-100 bg-white text-slate-600 text-[10px] font-black uppercase transition-all ${
        isActive ? 'opacity-30 cursor-not-allowed' : 'active:scale-95 hover:bg-slate-50 hover:text-emerald-600'
    }`;
    btn.onclick = () => { if (!isActive) goToPage(page); };
    container.appendChild(btn);
}

function goToPage(page) {
    currentPage = page;
    renderUI();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function changePage(dir) {
    const totalPages = Math.ceil(filteredData.length / pageSize);
    const target = currentPage + dir;
    if (target >= 1 && target <= totalPages) goToPage(target);
}

function showEmptyState() {
    document.getElementById('transaction-grid').classList.add('hidden');
    document.getElementById('paginationCard').classList.add('hidden');
    document.getElementById('empty-state').classList.remove('hidden');
}


async function printWalletReceipt(transactionID, receiptName) {
    try {
        if (typeof showNotify === 'function') {
            showNotify('Generating Wallet Receipt...', 'success');
        }

        const response = await fetch('/generate-receipt-view/wallet', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                transaction_id: transactionID
            })
        });

        if (!response.ok) throw new Error('Failed to load receipt');

        const htmlContent = await response.text();
        const receiptWindow = window.open('', '_blank');

        receiptWindow.document.write(htmlContent);
        
        // Sets the browser tab title to your specific format
        receiptWindow.document.title = receiptName;
        
        receiptWindow.document.close();


    } catch (error) {
        console.error('Error:', error);
        showNotify('Could not open wallet receipt view','error');
    }
}