/**
 * Wholesale Inquiry Modal Manager
 * Handles wholesale inquiry form display and submission
 */

class WholesaleManager {
    constructor() {
        this.modalLoaded = false;
        this.currentProduct = null;
    }

    /**
     * Initialize the wholesale modal
     */
    async init() {
        if (this.modalLoaded) return;

        try {
            // Load the modal component
            await this.loadModal();

            // Set up form submission handler
            this.setupFormHandler();

            // Set up Lucide icons for the modal
            if (typeof lucide !== 'undefined') {
                lucide.createIcons();
            }

            this.modalLoaded = true;
        } catch (error) {
            console.error('Failed to initialize wholesale modal:', error);
        }
    }

    /**
     * Load the wholesale modal component
     */
    async loadModal() {
        const container = document.getElementById('wholesale-container');
        if (!container) {
            console.warn('Wholesale container not found');
            return;
        }

        try {
            // Determine the correct path based on current location
            const isInPricingDir = window.location.pathname.includes('/pricing/');
            const componentPath = isInPricingDir ? '../components/wholesale-modal.html' : 'components/wholesale-modal.html';

            const response = await fetch(componentPath);
            if (!response.ok) throw new Error('Failed to load wholesale modal');

            const html = await response.text();
            container.innerHTML = html;
        } catch (error) {
            console.error('Error loading wholesale modal:', error);
        }
    }

    /**
     * Set up form submission handler
     */
    setupFormHandler() {
        const form = document.getElementById('wholesale-form');
        if (!form) return;

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.submitInquiry();
        });
    }

    /**
     * Open the wholesale modal
     * @param {string} productName - Optional product name to pre-fill
     */
    open(productName = null) {
        const modal = document.getElementById('wholesale-modal');
        if (!modal) {
            console.error('Wholesale modal not found');
            return;
        }

        // Pre-fill product if provided
        if (productName) {
            this.currentProduct = productName;
            const productInput = document.getElementById('wholesale-product');
            if (productInput) {
                productInput.value = productName;
            }
        }

        // Show modal
        modal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';

        // Focus first input
        setTimeout(() => {
            const nameInput = document.getElementById('wholesale-name');
            if (nameInput) nameInput.focus();
        }, 100);
    }

    /**
     * Close the wholesale modal
     */
    close() {
        const modal = document.getElementById('wholesale-modal');
        if (!modal) return;

        modal.classList.add('hidden');
        document.body.style.overflow = '';

        // Reset form after a delay
        setTimeout(() => {
            this.resetForm();
        }, 300);
    }

    /**
     * Submit wholesale inquiry to Firestore
     */
    async submitInquiry() {
        const submitBtn = document.getElementById('wholesale-submit-btn');
        const errorDiv = document.getElementById('wholesale-error');
        const successDiv = document.getElementById('wholesale-success');

        // Get form data
        const formData = {
            name: document.getElementById('wholesale-name').value.trim(),
            email: document.getElementById('wholesale-email').value.trim(),
            phone: document.getElementById('wholesale-phone').value.trim(),
            company: document.getElementById('wholesale-company').value.trim(),
            product: document.getElementById('wholesale-product').value.trim() || 'General Inquiry',
            volume: document.getElementById('wholesale-volume').value,
            notes: document.getElementById('wholesale-notes').value.trim()
        };

        // Basic validation
        if (!formData.name || !formData.email || !formData.phone || !formData.company || !formData.volume) {
            this.showError('Please fill in all required fields');
            return;
        }

        // Email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(formData.email)) {
            this.showError('Please enter a valid email address');
            return;
        }

        // Disable submit button
        submitBtn.disabled = true;
        submitBtn.textContent = 'Submitting...';

        try {
            // Wait for Firebase to be ready
            await window.firebaseServices.onReady();
            const db = window.firebaseServices.getFirestore();

            // Add timestamp and status
            const inquiry = {
                ...formData,
                status: 'new',
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                source: 'website'
            };

            // Save to Firestore
            await db.collection('wholesaleInquiries').add(inquiry);

            // Show success
            this.showSuccess();

            // Close modal after delay
            setTimeout(() => {
                this.close();
            }, 2000);

        } catch (error) {
            console.error('Error submitting wholesale inquiry:', error);
            this.showError('Failed to submit inquiry. Please try again or contact us directly.');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Submit Inquiry';
        }
    }

    /**
     * Show error message
     */
    showError(message) {
        const errorDiv = document.getElementById('wholesale-error');
        const successDiv = document.getElementById('wholesale-success');

        if (errorDiv) {
            errorDiv.querySelector('p').textContent = message;
            errorDiv.classList.remove('hidden');
        }

        if (successDiv) {
            successDiv.classList.add('hidden');
        }
    }

    /**
     * Show success message
     */
    showSuccess() {
        const errorDiv = document.getElementById('wholesale-error');
        const successDiv = document.getElementById('wholesale-success');

        if (successDiv) {
            successDiv.classList.remove('hidden');
        }

        if (errorDiv) {
            errorDiv.classList.add('hidden');
        }
    }

    /**
     * Reset form to initial state
     */
    resetForm() {
        const form = document.getElementById('wholesale-form');
        if (form) {
            form.reset();
        }

        const errorDiv = document.getElementById('wholesale-error');
        const successDiv = document.getElementById('wholesale-success');

        if (errorDiv) errorDiv.classList.add('hidden');
        if (successDiv) successDiv.classList.add('hidden');

        this.currentProduct = null;
    }
}

// Create singleton instance
const wholesaleManager = new WholesaleManager();

// Global functions for easy access
window.openWholesaleModal = (productName) => wholesaleManager.open(productName);
window.closeWholesaleModal = () => wholesaleManager.close();
window.wholesaleManager = wholesaleManager;

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        wholesaleManager.init().catch(console.error);
    });
} else {
    wholesaleManager.init().catch(console.error);
}
