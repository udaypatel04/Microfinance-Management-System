    const amountInput = document.getElementById('topupAmount');
    const errorMsg = document.getElementById('limitError');
    const submitBtn = document.getElementById('submitBtn');

    function setAmount(val) {
        amountInput.value = val;
        validateLimit();
    }

    function validateLimit() {
        const val = parseFloat(amountInput.value) || 0;
        if (val > remainingLimit) {
            errorMsg.classList.remove('hidden');
            amountInput.classList.add('ring-2', 'ring-red-500', 'bg-red-50');
            submitBtn.disabled = true;
            submitBtn.classList.add('opacity-50', 'cursor-not-allowed');
        } else {
            errorMsg.classList.add('hidden');
            amountInput.classList.remove('ring-2', 'ring-red-500', 'bg-red-50');
            submitBtn.disabled = false;
            submitBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        }
    }

    amountInput.addEventListener('input', validateLimit);

    document.getElementById('topupForm').onsubmit = function(e) {
        e.preventDefault();
        let amt = parseFloat(amountInput.value);
        if(amt < 10) {
            showNotify("Minimum top-up amount is ₹10",'error');
            
        } else if (amt > remainingLimit) {
            showNotify("Amount exceeds your remaining limit of ₹" + remainingLimit,'error');   
        }

        loadWalletMoney();
    }


    async function loadWalletMoney() {
    // 1. Get the amount from your input field
    const amountInput = document.getElementById('topupAmount');
    const loadAmount = parseFloat(amountInput.value);

    try {
        // 2. Call backend to create a Razorpay Order for Wallet
        const orderResponse = await fetch('/create-wallet-order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                amount: loadAmount
            })
        });

        const orderData = await orderResponse.json();
        if (!orderData.success) throw new Error(orderData.message);

        // 3. Configure Razorpay Options
        const options = {
            "key": "rzp_test_S1JoUGTFQ3NwYk", 
            "amount": orderData.amount, // Amount in paise from backend
            "currency": "INR",
            "name": "FinTrack Wallet",
            "description": "Add Funds to Digital Wallet",
            "order_id": orderData.order_id,
            "handler": async function (response) {
                // This runs after successful payment
                await verifyWalletPayment(response, loadAmount);
            },
            "prefill": {
                "name": document.getElementById('user_name')?.innerText || "Customer",
                "email": document.getElementById("userEmail")?.innerText || "",
                "contact": document.getElementById("userMobile")?.value || ""
            },
            "theme": { "color": "#10b981" } // Emerald Green theme for Wallet
        };

        const rzp = new Razorpay(options);
        rzp.open();

    } catch (error) {
        showNotify(error.message, 'error');
        console.error("Wallet Error:", error.message);
    }
}

// 4. Verify Wallet Payment with Backend
async function verifyWalletPayment(razorpayResponse, loadAmount) {
    try {
        const res = await fetch('/verify-wallet-payment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                razorpay_payment_id: razorpayResponse.razorpay_payment_id,
                razorpay_order_id: razorpayResponse.razorpay_order_id,
                razorpay_signature: razorpayResponse.razorpay_signature,
                amount: loadAmount
            })
        });

        const data = await res.json();
        if (data.success) {
            showNotify(`₹${loadAmount} added to wallet successfully!`, 'success');
            
            // Refresh the page or balance after 1.5 seconds to show new balance
            setTimeout(() => {
                window.location.reload(); 
            }, 1500);
        } else {
            throw new Error(data.message || 'Verification Failed');
        }
    } catch (error) {
        showNotify(error.message, 'error');
    }
}