function navigateToEMI(loan_type) {
    window.location.href = `/loan_type_for_emi_selection/${loan_type}/customers_list`;
}

function filterLoanTypes() {
    const searchInput = document.getElementById("loanTypeSearch");
    if (!searchInput) return;

    const filterValue = searchInput.value.toUpperCase();
    const container = document.getElementById("typeContainer");
    const cards = container.querySelectorAll(".group");

    cards.forEach(card => {
        const title = card.querySelector("h3");
        if (title) {
            const textValue = title.textContent || title.innerText;
            if (textValue.toUpperCase().includes(filterValue)) {
                card.style.display = "";
                card.classList.add('animate__animated', 'animate__fadeIn');
            } else {
                card.style.display = "none";
                card.classList.remove('animate__animated', 'animate__fadeIn');
            }
        }
    });
}

let searchTimeout;
document.getElementById("loanTypeSearch")?.addEventListener("input", () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(filterLoanTypes, 150);
});