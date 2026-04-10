let currentImageData = {};
let currentZoom = 1;

document.querySelectorAll('input[type="file"]').forEach(input => {
    input.addEventListener('change', function() {
        if (this.files && this.files[0]) {
            const file = this.files[0];
            const name = this.getAttribute('name');
            const parentBox = this.closest('.group');
            const textLabel = parentBox.querySelector('p');

            const reader = new FileReader();
            reader.onload = function(e) {
                currentImageData[name] = {
                    src: e.target.result,
                    fileName: file.name,
                    title: name.replace(/_/g, ' ').toUpperCase()
                };

                input.classList.remove('inset-0');
                input.classList.add('top-0', 'left-0', 'w-full', 'h-2/3');
                parentBox.classList.remove('border-dashed', 'border-slate-100');
                parentBox.classList.add('border-solid', 'bg-blue-500/5', 'border-blue-500/50');
                
                if (textLabel) {
                    textLabel.innerHTML = `
                        <div class="flex flex-col items-center gap-2 animate__animated animate__fadeIn">
                            <span class="text-blue-500 font-black text-[9px] tracking-widest">UPLOADED</span>
                            <button type="button" onclick="openImageModal('${name}')" 
                                class="relative z-30 px-4 py-2 bg-blue-600 text-white text-[9px] font-black rounded-xl uppercase tracking-widest hover:bg-blue-700 transition-all shadow-lg active:scale-95">
                                <i class="fas fa-eye mr-1"></i> View Document
                            </button>
                        </div>
                    `;
                }
            };
            reader.readAsDataURL(file);
        }
    });
});



function applyZoom() {
    const wrapper = document.getElementById('zoomWrapper');
    const percentLabel = document.getElementById('zoomPercent');
    const container = wrapper.parentElement; 
    
    if (wrapper) {
        if (currentZoom > 1) {
         
            wrapper.style.transformOrigin = "top center";
            
          
            container.classList.remove('items-center');
            container.classList.add('items-start');
            
           
            wrapper.style.margin = "20px auto"; 
        } else {
           
            wrapper.style.transformOrigin = "center center";
            
            container.classList.add('items-center');
            container.classList.remove('items-start');
            wrapper.style.margin = "0";
        }
        
        wrapper.style.transform = `scale(${currentZoom})`;
    }
    
    if (percentLabel) percentLabel.innerText = Math.round(currentZoom * 100) + "%";
}

function adjustZoom(delta) {
    currentZoom = Math.min(Math.max(0.5, currentZoom + delta), 4);
    applyZoom();
}

function resetZoom() {
    currentZoom = 1;
    applyZoom();
}

function openImageModal(key) {
    const modal = document.getElementById('imagePreviewModal');
    const modalImg = document.getElementById('previewImg');
    const modalTitle = document.getElementById('modalImageTitle');

    if (currentImageData[key]) {
        modalImg.src = currentImageData[key].src;
        modalTitle.innerText = currentImageData[key].title;
        
        resetZoom();
        modal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    }
}

function closeImageModal() {
    const modal = document.getElementById('imagePreviewModal');
    modal.classList.add('hidden');
    document.body.style.overflow = 'auto';
}

document.addEventListener('keydown', (e) => {
    if (e.key === "Escape") closeImageModal();
});



document.getElementById('user-registration-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const form = this;
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalContent = submitBtn.innerHTML;
    
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<i class="fas fa-circle-notch fa-spin mr-2"></i> SUBMITTING DOCUMENTS...`;
    
    const formData = new FormData(form);
    Loader.show();
    try {
        const response = await fetch('/submit-customer-registration', {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        
        if (result.success) {
            showNotify(result.message, "success");
            submitBtn.innerHTML = `<i class="fas fa-check mr-2"></i> SUCCESSFUL`;
            
            setTimeout(() => {
               submitBtn.innerHTML = originalContent;
            }, 2000);
            
            
        } else {
            showNotify(result.message || "Registration failed", "error");
            submitBtn.disabled = false;
           
            submitBtn.innerHTML = originalContent;
        }
    } catch (error) {
        showNotify("Connection lost. Please check your internet.", "error");
        submitBtn.disabled = false;
     
        submitBtn.innerHTML = originalContent;
    }
    form.reset();
    resetUploadUI()
    Loader.hide();
});


function resetUploadUI() {
    
    currentImageData = {};
    currentZoom = 1;

    
    document.querySelectorAll('.group').forEach(group => {
        const input = group.querySelector('input[type="file"]');
        const textLabel = group.querySelector('p');
        
        if (input && textLabel) {
           
            input.classList.remove('top-0', 'left-0', 'w-full', 'h-2/3');
            input.classList.add('inset-0');

           
            group.classList.remove('border-solid', 'bg-blue-500/5', 'border-blue-500/50');
            group.classList.add('border-dashed', 'border-slate-100');

          
            const labelMapping = {
                'aadhar_card_photo': 'Aadhar Card Photo',
                'pan_card_photo': 'PAN Card Photo',
                'passport_photo': 'Passport Photo',
                'light_bill_photo': 'Utility Bill'
            };
            
            textLabel.innerHTML = labelMapping[input.name] || 'Upload Document';
        }
    });

    if (typeof closeImageModal === 'function') closeImageModal();
}