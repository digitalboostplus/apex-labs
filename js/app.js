/**
 * Apex Labs Shared Application Logic
 * Handles component injection, cart management, and global UI
 */

document.addEventListener('DOMContentLoaded', () => {
    // Detect path context for asset resolution
    const isInSubdir = window.location.pathname.includes('/pricing/') ||
                       window.location.pathname.includes('/pages/');
    const basePath = isInSubdir ? '..' : '.';

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
    window.toggleCart = function() {
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

    // Cart Drawer
    const cartContainer = document.getElementById('cart-container');
    if (cartContainer) {
        const componentPath = `${basePath}/components/cart-drawer.html`;

        fetch(componentPath)
            .then(res => {
                if (!res.ok) throw new Error('Component not found');
                return res.text();
            })
            .then(html => {
                cartContainer.innerHTML = html;
                if (window.lucide) window.lucide.createIcons();

                // Subscribe to cart updates for the badge
                if (window.cartManager) {
                    window.cartManager.subscribe((cart) => {
                        updateCartBadges();
                    });
                    // Initial update
                    updateCartBadges();
                }
            })
            .catch(err => console.error('Error loading cart drawer:', err));
    }

    // Auth Modal (if container exists)
    const authModalContainer = document.getElementById('auth-modal-container');
    if (authModalContainer && authModalContainer.innerHTML.trim() === '') {
        fetch(`${basePath}/components/auth-modal.html`)
            .then(res => res.ok ? res.text() : '')
            .then(html => {
                if (html) {
                    authModalContainer.innerHTML = html;
                    if (window.lucide) window.lucide.createIcons();
                }
            })
            .catch(() => {}); // Silently fail if component doesn't exist
    }

    // User Menu (if container exists)
    const userMenuContainer = document.getElementById('user-menu-container');
    if (userMenuContainer && userMenuContainer.innerHTML.trim() === '') {
        fetch(`${basePath}/components/user-menu.html`)
            .then(res => res.ok ? res.text() : '')
            .then(html => {
                if (html) {
                    userMenuContainer.innerHTML = html;
                    if (window.lucide) window.lucide.createIcons();
                }
            })
            .catch(() => {});
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
                .catch(() => {});
        }, 2000);
    }

    // --- Cart Badge Update Function ---
    function updateCartBadges() {
        const countEls = document.querySelectorAll('#cart-count, .cart-counter');
        const count = window.cartManager ? window.cartManager.getItemCount() : 0;

        countEls.forEach(el => {
            el.textContent = count;
            if (el.id === 'cart-count') {
                el.classList.toggle('scale-0', count === 0);
                el.classList.toggle('scale-100', count > 0);
                el.classList.toggle('hidden', count === 0);
            } else {
                el.classList.toggle('hidden', count === 0);
            }
        });
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
    window.animateAddToCart = function(buttonEl, productImage) {
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
    window.toggleWishlistHeart = function(buttonEl, productId, product) {
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
