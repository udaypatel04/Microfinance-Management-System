function navigateToApproved(loan_type) {
    window.location.href = `/loan-approved-details/${loan_type}`;
}

function filterCategories() {
    const searchInput = document.getElementById("categorySearch");
    if (!searchInput) return;

    const filterValue = searchInput.value.toUpperCase();
    const categories = document.querySelectorAll("#categoryContainer > div");

    categories.forEach(card => {
        const titleElement = card.querySelector('h3');
        if (titleElement) {
            const isMatch = titleElement.innerText.toUpperCase().includes(filterValue);
            card.style.display = isMatch ? "" : "none";
        }
    });
}