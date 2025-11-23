// banner-handler.js - Shared functionality for banner image handling using active ticket

const isDebug = true; // Set to false in production for reduced logging
function log(...args) {
    if (isDebug) console.log(...args);
}

// Get banner image from active ticket
function getActiveTicketBanner() {
    const activeTicketId = localStorage.getItem('activeTicket');
    if (!activeTicketId) return null;

    const tickets = JSON.parse(localStorage.getItem('tickets') || '[]');
    const activeTicket = tickets.find(t => t.id === activeTicketId);
    return activeTicket ? activeTicket.bannerImage : null;
}

function updateBannerImages() {
    log("Updating banner images using active ticket");

    const bannerImage = getActiveTicketBanner();
    if (!bannerImage) {
        log("No banner image found for active ticket");
        return;
    }

    // Include #bannerPreview and #previewBanner for for-you.html
    const ticketImages = document.querySelectorAll('.ticket-image, #bannerPreview, #previewBanner');
    log("Found ticket image elements:", ticketImages.length);

    ticketImages.forEach((imageDiv, index) => {
        imageDiv.style.backgroundImage = `url('${bannerImage}')`;
        log(`Updated ticket image ${index + 1} with banner: ${bannerImage}`);
    });
}

function initBannerHandling() {
    log("Initializing banner handling");

    const bannerImageInput = document.getElementById('bannerImage');
    if (bannerImageInput) {
        log("Found banner image input, setting up event listener");
        bannerImageInput.addEventListener('change', handleBannerFileSelect);

        const savedBannerImage = getActiveTicketBanner();
        const bannerPreview = document.getElementById('bannerPreview');
        const previewBanner = document.getElementById('previewBanner');
        if (savedBannerImage && bannerPreview && previewBanner) {
            log("Found saved banner image in active ticket, displaying preview");
            bannerPreview.style.backgroundImage = `url('${savedBannerImage}')`;
            previewBanner.style.backgroundImage = `url('${savedBannerImage}')`;
        }

        const defaultBannerSelect = document.getElementById('useDefaultBanner');
        if (defaultBannerSelect) {
            defaultBannerSelect.addEventListener('change', handleDefaultBannerSelect);
        }
    }

    // Update any ticket images or previews on page load
    if (document.querySelectorAll('.ticket-image, #bannerPreview, #previewBanner').length > 0) {
        log("Found ticket images or previews, updating with active ticket banner");
        updateBannerImages();
    }
}

let debounceTimeout;
function handleBannerFileSelect(event) {
    clearTimeout(debounceTimeout);
    debounceTimeout = setTimeout(() => {
        const file = event.target.files[0];
        if (!file) {
            log("No file selected");
            return;
        }
        if (!file.type.startsWith('image/')) {
            alert('Please upload a valid image file (e.g., JPEG, PNG).');
            event.target.value = '';
            return;
        }
        if (file.size > 2 * 1024 * 1024) {
            alert('File size exceeds 2MB. Please choose a smaller image.');
            event.target.value = '';
            return;
        }

        log("Processing file:", file.name, file.type, file.size);
        const reader = new FileReader();
        reader.onload = function(e) {
            const img = new Image();
            img.src = e.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                canvas.width = 800;
                canvas.height = 450;
                ctx.drawImage(img, 0, 0, 800, 450);
                try {
                    const compressedData = canvas.toDataURL('image/jpeg', 0.8);

                    // Save banner image to active ticket in localStorage
                    const activeTicketId = localStorage.getItem('activeTicket');
                    if (activeTicketId) {
                        const tickets = JSON.parse(localStorage.getItem('tickets') || '[]');
                        const activeTicket = tickets.find(t => t.id === activeTicketId);
                        if (activeTicket) {
                            activeTicket.bannerImage = compressedData;
                            localStorage.setItem('tickets', JSON.stringify(tickets));
                            log('Banner image saved to active ticket in localStorage');
                        }
                    }

                    updateBannerImages();
                    const defaultBannerSelect = document.getElementById('useDefaultBanner');
                    if (defaultBannerSelect) defaultBannerSelect.value = '';
                } catch (error) {
                    log("Failed to save banner image:", error);
                    alert('Error saving image: Storage limit reached. Try a smaller image.');
                }
            };
            img.onerror = function() {
                log("Error loading image for compression");
                alert('Error processing image. Please try another file.');
            };
        };
        reader.onerror = function(error) {
            log("Error reading file:", error);
            alert('Error reading image file. Please try again.');
        };
        reader.readAsDataURL(file);
    }, 300);
}

function handleDefaultBannerSelect() {
    const defaultBannerSelect = document.getElementById('useDefaultBanner');
    if (!defaultBannerSelect || !defaultBannerSelect.value) return;
    log("Default banner selected:", defaultBannerSelect.value);

    // Save to active ticket only
    const activeTicketId = localStorage.getItem('activeTicket');
    if (activeTicketId) {
        const tickets = JSON.parse(localStorage.getItem('tickets') || '[]');
        const activeTicket = tickets.find(t => t.id === activeTicketId);
        if (activeTicket) {
            activeTicket.bannerImage = defaultBannerSelect.value;
            localStorage.setItem('tickets', JSON.stringify(tickets));
            log('Default banner saved to active ticket');
            updateBannerImages();
            const bannerImageInput = document.getElementById('bannerImage');
            if (bannerImageInput) bannerImageInput.value = '';
        }
    }
}

window.addEventListener('storage', function(e) {
    if (e.key === 'tickets') {
        log("Tickets changed in storage, updating banner images");
        updateBannerImages();
    }
});

window.addEventListener('focus', () => {
    log("Window focused, updating banner images");
    updateBannerImages();
});

window.addEventListener('storageReset', () => {
    log("Storage reset detected, removing active ticket banner");
    const activeTicketId = localStorage.getItem('activeTicket');
    if (activeTicketId) {
        const tickets = JSON.parse(localStorage.getItem('tickets') || '[]');
        const activeTicket = tickets.find(t => t.id === activeTicketId);
        if (activeTicket) {
            activeTicket.bannerImage = null;
            localStorage.setItem('tickets', JSON.stringify(tickets));
        }
    }
    updateBannerImages();
});

document.addEventListener('DOMContentLoaded', initBannerHandling);
