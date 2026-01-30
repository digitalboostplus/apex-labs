/**
 * Apex Labs Shared Application Logic
 * Handles component injection, cart management, and global UI
 */

document.addEventListener('DOMContentLoaded', () => {
    // Detect path context for asset resolution
    const isInSubdir = window.location.pathname.includes('/pricing/') ||
        window.location.pathname.includes('/pages/');
    const basePath = isInSubdir ? '..' : '.';

    // --- Cart Drawer Logic ---
    window.updateCartDrawerUI = (cart) => {
        const list = document.getElementById('cart-items');
        const totalEl = document.getElementById('cart-total');
        const checkoutBtn = document.getElementById('checkout-btn');

        if (!list || !totalEl || !window.cartManager) return;

        // Security: Validate cart data before rendering
        const esc = window.sanitize ? window.sanitize.html : (s => s);
        const escAttr = window.sanitize ? window.sanitize.attr : (s => s);
        const sanitizeId = window.sanitize ? window.sanitize.id : (s => s);
        const sanitizeImg = window.sanitize ? window.sanitize.imageUrl : ((url, bp) => url || `${bp}/assets/placeholder.png`);

        if (cart.length === 0) {
            list.innerHTML = `
                <div class="flex flex-col items-center justify-center h-64 text-slate-400">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 mb-4 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                    </svg>
                    <p class="font-bold uppercase tracking-widest text-xs text-center">Your research cart is empty</p>
                </div>
            `;
            if (checkoutBtn) {
                checkoutBtn.disabled = true;
                checkoutBtn.classList.add('opacity-50', 'cursor-not-allowed');
            }
        } else {
            list.innerHTML = cart.map(item => {
                // Security: Sanitize all user-controlled data
                const rawId = item.id || item.priceId;
                const id = sanitizeId(rawId) || 'unknown';
                const safeName = esc(item.name || 'Unknown Item');
                const safeCategory = esc(item.category || 'Compound');
                const price = window.cartManager.getItemPrice(rawId, item.quantity) || Number(item.price) || 0;
                const quantity = parseInt(item.quantity, 10) || 1;

                // Determine if a tier discount is active
                const isTier1 = quantity >= 10 && quantity < 25;
                const isTier2 = quantity >= 25;
                let tierBadge = '';
                if (isTier2) {
                    tierBadge = '<span class="ml-2 px-1.5 py-0.5 bg-brand-cyan/10 text-brand-blue text-[8px] font-black uppercase rounded">Tier 2 Labs</span>';
                } else if (isTier1) {
                    tierBadge = '<span class="ml-2 px-1.5 py-0.5 bg-brand-blue/10 text-brand-blue text-[8px] font-black uppercase rounded">Tier 1 Elite</span>';
                }

                // Security: Validate and sanitize image URL
                const itemImage = sanitizeImg(item.image, basePath);

                return `
                <div class="cart-item border border-slate-100 rounded-xl p-4 bg-white flex gap-4">
                    <div class="w-16 h-16 flex-shrink-0 bg-slate-50 p-2 rounded-lg border border-slate-100 flex items-center justify-center">
                        <img src="${itemImage}" alt="${safeName}" class="max-w-full max-h-full object-contain">
                    </div>
                    <div class="flex-grow">
                        <div class="flex justify-between items-start">
                            <div>
                                <h3 class="font-bold text-slate-900 leading-tight">${safeName}</h3>
                                <p class="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">${safeCategory}</p>
                            </div>
                            <button onclick="window.cartManager.removeItem('${escAttr(id)}')" class="text-slate-300 hover:text-red-500 transition-colors p-1 cursor-pointer">
                                <i data-lucide="trash-2" class="w-4 h-4"></i>
                            </button>
                        </div>
                        <div class="flex items-center justify-between mt-4">
                            <div class="flex items-center border border-slate-100 bg-slate-50 rounded-lg overflow-hidden">
                                <button onclick="window.cartManager.updateQuantity('${escAttr(id)}', -1)" class="px-2 py-1 hover:bg-slate-200 text-slate-600 transition-colors cursor-pointer">-</button>
                                <span class="px-3 py-1 text-xs font-black text-slate-700 min-w-[2rem] text-center">${quantity}</span>
                                <button onclick="window.cartManager.updateQuantity('${escAttr(id)}', 1)" class="px-2 py-1 hover:bg-slate-200 text-slate-600 transition-colors cursor-pointer">+</button>
                            </div>
                            <div class="text-right">
                                <p class="text-brand-blue font-black">$${price.toFixed(2)}${tierBadge}</p>
                                <p class="text-[9px] text-slate-400 font-bold uppercase">per vial</p>
                            </div>
                        </div>
                    </div>
                </div>
            `}).join('');

            if (checkoutBtn) {
                checkoutBtn.disabled = false;
                checkoutBtn.classList.remove('opacity-50', 'cursor-not-allowed');
            }

            // Re-init Lucide for new items
            if (window.lucide) window.lucide.createIcons();
        }

        totalEl.textContent = '$' + window.cartManager.getTotal().toFixed(2);
    };

    // Initialize Lucide Icons
    if (window.lucide) {
        window.lucide.createIcons();
    }

    // --- Mobile Menu Logic ---
    const menuToggle = document.getElementById('mobile-menu-toggle');
    const menuClose = document.getElementById('mobile-menu-close');
    const mobileMenu = document.getElementById('mobile-menu');
    const navLinks = document.querySelectorAll('.mobile-nav-link');

    if (menuToggle && mobileMenu) {
        menuToggle.addEventListener('click', () => {
            mobileMenu.style.transform = 'translateX(0)';
            document.body.style.overflow = 'hidden';
        });

        const closeMenu = () => {
            mobileMenu.style.transform = 'translateX(100%)';
            document.body.style.overflow = '';
        };

        if (menuClose) menuClose.addEventListener('click', closeMenu);
        navLinks.forEach(link => link.addEventListener('click', closeMenu));
    }

    // --- Toggle Cart Function (global) ---
    window.toggleCart = function () {
        const drawer = document.getElementById('cart-drawer');
        const overlay = document.getElementById('cart-overlay');

        if (!drawer || !overlay) return;

        const isOpen = !drawer.classList.contains('translate-x-full');

        if (isOpen) {
            drawer.classList.add('translate-x-full');
            overlay.classList.add('hidden');
            document.body.style.overflow = '';
        } else {
            drawer.classList.remove('translate-x-full');
            overlay.classList.remove('hidden');
            document.body.style.overflow = 'hidden';
        }
    };

    // --- Dynamic Component Injection ---

    // --- Cart Badge Update Function ---
    function updateCartBadges() {
        const countEls = document.querySelectorAll('#cart-count, .cart-counter');
        const count = window.cartManager ? window.cartManager.getItemCount() : 0;

        countEls.forEach(el => {
            el.textContent = count;
            if (el.id === 'cart-count') {
                if (count > 0) {
                    el.classList.remove('scale-0', 'hidden');
                    el.classList.add('scale-100');
                } else {
                    el.classList.add('scale-0', 'hidden');
                    el.classList.remove('scale-100');
                }
            } else {
                el.classList.toggle('hidden', count === 0);
            }
        });
    }

    // Subscribe to cart updates globally as soon as cartManager is available
    if (window.cartManager) {
        window.cartManager.subscribe((cart) => {
            updateCartBadges();
        });
    }

    // --- Dynamic Component Injection ---
    function injectComponent(containerId, path, callback) {
        const container = document.getElementById(containerId);
        if (!container) return;

        fetch(path)
            .then(res => {
                if (!res.ok) throw new Error(`Component not found: ${path}`);
                return res.text();
            })
            .then(html => {
                const range = document.createRange();
                const fragment = range.createContextualFragment(html);
                container.innerHTML = ''; // Clear container
                container.appendChild(fragment);

                if (window.lucide) window.lucide.createIcons();
                if (callback) callback();
            })
            .catch(err => console.error(`Error loading component ${path}:`, err));
    }

    // Cart Drawer injection
    const cartContainer = document.getElementById('cart-container');
    if (cartContainer) {
        injectComponent('cart-container', `${basePath}/components/cart-drawer.html`, () => {
            if (window.cartManager) {
                window.cartManager.subscribe(window.updateCartDrawerUI);
                const checkoutBtn = document.getElementById('checkout-btn');
                if (checkoutBtn) {
                    checkoutBtn.addEventListener('click', () => {
                        window.location.href = 'checkout.html';
                    });
                }
            }
        });
    }

    // Auth Modal injection
    const authModalContainer = document.getElementById('auth-modal-container');
    if (authModalContainer) {
        injectComponent('auth-modal-container', `${basePath}/components/auth-modal.html`);
    }

    // User Menu injection
    const userMenuContainer = document.getElementById('user-menu-container');
    if (userMenuContainer) {
        injectComponent('user-menu-container', `${basePath}/components/user-menu.html`);
    }

    // Exit Intent Popup (delayed load for non-checkout pages)
    const skipExitIntent = ['checkout', 'order-confirmation', 'cart'];
    const currentPath = window.location.pathname.toLowerCase();
    if (!skipExitIntent.some(page => currentPath.includes(page))) {
        // Delay loading exit intent to not block initial render
        setTimeout(() => {
            fetch(`${basePath}/components/exit-intent-popup.html`)
                .then(res => res.ok ? res.text() : '')
                .then(html => {
                    if (html) {
                        let container = document.getElementById('exit-popup-container');
                        if (!container) {
                            container = document.createElement('div');
                            container.id = 'exit-popup-container';
                            document.body.appendChild(container);
                        }
                        container.innerHTML = html;
                    }
                })
                .catch(() => { });
        }, 2000);
    }


    // --- Magnetic Effects (if GSAP is present) ---
    if (window.gsap) {
        document.querySelectorAll('.magnetic-wrap').forEach(wrap => {
            wrap.addEventListener('mousemove', e => {
                const rect = wrap.getBoundingClientRect();
                const x = e.clientX - rect.left - rect.width / 2;
                const y = e.clientY - rect.top - rect.height / 2;
                gsap.to(wrap, {
                    x: x * 0.3,
                    y: y * 0.3,
                    duration: 0.6,
                    ease: "power2.out"
                });
            });
            wrap.addEventListener('mouseleave', () => {
                gsap.to(wrap, {
                    x: 0,
                    y: 0,
                    duration: 0.6,
                    ease: "elastic.out(1, 0.3)"
                });
            });
        });
    }

    // --- Add to Cart Animation ---
    window.animateAddToCart = function (buttonEl, productImage) {
        if (!buttonEl) return;

        const originalText = buttonEl.innerHTML;
        buttonEl.disabled = true;
        buttonEl.innerHTML = `
            <svg class="animate-spin h-5 w-5 inline-block" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
        `;

        setTimeout(() => {
            buttonEl.innerHTML = `
                <svg class="h-5 w-5 inline-block text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path>
                </svg>
                Added!
            `;

            // Bounce the cart icon
            const cartIcon = document.querySelector('#cart-count, .cart-counter');
            if (cartIcon && window.gsap) {
                gsap.fromTo(cartIcon,
                    { scale: 1 },
                    { scale: 1.3, duration: 0.15, yoyo: true, repeat: 1, ease: "power2.out" }
                );
            }

            setTimeout(() => {
                buttonEl.disabled = false;
                buttonEl.innerHTML = originalText;
            }, 1500);
        }, 300);
    };

    // --- Wishlist Heart Toggle ---
    window.toggleWishlistHeart = function (buttonEl, productId, product) {
        if (!buttonEl || !window.wishlistManager) return;

        const isInWishlist = window.wishlistManager.contains(productId);
        const heart = buttonEl.querySelector('svg, i');

        if (isInWishlist) {
            window.wishlistManager.remove(productId);
            if (heart) {
                heart.classList.remove('fill-red-500', 'text-red-500');
                heart.classList.add('text-slate-400');
            }
        } else {
            window.wishlistManager.add(product);
            if (heart) {
                heart.classList.add('fill-red-500', 'text-red-500');
                heart.classList.remove('text-slate-400');
            }

            // Animate
            if (window.gsap) {
                gsap.fromTo(heart,
                    { scale: 1 },
                    { scale: 1.3, duration: 0.15, yoyo: true, repeat: 1, ease: "power2.out" }
                );
            }
        }
    };

    // --- Keyboard Shortcuts ---
    document.addEventListener('keydown', (e) => {
        // Escape to close modals/drawers
        if (e.key === 'Escape') {
            const cartDrawer = document.getElementById('cart-drawer');
            if (cartDrawer && !cartDrawer.classList.contains('translate-x-full')) {
                window.toggleCart();
            }

            if (window.closeAuthModal) {
                window.closeAuthModal();
            }

            if (window.closeExitPopup) {
                window.closeExitPopup();
            }
        }
    });
});
