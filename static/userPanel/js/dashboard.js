 const Dashboard = {
        formatINR: (num) => {
            return new Intl.NumberFormat('en-IN', {
                style: 'currency',
                currency: 'INR',
                maximumFractionDigits: 0
            }).format(num);
        },

        updateCreditRing: (score) => {
            const ring = document.getElementById('creditRing');
            const circumference = 301.5; 
            const progress = score / 900;
            const offset = circumference - (progress * circumference);
            ring.style.strokeDashoffset = offset;
        },

        init: async function() {
            try {
                const response = await fetch('/dashboard-data'); 
                const data = await response.json();

                if (data.status === 'success') {
                    const stats = data.summary;
                    const score = stats.credit_score;

                    // Update Credit Score and Label
                    document.getElementById('creditScoreVal').innerText = score;
                    const label = document.getElementById('creditScoreLabel');
                    
                    if (score >= 750) {
                        label.innerText = 'Excellent';
                        label.className = 'text-[8px] font-black text-emerald-500 uppercase tracking-tighter leading-none pt-1';
                    } else if (score >= 700) {
                        label.innerText = 'Good';
                        label.className = 'text-[8px] font-black text-blue-500 uppercase tracking-tighter leading-none pt-1';
                    } else if (score >=600) {
                        label.innerText = 'Fair';
                        label.className = 'text-[8px] font-black text-amber-500 uppercase tracking-tighter leading-none pt-1';
                    }else if (score>=30){
                        label.innerText = 'Bad';
                        label.className = 'text-[8px] font-black text-red-500 uppercase tracking-tighter leading-none pt-1';
                    }else{
                        label.innerText = 'None';
                        label.className = 'text-[8px] font-black text-slate-500 uppercase tracking-tighter leading-none pt-1';
                    }

                    document.getElementById('walletBalance').innerText = this.formatINR(stats.wallet_balance);
                    // Update Global Stats
                    document.getElementById('totalOutstanding').innerText = this.formatINR(stats.outstanding);
                    document.getElementById('activeLoansCount').innerText = stats.count.toString().padStart(2, '0');
                    document.getElementById('nextEmi').innerText = stats.next_emi_date;

                    this.updateCreditRing(score);
                    this.renderPortfolio(data.loans);
                }
            } catch (err) {
                console.error("Dashboard failed to sync:", err);
            }
        },

        renderPortfolio: function(loans) {
            const container = document.getElementById('loanPortfolioContainer');
            if (!container) return;

            if (loans.length === 0) {
                container.innerHTML = `<div class="col-span-full text-center py-20 bg-white rounded-[2.5rem] border border-slate-100 text-slate-400 font-bold uppercase text-[10px] tracking-widest">No active loans found.</div>`;
                return;
            }

            container.innerHTML = loans.map(loan => {
                const isGold = loan.type === 'Gold';
                const colorClass = isGold ? 'bg-yellow-50 text-yellow-600' : 'bg-blue-50 text-blue-600';
                
                // Status Badge Logic
                const today = new Date().getDate();
                const dueDay = parseInt(loan.due);
                let statusBadge = '';

                if (loan.is_paid_this_month) {
                    statusBadge = `<span class="bg-emerald-50 text-emerald-600 text-[8px] font-black px-2 py-1 rounded-md uppercase">Paid</span>`;
                }else if (loan.is_loan_issue_month) {
                    statusBadge = `<span class="bg-blue-50 text-blue-600 text-[8px] font-black px-2 py-1 rounded-md uppercase">Upcoming</span>`;
                }else if (today > dueDay) {
                    statusBadge = `<span class="bg-rose-50 text-rose-600 text-[8px] font-black px-2 py-1 rounded-md uppercase">Overdue</span>`;
                }else{
                     statusBadge = `<span class="bg-blue-50 text-blue-600 text-[8px] font-black px-2 py-1 rounded-md uppercase">Upcoming</span>`;
                }

                return `
                <div class="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/40 relative overflow-hidden group hover:shadow-2xl hover:shadow-blue-100/50 transition-all duration-500">
                    <div class="flex items-center justify-between mb-6">
                        <div class="flex items-center gap-3">
                            <div class="w-10 h-10 ${colorClass} rounded-xl flex items-center justify-center">
                                <i class="fas ${isGold ? 'fa-gem' : 'fa-motorcycle'} text-xs"></i>
                            </div>
                            <div>
                                <p class="text-sm font-black text-slate-800 tracking-tight">${loan.name}</p>
                                <p class="text-[9px] text-slate-400 font-bold uppercase tracking-widest">${loan.type} Loan</p>
                            </div>
                        </div>
                        ${statusBadge}
                    </div>

                    <div class="grid grid-cols-2 gap-4 mb-6 py-4 border-y border-slate-50">
                        <div>
                            <p class="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Loan Amount</p>
                            <p class="text-xs font-black text-slate-800">${this.formatINR(loan.loan_amount)}</p>
                        </div>
                        <div class="text-right">
                            <p class="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Monthly EMI</p>
                            <p class="text-xs font-black text-blue-600">${this.formatINR(loan.emi)}</p>
                        </div>
                    </div>

                    <div class="flex items-center justify-between">
                        <div>
                            <p class="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Current Outstanding</p>
                            <p class="text-sm font-black text-slate-800 tracking-tighter">${loan.current_oustanding}</p>
                        </div>
                        <div class="text-right">
                            <p class="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Due Date</p>
                            <p class="text-[10px] font-black text-slate-500">${loan.due}</p>
                        </div>
                    </div>

                    <div class="mt-5 pt-4 border-t border-slate-50 flex items-center justify-between">
                         <span class="text-[9px] font-black text-indigo-500 bg-indigo-50 px-2 py-1 rounded-md uppercase tracking-tighter">
                            ${loan.installments} Paid
                         </span>
                         <span class="text-[10px] font-black text-slate-200 group-hover:text-blue-400 transition-colors">#${loan.id}</span>
                    </div>
                </div>`;
            }).join('');
        }
    };

    document.addEventListener('DOMContentLoaded', () => Dashboard.init());