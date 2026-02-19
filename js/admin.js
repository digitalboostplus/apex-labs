/**
 * Admin Module - Firestore CRUD for product management
 * Handles admin auth check, real-time product listener, and CRUD operations
 */
(function() {
    'use strict';

    let db = null;
    let unsubscribeProducts = null;
    let products = [];
    let editingProductId = null;

    // ====================================================================
    // Admin Auth
    // ====================================================================

    async function checkAdminStatus(user) {
        if (!user || !db) return false;
        try {
            const doc = await db.collection('admins').doc(user.uid).get();
            return doc.exists && doc.data().role === 'admin';
        } catch (error) {
            console.error('Admin check failed:', error);
            return false;
        }
    }

    // ====================================================================
    // Real-time Product Listener
    // ====================================================================

    function subscribeToProducts() {
        if (unsubscribeProducts) unsubscribeProducts();

        unsubscribeProducts = db.collection('products').orderBy('name').onSnapshot(
            (snapshot) => {
                products = snapshot.docs.map(doc => ({
                    _docId: doc.id,
                    ...doc.data()
                }));
                renderProductTable(products);
            },
            (error) => {
                console.error('Products listener error:', error);
                showToast('Failed to load products', 'error');
            }
        );
    }

    // ====================================================================
    // CRUD Operations
    // ====================================================================

    async function createProduct(data) {
        const sanitized = sanitizeProductData(data);
        sanitized.createdAt = firebase.firestore.FieldValue.serverTimestamp();
        sanitized.updatedAt = firebase.firestore.FieldValue.serverTimestamp();

        await db.collection('products').doc(sanitized.id).set(sanitized);
        showToast(`Created "${sanitized.name}"`, 'success');
    }

    async function updateProduct(docId, data) {
        const sanitized = sanitizeProductData(data);
        sanitized.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
        delete sanitized.createdAt;

        await db.collection('products').doc(docId).update(sanitized);
        showToast(`Updated "${sanitized.name}"`, 'success');
    }

    async function deleteProduct(docId, productName) {
        await db.collection('products').doc(docId).delete();
        showToast(`Deleted "${productName}"`, 'success');
    }

    // ====================================================================
    // Data Sanitization
    // ====================================================================

    function sanitizeProductData(data) {
        const s = window.sanitize;
        return {
            id: s.id(data.id) || '',
            priceId: (data.priceId || '').trim(),
            name: (data.name || '').trim().substring(0, 200),
            price: s.price(data.price),
            wholesale1Price: s.price(data.wholesale1Price),
            wholesale2Price: s.price(data.wholesale2Price),
            wholesaleMinQty: Math.max(1, parseInt(data.wholesaleMinQty, 10) || 10),
            wholesale2MinQty: Math.max(1, parseInt(data.wholesale2MinQty, 10) || 25),
            image: (data.image || '').trim().substring(0, 500),
            category: (data.category || '').trim().substring(0, 100),
            description: (data.description || '').trim().substring(0, 2000),
            shortDescription: (data.shortDescription || '').trim().substring(0, 300),
            concentration: (data.concentration || '').trim().substring(0, 50),
            purity: (data.purity || '').trim().substring(0, 20),
            format: (data.format || '').trim().substring(0, 50),
            tags: parseTags(data.tags),
            featured: Boolean(data.featured),
            inStock: Boolean(data.inStock),
            stockLevel: Math.max(0, parseInt(data.stockLevel, 10) || 0)
        };
    }

    function parseTags(tags) {
        if (Array.isArray(tags)) return tags.map(t => t.trim().toLowerCase()).filter(Boolean);
        if (typeof tags === 'string') return tags.split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
        return [];
    }

    // ====================================================================
    // UI Rendering
    // ====================================================================

    function renderProductTable(productList) {
        const tbody = document.getElementById('product-tbody');
        const countEl = document.getElementById('product-count');
        if (!tbody) return;

        // Apply search filter
        const searchInput = document.getElementById('product-search');
        const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';
        let filtered = productList;
        if (searchTerm) {
            filtered = productList.filter(p =>
                p.name.toLowerCase().includes(searchTerm) ||
                p.category.toLowerCase().includes(searchTerm) ||
                (p.id && p.id.toLowerCase().includes(searchTerm))
            );
        }

        if (countEl) countEl.textContent = `${filtered.length} product${filtered.length !== 1 ? 's' : ''}`;

        if (filtered.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="9" class="px-6 py-12 text-center text-slate-400">
                        ${searchTerm ? 'No products match your search.' : 'No products found. Create one to get started.'}
                    </td>
                </tr>`;
            return;
        }

        const esc = window.sanitize.html;
        tbody.innerHTML = filtered.map(p => `
            <tr class="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                <td class="px-4 py-3">
                    <div class="flex items-center gap-3">
                        <img src="${window.sanitize.imageUrl(p.image)}" alt="" class="w-10 h-10 rounded-lg object-cover bg-slate-100" onerror="this.src='/assets/placeholder.png'">
                        <div>
                            <div class="font-medium text-slate-900">${esc(p.name)}</div>
                            <div class="text-xs text-slate-400">${esc(p.id)}</div>
                        </div>
                    </div>
                </td>
                <td class="px-4 py-3 text-sm text-slate-600">${esc(p.category)}</td>
                <td class="px-4 py-3 text-sm font-medium">$${esc(String(p.price))}</td>
                <td class="px-4 py-3 text-sm text-slate-500">$${esc(String(p.wholesale1Price || '-'))}</td>
                <td class="px-4 py-3 text-sm text-slate-500">$${esc(String(p.wholesale2Price || '-'))}</td>
                <td class="px-4 py-3 text-sm">${p.stockLevel != null ? esc(String(p.stockLevel)) : '-'}</td>
                <td class="px-4 py-3">
                    <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${p.inStock ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}">
                        ${p.inStock ? 'In Stock' : 'Out'}
                    </span>
                </td>
                <td class="px-4 py-3">
                    ${p.featured ? '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">Featured</span>' : '<span class="text-xs text-slate-400">-</span>'}
                </td>
                <td class="px-4 py-3">
                    <div class="flex items-center gap-1">
                        <button onclick="window.adminModule.openProductModal('${esc(p._docId)}')" class="p-1.5 rounded-lg hover:bg-blue-50 text-slate-400 hover:text-blue-600 transition-colors" title="Edit">
                            <i data-lucide="pencil" class="w-4 h-4"></i>
                        </button>
                        <button onclick="window.adminModule.openDeleteModal('${esc(p._docId)}', '${esc(p.name)}')" class="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors" title="Delete">
                            <i data-lucide="trash-2" class="w-4 h-4"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');

        // Re-init lucide icons for the new rows
        if (window.lucide) lucide.createIcons();
    }

    // ====================================================================
    // Modals
    // ====================================================================

    function openProductModal(docId) {
        editingProductId = docId || null;
        const modal = document.getElementById('product-modal');
        const title = document.getElementById('modal-title');
        const idField = document.getElementById('field-id');
        const form = document.getElementById('product-form');

        if (!modal || !form) return;

        form.reset();

        if (editingProductId) {
            title.textContent = 'Edit Product';
            idField.readOnly = true;
            idField.classList.add('bg-slate-100');

            const product = products.find(p => p._docId === docId);
            if (product) {
                idField.value = product.id || '';
                document.getElementById('field-priceId').value = product.priceId || '';
                document.getElementById('field-name').value = product.name || '';
                document.getElementById('field-price').value = product.price || '';
                document.getElementById('field-wholesale1Price').value = product.wholesale1Price || '';
                document.getElementById('field-wholesale2Price').value = product.wholesale2Price || '';
                document.getElementById('field-wholesaleMinQty').value = product.wholesaleMinQty || 10;
                document.getElementById('field-wholesale2MinQty').value = product.wholesale2MinQty || 25;
                document.getElementById('field-image').value = product.image || '';
                document.getElementById('field-category').value = product.category || '';
                document.getElementById('field-description').value = product.description || '';
                document.getElementById('field-shortDescription').value = product.shortDescription || '';
                document.getElementById('field-concentration').value = product.concentration || '';
                document.getElementById('field-purity').value = product.purity || '';
                document.getElementById('field-format').value = product.format || '';
                document.getElementById('field-tags').value = (product.tags || []).join(', ');
                document.getElementById('field-featured').checked = product.featured || false;
                document.getElementById('field-inStock').checked = product.inStock !== false;
                document.getElementById('field-stockLevel').value = product.stockLevel || 0;
            }
        } else {
            title.textContent = 'Create Product';
            idField.readOnly = false;
            idField.classList.remove('bg-slate-100');
            document.getElementById('field-wholesaleMinQty').value = 10;
            document.getElementById('field-wholesale2MinQty').value = 25;
            document.getElementById('field-inStock').checked = true;
        }

        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }

    function closeProductModal() {
        const modal = document.getElementById('product-modal');
        if (modal) {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        }
        editingProductId = null;
    }

    function openDeleteModal(docId, name) {
        const modal = document.getElementById('delete-modal');
        const nameEl = document.getElementById('delete-product-name');
        const confirmBtn = document.getElementById('confirm-delete-btn');

        if (!modal) return;

        nameEl.textContent = name;
        confirmBtn.onclick = async () => {
            confirmBtn.disabled = true;
            confirmBtn.textContent = 'Deleting...';
            try {
                await deleteProduct(docId, name);
                closeDeleteModal();
            } catch (error) {
                showToast(`Delete failed: ${error.message}`, 'error');
            } finally {
                confirmBtn.disabled = false;
                confirmBtn.textContent = 'Delete';
            }
        };

        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }

    function closeDeleteModal() {
        const modal = document.getElementById('delete-modal');
        if (modal) {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        }
    }

    // ====================================================================
    // Form Submission
    // ====================================================================

    async function handleProductSubmit(e) {
        e.preventDefault();
        const submitBtn = document.getElementById('modal-submit-btn');
        submitBtn.disabled = true;
        submitBtn.textContent = editingProductId ? 'Saving...' : 'Creating...';

        try {
            const data = {
                id: document.getElementById('field-id').value,
                priceId: document.getElementById('field-priceId').value,
                name: document.getElementById('field-name').value,
                price: document.getElementById('field-price').value,
                wholesale1Price: document.getElementById('field-wholesale1Price').value,
                wholesale2Price: document.getElementById('field-wholesale2Price').value,
                wholesaleMinQty: document.getElementById('field-wholesaleMinQty').value,
                wholesale2MinQty: document.getElementById('field-wholesale2MinQty').value,
                image: document.getElementById('field-image').value,
                category: document.getElementById('field-category').value,
                description: document.getElementById('field-description').value,
                shortDescription: document.getElementById('field-shortDescription').value,
                concentration: document.getElementById('field-concentration').value,
                purity: document.getElementById('field-purity').value,
                format: document.getElementById('field-format').value,
                tags: document.getElementById('field-tags').value,
                featured: document.getElementById('field-featured').checked,
                inStock: document.getElementById('field-inStock').checked,
                stockLevel: document.getElementById('field-stockLevel').value
            };

            if (!data.id || !data.name || !data.price) {
                showToast('ID, Name, and Price are required.', 'error');
                return;
            }

            if (editingProductId) {
                await updateProduct(editingProductId, data);
            } else {
                // Check if ID already exists
                const existing = products.find(p => p.id === data.id);
                if (existing) {
                    showToast('A product with this ID already exists.', 'error');
                    return;
                }
                await createProduct(data);
            }

            closeProductModal();
        } catch (error) {
            showToast(`Save failed: ${error.message}`, 'error');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = editingProductId ? 'Save Changes' : 'Create Product';
        }
    }

    // ====================================================================
    // Toast Notifications
    // ====================================================================

    function showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const colors = {
            success: 'bg-emerald-600',
            error: 'bg-red-600',
            info: 'bg-blue-600'
        };

        const toast = document.createElement('div');
        toast.className = `${colors[type] || colors.info} text-white px-5 py-3 rounded-xl shadow-lg text-sm font-medium transform transition-all duration-300 translate-y-2 opacity-0`;
        toast.textContent = message;
        container.appendChild(toast);

        requestAnimationFrame(() => {
            toast.classList.remove('translate-y-2', 'opacity-0');
        });

        setTimeout(() => {
            toast.classList.add('translate-y-2', 'opacity-0');
            setTimeout(() => toast.remove(), 300);
        }, 3500);
    }

    // ====================================================================
    // Auth Gate UI
    // ====================================================================

    function showAuthGate() {
        document.getElementById('auth-gate').classList.remove('hidden');
        document.getElementById('admin-content').classList.add('hidden');
    }

    function showUnauthorized() {
        document.getElementById('auth-gate').classList.remove('hidden');
        document.getElementById('admin-content').classList.add('hidden');
        document.getElementById('auth-gate-message').textContent = 'Access Denied — Your account does not have admin privileges.';
        document.getElementById('auth-gate-signin').classList.add('hidden');
    }

    function showAdminContent() {
        document.getElementById('auth-gate').classList.add('hidden');
        document.getElementById('admin-content').classList.remove('hidden');
    }

    // ====================================================================
    // Initialization
    // ====================================================================

    async function init() {
        // Wait for Firebase
        const services = await window.firebaseServices.onReady();
        db = services.db;

        // Initialize auth manager
        await window.authManager.init();

        // Set up auth state handling
        window.authManager.subscribe(async (event, user) => {
            if (event !== 'authStateChanged') return;

            if (!user) {
                showAuthGate();
                if (unsubscribeProducts) {
                    unsubscribeProducts();
                    unsubscribeProducts = null;
                }
                return;
            }

            const isAdmin = await checkAdminStatus(user);
            if (!isAdmin) {
                showUnauthorized();
                return;
            }

            // Admin confirmed — show dashboard
            document.getElementById('admin-email').textContent = user.email;
            showAdminContent();
            subscribeToProducts();
        });

        // Bind search
        const searchInput = document.getElementById('product-search');
        if (searchInput) {
            searchInput.addEventListener('input', () => renderProductTable(products));
        }

        // Bind form
        const form = document.getElementById('product-form');
        if (form) {
            form.addEventListener('submit', handleProductSubmit);
        }

        // Sign in button
        const signInBtn = document.getElementById('admin-signin-btn');
        if (signInBtn) {
            signInBtn.addEventListener('click', () => {
                window.authManager.signInWithGoogle().catch(err => {
                    showToast(err.message, 'error');
                });
            });
        }

        // Sign out button
        const signOutBtn = document.getElementById('admin-signout-btn');
        if (signOutBtn) {
            signOutBtn.addEventListener('click', () => {
                window.authManager.signOut().catch(console.error);
            });
        }

        // Seed button
        const seedBtn = document.getElementById('seed-products-btn');
        if (seedBtn) {
            seedBtn.addEventListener('click', async () => {
                seedBtn.disabled = true;
                seedBtn.textContent = 'Seeding...';
                try {
                    const seedFn = firebase.functions().httpsCallable('seedProducts');
                    const result = await seedFn();
                    showToast(result.data.message, 'success');
                } catch (error) {
                    showToast(`Seed failed: ${error.message}`, 'error');
                } finally {
                    seedBtn.disabled = false;
                    seedBtn.textContent = 'Seed from JSON';
                }
            });
        }
    }

    // Expose module
    window.adminModule = {
        openProductModal,
        closeProductModal,
        openDeleteModal,
        closeDeleteModal
    };

    // Auto-init
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => init().catch(console.error));
    } else {
        init().catch(console.error);
    }
})();
