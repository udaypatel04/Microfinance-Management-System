function triggerCalculation() {
    const results = document.getElementById('resultsContent');
    const instruction = document.getElementById('calcInstruction');
    
    if (results) {
        results.classList.remove('opacity-40', 'animate__animated', 'animate__fadeInRight');
        void results.offsetWidth; 
        results.classList.add('opacity-100', 'animate__animated', 'animate__fadeInRight');
    }
    
    if (instruction) {
        instruction.style.opacity = '0.2';
    }

    calculateLoan();
}

function calculateLoan() {
    const weight = parseFloat(document.getElementById('weight').value) || 0;
    const price24K = parseFloat(document.getElementById('price1g').value) || 0;
    const karat = parseInt(document.getElementById('karat').value);
    const months = parseInt(document.getElementById('tenure').value);
    const ltvPercent = parseInt(document.getElementById('ltv').value);
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
    
    let emi = 0;
    let totalInterest = 0;
    let totalPayable = 0;

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

function formatCurrency(num) {
    return '₹' + Math.round(num).toLocaleString('en-IN');
}

document.addEventListener('DOMContentLoaded', () => {
    const tenureInput = document.getElementById('tenure');
    const ltvInput = document.getElementById('ltv');

    if (tenureInput) {
        tenureInput.addEventListener('input', (e) => {
            document.getElementById('tenureVal').innerText = `${e.target.value} Months`;
        });
    }

    if (ltvInput) {
        ltvInput.addEventListener('input', (e) => {
            document.getElementById('ltvVal').innerText = `${e.target.value}%`;
        });
    }

    calculateLoan();
});