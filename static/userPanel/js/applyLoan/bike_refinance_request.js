document.getElementById('bikeName').addEventListener('input', function() {
    document.getElementById('resBikeName').innerText = this.value || "Selected Bike";
});

function triggerCalculation() {
    const results = document.getElementById('resultsContent');
    if (results) {
        results.classList.remove('animate__animated', 'animate__fadeInRight');
        void results.offsetWidth; 
        results.classList.add('animate__animated', 'animate__fadeInRight');
    }
    calculateBikeLoan();
}

function calculateBikeLoan() {
    const price = parseFloat(document.getElementById('bikePrice').value) || 0;
    const ltvRatio = parseFloat(document.getElementById('ltvRatio').value) || 70;
    const rate = parseFloat(document.getElementById('interestRate').value) || 0;
    const months = parseInt(document.getElementById('tenure').value) || 12;

    const totalProcessingFee = 1180; 

    const principal = (price * ltvRatio) / 100;
    const monthlyRate = (rate / 100) / 12;

    let emi = 0;
    let totalInterest = 0;
    let totalPayable = 0;

    if (principal > 0 && months > 0) {
        if (monthlyRate > 0) {
            emi = (principal * monthlyRate * Math.pow(1 + monthlyRate, months)) / (Math.pow(1 + monthlyRate, months) - 1);
            totalPayable = emi * months;
            totalInterest = totalPayable - principal;
        } else {
            emi = principal / months;
            totalPayable = principal;
            totalInterest = 0;
        }
    }

    const disburseAmount = principal > totalProcessingFee ? principal - totalProcessingFee : 0;

    document.getElementById('resOnRoad').innerText = formatCurrency(price);
    
    const ltvElem = document.getElementById('resLTVPercent');
    if(ltvElem) ltvElem.innerText = ltvRatio + '%';
    
    const loanElem = document.getElementById('loanAmount');
    if(loanElem) loanElem.innerText = formatCurrency(principal);
    
    document.getElementById('totalFee').innerText = "- " + formatCurrency(totalProcessingFee);
    document.getElementById('disburseAmount').innerText = formatCurrency(disburseAmount);
    document.getElementById('emiAmount').innerText = formatCurrency(emi);
    
    document.getElementById('totalInterest').innerText = formatCurrency(totalInterest);
    document.getElementById('totalPayable').innerText = formatCurrency(totalPayable);
    
    document.getElementById('repaymentLabel').innerText = `(${months} Months × ${formatCurrency(emi)} EMI)`;
}

function formatCurrency(num) {
    return '₹' + Math.round(num).toLocaleString('en-IN');
}

async function fetchBikeModels() {
    const condition = document.getElementById('bikeCondition').value;
    const dataList = document.getElementById('bikeModels');
    dataList.innerHTML = '';
    if (!condition || condition === "Select Condition") return;

    try {
        const response = await fetch(`/get-bikes/${condition}`, { method: 'POST' });
        const data = await response.json();

        window.currentBikes = data.bikes; 

        data.bikes.forEach(bike => {
            const option = document.createElement('option');
            option.value = bike.name; 
            option.dataset.id = bike.id; 
            dataList.appendChild(option);
        });
    } catch (error) {
        console.error(error);
    }
}

document.getElementById('bikeName').addEventListener('input', async function() {
    const selectedModel = this.value;
    const options = document.getElementById('bikeModels').options;
    
    const val = this.value;
    const bike = window.currentBikes?.find(b => b.name === val);

    if (bike) {
        document.getElementById('selectedBikeId').value = bike.id;

    } else {
        document.getElementById('selectedBikeId').value = "";
    }

    let exists = false;
    for (let i = 0; i < options.length; i++) {
        if (options[i].value === selectedModel) {
            exists = true;
            break;
        }
    }

    if (exists) {
        try {
            const response = await fetch(`/get-price/model/${selectedModel}`, { method: 'POST' });
            if (!response.ok) throw new Error();
            
            const data = await response.json();
            const priceInput = document.getElementById('bikePrice');
            
            if (priceInput && data.price) {
                priceInput.value = data.price;
                calculateBikeLoan();
            }
        } catch (error) {
            console.error(error);
        }
    }
});

window.onload = calculateBikeLoan;



async function submitBikeLoan() {
    const bikeName = document.getElementById('bikeName').value;
    const apptDate = document.getElementById('appointmentDate').value;
    const apptTime = document.getElementById('appointmentTime').value;

    if (!bikeName || !apptDate || !apptTime) {
        if(typeof showNotify === 'function') {
            showNotify('Please fill in Bike Model, Date, and Time', 'error');
        } else {
            alert('Please fill in Bike Model, Date, and Time');
        }
        return;
    }


     const formData = {
        bike_id:document.getElementById('selectedBikeId').value,
        expected_month: document.getElementById('tenure').value,
        price: document.getElementById('bikePrice').value,
        interest_rate:document.getElementById('interestRate').value,
        down_payment: 0,
        final_amount:document.getElementById('loanAmount').innerText.replace(/[^\d]/g, ''),
        monthly_emi:document.getElementById('emiAmount').innerText.replace(/[^\d]/g, ''),
        appointment_date: apptDate,
        appointment_time: apptTime
    };
    Loader.show();

    try {
        const response = await fetch('/submit-bike-loan-request', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        });
        const result = await response.json();
        if (result.success) {
            showNotify(result.message, 'success');
            resetFormFields();
        }else{
            showNotify(result.message, 'error');
        }
    } catch (error) {
        console.error(error);
    }

    Loader.hide();
}


function resetFormFields() {
    
    document.getElementById('appointmentDate').value = "";
    document.getElementById('appointmentTime').value = "";
    document.getElementById('bikeName').value='';
    document.getElementById('bikePrice').value='';
    document.getElementById('bikeCondition').value='Select Condition';
   
    calculateBikeLoan();
}



function showPremiumNotification() {
    const popup = document.getElementById('interest-popup');

    // 1. Spring Entry (Drop from top + Scale up)
    popup.classList.remove('invisible', '-translate-y-20', 'opacity-0', 'scale-95');
    popup.classList.add('translate-y-0', 'opacity-100', 'scale-100');

    // 2. Duration Logic (4 Seconds)
    setTimeout(() => {
        // 3. Smooth Exit (Slide back up + Fade)
        popup.classList.remove('translate-y-0', 'opacity-100', 'scale-100');
        popup.classList.add('-translate-y-20', 'opacity-0', 'scale-95');
        
        setTimeout(() => {
            popup.classList.add('invisible');
        }, 700); 
    }, 10000);
}

document.addEventListener('DOMContentLoaded', showPremiumNotification);