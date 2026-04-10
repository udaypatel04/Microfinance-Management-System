
async function payEMI(installmentNo, loanRequestID, emiAmount, loanType, dueDate, lateFee) {
    const item = installments.find(inst => inst.no == installmentNo);
    if (!item) return showNotify('Installment not found', 'error');

    const totalPayable = (parseFloat(emiAmount) || 0) + (parseFloat(lateFee) || 0);
    
    try {
        const response = await fetch('/get-wallet-balance'); 
        const data = await response.json();
        const walletBalance = parseFloat(data.balance) || 0;

        openPaymentModal({
            installmentNo: item.no,
            loanRequestID,
            totalPayable,
            walletBalance,
            emiAmount,
            dueDate,
            lateFee,
            loanType
        });
    } catch (error) {
        console.error('Balance check failed:', error);
        showNotify('Failed to check wallet balance', 'error');
    }
}


function openPaymentModal(data) {
   
    data.isSplit = false;
    data.walletContribution = 0;
    currentPaymentData = data;

    const { totalPayable, walletBalance, emiAmount } = data;
    
    document.getElementById('modalInstNo').innerText = data.installmentNo;
    document.getElementById('modalTotalAmount').innerText = totalPayable.toLocaleString('en-IN', { minimumFractionDigits: 2 });
    document.getElementById('modalWalletBalance').innerText = walletBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 });
    
    const optionsContainer = document.getElementById('paymentOptionsContainer');
    optionsContainer.innerHTML = ''; 

    const threeMonthThreshold = emiAmount * 3;
    const remainingAfterWallet = Math.max(0, totalPayable - walletBalance);
    const hasEnoughWallet = walletBalance >= totalPayable;

    // --- BUTTON 1: FULL WALLET PAYMENT ---
    let walletSubText = hasEnoughWallet 
        ? (walletBalance >= threeMonthThreshold ? "3-Month Reserve Detected" : "Sufficient Balance Available")
        : `Insufficient Balance (Needs ₹${(totalPayable - walletBalance).toFixed(2)} more)`;

    optionsContainer.innerHTML += createPaymentButton(
        'processWalletPayment()', 
        'fa-wallet', 
        hasEnoughWallet ? 'bg-emerald-100' : 'bg-slate-100', 
        hasEnoughWallet ? 'text-emerald-600' : 'text-slate-400',
        'Full Wallet Payment', 
        walletSubText, 
        hasEnoughWallet ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 opacity-60 cursor-not-allowed',
        !hasEnoughWallet
    );
    
    // --- BUTTON 2: SPLIT PAYMENT ---
    if (walletBalance > 0 && !hasEnoughWallet) {
        optionsContainer.innerHTML += createPaymentButton(
            `triggerSplitPayment(${walletBalance}, ${remainingAfterWallet})`, 
            'fa-layer-group', 'bg-blue-100', 'text-blue-600',
            'Split Payment', `Use ₹${walletBalance.toFixed(2)} Wallet + ₹${remainingAfterWallet.toFixed(2)} Online`, 'border-blue-200 bg-blue-50/30',
            false
        );
    }

    // --- BUTTON 3: FULL ONLINE PAYMENT ---
    optionsContainer.innerHTML += createPaymentButton(
        'triggerRazorpay()', 
        'fa-university', 'bg-amber-100', 'text-amber-600',
        'Full Online Payment', 'UPI / Cards / Net Banking', 'border-slate-100',
        false
    );

    document.getElementById('paymentGateModal').classList.remove('hidden');
}


async function processWalletPayment() {
    const { installmentNo, loanRequestID, totalPayable, loanType, dueDate, lateFee } = currentPaymentData;
    try {
        
        const response = await fetch('/pay-emi-via-wallet', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                installment_no: installmentNo,
                loan_request_id: loanRequestID,
                amount: totalPayable,
                loan_type: loanType,
                due_date: dueDate,
                late_fee: lateFee
            })
        });

        const result = await response.json();
        if (result.success) {
            closePaymentModal();
            showNotify('Transaction Successful!', 'success');
            setTimeout(fetchInstallments, 1500);
        } else {
            showNotify(result.message || 'Payment Failed', 'error');
        }
    } catch (error) {
        showNotify('System error during wallet payment', 'error');
    }
}


async function triggerSplitPayment(walletAmt, remainingAmt) {
    try {
       

        const { installmentNo, loanRequestID, totalPayable, loanType, dueDate, lateFee } = currentPaymentData;
        
        // 1. Initiate deduction on server to "lock" funds
        const response = await fetch('/initiate-split-wallet-deduction', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                wallet_contribution: walletAmt,
                loan_request_id: loanRequestID,
                installment_no: installmentNo,
                loan_type: loanType,
              
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            // 2. Prepare for Razorpay part
            currentPaymentData.totalPayable = remainingAmt;
            currentPaymentData.walletTransctionId= result.wallet_transaction_id; 
            
            closePaymentModal();
            startRazorpayFlow(currentPaymentData); 
        } else {
            showNotify(result.message, 'error');
        }
    } catch (e) {
        showNotify('Failed to initiate split payment', 'error');
    }
}

function triggerRazorpay() {
    closePaymentModal(); 
    if (currentPaymentData) {
        startRazorpayFlow(currentPaymentData);
    }
}

async function startRazorpayFlow(data) {
    try {
        const orderResponse = await fetch('/create-payment-order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                installment_no: data.installmentNo,
                amount: data.totalPayable,
            })
        });

        const orderData = await orderResponse.json();
        if (!orderData.success) throw new Error(orderData.message);

        const options = {
            "key": "rzp_test_S1JoUGTFQ3NwYk", 
            "amount": orderData.amount, 
            "currency": "INR",
            "name": "FinTrack Secure",
            "description": `Installment #${data.installmentNo}`,
            "order_id": orderData.order_id,
            "handler": async function (response) {
                // Success path
                await verifyPayment(response, data.installmentNo, data.loanRequestID, data.loanType, data.dueDate, data.lateFee, data.totalPayable, data.walletTransctionId);
            },
            // --- ADDED THIS SECTION TO HANDLE THE "EXIT" MODAL ---
            "modal": {
                "ondismiss": async function() {
                    if (data.walletTransctionId) {
                        showNotify('Payment cancelled. Restoring wallet balance...', 'error');
                        
                        try {
                            const revertRes = await fetch('/revert-wallet-deduction', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    wallet_transaction_id: data.walletTransctionId
                                })
                            });
                            const revertData = await revertRes.json();
                            
                            if (revertData.success) {
                                showNotify('Wallet Balance Restored Successfully.', 'success');
                            }
                        } catch (err) {
                            console.error("Revert failed:", err);
                            showNotify('Manual refund required for wallet amount.', 'error');
                        }
                    } else {
                        showNotify('Payment Cancelled By User.', 'error');
                    }
                }
            },
            "prefill": {
                "name": document.getElementById('user_name')?.innerText || "",
                "email": document.getElementById("userEmail")?.innerText || "",
                "contact": document.getElementById("userMobile")?.value || ""
            },
            "theme": { "color": "#0f172a" }
        };

       
        const rzp = new Razorpay(options);

        rzp.on('payment.failed', function (response) {
            showNotify('Payment Failed: ' + response.error.description, 'error');
            console.error("Reason:", response.error.reason);
        });

        rzp.open();
    } catch (error) {
        showNotify('Gateway Error: ' + error.message, 'error');
    }
}


async function verifyPayment(razorpayResponse, installmentNo, loanRequestID, loanType, dueDate, lateFee,totalPayable,walletTransctionId) {
    try {
       
        const res = await fetch('/verify-payment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                razorpay_payment_id: razorpayResponse.razorpay_payment_id,
                razorpay_order_id: razorpayResponse.razorpay_order_id,
                razorpay_signature: razorpayResponse.razorpay_signature,
                installment_no: installmentNo,
                loan_request_id: loanRequestID,
                loan_type: loanType,
                due_date: dueDate,
                late_fee: lateFee,
                walletTransctionId: walletTransctionId,
                totalPayable:totalPayable||0
            })
        });

        const data = await res.json();
        if (data.success) {
            showNotify('Payment Successful!', 'success');
            setTimeout(fetchInstallments, 1500);
        } else throw new Error(data.message);
    } catch (error) {
        showNotify(error.message, 'error');
    }
}

function createPaymentButton(onclick, icon, iconBg, iconColor, title, sub, border, isDisabled = false) {
    const clickAttr = isDisabled ? '' : `onclick="${onclick}"`;
    const disabledAttr = isDisabled ? 'disabled' : '';

    return `
        <button ${clickAttr} ${disabledAttr} class="w-full p-4 rounded-2xl border-2 ${border} flex items-center justify-between transition-all group ${isDisabled ? '' : 'hover:scale-[1.02]'}">
            <div class="flex items-center gap-4">
                <div class="w-10 h-10 ${iconBg} ${iconColor} rounded-xl flex items-center justify-center">
                    <i class="fas ${icon}"></i>
                </div>
                <div class="text-left">
                    <p class="text-xs font-black ${isDisabled ? 'text-slate-400' : 'text-slate-900'} uppercase">${title}</p>
                    <p class="text-[9px] ${isDisabled ? 'text-slate-300' : 'text-slate-500'} font-bold uppercase">${sub}</p>
                </div>
            </div>
            ${isDisabled ? '<i class="fas fa-lock text-slate-200 text-xs"></i>' : '<i class="fas fa-chevron-right text-slate-300 group-hover:text-slate-600"></i>'}
        </button>`;
}

function closePaymentModal() {
    const modal = document.getElementById('paymentGateModal');
    if (modal) modal.classList.add('hidden');
}