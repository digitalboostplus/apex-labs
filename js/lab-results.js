/**
 * Lab Results Component
 * Dynamically loads and displays lab analysis data for products
 * Usage: <div id="lab-results" data-product-id="bpc-157"></div>
 */

(function() {
    // Lab results data (embedded to avoid fetch issues)
    const labData = {
        "bpc-157": {
            name: "BPC-157",
            taskNumber: "#101115",
            quantity: 10.89,
            unit: "mg",
            purity: 99.751,
            analysisDate: "Jan 28, 2026",
            verificationKey: "1UGJHZ51HQVR",
            reportImage: "BPC-157.png"
        },
        "cjc-1295": {
            name: "CJC-1295 (mod GRF 1-29)",
            taskNumber: "#101119",
            quantity: 9.87,
            unit: "mg",
            purity: 81.190,
            analysisDate: "Jan 28, 2026",
            verificationKey: "8GTM1W65B3SS1",
            reportImage: "CJC-1295.png",
            note: "Sample contained related peptide - see full report"
        },
        "ghk-cu": {
            name: "GHK-Cu",
            taskNumber: "#101116",
            quantity: 105.33,
            unit: "mg",
            purity: 99.572,
            analysisDate: "Jan 28, 2026",
            verificationKey: "B1VRPP7ERFZ4",
            reportImage: "GHK-Cu.png"
        },
        "ipamorelin": {
            name: "Ipamorelin",
            taskNumber: "#101120",
            quantity: 12.66,
            unit: "mg",
            purity: 99.817,
            analysisDate: "Jan 28, 2026",
            verificationKey: "7T9TPLF4JU3C",
            reportImage: "Ipamorelin.png"
        },
        "mots-c": {
            name: "MOTS-C",
            taskNumber: "#101121",
            quantity: 55.63,
            unit: "mg",
            purity: 99.563,
            analysisDate: "Jan 28, 2026",
            verificationKey: "ASNSWEEFAZ79",
            reportImage: "MOTS-C.png"
        },
        "pt-141": {
            name: "PT-141",
            taskNumber: "#101122",
            quantity: 12.38,
            unit: "mg",
            purity: 99.861,
            analysisDate: "Jan 28, 2026",
            verificationKey: "DH49ZZ3CM4MI",
            reportImage: "PT-141.png"
        },
        "reta": {
            name: "Retatrutide",
            taskNumber: "#101113",
            quantity: 11.79,
            unit: "mg",
            purity: 99.788,
            analysisDate: "Jan 28, 2026",
            verificationKey: "7LXBJJWNAP83",
            reportImage: "Retatrutide.png"
        },
        "tb-500": {
            name: "TB-500 (TB4)",
            taskNumber: "#101114",
            quantity: 11.92,
            unit: "mg",
            purity: 99.782,
            analysisDate: "Jan 28, 2026",
            verificationKey: "LABYSEAVF5P4",
            reportImage: "TB-500.png"
        },
        "tesamorelin": {
            name: "Tesamorelin",
            taskNumber: "#101118",
            quantity: 10.28,
            unit: "mg",
            purity: 99.070,
            analysisDate: "Jan 28, 2026",
            verificationKey: "HFXVGQ9VKB35",
            reportImage: "Tesamorelin.png"
        }
    };

    // Inject CSS
    const styles = `
        .lab-results-panel {
            background: linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(248,250,252,0.95) 100%);
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
            border: 1px solid rgba(0, 194, 255, 0.2);
            position: relative;
            overflow: hidden;
            padding: 1.5rem;
            margin-top: 2rem;
            box-shadow: 0 10px 40px -10px rgba(0, 82, 204, 0.15);
        }

        .lab-results-panel::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 3px;
            background: linear-gradient(90deg, #00C2FF 0%, #0052cc 50%, #00C2FF 100%);
        }

        .lab-purity-ring {
            width: 100px;
            height: 100px;
            border-radius: 50%;
            background: conic-gradient(
                #00C2FF 0deg,
                #0052cc calc(var(--purity) * 3.6deg),
                #e2e8f0 calc(var(--purity) * 3.6deg)
            );
            display: flex;
            align-items: center;
            justify-content: center;
            position: relative;
            flex-shrink: 0;
        }

        .lab-purity-ring::before {
            content: '';
            position: absolute;
            inset: 6px;
            background: white;
            border-radius: 50%;
        }

        .lab-purity-value {
            position: relative;
            z-index: 1;
            font-family: 'Oswald', sans-serif;
            font-size: 1.5rem;
            font-weight: 700;
            color: #0F172A;
            letter-spacing: -0.02em;
        }

        .lab-purity-value span {
            font-size: 0.75rem;
            color: #64748b;
        }

        .lab-stat {
            display: flex;
            flex-direction: column;
            gap: 2px;
        }

        .lab-stat-label {
            font-size: 9px;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.15em;
            color: #94a3b8;
        }

        .lab-stat-value {
            font-size: 13px;
            font-weight: 700;
            color: #0F172A;
        }

        .lab-janoshik-badge {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            padding: 4px 10px;
            background: #f1f5f9;
            border: 1px solid #e2e8f0;
            font-size: 8px;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            color: #475569;
            text-decoration: none;
            transition: all 0.2s ease;
        }

        .lab-janoshik-badge:hover {
            background: #0052cc;
            border-color: #0052cc;
            color: white;
        }

        .lab-view-report-btn {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            width: 100%;
            padding: 12px 20px;
            margin-top: 1.5rem;
            background: #0F172A;
            color: white;
            font-size: 10px;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.15em;
            border: none;
            cursor: pointer;
            transition: all 0.3s ease;
        }

        .lab-view-report-btn:hover {
            background: #0052cc;
        }

        .lab-note {
            margin-top: 12px;
            padding: 8px 12px;
            background: #fef3c7;
            border-left: 3px solid #f59e0b;
            font-size: 11px;
            color: #92400e;
        }

        /* Modal */
        .lab-modal-overlay {
            position: fixed;
            inset: 0;
            background: rgba(15, 23, 42, 0.9);
            backdrop-filter: blur(8px);
            z-index: 9999;
            display: none;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }

        .lab-modal-overlay.active {
            display: flex;
        }

        .lab-modal {
            background: white;
            max-width: 550px;
            width: 100%;
            max-height: 90vh;
            overflow: auto;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
        }

        .lab-modal-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 14px 20px;
            background: #0F172A;
            color: white;
            position: sticky;
            top: 0;
            z-index: 10;
        }

        .lab-modal-title {
            font-family: 'Oswald', sans-serif;
            font-size: 12px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.1em;
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .lab-modal-close {
            background: transparent;
            border: none;
            color: white;
            cursor: pointer;
            padding: 4px;
            display: flex;
            transition: color 0.2s;
        }

        .lab-modal-close:hover {
            color: #00C2FF;
        }

        .lab-modal-body img {
            width: 100%;
            height: auto;
            display: block;
        }

        .lab-modal-footer {
            padding: 14px 20px;
            background: #f8fafc;
            border-top: 1px solid #e2e8f0;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            flex-wrap: wrap;
        }

        .lab-verification-code {
            font-size: 11px;
            color: #64748b;
        }

        .lab-verification-code strong {
            color: #0F172A;
            font-family: monospace;
        }

        .lab-verify-link {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 8px 14px;
            background: #00C2FF;
            color: #0F172A;
            font-size: 9px;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.1em;
            text-decoration: none;
            transition: all 0.2s ease;
        }

        .lab-verify-link:hover {
            background: #0052cc;
            color: white;
        }
    `;

    function injectStyles() {
        if (document.getElementById('lab-results-styles')) return;
        const styleEl = document.createElement('style');
        styleEl.id = 'lab-results-styles';
        styleEl.textContent = styles;
        document.head.appendChild(styleEl);
    }

    function formatPurity(purity) {
        return purity.toFixed(2);
    }

    function renderLabResults(container, productId) {
        const data = labData[productId];
        if (!data) {
            console.warn(`No lab data found for product: ${productId}`);
            return;
        }

        // Determine base path for assets
        const isInPricing = window.location.pathname.includes('/pricing/');
        const assetPath = isInPricing ? '../assets/lab-results/' : 'assets/lab-results/';

        const html = `
            <div class="lab-results-panel">
                <!-- Header -->
                <div class="flex items-center justify-between mb-6">
                    <div class="flex items-center gap-2">
                        <i data-lucide="flask-conical" class="w-4 h-4 text-[#00C2FF]"></i>
                        <span class="text-[10px] font-black uppercase tracking-widest text-slate-500">Independent Lab Analysis</span>
                    </div>
                    <a href="https://www.janoshik.com" target="_blank" rel="noopener" class="lab-janoshik-badge">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-3 h-3">
                            <path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="10"/>
                        </svg>
                        Janoshik Verified
                    </a>
                </div>

                <!-- Main Content -->
                <div class="flex items-center gap-6">
                    <!-- Purity Ring -->
                    <div class="lab-purity-ring" style="--purity: ${data.purity}">
                        <div class="lab-purity-value">${formatPurity(data.purity)}<span>%</span></div>
                    </div>

                    <!-- Stats Grid -->
                    <div class="flex-grow grid grid-cols-2 gap-3">
                        <div class="lab-stat">
                            <span class="lab-stat-label">Compound</span>
                            <span class="lab-stat-value">${data.name}</span>
                        </div>
                        <div class="lab-stat">
                            <span class="lab-stat-label">Quantity</span>
                            <span class="lab-stat-value">${data.quantity} ${data.unit}</span>
                        </div>
                        <div class="lab-stat">
                            <span class="lab-stat-label">Analysis Date</span>
                            <span class="lab-stat-value">${data.analysisDate}</span>
                        </div>
                        <div class="lab-stat">
                            <span class="lab-stat-label">Task #</span>
                            <span class="lab-stat-value">${data.taskNumber}</span>
                        </div>
                    </div>
                </div>

                ${data.note ? `<div class="lab-note">${data.note}</div>` : ''}

                <!-- View Report Button -->
                <button class="lab-view-report-btn" onclick="window.labResults.openModal('${productId}')">
                    <i data-lucide="file-search" class="w-4 h-4"></i>
                    View Full Lab Report
                </button>
            </div>

            <!-- Modal -->
            <div id="lab-modal-${productId}" class="lab-modal-overlay" onclick="window.labResults.closeModal('${productId}', event)">
                <div class="lab-modal" onclick="event.stopPropagation()">
                    <div class="lab-modal-header">
                        <span class="lab-modal-title">
                            <i data-lucide="microscope" class="w-4 h-4"></i>
                            ${data.name} Lab Analysis Report
                        </span>
                        <button class="lab-modal-close" onclick="window.labResults.closeModal('${productId}')">
                            <i data-lucide="x" class="w-5 h-5"></i>
                        </button>
                    </div>
                    <div class="lab-modal-body">
                        <img src="${assetPath}${data.reportImage}" alt="${data.name} Lab Report">
                    </div>
                    <div class="lab-modal-footer">
                        <span class="lab-verification-code">
                            Verification Key: <strong>${data.verificationKey}</strong>
                        </span>
                        <a href="https://www.janoshik.com/verify/" target="_blank" rel="noopener" class="lab-verify-link">
                            <i data-lucide="external-link" class="w-3 h-3"></i>
                            Verify on Janoshik
                        </a>
                    </div>
                </div>
            </div>
        `;

        container.innerHTML = html;

        // Initialize Lucide icons in the new content
        if (window.lucide) {
            setTimeout(() => lucide.createIcons(), 0);
        }
    }

    // Public API
    window.labResults = {
        init: function() {
            injectStyles();
            const containers = document.querySelectorAll('[data-lab-product]');
            containers.forEach(container => {
                const productId = container.getAttribute('data-lab-product');
                renderLabResults(container, productId);
            });
        },

        openModal: function(productId) {
            const modal = document.getElementById(`lab-modal-${productId}`);
            if (modal) {
                modal.classList.add('active');
                document.body.style.overflow = 'hidden';
                if (window.lucide) lucide.createIcons();
            }
        },

        closeModal: function(productId, event) {
            if (event && event.target !== event.currentTarget) return;
            const modal = document.getElementById(`lab-modal-${productId}`);
            if (modal) {
                modal.classList.remove('active');
                document.body.style.overflow = '';
            }
        },

        hasData: function(productId) {
            return !!labData[productId];
        }
    };

    // Auto-init on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', window.labResults.init);
    } else {
        window.labResults.init();
    }

    // Close modal on Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            document.querySelectorAll('.lab-modal-overlay.active').forEach(modal => {
                modal.classList.remove('active');
                document.body.style.overflow = '';
            });
        }
    });
})();
