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
    const errorText = document.getElementById('error-text');

    // ── Configuración de la API de tracking ──
    const API_BASE = 'http://localhost/dentall-catalog-api/api/v1';
    const API_AUTH = 'Basic ' + btoa('admin:secret');

    // ── UUID ──
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const DEFAULT_PDF = 'ortodoncia.pdf';

    // ── Utilidades ──

    function showError(msg) {
        if (msg) {
            errorText.textContent = msg;
        }
        errorMessage.classList.remove('d-none');
    }

    function hideError() {
        errorMessage.classList.add('d-none');
    }

    /**
     * Valida si una cadena tiene formato UUID v4.
     * @param {string} str
     * @returns {boolean}
     */
    function isValidUuid(str) {
        return typeof str === 'string' && UUID_REGEX.test(str);
    }

    /**
     * Extrae el UUID de cada página y construye un mapping UUID → número de página.
     * @param {Object} pdfDoc - Documento PDF cargado por PDF.js.
     * @returns {Promise<Map<string, number>>}
     */
    async function buildUuidMap(pdfDoc) {
        const uuidMap = new Map();
        const totalPages = pdfDoc.numPages;

        for (let i = 1; i <= totalPages; i++) {
            const page = await pdfDoc.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map(item => item.str).join(' ');

            const match = pageText.match(UUID_REGEX);
            if (match) {
                uuidMap.set(match[0].toLowerCase(), i);
            }
        }

        return uuidMap;
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
     * @returns {{ pdf: string|null, page: number, ref: string|null }}
     */
    function getParamsFromUrl() {
        const params = new URLSearchParams(window.location.search);
        const pdfParam = params.get('pdf');
        const refParam = params.get('ref');
        let pageParam = parseInt(params.get('page'), 10);
        if (isNaN(pageParam) || pageParam < 1) {
            pageParam = 1;
        }
        return { pdf: pdfParam, page: pageParam, ref: refParam };
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
        const fileName = pdfName || DEFAULT_PDF;

        const link = document.createElement('a');
        link.href = `./assets/${fileName}`;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    // ── Inicialización ──

    async function init() {
        const { pdf: pdfName, page: initialPage, ref } = getParamsFromUrl();

        if (!pdfName && !ref) {
            window.location.replace(`./index.html?pdf=${DEFAULT_PDF}&page=1`);
            return;
        }

        const pdfFile = pdfName || DEFAULT_PDF;

        if (ref && !isValidUuid(ref)) {
            showError('El enlace no es válido. Verifique el código QR.');
            return;
        }

        try {
            const loadingTask = pdfjsLib.getDocument(`./assets/${pdfFile}`);
            pdfDoc = await loadingTask.promise;

            if (ref) {
                const uuidMap = await buildUuidMap(pdfDoc);
                const resolvedPage = uuidMap.get(ref.toLowerCase());

                if (!resolvedPage) {
                    showError('Este catálogo ha sido actualizado. Por favor, solicite un nuevo código QR.');
                    return;
                }

                pageNum = resolvedPage;
            } else {
                if (initialPage > pdfDoc.numPages) {
                    pageNum = pdfDoc.numPages;
                } else {
                    pageNum = initialPage;
                }
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
