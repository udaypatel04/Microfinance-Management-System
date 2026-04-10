

document.getElementById('appointmentDate').addEventListener('change', function() {
    const d = new Date(this.value); 
    const week = Math.ceil(d.getDate() / 7);
    if (d.getDay() === 0 || (d.getDay() === 6 && (week === 2 || week === 4))) { 
        alert("Sundays and 2nd/4th Saturdays are holidays."); this.value = ""; 
    }
});

function formatCurrency(num) {
    return '₹' + Math.round(num).toLocaleString('en-IN');
}

function calculateLoan() {
    const weight = parseFloat(document.getElementById('weight').value) || 0;
    const price24K = parseFloat(document.getElementById('price1g').value) || 0;
    
    const karatSelect = document.getElementById('karat');
    const selectedOption = karatSelect.options[karatSelect.selectedIndex];

    const karat = parseFloat(selectedOption.getAttribute('data-karat'));

    const months = parseInt(document.getElementById('tenure').value) || 12;
    const ltvPercent = parseInt(document.getElementById('ltv').value) || 70;
    const interestInput = parseFloat(document.getElementById('interestRate').value) || 0;
    
    const baseFee = 1000;
    const gst = 0.18;
    const totalProcessingFee = baseFee * (1 + gst); 
    
    const karatPrice = (price24K / 24) * karat;
    const totalGoldValue = weight * karatPrice;
    
    const loanAmount = (totalGoldValue * ltvPercent) / 100;
    const disburseAmount = loanAmount > totalProcessingFee ? loanAmount - totalProcessingFee : 0;

    const annualRate = interestInput / 100;
    const monthlyRate = annualRate / 12;
    
    let emi = 0, totalInterest = 0, totalPayable = 0;

    if (loanAmount > 0) {
        if (monthlyRate > 0) {
            emi = (loanAmount * monthlyRate * Math.pow(1 + monthlyRate, months)) / (Math.pow(1 + monthlyRate, months) - 1);
            totalPayable = emi * months;
            totalInterest = totalPayable - loanAmount;
        } else {
            emi = loanAmount / months;
            totalPayable = loanAmount;
            totalInterest = 0;
        }
    }

    document.getElementById('estGoldValue').innerText = formatCurrency(totalGoldValue);
    document.getElementById('loanAmount').innerText = formatCurrency(loanAmount);
    document.getElementById('disburseAmount').innerText = formatCurrency(disburseAmount);
    document.getElementById('emiAmount').innerText = formatCurrency(emi);
    document.getElementById('totalInterest').innerText = formatCurrency(totalInterest);
    document.getElementById('totalPayable').innerText = formatCurrency(totalPayable);
    
    const feeElement = document.getElementById('totalFee');
    if (feeElement) feeElement.innerText = "- " + formatCurrency(totalProcessingFee);

    const repaymentLabel = document.getElementById('repaymentLabel');
    if (repaymentLabel) {
        repaymentLabel.innerText = `(${months} Months × ${formatCurrency(emi)} EMI)`;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const inputIds = ['weight', 'karat', 'tenure', 'ltv', 'goldType'];

    inputIds.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
        
            const eventType = element.tagName === 'SELECT' ? 'change' : 'input';
            
            element.addEventListener(eventType, () => {
                if (id === 'tenure') {
                    document.getElementById('tenureVal').innerText = `${element.value} Months`;
                }
                if (id === 'ltv') {
                    document.getElementById('ltvVal').innerText = `${element.value}%`;
                }
                calculateLoan();
            });
        }
    });

    calculateLoan(); 
});


document.getElementById('gold-loan-form').onsubmit=async function (e) {
    e.preventDefault();
    const data = {
        gold_type_id: document.getElementById('goldType').value,
        gold_loan_purity_id: document.getElementById('karat').value,
        weight: document.getElementById('weight').value,
        expected_month: document.getElementById('tenure').value,
        app_date: document.getElementById('appointmentDate').value,
        app_time: document.getElementById('appointmentTime').value,
        est_gold_value: document.getElementById('estGoldValue').innerText.replace(/[^\d]/g, ''),
        loan_amount: document.getElementById('loanAmount').innerText.replace(/[^\d]/g, ''),
        emi: document.getElementById('emiAmount').innerText.replace(/[^\d]/g, ''),
        interest_rate:document.getElementById('interestRate').value,
        per_gram_price:document.getElementById('price1g').value
    };

    if (!data.app_date || !data.app_time) {
         showNotify("Please select an appointment date and time.","error");
        return;
    }
    
    Loader.show();
    try {
        const response = await fetch('/submit-gold-loan-request', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data)
        });

        const result = await response.json();

        if (result.success) {
            showNotify(result.message,'success');
            resetFormFields();
           

        } else {
            showNotify(result.message,'error');
        }
        
    } catch (error) {
        console.error("Submission failed:", error);
        showNotify("Server connection failed. Please try again.");
       
    }
    Loader.hide()
}


function resetFormFields() {
    
    document.getElementById('appointmentDate').value = "";
    document.getElementById('appointmentTime').value = "";
    document.getElementById('weight').value = "1"; 
    
   
    calculateLoan();
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