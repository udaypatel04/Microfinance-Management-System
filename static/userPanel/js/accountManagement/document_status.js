let currentZoom = 1;
let kycRecords = {};
let currentImageData = {};

async function loadKYCData() {
  Loader.show("Fetching Documents...");
  try {
    const response = await fetch("/get-customer-document-verification-status");
    const data = await response.json();
    if (data.success) {
      kycRecords = data.kyc_data;
      renderKYCCards();
    }
  } catch (e) {
    showNotify("Connection Error", "error");
  } finally {
    Loader.hide();
  }
}

function renderKYCCards() {
  const grid = document.getElementById("doc-grid");
  grid.innerHTML = "";

  const existingMsg = document.getElementById("global-rejection-msg");
  if (existingMsg) existingMsg.remove();

  // 1. STATUS & EXPIRY LOGIC (90 Days / 3 Months)
  const globalStatus = (kycRecords["status"] || "pending").toLowerCase();
  const lastUpdateDate = kycRecords["updated_at"];
  let isExpired = false;

  if (lastUpdateDate) {
    const lastDate = new Date(lastUpdateDate);
    const today = new Date();

    lastDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);

    const deadlineDate = new Date(lastDate);
    deadlineDate.setFullYear(deadlineDate.getFullYear() + 1);

    if (today >= deadlineDate) {
        isExpired = true;
    }
}

   
  const docs = [
    {
      id: "aadhar",
      name: "AADHAR CARD PHOTO",
      icon: "fa-id-card",
      color: "text-emerald-500",
      img: "aadhar_card_photo",
    },
    {
      id: "pan",
      name: "PAN CARD PHOTO",
      icon: "fa-credit-card",
      color: "text-orange-500",
      img: "pan_card_photo",
    },
    {
      id: "passport",
      name: "PASSPORT PHOTO",
      icon: "fa-passport",
      color: "text-blue-500",
      img: "passport_photo",
    },
    {
      id: "utility",
      name: "UTILITY BILL",
      icon: "fa-bolt",
      color: "text-amber-500",
      img: "light_bill_photo",
    },
  ];

  const statusThemes = {
    approved: "border-emerald-200",
    rejected: "border-rose-200",
    pending: "border-slate-100",
  };

  let activeBorder = statusThemes[globalStatus] || statusThemes["pending"];

  if (isExpired && globalStatus === "approved") {
    activeBorder = "border-amber-200";
  }

  grid.className = "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10";

  docs.forEach((doc) => {
    grid.innerHTML += `
            <div class="group relative bg-white py-12 px-6 border-2 border-dashed ${activeBorder} rounded-[3rem] hover:border-slate-400 transition-all duration-500 text-center flex flex-col items-center">
                <div class="w-16 h-16 bg-white rounded-2xl shadow-xl shadow-slate-200/50 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500">
                    <i class="fas ${doc.icon} text-xl ${doc.color}"></i>
                </div>
                <h3 class="text-[10px] font-black text-slate-700 uppercase tracking-[0.2em] mb-8 leading-tight h-8 flex items-center justify-center">
                    ${doc.name}
                </h3>
                <div class="w-full px-4">
                    <button onclick="openImageModal('${doc.img}')" 
                        class="group/btn w-full h-12 bg-slate-900 text-white hover:bg-slate-800 rounded-2xl transition-all duration-300 active:scale-95 flex items-center justify-center gap-2 overflow-hidden px-2 shadow-lg shadow-slate-200">
                        <i class="fas fa-eye text-sm"></i> 
                        <span class="hidden group-hover/btn:block text-[9px] font-black uppercase tracking-widest animate__animated animate__fadeInLeft">View File</span>
                    </button>
                </div>
            </div>`;
  });

  if (globalStatus === "rejected") {
    const rejectionHtml = `
            <div id="global-rejection-msg" class="mt-4 p-8 bg-rose-50 border-2 border-rose-100 rounded-[3rem] animate__animated animate__fadeInUp flex flex-col md:flex-row items-center gap-8 shadow-sm w-full col-span-full">
                <div class="w-16 h-16 bg-rose-500 shadow-lg shadow-rose-200 text-white rounded-3xl flex items-center justify-center flex-shrink-0 animate-pulse">
                    <i class="fas fa-file-circle-exclamation text-2xl"></i>
                </div>
                <div class="flex-1 text-center md:text-left">
                    <p class="text-[11px] font-black text-rose-600 uppercase tracking-[0.2em] mb-2">Verification Failed</p>
                    <p class="text-sm font-bold text-rose-900/60 leading-relaxed italic">
                        "Your document verification was rejected by our team. Please re-upload clear, high-quality photos of all documents."
                    </p>
                </div>
                <button onclick="openDocModal()" 
                    class="group/btn h-14 bg-emerald-600 text-white hover:bg-emerald-700 rounded-[1.8rem] transition-all duration-300 active:scale-95 flex items-center justify-center gap-3 overflow-hidden px-10 shadow-xl shadow-emerald-100">
                    <i class="fas fa-file-shield text-lg"></i>
                    <span class="text-[10px] font-black uppercase tracking-widest animate__animated animate__fadeInLeft">Fix Rejection</span>
                </button>
            </div>`;
    grid.insertAdjacentHTML("afterend", rejectionHtml);
  }

  if (isExpired) {
     openReKycModal();
  }

  updateStatusIndicator(globalStatus);
}

function updateStatusIndicator(status) {
  const scoreCircle = document.getElementById("trust-score-circle");

  if (status === "rejected") {
    if (scoreCircle) {
      scoreCircle.className =
        "w-12 h-12 rounded-full border-4 border-rose-500 flex items-center justify-center text-[10px] font-black text-rose-600 animate-pulse";
      scoreCircle.innerText = "FIX";
    }
  } else {
    if (scoreCircle) {
      const isApproved = status === "approved";
      scoreCircle.className = `w-12 h-12 rounded-full border-4 border-${isApproved ? "emerald" : "blue"}-500 flex items-center justify-center text-[10px] font-black text-${isApproved ? "emerald" : "blue"}-600`;
      scoreCircle.innerText = isApproved ? "100%" : "WAIT";
    }
  }
}

document
  .querySelectorAll('#updateDocForm input[type="file"]')
  .forEach((input) => {
    input.addEventListener("change", function () {
      if (this.files && this.files[0]) {
        const file = this.files[0];
        const name = this.getAttribute("name");
        const parentBox = this.closest(".group");
        const textLabel = parentBox.querySelector("p");

        const reader = new FileReader();
        reader.onload = function (e) {
          currentImageData[name] = {
            src: e.target.result,
            fileName: file.name,
            title: name.replace(/_/g, " ").toUpperCase(),
          };

          input.classList.remove("inset-0");
          input.classList.add("top-0", "left-0", "w-full", "h-2/3");
          parentBox.classList.remove("border-dashed", "border-slate-100");
          parentBox.classList.add(
            "border-solid",
            "bg-blue-500/5",
            "border-blue-500/50",
          );

          if (textLabel) {
            textLabel.innerHTML = `
                        <div class="flex flex-col items-center gap-2 animate__animated animate__fadeIn">
                            <span class="text-blue-500 font-black text-[9px] tracking-widest">UPLOADED</span>
                            <button type="button" onclick="openImageModal('${name}')" 
                                class="relative z-30 px-4 py-2 bg-blue-600 text-white text-[9px] font-black rounded-xl uppercase tracking-widest hover:bg-blue-700 transition-all shadow-lg active:scale-95">
                                <i class="fas fa-eye mr-1"></i> View
                            </button>
                        </div>
                    `;
          }
        };
        reader.readAsDataURL(file);
      }
    });
  });

function openImageModal(imgKey) {
  const modal = document.getElementById("imagePreviewModal");
  const previewImg = document.getElementById("previewImg");

  if (currentImageData[imgKey]) {
    previewImg.src = currentImageData[imgKey].src;
    modal.classList.remove("hidden");
    resetZoom();
    return;
  }

  const fileName = kycRecords[imgKey];
  if (!fileName) {
    return showNotify("Document not yet uploaded", "warning");
  }

  const folderMap = {
    aadhar_card_photo: "aadhar_card",
    pan_card_photo: "pan_card",
    passport_photo: "passport",
    light_bill_photo: "light_bill",
  };

  previewImg.src = `/static/uploads/users/documents/${folderMap[imgKey]}/${fileName}`;
  modal.classList.remove("hidden");
  resetZoom();
}

function closeImageModal() {
  document.getElementById("imagePreviewModal").classList.add("hidden");
}
function openDocModal() {
  document.getElementById("updateDocModal").classList.remove("hidden");
  document.body.style.overflow = "hidden";
}
function closeDocModal() {
  document.getElementById("updateDocModal").classList.add("hidden");
  document.body.style.overflow = "auto";
}

function openReKycModal() {
  document.getElementById("rekyc-modal").classList.remove("hidden");
  document.body.style.overflow = "hidden";
}

function closeReKycModal() {
  document.getElementById("rekyc-modal").classList.add("hidden");
  document.body.style.overflow = "auto";
}

function proceedToUpdate() {
  closeReKycModal();
  openDocModal();
}

function applyZoom() {
  const wrapper = document.getElementById("zoomWrapper");
  const percentLabel = document.getElementById("zoomPercent");
  const container = wrapper.parentElement;

  if (wrapper) {
    if (currentZoom > 1) {
      wrapper.style.transformOrigin = "top center";
      container.classList.remove("items-center");
      container.classList.add("items-start");
      wrapper.style.margin = "20px auto";
    } else {
      wrapper.style.transformOrigin = "center center";
      container.classList.add("items-center");
      container.classList.remove("items-start");
      wrapper.style.margin = "0";
    }
    wrapper.style.transform = `scale(${currentZoom})`;
  }
  if (percentLabel)
    percentLabel.innerText = Math.round(currentZoom * 100) + "%";
}

function adjustZoom(delta) {
  currentZoom = Math.min(Math.max(0.5, currentZoom + delta), 4);
  applyZoom();
}

function resetZoom() {
  currentZoom = 1;
  adjustZoom(0);
}

async function submitDocuments(e) {
  e.preventDefault();
  const formElement = e.target; // The actual HTML <form>
  const btn = document.getElementById("btn_save_docs");
  const formData = new FormData(formElement);
  const id = document.getElementById("user_id").value;

  btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Uploading...`;
  btn.disabled = true;

  try {
    const response = await fetch(`/customers/${id}/update-docs`, {
      method: "POST",
      body: formData,
    });

    const result = await response.json();

    if (result.success) {
      showNotify(result.message, "success");

      currentImageData = {};

      closeDocModal();
      loadKYCData();
    } else {
      showNotify(result.message, "error");
    }
  } catch (e) {
    showNotify("Upload failed", "error");
    document.getElementById("updateDocModal").classList.add("hidden");
    setTimeout(() => {
      document.getElementById("updateDocModal").classList.remove("hidden");
    }, 3000);
  } finally {
    btn.innerHTML = `Update Documents <i class="fas fa-cloud-arrow-up text-sm"></i>`;
    btn.disabled = false;
    resetUploadBoxStyles();
    formElement.reset();
  }
}

// Helper function to return upload boxes to their original look
function resetUploadBoxStyles() {
  document.querySelectorAll("#updateDocForm .group").forEach((box) => {
    box.classList.remove(
      "border-solid",
      "bg-blue-500/5",
      "border-blue-500/50",
      "border-emerald-500/50",
      "border-orange-500/50",
    );
    box.classList.add("border-dashed", "border-slate-100");

    const label = box.querySelector("p");
    const input = box.querySelector('input[type="file"]');

    if (input) {
      input.classList.remove("top-0", "left-0", "w-full", "h-2/3");
      input.classList.add("inset-0");
    }

    // Restore the original text based on the input name
    if (label && input) {
      const name = input.getAttribute("name").replace(/_/g, " ").toUpperCase();
      label.innerText = name.replace(" PHOTO", "");
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  loadKYCData();
});
