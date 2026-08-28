(() => {
    'use strict';

    // ── Configuración del worker de PDF.js ──
    pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

    // ── Estado de la aplicación (SDD §4) ──
    let pdfDoc = null;
    let pageNum = 1;
    let pageIsRendering = false;
    let pageNumPending = null;
    let scale = 1.5;

    // ── Referencias del DOM (SDD §5) ──
    const canvas = document.getElementById('pdf-render');
    const ctx = canvas.getContext('2d');
    const btnPrev = document.getElementById('btn-prev');
    const btnNext = document.getElementById('btn-next');
    const pageInfo = document.getElementById('page-info');
    const btnZoomIn = document.getElementById('btn-zoom-in');
    const btnZoomOut = document.getElementById('btn-zoom-out');
    const btnDownload = document.getElementById('btn-download');
    const errorMessage = document.getElementById('error-message');

    // ── Configuración de la API de tracking ──
    const API_BASE = 'http://localhost/dentall-catalog-api/api/v1';
    const API_AUTH = 'Basic ' + btoa('admin:secret');

    // ── Utilidades ──

    function showError() {
        errorMessage.classList.remove('d-none');
    }

    function hideError() {
        errorMessage.classList.add('d-none');
    }

    /**
     * Registra el evento de escaneo en la API de tracking (fire-and-forget).
     * @param {number} pageNumber - Número de página escaneada.
     */
    async function trackScan(pageNumber) {
        try {
            await fetch(`${API_BASE}/tracking/scan`, {
                method: 'POST',
                headers: {
                    'Authorization': API_AUTH,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ page_number: pageNumber })
            });
        } catch (_) {
            // Silencioso — el visor no debe fallar si el API no responde
        }
    }

    /**
     * Extrae los parámetros de la URL (SDD §3).
     * @returns {{ pdf: string|null, page: number }}
     */
    function getParamsFromUrl() {
        const params = new URLSearchParams(window.location.search);
        const pdfParam = params.get('pdf');
        let pageParam = parseInt(params.get('page'), 10);
        if (isNaN(pageParam) || pageParam < 1) {
            pageParam = 1;
        }
        return { pdf: pdfParam, page: pageParam };
    }

    /**
     * Actualiza el texto de paginación.
     */
    function updatePageInfo() {
        const total = pdfDoc ? pdfDoc.numPages : 0;
        pageInfo.textContent = `${pageNum} / ${total}`;
    }

    /**
     * Renderiza una página específica en el canvas.
     * @param {number} num - Número de página a renderizar.
     * @returns {Promise<void>}
     */
    async function renderPage(num) {
        pageIsRendering = true;

        try {
            const page = await pdfDoc.getPage(num);
            const viewport = page.getViewport({ scale });
            canvas.height = viewport.height;
            canvas.width = viewport.width;

            const renderContext = {
                canvasContext: ctx,
                viewport
            };

            await page.render(renderContext).promise;
        } catch (err) {
            console.error('Error al renderizar la página:', err);
            showError();
        }

        pageIsRendering = false;

        if (pageNumPending !== null) {
            const pending = pageNumPending;
            pageNumPending = null;
            renderPage(pending);
        }
    }

    /**
     * Solicita ir a una página. Implementa el sistema de colas (SDD §4).
     * @param {number} num - Página destino.
     */
    function queueRenderPage(num) {
        if (pageIsRendering) {
            pageNumPending = num;
        } else {
            renderPage(num);
        }
    }

    /**
     * Muestra la página anterior.
     */
    function onPrevPage() {
        if (pageNum <= 1) return;
        pageNum--;
        updatePageInfo();
        queueRenderPage(pageNum);
    }

    /**
     * Muestra la página siguiente.
     */
    function onNextPage() {
        if (pageNum >= pdfDoc.numPages) return;
        pageNum++;
        updatePageInfo();
        queueRenderPage(pageNum);
    }

    /**
     * Aumenta el zoom y re-renderiza.
     */
    function onZoomIn() {
        scale = Math.min(scale + 0.25, 5);
        queueRenderPage(pageNum);
    }

    /**
     * Reduce el zoom y re-renderiza.
     */
    function onZoomOut() {
        scale = Math.max(scale - 0.25, 0.5);
        queueRenderPage(pageNum);
    }

    /**
     * Descarga el PDF local desde ./assets/ (SDD §4).
     */
    function onDownload() {
        if (!pdfDoc) return;
        const { pdf: pdfName } = getParamsFromUrl();
        if (!pdfName) return;

        const link = document.createElement('a');
        link.href = `./assets/${pdfName}`;
        link.download = pdfName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    // ── Inicialización ──

    async function init() {
        const { pdf: pdfName, page: initialPage } = getParamsFromUrl();

        if (!pdfName) {
            window.location.replace('./index.html?pdf=ortodoncia.pdf&page=1');
            return;
        }

        try {
            const loadingTask = pdfjsLib.getDocument(`./assets/${pdfName}`);
            pdfDoc = await loadingTask.promise;

            if (initialPage > pdfDoc.numPages) {
                pageNum = pdfDoc.numPages;
            } else {
                pageNum = initialPage;
            }

            updatePageInfo();
            await renderPage(pageNum);
            trackScan(pageNum);
        } catch (err) {
            console.error('Error al cargar el PDF:', err);
            showError();
        }
    }

    // ── Bindings de eventos ──
    btnPrev.addEventListener('click', onPrevPage);
    btnNext.addEventListener('click', onNextPage);
    btnZoomIn.addEventListener('click', onZoomIn);
    btnZoomOut.addEventListener('click', onZoomOut);
    btnDownload.addEventListener('click', onDownload);

    // ── Arranque ──
    init();
})();
