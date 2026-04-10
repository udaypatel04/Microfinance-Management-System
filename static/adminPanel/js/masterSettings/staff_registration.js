document.getElementById('staff-registration-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const submitBtn = this.querySelector('button[type="submit"]');
    
    const formData = {
        full_name: document.getElementById('full_name').value.trim(),
        city: document.getElementById('city').value.trim(),
        address: document.getElementById('address').value.trim(),
        mob_number: document.getElementById('mob_number').value.trim(),
        gender: document.getElementById('gender').value,
        email: document.getElementById('email').value.trim(),
        password: document.getElementById('password').value,
        dob: document.getElementById('dob').value,
        joining_date: document.getElementById('joining_date').value
    };

    if (!formData.full_name || !formData.email || !formData.password) {
        return showNotify("Please fill in all required fields", "error");
    }

    submitBtn.disabled = true;
    Loader.show();

    try {
        const response = await fetch("/register-staff", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(formData)
        });

        const data = await response.json();

        if (data.success) {
            showNotify(data.message, "success");
            this.reset();
        } else {
            showNotify(data.message, "error");
        }
    } catch (error) {
        showNotify("Connection failed. Please try again.", "error");
    } finally {
        submitBtn.disabled = false;
        Loader.hide();
    }
});