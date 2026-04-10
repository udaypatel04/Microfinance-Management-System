let currentReplyId = null;
let allInquiryRecords = []; 
let inquiryRecords = [];    
let currentPage = 1;
let totalPages = 1;
let pageSize = getResponsivePageSize();

function getResponsivePageSize() {
    const width = window.innerWidth;
    if (width < 768) return 3;  
    if (width < 1280) return 4; 
    return 6;                   
}

window.addEventListener('resize', () => {
    const newSize = getResponsivePageSize();
    if (newSize !== pageSize) {
        pageSize = newSize;
        renderRecords();
    }
});

async function loadInquiryData() {
    try {
        const response = await fetch("/get-inquiries-list", {
            method: "POST",
            headers: { "Content-Type": "application/json" }
        });
        const data = await response.json();

        if (data.success) {
            const formattedData = data.items.map(item => ({
                id: item.id,
                name: item.full_name,
                email: item.email_address,
                message: item.message_body,
                status: item.inquiry_status,
                submitted: item.submitted_at 
            }));
    
            allInquiryRecords = [...formattedData];
            inquiryRecords = [...formattedData];
            renderRecords();
        } else {
            showNotify(data.message, "error");
        }
    } catch (error) {
        showNotify("Failed to load inquiries", "error");
    }
}

function renderRecords() {
    totalPages = Math.ceil(inquiryRecords.length / pageSize);
    if (currentPage > totalPages && totalPages > 0) currentPage = totalPages;
    else if (totalPages === 0) currentPage = 1;

    const container = document.getElementById('inquiryContainer');
    if (!container) return;
    
    container.innerHTML = '';
    const start = (currentPage - 1) * pageSize;
    const currentData = inquiryRecords.slice(start, start + pageSize);

    if (currentData.length === 0) {
        container.innerHTML = `<div class="col-span-full py-20 text-center text-slate-400 font-bold uppercase text-[10px]">No Inquiries Found</div>`;
        return;
    }

    document.getElementById('pagination').classList.remove('hidden');

    currentData.forEach(inquiry => {
        const isUnread = inquiry.status === 'unread';
        const badgeClass = isUnread ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-500';
        const badgeText = isUnread ? 'New Message' : 'Read';

        container.innerHTML += `
            <div class="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all group min-h-[320px] flex flex-col justify-between animate__animated animate__fadeIn">
                <div>
                    <div class="flex justify-between items-start mb-4">
                        <div class="flex items-center space-x-3">
                            <div class="w-11 h-11 rounded-2xl ${isUnread ? 'bg-blue-600 text-white shadow-lg shadow-blue-100' : 'bg-slate-100 text-slate-400'} flex items-center justify-center font-black text-base transition-all">
                                ${inquiry.name.charAt(0)}
                            </div>
                            <div>
                                <h4 class="text-sm font-black text-slate-800 tracking-tight leading-none mb-1">${inquiry.name}</h4>
                                <div class="text-[8px] text-slate-400 font-bold uppercase tracking-wider">${inquiry.submitted}</div>
                            </div>
                        </div>
                        <span class="${badgeClass} px-2 py-0.5 rounded-lg text-[7px] font-black uppercase tracking-wider italic">${badgeText}</span>
                    </div>
                    <div class="space-y-2.5 py-3.5 border-t border-slate-50">
                        <div class="flex justify-between items-center">
                            <span class="text-[8px] text-slate-400 font-black uppercase tracking-widest">Sender</span>
                            <span class="text-xs font-bold text-slate-700 truncate max-w-[150px]">${inquiry.email}</span>
                        </div>
                        <div class="flex flex-col pt-1">
                            <span class="text-[8px] text-slate-400 font-black uppercase tracking-widest mb-1">Message Preview</span>
                            <span class="text-[11px] font-semibold text-slate-500 line-clamp-2 leading-relaxed italic">"${inquiry.message}"</span>
                        </div>
                    </div>
                </div>
                <div class="mt-3 grid grid-cols-2 gap-2">
                    <button onclick="viewInquiry(${inquiry.id})" class="flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-[9px] font-black uppercase transition-all active:scale-95 shadow-lg shadow-blue-100">
                        <i class="fas fa-envelope-open text-[10px]"></i> View Info
                    </button>
                    <button onclick="deleteInquiry(${inquiry.id})" class="flex items-center justify-center gap-2 py-3 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl text-[9px] font-black uppercase transition-all active:scale-95">
                        <i class="fas fa-trash-alt text-[10px]"></i> Delete
                    </button>
                </div>
            </div>`;
    });
    updatePaginationInfo(start);
}

function updatePaginationInfo(start) {
    const end = Math.min(start + pageSize, inquiryRecords.length);
    document.getElementById('startRange').innerText = inquiryRecords.length > 0 ? start + 1 : 0;
    document.getElementById('endRange').innerText = end;
    document.getElementById('totalEntries').innerText = inquiryRecords.length;
    document.getElementById('prevBtn').disabled = currentPage === 1;
    document.getElementById('nextBtn').disabled = currentPage * pageSize >= inquiryRecords.length;
    renderPageNumbers();
}

function renderPageNumbers() {
    const container = document.getElementById('pageIndicator');
    if (!container) return;
    container.innerHTML = '';
    
    createNavBtn("First", 1, currentPage === 1, container);
    
    let startPage = Math.max(1, currentPage - 1);
    let endPage = Math.min(totalPages, startPage + 2);
    if (endPage === totalPages) startPage = Math.max(1, endPage - 3);

    for (let i = startPage; i <= endPage; i++) {
        const btn = document.createElement('button');
        btn.innerText = i;
        const isActive = i === currentPage;
        btn.className = `w-9 h-9 rounded-xl text-xs font-bold transition-all ${isActive ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`;
        btn.onclick = () => { currentPage = i; renderRecords(); window.scrollTo(0, 0); };
        container.appendChild(btn);
    }
    createNavBtn("Last", totalPages, currentPage === totalPages, container);
}

function createNavBtn(label, page, disabled, container) {
    const btn = document.createElement('button');
    btn.innerText = label;
    btn.className = `px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-600 text-[10px] font-black uppercase transition-all ${disabled ? 'opacity-40 cursor-not-allowed' : 'active:scale-95 hover:bg-slate-50'}`;
    btn.onclick = () => { if(!disabled) { currentPage = page; renderRecords(); window.scrollTo(0, 0); } };
    container.appendChild(btn);
}

async function filterInquiries() {
    const query = document.getElementById("inquirySearch").value.trim();
    try {
        const response = await fetch("/search-inquiries", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query })
        });
        const data = await response.json();
        if (data.success) {
            inquiryRecords = data.items.map(item => ({
                id: item.id,
                name: item.full_name,
                email: item.email_address,
                message: item.message_body,
                status: item.inquiry_status,
                submitted: item.submitted_at
            }));
            currentPage = 1; 
            renderRecords(); 
        }
    } catch (error) {
        console.error("Search Error:", error);
    }
}

async function viewInquiry(id) {
    const inquiry = allInquiryRecords.find(i => i.id === id);
    if (!inquiry) return;

    document.getElementById('view-avatar').innerText = inquiry.name.charAt(0);
    document.getElementById('view-name').innerText = inquiry.name;
    document.getElementById('view-date').innerText = `Received: ${inquiry.submitted}`;
    document.getElementById('view-email').innerText = inquiry.email;
    document.getElementById('view-message').innerText = inquiry.message;
    
    const statusNote = document.getElementById('replied-status-note');
    const replyBtn = document.getElementById('email-reply');

    if (inquiry.status === 'replied') {
        replyBtn.classList.add('hidden');
        statusNote.classList.remove('hidden');
    } else {
        replyBtn.classList.remove('hidden');
        statusNote.classList.add('hidden');
        replyBtn.onclick = () => openReplyModal(inquiry.id);
    }

    document.getElementById('viewInquiryModal').classList.remove('hidden');
    document.body.style.overflow = 'hidden';

    if (inquiry.status === 'unread') {
        try {
            const response = await fetch("/mark-inquiry-read", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id })
            });
            const data = await response.json();
            if (data.success) {
                inquiry.status = 'read'; 
                renderRecords(); 
            }
        } catch (e) {
            console.error("Update Status Error", e); 
        }
    }
}

function closeViewModal() {
    document.getElementById('viewInquiryModal').classList.add('hidden');
    document.body.style.overflow = 'auto';
}

async function deleteInquiry(id) {
    if (!confirm("Are you sure?")) return;
    try {
        const response = await fetch("/delete-inquiry", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id })
        });
        const result = await response.json();
        if (result.success) {
            allInquiryRecords = allInquiryRecords.filter(i => i.id !== id);
            inquiryRecords = inquiryRecords.filter(i => i.id !== id);
            showNotify(result.message, "success");
            closeViewModal();
            renderRecords(); 
        }
    } catch (error) {
        console.error("Delete Error:", error);
    }
}

function openReplyModal(id) {
    const inquiry = allInquiryRecords.find(i => i.id === id);
    if (!inquiry) return;
    currentReplyId = id;
    document.getElementById('reply-to-name').innerText = inquiry.name;
    document.getElementById('reply-to-email').innerText = inquiry.email;
    document.getElementById('reply-message').value = "";
    document.getElementById('replyInquiryModal').classList.remove('hidden');
    closeViewModal();
}

function closeReplyModal() {
    document.getElementById('replyInquiryModal').classList.add('hidden');
}

async function submitInquiryReply() {
    const message = document.getElementById('reply-message').value.trim();
    const btn = document.getElementById('send-reply-btn');
    if (!message) return showNotify("Please type a message first", "error");
    btn.disabled = true;
    try {
        const response = await fetch("/submit-inquiry-reply", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: currentReplyId, message })
        });
        const data = await response.json();
        if (data.success) {
            showNotify(data.message, "success");
            closeReplyModal();
            loadInquiryData();
        } else {
            showNotify(data.message, "error");
        }
    } catch (e) {
        showNotify("Failed to send reply", "error");
    } finally {
        btn.disabled = false;
    }
}

document.addEventListener('DOMContentLoaded', loadInquiryData);