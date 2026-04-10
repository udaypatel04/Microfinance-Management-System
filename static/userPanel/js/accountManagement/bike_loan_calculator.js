
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
    const downPayment = parseFloat(document.getElementById('downPayment').value) || 0;
    const rate = parseFloat(document.getElementById('interestRate').value) || 0;
    const months = parseInt(document.getElementById('tenure').value);

    const baseFee = 1000;
    const gst = 0.18;
    const totalProcessingFee = baseFee * (1 + gst);

    const principal = Math.max(0, price - downPayment);
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
    document.getElementById('resDownPayment').innerText = formatCurrency(downPayment);
    
    const loanElem = document.getElementById('loanAmount');
    if(loanElem) loanElem.innerText = formatCurrency(principal);
    
    
    document.getElementById('totalFee').innerText = "- " + formatCurrency(totalProcessingFee);
    document.getElementById('disburseAmount').innerText = formatCurrency(disburseAmount);
    
    document.getElementById('emiAmount').innerText = formatCurrency(emi);
    
    const tenureLabel = document.getElementById('emiTenureLabel');
    if(tenureLabel) tenureLabel.innerText = `${months} Months Tenure`;

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

    if (!condition) return;

    try {
        const response = await fetch(`/get-bikes/${condition}`,{ method: 'POST' });
        const data = await response.json();
        
         data.bikes.forEach(bike => {
            const option = document.createElement('option');
            option.value = bike.name; 
           
            dataList.appendChild(option);
        });
    } catch (error) {
        console.error('Error fetching bike models:', error);
    }
}



document.getElementById('bikeName').addEventListener('input', async function() {
    const selectedModel = this.value;
    const options = document.getElementById('bikeModels').childNodes;
    
    let exists = false;
    for (let i = 0; i < options.length; i++) {
        if (options[i].value === selectedModel) {
            exists = true;
            break;
        }
    }

    if (exists) {
        try {
            const response = await fetch(`/get-price/model/${selectedModel}`,{
                method: 'POST'
            });
            if (!response.ok) throw new Error();
            
            const data = await response.json();
            const priceInput = document.getElementById('bikePrice');
            
            if (priceInput && data.price) {
                priceInput.value = data.price;
                if (typeof calculateBikeLoan === "function") {
                    calculateBikeLoan();
                }
            }
        } catch (error) {
            console.error(error);
        }
    }
});


window.onload = calculateBikeLoan;