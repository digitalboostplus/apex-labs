/**
 * Apex Labs Shared Application Logic
 */

document.addEventListener('DOMContentLoaded', () => {
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

    // --- Dynamic Component Injection (Cart Drawer) ---
    const cartContainer = document.getElementById('cart-container');
    if (cartContainer) {
        const isRoot = !window.location.pathname.includes('/pricing/');
        const componentPath = isRoot ? 'components/cart-drawer.html' : '../components/cart-drawer.html';

        fetch(componentPath)
            .then(res => {
                if (!res.ok) throw new Error('Component not found');
                return res.text();
            })
            .then(html => {
                cartContainer.innerHTML = html;
                // Re-initialize Lucide icons for the injected component
                if (window.lucide) window.lucide.createIcons();
                
                // Subscribe to cart updates for the badge
                if (window.cartManager) {
                    window.cartManager.subscribe((cart) => {
                        const countEls = document.querySelectorAll('#cart-count, .cart-counter');
                        const count = window.cartManager.getItemCount();
                        countEls.forEach(el => {
                            el.textContent = count;
                            if (el.id === 'cart-count') {
                                el.classList.toggle('scale-0', count === 0);
                                el.classList.toggle('scale-100', count > 0);
                            } else {
                                el.classList.toggle('hidden', count === 0);
                            }
                        });
                    });
                }
            })
            .catch(err => console.error('Error loading cart drawer:', err));
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
});
