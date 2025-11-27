// Drag and drop with server processing
// Global variables
let currentMode = 'parts'; // 'parts', 'damage', or 'full-union'
let isProcessing = false;
let currentProgress = 0;

// File processing queue
let processingQueue = [];
let isProcessingQueue = false;
let fileIdCounter = 0;

// DOM elements
const dropZone = document.getElementById('drop-zone');
const resultsGrid = document.getElementById('results-grid');
const resultsGallery = document.getElementById('results-gallery');
const errorDiv = document.getElementById('error');
const errorMessage = document.getElementById('error-message');

// Progress bar elements
const progressContainer = document.getElementById('progress-container');
const progressText = document.getElementById('progress-text');
const progressPercent = document.getElementById('progress-percent');
const progressFill = document.getElementById('progress-fill');

// Modal elements
const modal = document.getElementById('image-modal');
const modalImage = document.getElementById('modal-image');
const modalTitle = document.getElementById('modal-title');
const modalFilename = document.getElementById('modal-filename');
const modalTimestamp = document.getElementById('modal-timestamp');
const modalMode = document.getElementById('modal-mode');
const btnOriginal = document.getElementById('btn-original');
const btnOverlay = document.getElementById('btn-overlay');
const btnMask = document.getElementById('btn-mask');
const modalClose = document.getElementById('modal-close');
const btnInteractive = document.getElementById('btn-interactive');

// Modal data
let currentModalData = null;
let currentModalMode = 'original'; // 'original', 'overlay', 'interactive', 'mask'

// Interactive labels
let interactiveLabels = [];
let isDraggingLabel = false;
let draggedLabel = null;
let dragOffset = { x: 0, y: 0 };

// Initialize - combined with modal listeners
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 DCD Vision initialized');
    updateModeTabs();
    updateMobileButtonText(); // Инициализируем текст мобильной кнопки

    // Initialize parallel indicator close functionality
    initParallelIndicatorClose();

    // Initialize model status checking
    startModelStatusChecking();

    // Add resize handler for responsive interactive elements
    window.addEventListener('resize', function() {
        console.log('📱 Окно изменено, обновляем интерактивные элементы');
        updateInteractiveElementsPositions();
    });



    // Modal close button
    if (modalClose) {
        modalClose.addEventListener('click', closeModal);
    }

    // Close modal on background click
    if (modal) {
        modal.addEventListener('click', function(e) {
            if (e.target === modal) {
                closeModal();
            }
        });
    }

    // Modal button handlers
    if (btnOriginal) {
        btnOriginal.addEventListener('click', function() {
            updateModalButtons('original');
        });
    }

    if (btnOverlay) {
        btnOverlay.addEventListener('click', function() {
            updateModalButtons('overlay');
        });
    }

    if (btnMask) {
        btnMask.addEventListener('click', function() {
            updateModalButtons('mask');
        });
    }

    if (btnInteractive) {
        btnInteractive.addEventListener('click', function() {
            updateModalButtons('interactive');
        });
    }

    // ESC key to close modal
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && modal && modal.classList.contains('show')) {
            closeModal();
        }
    });

    console.log('✅ Modal event listeners initialized');
});

// Mode switching function - always works, doesn't affect running processes
function switchTab(mode, button) {
    currentMode = mode;

    // Update tab buttons
    const tabButtons = document.querySelectorAll('.mode-tab');
    tabButtons.forEach(btn => btn.classList.remove('active'));
    button.classList.add('active');

    // Update drop text
    updateDropText();

    console.log('🔄 Switched to mode:', mode);
}

// Update drop zone text based on current mode
function updateDropText() {
    const dropText = document.getElementById('drop-text');
    if (dropText) {
        if (currentMode === 'parts') {
            dropText.innerHTML = 'Перетащите изображение автомобиля сюда для анализа деталей';
        } else if (currentMode === 'damage') {
            dropText.innerHTML = 'Перетащите изображение автомобиля сюда для анализа повреждений';
        } else if (currentMode === 'full-union') {
            dropText.innerHTML = 'Перетащите изображение автомобиля сюда для полного объединения всех моделей';
        }
    }
    
    // Обновляем текст мобильной кнопки
    updateMobileButtonText();
}

// Update mobile button text based on current mode
function updateMobileButtonText() {
    const mobileFileText = document.getElementById('mobile-file-text');
    const mobileFileButton = document.getElementById('mobile-file-button');
    
    if (mobileFileText) {
        if (currentMode === 'parts') {
            mobileFileText.textContent = 'Выберите файл для анализа деталей';
        } else if (currentMode === 'damage') {
            mobileFileText.textContent = 'Выберите файл для анализа повреждений';
        } else if (currentMode === 'full-union') {
            mobileFileText.textContent = 'Выберите файл для полного объединения';
        } else {
            mobileFileText.textContent = 'Выберите файл';
        }
    }
    
    // Обновляем цвет кнопки в зависимости от режима
    if (mobileFileButton) {
        // Удаляем все классы режимов
        mobileFileButton.classList.remove('mode-parts', 'mode-damage', 'mode-full-union');
        
        // Добавляем класс текущего режима
        if (currentMode === 'parts') {
            mobileFileButton.classList.add('mode-parts');
        } else if (currentMode === 'damage') {
            mobileFileButton.classList.add('mode-damage');
        } else if (currentMode === 'full-union') {
            mobileFileButton.classList.add('mode-full-union');
        } else {
            // По умолчанию используем режим parts
            mobileFileButton.classList.add('mode-parts');
        }
    }
}

// Update tab buttons on load
function updateModeTabs() {
    const partsButton = document.querySelector('.mode-tab[onclick*="parts"]');
    const damageButton = document.querySelector('.mode-tab[onclick*="damage"]');
    const fullUnionButton = document.querySelector('.mode-tab[onclick*="full-union"]');

    if (partsButton && damageButton && fullUnionButton) {
        // Remove active class from all buttons
        partsButton.classList.remove('active');
        damageButton.classList.remove('active');
        fullUnionButton.classList.remove('active');

        // Add active class to current mode button
        if (currentMode === 'parts') {
            partsButton.classList.add('active');
        } else if (currentMode === 'damage') {
            damageButton.classList.add('active');
        } else if (currentMode === 'full-union') {
            fullUnionButton.classList.add('active');
        }
    }
}

// Handle multiple files with queue system
function handleFiles(files) {
    // Filter only image files
    const imageFiles = files.filter(file => file.type.startsWith('image/'));

    if (imageFiles.length === 0) {
        showError('Не найдено подходящих изображений');
        // Сбрасываем состояние даже при ошибке
        resetUploadState();
        return;
    }

    // Check file sizes
    const oversizedFiles = imageFiles.filter(file => file.size > 10 * 1024 * 1024);
    if (oversizedFiles.length > 0) {
        showError('Один или несколько файлов слишком большие (макс. 10MB)');
        // Сбрасываем состояние даже при ошибке
        resetUploadState();
        return;
    }

    // Add files to queue
    imageFiles.forEach(file => {
        const fileId = ++fileIdCounter;
        const fileItem = {
            id: fileId,
            file: file,
            mode: currentMode, // Запоминаем режим на момент добавления
            status: 'queued', // 'queued', 'processing', 'completed', 'error'
            progress: 0,
            timestamp: new Date(),
            element: null // DOM element for this file
        };

        processingQueue.push(fileItem);
        addFileToUI(fileItem);
    });

    // Start processing if not already running
    if (!isProcessingQueue) {
        startQueueProcessing();
    }

    hideError();
}

// Drag and drop handlers
if (dropZone) {
    dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
});

dropZone.addEventListener('drop', (e) => {
    e.preventDefault();

        const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
            handleFiles(files);
        }
    });
}

// File input handler
const fileInput = document.getElementById('file-input');
if (fileInput) {
    fileInput.addEventListener('change', (e) => {
        const files = Array.from(e.target.files);
        if (files.length > 0) {
            handleFiles(files);
            // Очищаем input после обработки, чтобы можно было выбирать тот же файл снова
            fileInput.value = '';
        }
    });
}

// File select link handler
const fileSelectLink = document.getElementById('file-select');
if (fileSelectLink) {
    fileSelectLink.addEventListener('click', (e) => {
        e.preventDefault();
        if (fileInput) {
            fileInput.click();
        }
    });
}

// Mobile file button handler
const mobileFileButton = document.getElementById('mobile-file-button');
if (mobileFileButton) {
    mobileFileButton.addEventListener('click', (e) => {
        e.preventDefault();
        if (fileInput) {
            fileInput.click();
        }
    });
}

// Send file to server with specific processing mode
async function sendToServer(file, processingMode = null) {
    // Используем переданный режим или текущий
    const modeToUse = processingMode || currentMode;

        const formData = new FormData();
        formData.append('file', file);

    // Choose endpoint based on processing mode (not current UI mode)
    let endpoint;
    if (modeToUse === 'parts') {
        endpoint = '/upload';
    } else if (modeToUse === 'damage') {
        endpoint = '/upload_damage';
    } else if (modeToUse === 'full-union') {
        endpoint = '/upload_full_union'; // Пока используем существующий endpoint, можно потом добавить новый
    } else {
        endpoint = '/upload'; // fallback
    }

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            body: formData
        });

        const data = await response.json();

        if (data.success) {
            return data; // Return data for queue processing
        } else {
            throw new Error(data.error || 'Ошибка обработки');
        }
    } catch (error) {
        console.error('Network error:', error);
        throw error; // Re-throw for queue processing
    }
}

// Add processed image to gallery with specific mode
function addProcessedImageToGallery(data, originalFilename, processingMode = null) {
    if (!resultsGrid) {
        return;
    }

    const resultCard = document.createElement('div');
    resultCard.className = 'result-card';

    const timestamp = new Date().toLocaleTimeString();
    // Используем переданный режим обработки, а не текущий UI режим
    const modeToUse = processingMode || currentMode;
    let modeText, modeClass;
    if (modeToUse === 'parts') {
        modeText = 'Детали';
        modeClass = 'mode-parts';
    } else if (modeToUse === 'damage') {
        modeText = 'Повреждения';
        modeClass = 'mode-damage';
    } else if (modeToUse === 'full-union') {
        modeText = 'Полное объединение';
        modeClass = 'mode-full-union';
    } else {
        modeText = 'Детали'; // Default fallback
        modeClass = 'mode-parts';
    }

    // Use processed image from server (overlay URL)
    let imageUrl = data.overlay || data.original || '';

    // Prepare modal data with correct processing mode and polygons
    const modalData = {
        filename: originalFilename,
        timestamp: timestamp,
        mode: modeToUse, // Важно: используем режим обработки, а не UI
        original: data.original || '',
        overlay: data.overlay || '',
        mask: data.mask || '',
        polygons: data.polygons || [], // Добавляем информацию о полигонах
        detections: data.detections || [],
        file_id: data.file_id || '' // Добавляем file_id для работы с масками
    };

    console.log(`📊 Добавляем в галерею: ${originalFilename}`);
    console.log(`   Полигоны: ${modalData.polygons ? modalData.polygons.length : 0}`);
    console.log(`   File ID: ${modalData.file_id}`);
    console.log(`   Режим: ${modalData.mode}`);

    // Сохраняем данные в dataset для доступа из обработчика клика
    resultCard.dataset.modalData = JSON.stringify(modalData);

    // Обычное отображение с изображением для всех режимов
    resultCard.innerHTML = `
        <img src="${imageUrl}" alt="${originalFilename}" class="result-image">
        <div class="result-info">
            <div class="result-filename">${originalFilename}</div>
            <div class="result-meta">
                <span class="result-mode-badge ${modeClass}">${modeText}</span>
                <span>${timestamp}</span>
                ${data.polygons && data.polygons.length > 0 ? `<span class="polygons-count">${data.polygons.length} полигонов</span>` : ''}
                <button class="export-single-btn" title="Экспортировать в Excel">📊</button>
            </div>
        </div>
    `;

    // Add click handler to image
    const imageElement = resultCard.querySelector('.result-image');

    if (imageElement) {
        imageElement.addEventListener('click', function() {
            // Получаем данные из dataset карточки
            const cardData = JSON.parse(resultCard.dataset.modalData || '{}');
            openModal(cardData);
        });
        imageElement.style.cursor = 'pointer';
    }

    // Add click handler for export button
    const exportBtn = resultCard.querySelector('.export-single-btn');
    if (exportBtn) {
        exportBtn.addEventListener('click', function(e) {
            e.stopPropagation(); // Prevent modal opening
            const fileId = data.file_id || fileId; // Use file_id from server response
            exportSingleToExcel(fileId);
        });
    }

    resultsGrid.appendChild(resultCard);

    // Show results gallery if hidden
    if (resultsGallery && resultsGallery.style.display === 'none') {
        resultsGallery.style.display = 'block';
    }

    console.log('✅ Processed image added to gallery:', originalFilename, '- Processing Mode:', modeToUse, '- Polygons:', data.polygons?.length || 0);
}

// Queue processing functions
function addFileToUI(fileItem) {
    // Create file preview element
    const fileElement = document.createElement('div');
    fileElement.className = 'file-queue-item';
    fileElement.dataset.fileId = fileItem.id;

    let modeText, modeClass;
    if (fileItem.mode === 'parts') {
        modeText = 'Детали';
        modeClass = 'mode-parts';
    } else if (fileItem.mode === 'damage') {
        modeText = 'Повреждения';
        modeClass = 'mode-damage';
    } else if (fileItem.mode === 'full-union') {
        modeText = 'Полное объединение';
        modeClass = 'mode-full-union';
    } else {
        modeText = 'Детали';
        modeClass = 'mode-parts';
    }

    fileElement.innerHTML = `
        <div class="file-preview">
            <div class="file-icon">📄</div>
            <div class="file-info">
                <div class="file-name">${fileItem.file.name}</div>
                <div class="file-size">${formatFileSize(fileItem.file.size)}</div>
            </div>
        </div>
        <div class="file-status">
            <div class="status-badge status-${fileItem.status}">
                ${getStatusText(fileItem.status)}
            </div>
            <div class="file-mode-badge ${modeClass}">${modeText}</div>
        </div>
        <div class="file-progress">
            <div class="progress-bar-small">
                <div class="progress-fill-small" style="width: ${fileItem.progress}%"></div>
            </div>
        </div>
        <div class="file-actions">
            <button class="cancel-btn" onclick="cancelFile(${fileItem.id})" title="Отменить обработку этого файла">
                ✕
            </button>
        </div>
    `;

    // Add to queue container (create if doesn't exist)
    let queueContainer = document.getElementById('file-queue');
    if (!queueContainer) {
        queueContainer = document.createElement('div');
        queueContainer.id = 'file-queue';
        queueContainer.className = 'file-queue';

        // Add header
        const header = document.createElement('div');
        header.className = 'file-queue-header';
        header.innerHTML = '<h4>📋 Очередь обработки файлов</h4>';
        queueContainer.appendChild(header);

        // Add items container
        const itemsContainer = document.createElement('div');
        itemsContainer.className = 'file-queue-items';
        itemsContainer.id = 'file-queue-items';
        queueContainer.appendChild(itemsContainer);

        // Insert before results gallery
        const resultsGallery = document.getElementById('results-gallery');
        if (resultsGallery) {
            resultsGallery.parentNode.insertBefore(queueContainer, resultsGallery);
        }
    }

    // Add to items container
    const itemsContainer = document.getElementById('file-queue-items');
    if (itemsContainer) {
        itemsContainer.appendChild(fileElement);
    }

    fileItem.element = fileElement;

    updateFileStatus(fileItem);
}

function startQueueProcessing() {
    if (isProcessingQueue || processingQueue.length === 0) return;

    isProcessingQueue = true;
    processNextInQueue();
}

// Function to check if all files are processed and hide indicators
function checkProcessingComplete() {
    const hasQueued = processingQueue.some(item => item.status === 'queued');
    const hasProcessing = processingQueue.some(item => item.status === 'processing');

    if (!hasQueued && !hasProcessing && isProcessingQueue) {
        isProcessingQueue = false;
        hideParallelIndicator();

        // Сбрасываем состояние для возможности новых загрузок
        resetUploadState();

        console.log('✅ All files processing completed - ready for new uploads');
    }
}

// Function to reset upload state for new file uploads
function resetUploadState() {
    // Очищаем input файл, если он еще не очищен
    if (fileInput) {
        fileInput.value = '';
    }

    // Сбрасываем любые визуальные индикаторы загрузки
    hideProgress();

    // Убеждаемся, что drag-and-drop зона активна
    if (dropZone) {
        dropZone.style.opacity = '1';
        dropZone.style.pointerEvents = 'auto';

        // Добавляем небольшой визуальный индикатор готовности
        dropZone.classList.add('ready-for-upload');
        setTimeout(() => {
            dropZone.classList.remove('ready-for-upload');
        }, 1000);
    }

    // Очищаем очередь обработки, если все файлы завершены
    if (processingQueue.every(item => item.status === 'completed' || item.status === 'error')) {
        console.log('🧹 Очищаем завершенную очередь обработки');
        processingQueue.length = 0; // Очищаем массив
        fileIdCounter = 0; // Сбрасываем счетчик
    }

    console.log('🔄 Upload state reset - ready for new files');
}

async function processNextInQueue() {
    // Find all queued files for parallel processing
    const queuedFiles = processingQueue.filter(item => item.status === 'queued');

    if (queuedFiles.length === 0) {
        isProcessingQueue = false;
        return;
    }

    // Process up to 8 files simultaneously with RTX 5090/3090 GPU power
    const batchSize = Math.min(8, queuedFiles.length);
    const filesToProcess = queuedFiles.slice(0, batchSize);

    console.log(`🚀 Starting parallel processing of ${filesToProcess.length} files`);

    // Show parallel processing indicator
    updateParallelIndicator(filesToProcess.length);

    // Update status to processing for all files in batch
    filesToProcess.forEach(fileItem => {
        fileItem.status = 'processing';
        updateFileStatus(fileItem);
    });

    // Process all files in the batch simultaneously
    const processingPromises = filesToProcess.map(async (fileItem) => {
        try {
            // Сначала отправляем файл на сервер (начало реальной обработки)
            console.log(`🚀 Начинаем обработку файла: ${fileItem.file.name}`);

            // Send to server (this is where real processing begins)
            const response = await sendToServer(fileItem.file, fileItem.mode);

        if (response && response.success) {
                console.log(`✅ Файл обработан успешно: ${fileItem.file.name}`);

                // Теперь запускаем прогресс-бар только после успешного ответа от сервера
                await startProgressAnimation(fileItem);

                // Complete the progress
                fileItem.status = 'completed';
                fileItem.progress = 100;

            // Add to results gallery
                addProcessedImageToGallery(response, response.filename || fileItem.file.name, fileItem.mode);
                console.log(`✅ Completed processing: ${fileItem.file.name}`);
        } else {
            throw new Error(response?.error || 'Unknown error');
        }

    } catch (error) {
            console.error(`❌ Error processing ${fileItem.file.name}:`, error);
            fileItem.status = 'error';
            fileItem.error = error.message;

            // Показываем ошибку пользователю
            showError(`Ошибка обработки файла ${fileItem.file.name}: ${error.message}`);
        }

        updateFileStatus(fileItem);
    });

    // Wait for all files in the batch to complete
    await Promise.allSettled(processingPromises);

    // Update parallel indicator with remaining processing files
    const remainingProcessing = processingQueue.filter(item => item.status === 'processing').length;
    if (remainingProcessing === 0) {
        hideParallelIndicator();
    } else {
        updateParallelIndicator(remainingProcessing);
    }

    // Check if all processing is complete
    checkProcessingComplete();

    // Continue with next batch after a short delay
    setTimeout(() => {
        processNextInQueue();
    }, 200);
}

async function startProgressAnimation(fileItem) {
    // Реалистичные этапы обработки, начинающиеся только после отправки на сервер
    const stages = [
        { name: '📁 Загрузка файла', duration: 300, targetProgress: 5 },
        { name: '📡 Отправка на сервер', duration: 200, targetProgress: 10 },
        { name: '🚀 Анализ ИИ', duration: 2000, targetProgress: 80 },
        { name: '📊 Обработка результатов', duration: 500, targetProgress: 95 },
        { name: '✨ Финализация', duration: 300, targetProgress: 100 }
    ];

    for (const stage of stages) {
        await animateFileProgress(fileItem, stage.targetProgress, stage.duration, stage.name);
    }
}

function animateFileProgress(fileItem, targetProgress, duration, message) {
    return new Promise((resolve) => {
        const startProgress = fileItem.progress;
        const startTime = Date.now();
        const difference = targetProgress - startProgress;

        function animate() {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);

            const easedProgress = 1 - Math.pow(1 - progress, 3);
            const currentProgress = startProgress + (difference * easedProgress);

            fileItem.progress = Math.round(currentProgress);
            updateFileStatus(fileItem);

            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                resolve();
            }
        }

        animate();
    });
}

function updateFileStatus(fileItem) {
    if (!fileItem.element) return;

    const statusBadge = fileItem.element.querySelector('.status-badge');
    const progressFill = fileItem.element.querySelector('.progress-fill-small');

    if (statusBadge) {
        statusBadge.className = `status-badge status-${fileItem.status}`;
        statusBadge.textContent = getStatusText(fileItem.status);
    }

    if (progressFill) {
        progressFill.style.width = `${fileItem.progress}%`;
    }

    // Hide progress for completed/error files
    const progressBar = fileItem.element.querySelector('.file-progress');
    if (progressBar) {
        if (fileItem.status === 'completed' || fileItem.status === 'error') {
            progressBar.style.display = 'none';
        } else {
            progressBar.style.display = 'flex';
        }
    }

    // Disable cancel button for processing/completed/error files
    const cancelBtn = fileItem.element.querySelector('.cancel-btn');
    if (cancelBtn) {
        if (fileItem.status === 'queued') {
            cancelBtn.disabled = false;
            cancelBtn.style.opacity = '1';
    } else {
            cancelBtn.disabled = true;
            cancelBtn.style.opacity = '0.5';
        }
    }
}


function getStatusText(status) {
    switch (status) {
        case 'queued': return '⏳ В очереди';
        case 'processing': return '⚙️ Обрабатывается';
        case 'completed': return '✅ Готово';
        case 'error': return '❌ Ошибка';
        default: return 'Неизвестно';
    }
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function cancelFile(fileId) {
    const fileIndex = processingQueue.findIndex(item => item.id === fileId);
    if (fileIndex === -1) return;

    const fileItem = processingQueue[fileIndex];

    // Only cancel if queued (not processing or completed)
    if (fileItem.status === 'queued') {
        processingQueue.splice(fileIndex, 1);
        if (fileItem.element) {
            fileItem.element.remove();
        }
        console.log(`❌ Отменена обработка файла: ${fileItem.file.name}`);
    }
}

// Error handling functions
function showError(message) {
    if (errorDiv && errorMessage) {
        errorDiv.style.display = 'block';
    errorMessage.textContent = message;
}
}

function hideError() {
    if (errorDiv) {
        errorDiv.style.display = 'none';
    }
}



// Progress bar functions
function showProgress() {
    if (progressContainer) {
        progressContainer.style.display = 'block';
    }
}

function hideProgress() {
    if (progressContainer) {
        progressContainer.style.display = 'none';
    }
    currentProgress = 0;
    updateProgress(0);
}

// Parallel processing indicator functions
function showParallelIndicator(processingCount = 0) {
    const parallelIndicator = document.getElementById('parallel-indicator');
    const parallelText = document.getElementById('parallel-text');

    if (parallelIndicator && parallelText) {
        parallelText.textContent = `Параллельная обработка: ${processingCount} файлов одновременно`;
        parallelIndicator.style.display = 'flex';
        parallelIndicator.classList.add('processing');
    }
}

function hideParallelIndicator() {
    const parallelIndicator = document.getElementById('parallel-indicator');
    if (parallelIndicator) {
        parallelIndicator.style.display = 'none';
        parallelIndicator.classList.remove('processing');
    }
}

function updateParallelIndicator(count) {
    const parallelText = document.getElementById('parallel-text');
    if (parallelText && count > 0) {
        parallelText.textContent = `Параллельная обработка: ${count} файлов одновременно`;
        showParallelIndicator(count);
    } else {
        hideParallelIndicator();
    }
}

// Initialize parallel indicator close functionality
function initParallelIndicatorClose() {
    const parallelIndicator = document.getElementById('parallel-indicator');
    const parallelCloseBtn = document.getElementById('parallel-close');

    // Close button handler
    if (parallelCloseBtn) {
        parallelCloseBtn.addEventListener('click', function() {
            hideParallelIndicator();
        });
    }

    // Swipe handler for mobile devices
    if (parallelIndicator && 'ontouchstart' in window) {
        let startX = 0;
        let startY = 0;
        let isSwiping = false;

        parallelIndicator.addEventListener('touchstart', function(e) {
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
            isSwiping = false;
        });

        parallelIndicator.addEventListener('touchmove', function(e) {
            if (!startX || !startY) return;

            const currentX = e.touches[0].clientX;
            const currentY = e.touches[0].clientY;
            const diffX = Math.abs(currentX - startX);
            const diffY = Math.abs(currentY - startY);

            // Detect swipe (horizontal movement > vertical, and > 50px)
            if (diffX > diffY && diffX > 50) {
                isSwiping = true;
            }
        });

        parallelIndicator.addEventListener('touchend', function(e) {
            if (isSwiping) {
                hideParallelIndicator();
            }
        });
    }
}

function updateProgress(percent) {
    currentProgress = Math.min(100, Math.max(0, percent));
    if (progressPercent) {
        progressPercent.textContent = Math.round(currentProgress) + '%';
    }
    if (progressFill) {
        progressFill.style.width = currentProgress + '%';
    }
}

// 🎮 ИГРОВАЯ ОБМАНКА ПРОГРЕССА: плавная анимация между двумя значениями
function animateProgress(fromPercent, toPercent, duration, message = '') {
    return new Promise((resolve) => {
        const startTime = Date.now();
        const difference = toPercent - fromPercent;

        function animate() {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // Используем easing function для плавности (ease-out)
            const easedProgress = 1 - Math.pow(1 - progress, 3);
            const currentPercent = fromPercent + (difference * easedProgress);

            updateProgress(currentPercent);

            if (message && progressText) {
                progressText.textContent = message;
            }

            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                updateProgress(toPercent);
                resolve();
            }
        }

        animate();
    });
}

// Modal functions
function openModal(data) {
    currentModalData = data;

    if (modal && modalImage && modalTitle && modalFilename && modalTimestamp && modalMode) {
        // Показываем изображение для всех режимов
        modalImage.src = data.overlay || data.original || '';
        modalImage.style.display = 'block';
        modalTitle.textContent = 'Просмотр: ' + data.filename;
        modalFilename.textContent = 'Файл: ' + data.filename;
        modalTimestamp.textContent = 'Время: ' + data.timestamp;
        let modalModeText;
        if (data.mode === 'parts') {
            modalModeText = 'Детали';
        } else if (data.mode === 'damage') {
            modalModeText = 'Повреждения';
        } else if (data.mode === 'full-union') {
            modalModeText = 'Полное объединение';
        } else {
            modalModeText = 'Детали';
        }
        modalMode.textContent = 'Тип: ' + modalModeText;

        modal.classList.add('show');

        // Set active button - по умолчанию включаем режим с разметкой
        const hasPolygons = data.polygons && data.polygons.length > 0;
        const defaultMode = hasPolygons ? 'overlay' : 'overlay';
        updateModalButtons(defaultMode);

        // Load polygons buttons and interactive labels if available
        if (hasPolygons) {
            console.log(`🎯 Открываем модальное окно с ${data.polygons.length} полигонами`);
            loadPolygonsList(data.polygons);

            // Create interactive labels and masks after image loads (only in interactive mode)
            modalImage.onload = function() {
                console.log('🖼️ Изображение загружено');
                // Interactive elements will be created when user switches to interactive mode
            };
        } else {
            console.log('⚠️ Полигоны не найдены в данных');
            // Clear polygons section if no polygons
            const polygonButtons = document.getElementById('polygon-buttons');
            if (polygonButtons) {
                polygonButtons.innerHTML = '<p style="text-align: center; color: var(--text-secondary); font-style: italic;">Полигоны не найдены</p>';
            }
            clearInteractiveLabels();
        }
    }
}

function closeModal() {
    if (modal) {
        modal.classList.remove('show');
        currentModalData = null;
        currentModalMode = 'original';
        // Clear interactive labels and hide controls
        clearInteractiveLabels();
        hideInteractiveElements();
        removePolygonMasksOverlay();
    }
}

function updateModalButtons(activeType) {
    if (!btnOriginal || !btnOverlay || !btnMask || !btnInteractive) return;

    console.log(`🔄 Переключаемся в режим: ${activeType}`);

    // Remove active class from all buttons
    [btnOriginal, btnOverlay, btnInteractive, btnMask].forEach(btn => {
        btn.classList.remove('active', 'interactive-active');
    });

    // Update current mode
    currentModalMode = activeType;

    // Update polygon buttons appearance based on current visibility
    updatePolygonButtonsState();

    // Add active class to current button
    switch (activeType) {
        case 'original':
            btnOriginal.classList.add('active');
            if (currentModalData && modalImage) {
                modalImage.src = currentModalData.original || '';
                hideInteractiveElements();
            }
            break;
        case 'overlay':
            btnOverlay.classList.add('active');
            if (currentModalData && modalImage) {
                // Show the pre-rendered overlay image from gallery
                modalImage.src = currentModalData.overlay || '';
                hideInteractiveElements();
            }
            break;
        case 'interactive':
            btnInteractive.classList.add('active', 'interactive-active');
            if (currentModalData && modalImage) {
                // Show original image with separate polygon masks overlaid
                modalImage.src = currentModalData.original || '';
                showInteractiveElements();

                // Force update positions after mode switch
                setTimeout(() => {
                    updateInteractiveElementsPositions();
                }, 200);
            }
            break;
        case 'mask':
            btnMask.classList.add('active');
            if (currentModalData && modalImage) {
                modalImage.src = currentModalData.mask || '';
                hideInteractiveElements();
            }
            break;
    }
}

function updatePolygonButtonsState() {
    if (!currentModalData || !currentModalData.polygons) return;

    currentModalData.polygons.forEach(polygon => {
        const button = document.querySelector(`.polygon-button[data-polygon-id="${polygon.id}"]`);
        if (button) {
            button.className = `polygon-button ${polygon.visible ? 'active' : 'inactive'}`;
        }
    });
}

function showInteractiveElements() {
    console.log('🎯 Включаем интерактивный режим');

    // Показываем секцию управления полигонами
    const polygonControls = document.querySelector('.modal-info-section:nth-child(2)');
    if (polygonControls) {
        polygonControls.style.display = 'block';
        console.log('✅ Показана секция управления полигонами');
    }

    // Создаем интерактивные лейблы и наложение масок
    if (currentModalData && currentModalData.polygons && currentModalData.polygons.length > 0) {
        console.log('🏷️ Включаем интерактивные элементы');
        console.log(`📊 Найдено ${currentModalData.polygons.length} полигонов`);

        // Очищаем старый обработчик onload, если он есть
        modalImage.onload = null;

        // Ждем загрузки изображения перед созданием элементов
        if (modalImage.complete) {
            console.log('🖼️ Изображение уже загружено, создаем интерактивные элементы');
            // Изображение уже загружено
            setTimeout(createInteractiveElements, 10); // Небольшая задержка для стабильности
        } else {
            console.log('⏳ Ждем загрузки изображения...');
            // Ждем загрузки изображения
            modalImage.onload = function() {
                console.log('🖼️ Изображение загружено, создаем интерактивные элементы');
                modalImage.onload = null; // Очищаем обработчик после выполнения
                setTimeout(createInteractiveElements, 10);
            };
        }
    } else {
        console.log('⚠️ Нет данных для создания интерактивных элементов');
        if (!currentModalData) console.log('  - currentModalData отсутствует');
        if (!currentModalData.polygons) console.log('  - currentModalData.polygons отсутствует');
        if (currentModalData.polygons && currentModalData.polygons.length === 0) console.log('  - массив полигонов пуст');
    }

    function createInteractiveElements() {
        console.log('🔄 Пересоздаем интерактивные элементы');

        // Полностью очищаем все старые элементы
        clearInteractiveLabels();
        removePolygonMasksOverlay();

        // Создаем новые лейблы
        console.log('🏷️ Создаем новые лейблы');
        createInteractiveLabels(currentModalData.polygons);

        // Создаем наложение масок
        console.log('🎭 Создаем наложение масок');
        createPolygonMasksOverlay();

        console.log('✅ Интерактивные элементы созданы');
    }

    // Also force update positions after creation
    setTimeout(() => {
        updateInteractiveElementsPositions();
    }, 100);
}

function hideInteractiveElements() {
    console.log('📱 Выключаем интерактивный режим');

    // Скрываем секцию управления полигонами
    const polygonControls = document.querySelector('.modal-info-section:nth-child(2)');
    if (polygonControls) {
        polygonControls.style.display = 'none';
        console.log('✅ Скрыта секция управления полигонами');
    }

    // Полностью очищаем интерактивные лейблы
    clearInteractiveLabels();
    console.log('✅ Очищены интерактивные лейблы');

    // Удаляем наложение масок
    removePolygonMasksOverlay();
    console.log('✅ Удалены наложения масок');
}

function showInteractiveLabels() {
    const labelsContainer = document.getElementById('interactive-labels');
    if (labelsContainer) {
        labelsContainer.style.display = 'block';
    }
}

function hideInteractiveLabels() {
    const labelsContainer = document.getElementById('interactive-labels');
    if (labelsContainer) {
        labelsContainer.style.display = 'none';
    }
}

// Create overlay masks for individual polygons
async function createPolygonMasksOverlay() {
    if (!currentModalData || !currentModalData.polygons || !modalImage) {
        console.log('⚠️ Недостаточно данных для создания масок');
        return;
    }

    console.log('🎭 Создаем наложение масок для полигонов');

    // Remove existing mask overlays
    removePolygonMasksOverlay();

    try {
        // Сначала получим список директорий с масками
        console.log('📁 Получаем список директорий с масками...');
        const response = await fetch('/api/list_tmp_dirs');
        const dirs = await response.json();

        const maskDirs = dirs.filter(dir => dir.startsWith(`masks_${currentModalData.file_id}`));
        console.log(`📁 Найденные директории с масками:`, maskDirs);

        if (maskDirs.length === 0) {
            console.log('❌ Не найдено директорий с масками для этого file_id');
            return;
        }

        // Возьмем самую свежую директорию
        const latestDir = maskDirs.sort().reverse()[0];
        console.log(`🎯 Используем директорию: ${latestDir}`);

        // Create container for polygon masks
        let masksContainer = document.getElementById('polygon-masks-overlay');
        if (!masksContainer) {
            masksContainer = document.createElement('div');
            masksContainer.id = 'polygon-masks-overlay';
            masksContainer.className = 'polygon-masks-overlay';

            // Position relative to modal image
            const modalImageContainer = modalImage.parentElement;
            modalImageContainer.style.position = 'relative';
            modalImageContainer.appendChild(masksContainer);
        }

        // Calculate image position within container for precise overlay
        const imageRect = modalImage.getBoundingClientRect();
        const containerRect = modalImage.parentElement.getBoundingClientRect();

        const imageOffsetX = imageRect.left - containerRect.left;
        const imageOffsetY = imageRect.top - containerRect.top;

        console.log(`📐 Позиция изображения: offsetX=${imageOffsetX.toFixed(1)}, offsetY=${imageOffsetY.toFixed(1)}`);
        console.log(`📐 Размеры: img=${imageRect.width.toFixed(1)}x${imageRect.height.toFixed(1)}, container=${containerRect.width.toFixed(1)}x${containerRect.height.toFixed(1)}`);

        // Position masks container to match image position
        masksContainer.style.position = 'absolute';
        masksContainer.style.left = `${imageOffsetX}px`;
        masksContainer.style.top = `${imageOffsetY}px`;
        masksContainer.style.width = `${imageRect.width}px`;
        masksContainer.style.height = `${imageRect.height}px`;

        // Create mask for each visible polygon
        const visiblePolygons = currentModalData.polygons.filter(p => p.visible !== false);

        for (const polygon of visiblePolygons) {
            const polygonId = polygon.id || `polygon_${currentModalData.polygons.indexOf(polygon)}`;

            // Create mask image element
            const maskImg = document.createElement('img');
            maskImg.className = 'polygon-mask-image';
            maskImg.dataset.polygonId = polygonId;
            maskImg.style.position = 'absolute';
            maskImg.style.top = '0';
            maskImg.style.left = '0';
            maskImg.style.width = '100%';
            maskImg.style.height = '100%';
            maskImg.style.pointerEvents = 'none';
            maskImg.style.opacity = '0.8'; // Полупрозрачность для лучшего вида
            maskImg.style.mixBlendMode = 'normal'; // Нормальный режим для прозрачных PNG
            maskImg.style.zIndex = '5';

            // Создаем URL для прозрачной маски (для интерактивного режима)
            const maskFilename = `${polygonId}_transparent.png`;
            const maskUrl = `/tmp/${latestDir}/${maskFilename}`;

            console.log(`🎨 Накладываем прозрачную маску для полигона ${polygonId}: ${maskUrl}`);
            console.log(`   Режим смешивания: normal`);
            console.log(`   Цвет полигона: ${polygon.color}`);

            console.log(`🎨 Создаем маску для ${polygonId}: ${maskUrl}`);

            // Проверяем существует ли файл по этому URL
            try {
                const headResponse = await fetch(maskUrl, { method: 'HEAD' });
                if (!headResponse.ok) {
                    console.log(`⚠️ Маска не найдена: ${maskUrl}, пропускаем`);
                    continue;
                }
            } catch (error) {
                console.log(`⚠️ Ошибка проверки маски ${maskUrl}:`, error);
                continue;
            }

            maskImg.src = maskUrl;
            maskImg.onload = () => {
                console.log(`✅ Маска загружена для полигона ${polygonId}: ${maskUrl}`);
            };
            maskImg.onerror = () => {
                console.log(`❌ Не удалось загрузить маску для полигона ${polygonId}: ${maskUrl}`);
                maskImg.remove(); // Remove failed mask
            };

            masksContainer.appendChild(maskImg);
        }

        console.log(`✅ Создано наложение масок для ${visiblePolygons.length} полигонов`);

    } catch (error) {
        console.log('❌ Ошибка при создании наложения масок:', error);
    }
}

// Remove polygon masks overlay
function removePolygonMasksOverlay() {
    const masksContainer = document.getElementById('polygon-masks-overlay');
    if (masksContainer) {
        // Останавливаем все загрузки изображений в контейнере
        const maskImages = masksContainer.querySelectorAll('img');
        maskImages.forEach(img => {
            img.src = '';
            img.onload = null;
            img.onerror = null;
        });

        masksContainer.innerHTML = '';
        // Полностью удаляем контейнер из DOM
        masksContainer.remove();
        console.log('🗑️ Полностью удален контейнер масок со всеми изображениями');
    }
}

// Update polygon masks overlay when visibility changes
function updatePolygonMasksOverlay() {
    if (currentModalMode !== 'interactive') return;

    console.log('🔄 Обновляем наложение масок');

    // Remove existing masks
    removePolygonMasksOverlay();

    // Recreate masks with updated visibility
    createPolygonMasksOverlay();
}

// Get URL for individual polygon mask
function getPolygonMaskUrl(polygonId, type = 'colored') {
    if (!currentModalData || !currentModalData.file_id) {
        console.log('❌ Нет file_id для получения URL маски');
        return null;
    }

    const maskFilename = type === 'colored' ? `${polygonId}_colored.png` : `${polygonId}_binary.png`;

    console.log(`🔍 Ищем маску: ${maskFilename} для file_id: ${currentModalData.file_id}`);

    // Пока API не ответил, вернем наиболее вероятный URL
    const now = Math.floor(Date.now() / 1000);
    const maskUrl = `/tmp/masks_${currentModalData.file_id}_${now}/${maskFilename}`;
    console.log(`🎯 Предполагаемый URL маски: ${maskUrl}`);
    return maskUrl;
}

// Model status checking functions
function startModelStatusChecking() {
    console.log('📊 Начинаем проверку статуса моделей');

    // Check status immediately
    checkModelStatus();

    // Check status every 5 seconds
    setInterval(checkModelStatus, 5000);
}

async function checkModelStatus() {
    try {
        const response = await fetch('/models/status');
        const status = await response.json();

        console.log('📊 Статус моделей:', status);

        updateModelStatusIndicators(status);
    } catch (error) {
        console.log('❌ Ошибка при проверке статуса моделей:', error);
        // Set all indicators to error state
        updateModelStatusIndicators({
            parts_models_ready: false,
            damage_models_ready: false
        });
    }
}

function updateModelStatusIndicators(status) {
    const partsStatus = document.getElementById('parts-status');
    const damageStatus = document.getElementById('damage-status');

    if (partsStatus) {
        if (status.parts_models_ready) {
            partsStatus.className = 'status-dot ready';
            console.log('✅ Модели деталей готовы');
        } else {
            partsStatus.className = 'status-dot loading';
            console.log('⏳ Модели деталей загружаются...');
        }
    }

    if (damageStatus) {
        if (status.damage_models_ready) {
            damageStatus.className = 'status-dot ready';
            console.log('✅ Модели повреждений готовы');
        } else {
            damageStatus.className = 'status-dot loading';
            console.log('⏳ Модели повреждений загружаются...');
        }
    }
}

// Polygon management functions
function loadPolygonsList(polygons) {
    const polygonButtons = document.getElementById('polygon-buttons');
    if (!polygonButtons) return;

    // Clear existing buttons
    polygonButtons.innerHTML = '';

    if (!polygons || polygons.length === 0) {
        polygonButtons.innerHTML = '<p style="text-align: center; color: var(--text-secondary); font-style: italic;">Полигоны не найдены</p>';
        return;
    }

    console.log(`🎨 Загружаем ${polygons.length} полигонов в список`);

    // Create button for each polygon
    polygons.forEach((polygon, index) => {
        const button = document.createElement('button');
        button.className = `polygon-button ${polygon.visible !== false ? 'active' : 'inactive'}`;
        button.dataset.polygonId = polygon.id;
        button.onclick = () => togglePolygonButton(polygon.id);

        // Получаем цвет полигона с костылем R/B swap
        const originalColor = polygon.color || '#2563eb'; // Синий по умолчанию
        const polygonColor = normalizePolygonColor(originalColor);

        button.innerHTML = `
            <div class="polygon-btn-color" style="background-color: ${polygonColor}" title="Цвет маски для этого класса"></div>
            <div class="polygon-btn-label" title="Класс детали автомобиля">${polygon.class || `Полигон ${index + 1}`}</div>
            <div class="polygon-btn-confidence" title="Уверенность ИИ в распознавании">${polygon.confidence ? (polygon.confidence * 100).toFixed(1) : 'N/A'}%</div>
        `;

        polygonButtons.appendChild(button);
    });

    console.log(`✅ Загружено ${polygons.length} кнопок полигонов`);
}

function hidePolygonsSection() {
    const modalInfo = document.querySelector('.modal-info');
    if (!modalInfo) return;

    const polygonsSection = modalInfo.querySelector('.polygons-section');
    if (polygonsSection) {
        polygonsSection.style.display = 'none';
    }
}

function togglePolygonButton(polygonId) {
    if (!currentModalData || !currentModalData.polygons) return;

    const polygon = currentModalData.polygons.find(p => p.id === polygonId);
    if (!polygon) return;

    // Toggle visibility
    polygon.visible = !polygon.visible;

    // Update button appearance
    const button = document.querySelector(`.polygon-button[data-polygon-id="${polygonId}"]`);
    if (button) {
        button.className = `polygon-button ${polygon.visible ? 'active' : 'inactive'}`;
    }

    // Update label appearance (labels always stay visible)
    const labelData = interactiveLabels.find(l => l.polygon.id === polygonId);
    if (labelData) {
        console.log(`🔄 [Кнопка] Обновляем лейбл ${polygonId}: visible=${polygon.visible}`);
        if (polygon.visible) {
            labelData.element.style.opacity = '0.9';
            labelData.element.style.textDecoration = 'none';
            labelData.element.classList.remove('label-disabled');
            console.log(`✅ [Кнопка] Лейбл ${polygonId} активирован`);
        } else {
            labelData.element.style.opacity = '0.4';
            labelData.element.style.textDecoration = 'line-through';
            labelData.element.classList.add('label-disabled');
            console.log(`❌ [Кнопка] Лейбл ${polygonId} деактивирован`);
        }
        // Labels always visible
        labelData.element.style.display = 'block';
    } else {
        console.log(`⚠️ [Кнопка] Лейбл ${polygonId} не найден в массиве interactiveLabels`);
    }

    // Update image if currently showing overlay or mask
    const activeButton = document.querySelector('.modal-btn.active');
    if (activeButton) {
        if (activeButton === btnOverlay) {
            updateImageWithVisiblePolygons();
        } else if (activeButton === btnMask) {
            updateMaskWithVisiblePolygons();
        }
    }

    // Update interactive labels visibility
    updateInteractiveLabelsVisibility();

    // Update polygon masks overlay
    if (currentModalMode === 'interactive') {
        updatePolygonMasksOverlay();
    }
}

// Legacy function for backward compatibility
function togglePolygonVisibility(polygonId) {
    togglePolygonButton(polygonId);
}

async function updateImageWithVisiblePolygons() {
    console.log('🖼️ updateImageWithVisiblePolygons запущена');

    if (!currentModalData || !modalImage) {
        console.log('❌ currentModalData или modalImage отсутствуют');
        return;
    }

    const visiblePolygons = currentModalData.polygons.filter(p => p.visible);

    if (visiblePolygons.length === 0) {
        // Если нет видимых полигонов, показываем оригинал
        modalImage.src = currentModalData.original || '';
        return;
    }

    try {
        if (visiblePolygons.length === 1) {
            // Если только один полигон, показываем его индивидуальную маску
            const polygon = visiblePolygons[0];
            const individualMaskUrl = await getIndividualPolygonMask(polygon.id, 'colored');
            if (individualMaskUrl) {
                console.log(`🎯 Показываем индивидуальную маску для полигона ${polygon.id}: ${individualMaskUrl}`);
                modalImage.src = individualMaskUrl;
                return;
            }
        }

        // Для нескольких полигонов используем композитное изображение
        const compositeImage = await createCompositeImage(currentModalData.original, visiblePolygons, false);
        modalImage.src = compositeImage;
    } catch (error) {
        console.error('Error updating image with visible polygons:', error);
        modalImage.src = currentModalData.overlay || '';
    }
}

async function updateMaskWithVisiblePolygons() {
    console.log('🎭 updateMaskWithVisiblePolygons запущена');

    if (!currentModalData || !modalImage) {
        console.log('❌ currentModalData или modalImage отсутствуют');
        return;
    }

    const visiblePolygons = currentModalData.polygons.filter(p => p.visible);

    if (visiblePolygons.length === 0) {
        // Если нет видимых полигонов, показываем пустую маску
        modalImage.src = '';
        return;
    }

    try {
        if (visiblePolygons.length === 1) {
            // Если только один полигон, показываем его индивидуальную бинарную маску
            const polygon = visiblePolygons[0];
            const individualMaskUrl = await getIndividualPolygonMask(polygon.id, 'binary');
            if (individualMaskUrl) {
                console.log(`🎯 Показываем индивидуальную бинарную маску для полигона ${polygon.id}: ${individualMaskUrl}`);
                modalImage.src = individualMaskUrl;
                return;
            }
        }

        // Для нескольких полигонов используем композитную маску
        const compositeMask = await createCompositeMask(visiblePolygons);
        modalImage.src = compositeMask;
    } catch (error) {
        console.error('Error updating mask with visible polygons:', error);
        modalImage.src = currentModalData.mask || '';
    }
}

async function getIndividualPolygonMask(polygonId, type = 'colored') {
    if (!currentModalData || !currentModalData.file_id) return null;

    try {
        const maskFilename = type === 'colored' ? `${polygonId}_colored.png` : `${polygonId}_binary.png`;

        // Сначала попробуем получить список директорий в tmp через API
        try {
            console.log(`🔍 Ищем маски для полигона ${polygonId}, тип: ${type}, file_id: ${currentModalData.file_id}`);

            const response = await fetch('/api/list_tmp_dirs');
            if (response.ok) {
                const dirs = await response.json();
                console.log(`📁 Найденные директории:`, dirs);

                const maskDirs = dirs.filter(dir => dir.includes(currentModalData.file_id));
                console.log(`🎯 Подходящие директории с масками:`, maskDirs);

                if (maskDirs.length > 0) {
                    // Берем самую свежую директорию (с самым большим timestamp)
                    const latestMaskDir = maskDirs.sort().reverse()[0];
                    const maskUrl = `/tmp/${latestMaskDir}/${maskFilename}`;

                    console.log(`🔗 Проверяем URL маски: ${maskUrl}`);

                    try {
                        const fileResponse = await fetch(maskUrl, { method: 'HEAD' });
                        if (fileResponse.ok) {
                            console.log(`✅ Найдена маска: ${maskUrl}`);
                            return maskUrl;
                        } else {
                            console.log(`❌ Маска не найдена по URL: ${maskUrl}, статус: ${fileResponse.status}`);
                        }
                    } catch (e) {
                        console.log(`❌ Ошибка при проверке маски: ${maskUrl}`, e);
                    }
                } else {
                    console.log(`⚠️ Не найдено подходящих директорий с масками для file_id: ${currentModalData.file_id}`);
                }
            } else {
                console.log(`❌ API для списка директорий вернул ошибку: ${response.status}`);
            }
        } catch (e) {
            console.log('API для списка директорий недоступен, используем fallback', e);
        }

        // Улучшенный fallback: ищем все возможные директории с масками
        try {
            const tmpResponse = await fetch('/tmp/', { method: 'HEAD' });
            if (tmpResponse.ok) {
                // Пробуем несколько возможных timestamp'ов
                const possibleTimestamps = [];
                const now = Math.floor(Date.now() / 1000);

                // Добавляем timestamp из текущего времени и несколько предыдущих
                for (let i = 0; i < 20; i++) {
                    possibleTimestamps.push(now - i);
                }

                // Также добавляем timestamp из имени файла, если он есть
                if (currentModalData.overlay) {
                    const overlayMatch = currentModalData.overlay.match(/overlay_([^.]+)\.jpg/);
                    if (overlayMatch) {
                        const overlayTimestamp = parseInt(overlayMatch[1].split('_').pop());
                        if (!isNaN(overlayTimestamp)) {
                            possibleTimestamps.push(overlayTimestamp);
                        }
                    }
                }

                // Убираем дубликаты и сортируем
                const uniqueTimestamps = [...new Set(possibleTimestamps)].sort((a, b) => b - a);

                for (const timestamp of uniqueTimestamps.slice(0, 10)) { // Проверяем только 10 самых свежих
            const maskUrl = `/tmp/masks_${currentModalData.file_id}_${timestamp}/${maskFilename}`;

            try {
                const response = await fetch(maskUrl, { method: 'HEAD' });
                if (response.ok) {
                            console.log(`✅ Найдена маска (fallback): ${maskUrl}`);
                    return maskUrl;
                }
            } catch (e) {
                // Продолжаем проверку других путей
            }
                }
            }
        } catch (e) {
            console.log('Fallback поиск также недоступен');
        }

        console.log(`⚠️ Маска не найдена для полигона ${polygonId}, тип: ${type}`);
        console.log('Проверенные пути:', currentModalData.file_id);
    } catch (error) {
        console.error('Error getting individual polygon mask:', error);
    }

    return null;
}

async function createCompositeImage(originalSrc, polygons, useColored = false) {
    if (!currentModalData || !polygons || polygons.length === 0) {
        return currentModalData.overlay || originalSrc;
    }

    try {
        const visiblePolygonIds = polygons
            .filter(p => p.visible)
            .map(p => p.id);

        if (visiblePolygonIds.length === 0) {
            return currentModalData.original || originalSrc;
        }

        // Используем file_id из currentModalData
        const fileId = currentModalData.file_id;
        if (!fileId) {
            console.error('No file_id available for composite image creation');
            return currentModalData.overlay || originalSrc;
        }

        const response = await fetch('/composite_image', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                file_id: fileId,
                visible_polygons: visiblePolygonIds,
                use_colored: useColored
            })
        });

        const data = await response.json();

        if (data.success && data.composite_image) {
            console.log('✅ Composite image created:', data.composite_image);
            return data.composite_image;
        } else {
            console.error('Error creating composite image:', data.error);
            return currentModalData.overlay || originalSrc;
        }
    } catch (error) {
        console.error('Error creating composite image:', error);
        return currentModalData.overlay || originalSrc;
    }
}

async function createCompositeMask(polygons) {
    if (!currentModalData || !polygons || polygons.length === 0) {
        return currentModalData.mask || '';
    }

    try {
        const visiblePolygonIds = polygons
            .filter(p => p.visible)
            .map(p => p.id);

        if (visiblePolygonIds.length === 0) {
            return '';
        }

        // Используем file_id из currentModalData
        const fileId = currentModalData.file_id;
        if (!fileId) {
            console.error('No file_id available for composite mask creation');
            return currentModalData.mask || '';
        }

        const response = await fetch('/composite_mask', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                file_id: fileId,
                visible_polygons: visiblePolygonIds
            })
        });

        const data = await response.json();

        if (data.success && data.composite_mask) {
            console.log('✅ Composite mask created:', data.composite_mask);
            return data.composite_mask;
        } else {
            console.error('Error creating composite mask:', data.error);
            return currentModalData.mask || '';
        }
    } catch (error) {
        console.error('Error creating composite mask:', error);
        return currentModalData.mask || '';
    }
}

// Global variables for interactive elements
let currentImageScale = 1;
let originalImageRect = null;
let originalLabelPositions = new Map(); // Store original positions for each label

// Function to update interactive elements when image/window size changes
function updateInteractiveElementsPositions() {
    if (!modalImage || !currentModalData || !currentModalData.polygons) {
        console.log('⚠️ Невозможно обновить позиции: отсутствуют необходимые данные');
        return;
    }

    console.log('🔄 Обновление позиций интерактивных элементов при изменении размера');

    // Пересоздаем лейблы с новыми позициями вместо попытки масштабировать старые
    clearInteractiveLabels();
    createInteractiveLabels(currentModalData.polygons);

    // Обновляем наложение масок
    if (currentModalMode === 'interactive') {
        createPolygonMasksOverlay();
    }

    console.log('✅ Позиции интерактивных элементов обновлены');
}

// Function to convert color formats for labels with R/B swap hack
function normalizePolygonColor(color) {
    let r, g, b;

    if (typeof color === 'string') {
        // If it's hex color (e.g., #6675ff)
        if (color.startsWith('#')) {
            // Convert hex to RGB
            const hex = color.slice(1);
            r = parseInt(hex.slice(0, 2), 16);
            g = parseInt(hex.slice(2, 4), 16);
            b = parseInt(hex.slice(4, 6), 16);
        } else {
            // If it's already CSS color string
            return color;
        }
    } else if (Array.isArray(color) && color.length >= 3) {
        // If it's RGB/BGR array
        [r, g, b] = color;
    } else {
        // Default fallback
        console.log('⚠️ Неизвестный формат цвета, использую дефолтный');
        return '#2563eb'; // Default blue
    }

    // КОСТЫЛЬ: Меняем местами красный и синий каналы
    // [R, G, B] -> [B, G, R]
    const swappedR = b;
    const swappedB = r;

    console.log(`🔄 КОСТЫЛЬ: ${color} -> R:${r} G:${g} B:${b} -> R:${swappedR} G:${g} B:${swappedB}`);

    return `rgb(${swappedR}, ${g}, ${swappedB})`;
}

// Interactive Labels Functions
function createInteractiveLabels(polygons) {
    if (!modalImage || !polygons || polygons.length === 0) {
        console.log('⚠️ Недостаточно данных для создания лейблов');
        return;
    }

    console.log(`🏷️ Создаем интерактивные лейблы для ${polygons.length} полигонов`);

    // Clear existing labels
    clearInteractiveLabels();

    // Create container for labels
    let labelsContainer = document.getElementById('interactive-labels');
    if (!labelsContainer) {
        labelsContainer = document.createElement('div');
        labelsContainer.id = 'interactive-labels';
        labelsContainer.className = 'interactive-labels-container';

        // Position relative to modal image container
        const modalImageContainer = modalImage.closest('.modal-image-container');
        modalImageContainer.style.position = 'relative';
        modalImageContainer.appendChild(labelsContainer);

        console.log('🏷️ Создан контейнер лейблов');
    }

    // Ждем полной загрузки изображения перед расчетом координат
    if (!modalImage.complete) {
        console.log('⏳ Ждем загрузки изображения для корректного позиционирования лейблов...');
        // Очищаем старый обработчик и устанавливаем новый
        modalImage.onload = null;
        modalImage.onload = () => {
            modalImage.onload = null; // Очищаем после выполнения
            createLabelsAfterImageLoad(polygons, labelsContainer);
        };
        return;
    }

    createLabelsAfterImageLoad(polygons, labelsContainer);
}

function createLabelsAfterImageLoad(polygons, labelsContainer) {
    // Проверяем, что изображение доступно
    if (!modalImage || !modalImage.complete) {
        console.log('⚠️ Изображение не загружено, пропускаем создание лейблов');
        return;
    }

    // Save original image rect for scaling calculations
    originalImageRect = modalImage.getBoundingClientRect();
    currentImageScale = 1;

    console.log(`📐 Сохранены оригинальные размеры: ${originalImageRect.width.toFixed(1)}x${originalImageRect.height.toFixed(1)}`);

    // Calculate positions for labels (using same logic as backend)
    const occupiedAreas = [];
    const imageRect = modalImage.getBoundingClientRect();
    const containerRect = labelsContainer.getBoundingClientRect();

    console.log(`📐 Размеры изображения: ${modalImage.naturalWidth}x${modalImage.naturalHeight}`);
    console.log(`📐 Размеры отображения: ${imageRect.width}x${imageRect.height}`);

    // Функция для расчета позиции лейбла
    function calculateLabelPosition(centerX, centerY) {
        // Простое масштабирование координат
        const scaleX = imageRect.width / modalImage.naturalWidth;
        const scaleY = imageRect.height / modalImage.naturalHeight;

        let screenX = centerX * scaleX;
        let screenY = centerY * scaleY;

        console.log(`   Scale: ${scaleX.toFixed(3)}x${scaleY.toFixed(3)}`);
        console.log(`   Raw screen pos: (${screenX.toFixed(1)}, ${screenY.toFixed(1)})`);

        // Учитываем позицию изображения относительно модального окна
        const modalRect = modalImage.closest('.modal-image-container').getBoundingClientRect();

        // Позиция лейбла относительно модального контейнера
        const relativeX = screenX + (imageRect.left - modalRect.left);
        const relativeY = screenY + (imageRect.top - modalRect.top);

        console.log(`   Image rect: left=${imageRect.left.toFixed(1)}, top=${imageRect.top.toFixed(1)}, width=${imageRect.width.toFixed(1)}, height=${imageRect.height.toFixed(1)}`);
        console.log(`   Modal rect: left=${modalRect.left.toFixed(1)}, top=${modalRect.top.toFixed(1)}, width=${modalRect.width.toFixed(1)}, height=${modalRect.height.toFixed(1)}`);
        console.log(`   Image offset: left=${(imageRect.left - modalRect.left).toFixed(1)}, top=${(imageRect.top - modalRect.top).toFixed(1)}`);
        console.log(`   Final label pos: (${relativeX.toFixed(1)}, ${relativeY.toFixed(1)})`);

        return { x: relativeX, y: relativeY };
    }

    polygons.forEach((polygon, index) => {
        // Создаем лейблы для всех полигонов, но с соответствующим стилем для скрытых
        const polygonIsVisible = polygon.visible !== false; // По умолчанию true, если не указано иное
        console.log(`🏷️ Создаем лейбл для полигона ${polygon.id} (visible: ${polygonIsVisible})`);

        // Рассчитываем центр полигона
        let centerX, centerY;

        // Сначала пытаемся использовать реальные координаты полигона (точки)
        if (polygon.points && polygon.points.length > 0) {
            console.log(`🎯 Используем реальные координаты полигона для ${polygon.id}`);

            // Рассчитываем геометрический центр полигона
            let sumX = 0;
            let sumY = 0;
            const numPoints = polygon.points.length;

            polygon.points.forEach(point => {
                sumX += point.x;
                sumY += point.y;
            });

            centerX = sumX / numPoints;
            centerY = sumY / numPoints;

            console.log(`📍 Геометрический центр полигона: (${centerX.toFixed(1)}, ${centerY.toFixed(1)}) из ${numPoints} точек`);
        } else {
            // Fallback: используем центр bbox
            console.log(`📦 Используем центр bbox для полигона ${polygon.id} (точки недоступны)`);

        const bbox = polygon.bbox || [0, 0, 0, 0];
            if (bbox.length < 4) {
                console.log(`⚠️ Недостаточно данных bbox для полигона ${polygon.id}`);
                return;
            }

            let x1, y1, x2, y2;

            // Проверяем формат bbox
            if (bbox.length === 4) {
                const [a, b, c, d] = bbox;

                // Если третье и четвертое значения больше первых двух - это формат [x1,y1,x2,y2]
                // Иначе это формат Roboflow [x,y,width,height]
                if (c > a && d > b) {
                    // Формат [x1, y1, x2, y2]
                    [x1, y1, x2, y2] = bbox;
                    console.log(`📐 Bbox формат: [x1,y1,x2,y2] = [${x1},${y1},${x2},${y2}]`);
                } else {
                    // Формат Roboflow [x, y, width, height]
                    x1 = a;
                    y1 = b;
                    x2 = a + c;
                    y2 = b + d;
                    console.log(`📐 Bbox формат: [x,y,width,height] = [${a},${b},${c},${d}] -> [${x1},${y1},${x2},${y2}]`);
                }
            } else {
                console.error(`❌ Неправильный формат bbox для полигона ${polygon.id}: ${bbox}`);
                return;
            }

            centerX = (x1 + x2) / 2;
            centerY = (y1 + y2) / 2;
            console.log(`📍 Центр bbox: (${centerX.toFixed(1)}, ${centerY.toFixed(1)})`);
        }

        console.log(`📍 Полигон ${polygon.id}:`);
        console.log(`   Center: (${centerX.toFixed(1)}, ${centerY.toFixed(1)})`);

        // Рассчитываем финальную позицию лейбла
        const position = calculateLabelPosition(centerX, centerY);
        const adjustedScreenX = position.x;
        const adjustedScreenY = position.y;

        // Create label element
        const labelElement = document.createElement('div');
        labelElement.className = `interactive-label ${polygonIsVisible ? '' : 'label-disabled'}`;
        labelElement.dataset.polygonId = polygon.id;

        console.log(`🏷️ Создан лейбл для полигона ${polygon.id} на позиции (${adjustedScreenX.toFixed(1)}, ${adjustedScreenY.toFixed(1)})`);

        // Получаем цвет полигона для лейбла
        console.log(`🎨 Оригинальный цвет полигона ${polygon.id}:`, polygon.color, typeof polygon.color);

        let polygonColor = normalizePolygonColor(polygon.color);
        console.log(`🎨 Конвертирован для CSS с костылем R/B swap: ${polygonColor}`);

        if (!polygonColor || polygonColor === '#2563eb') {
            console.log('⚠️ Цвет не определен, генерируем новый');
            // Генерируем цвет на основе имени класса если цвет не задан
            const hash = polygon.class ? polygon.class.split('').reduce((a, b) => {
                a = ((a << 5) - a) + b.charCodeAt(0);
                return a & a;
            }, 0) : index * 12345;

            const hue = Math.abs(hash) % 360;
            polygonColor = `hsl(${hue}, 70%, 50%)`;
            console.log(`🎨 Сгенерирован новый цвет: ${polygonColor}`);
        }

        labelElement.style.backgroundColor = polygonColor;
        labelElement.style.borderColor = polygonColor;
        console.log(`🎨 Установлен цвет лейбла ${polygon.id} с костылем R/B swap: ${polygonColor}`);
        labelElement.style.left = `${adjustedScreenX}px`;
        labelElement.style.top = `${adjustedScreenY}px`;

        // Устанавливаем начальную прозрачность в зависимости от видимости
        labelElement.style.opacity = polygonIsVisible ? '0.9' : '0.4';
        labelElement.style.textDecoration = polygonIsVisible ? 'none' : 'line-through';

        const className = polygon.class || `Полигон ${index + 1}`;
        const confidence = polygon.confidence ? (polygon.confidence * 100).toFixed(1) : 'N/A';

        labelElement.innerHTML = `
            <div class="label-text">${className}</div>
            <div class="label-confidence">${confidence}%</div>
        `;

        // Make draggable
        makeLabelDraggable(labelElement);

        labelsContainer.appendChild(labelElement);
        interactiveLabels.push({
            element: labelElement,
            polygon: polygon,
            originalPosition: { x: adjustedScreenX, y: adjustedScreenY }
        });

        // Note: We don't save original positions anymore since we recreate labels on resize

        console.log(`✅ Создан лейбл для полигона ${polygon.id}: ${className}`);
        console.log(`   Позиция: left=${adjustedScreenX.toFixed(1)}px, top=${adjustedScreenY.toFixed(1)}px`);
        console.log(`   Цвет: ${polygonColor}`);

        // Debug: check if position is within visible area
        const modalRect = modalImage.closest('.modal-image-container').getBoundingClientRect();
        const isVisible = adjustedScreenX >= 0 && adjustedScreenX <= modalRect.width &&
                         adjustedScreenY >= 0 && adjustedScreenY <= modalRect.height;

        if (!polygonIsVisible) {
            console.log(`⚠️ Лейбл ${polygon.id} находится за пределами видимой области!`);
            console.log(`   Modal size: ${modalRect.width.toFixed(1)}x${modalRect.height.toFixed(1)}`);
            console.log(`   Label pos: ${adjustedScreenX.toFixed(1)}, ${adjustedScreenY.toFixed(1)}`);
        }
    });

    console.log(`✅ Создано ${interactiveLabels.length} интерактивных лейблов`);

    // Обновляем видимость лейблов в соответствии с текущим состоянием полигонов
    updateInteractiveLabelsVisibility();
}

function makeLabelDraggable(labelElement) {
    let isDragging = false;
    let startX, startY, initialX, initialY;
    let hasMoved = false; // Флаг для определения, было ли значительное движение

    // Добавляем обработчик клика для переключения видимости
    // Click handler for desktop (touch devices use touchend)
    labelElement.addEventListener('click', function(e) {
        // Skip click on touch devices - they use touchend instead
        if ('ontouchstart' in window) {
            return;
        }

        console.log(`🖱️ Клик по лейблу: ${labelElement.dataset.polygonId}, hasMoved=${hasMoved}`);

        // Не обрабатываем клик если было значительное перетаскивание
        if (hasMoved) {
            console.log('🚫 Клик отменен из-за перетаскивания');
            e.preventDefault();
            hasMoved = false; // Сбрасываем флаг для следующего клика
            return;
        }

        const polygonId = labelElement.dataset.polygonId;
        if (polygonId) {
            console.log(`🔄 Вызываем togglePolygonByLabel для ${polygonId}`);
            togglePolygonByLabel(polygonId);
        } else {
            console.log('⚠️ polygonId не найден в dataset лейбла');
        }
    });

    labelElement.addEventListener('mousedown', function(e) {
        e.preventDefault();
        e.stopPropagation(); // Предотвращаем всплытие

        isDragging = false;
        hasMoved = false; // Сбрасываем флаг движения
        isDraggingLabel = true;
        draggedLabel = labelElement;

        const rect = labelElement.getBoundingClientRect();
        startX = e.clientX; // Запоминаем начальную позицию курсора
        startY = e.clientY;
        dragOffset.x = e.clientX - rect.left;
        dragOffset.y = e.clientY - rect.top;

        initialX = rect.left;
        initialY = rect.top;

        document.addEventListener('mousemove', dragLabel);
        document.addEventListener('mouseup', stopDragging);

        // Add dragging class for visual feedback
        labelElement.classList.add('dragging');
    });

    function dragLabel(e) {
        if (!isDraggingLabel || !draggedLabel) return;

        // Проверяем, было ли значительное движение (более 5 пикселей)
        const deltaX = Math.abs(e.clientX - startX);
        const deltaY = Math.abs(e.clientY - startY);

        if (deltaX > 5 || deltaY > 5) {
            hasMoved = true; // Было значительное движение
        isDragging = true; // Помечаем, что было перетаскивание
        }

        if (hasMoved) {
            // Получаем позицию модального контейнера
            const modalRect = modalImage.closest('.modal-image-container').getBoundingClientRect();

            // Рассчитываем позицию относительно модального контейнера
            const newX = e.clientX - modalRect.left - dragOffset.x;
            const newY = e.clientY - modalRect.top - dragOffset.y;

            // Ограничиваем лейбл в пределах модального окна
            const maxX = modalRect.width - draggedLabel.offsetWidth;
            const maxY = modalRect.height - draggedLabel.offsetHeight;

            const clampedX = Math.max(0, Math.min(newX, maxX));
            const clampedY = Math.max(0, Math.min(newY, maxY));

            draggedLabel.style.left = `${clampedX}px`;
            draggedLabel.style.top = `${clampedY}px`;
        }
    }

    function stopDragging() {
        if (draggedLabel) {
            draggedLabel.classList.remove('dragging');
        }
        isDraggingLabel = false;
        draggedLabel = null;
        document.removeEventListener('mousemove', dragLabel);
        document.removeEventListener('mouseup', stopDragging);

        // Сбрасываем флаг через небольшой таймаут
        setTimeout(() => {
            isDragging = false;
        }, 10);
    }

    // Touch event handlers for mobile devices
    labelElement.addEventListener('touchstart', function(e) {
        // Don't prevent default here to allow click events
        e.stopPropagation();

        if (e.touches.length !== 1) return; // Only handle single touch

        isDragging = false;
        hasMoved = false;
        isDraggingLabel = true;
        draggedLabel = labelElement;

        const rect = labelElement.getBoundingClientRect();
        const touch = e.touches[0];
        startX = touch.clientX;
        startY = touch.clientY;
        dragOffset.x = touch.clientX - rect.left;
        dragOffset.y = touch.clientY - rect.top;

        initialX = rect.left;
        initialY = rect.top;

        document.addEventListener('touchmove', dragLabelTouch, { passive: false });
        document.addEventListener('touchend', stopDraggingTouch);

        // Add dragging class for visual feedback
        labelElement.classList.add('dragging');
    });

    function dragLabelTouch(e) {
        if (!isDraggingLabel || !draggedLabel || e.touches.length !== 1) return;

        // Only prevent default if we're actually dragging
        const touch = e.touches[0];
        const deltaX = Math.abs(touch.clientX - startX);
        const deltaY = Math.abs(touch.clientY - startY);

        if (deltaX > 5 || deltaY > 5) {
            e.preventDefault(); // Only prevent when dragging
            hasMoved = true;
            isDragging = true;
        }

        if (hasMoved) {
            // Получаем позицию модального контейнера
            const modalRect = modalImage.closest('.modal-image-container').getBoundingClientRect();

            // Рассчитываем позицию относительно модального контейнера
            const newX = touch.clientX - modalRect.left - dragOffset.x;
            const newY = touch.clientY - modalRect.top - dragOffset.y;

            // Ограничиваем лейбл в пределах модального окна
            const maxX = modalRect.width - draggedLabel.offsetWidth;
            const maxY = modalRect.height - draggedLabel.offsetHeight;

            const clampedX = Math.max(0, Math.min(newX, maxX));
            const clampedY = Math.max(0, Math.min(newY, maxY));

            draggedLabel.style.left = `${clampedX}px`;
            draggedLabel.style.top = `${clampedY}px`;
        }
    }

    function stopDraggingTouch(e) {
        if (draggedLabel) {
            draggedLabel.classList.remove('dragging');
        }

        // If we didn't move much, treat it as a click
        if (!hasMoved && draggedLabel) {
            const polygonId = draggedLabel.dataset.polygonId;
            if (polygonId) {
                console.log(`👆 Touch click на лейбле: ${polygonId}`);
                togglePolygonByLabel(polygonId);
            }
        }

        isDraggingLabel = false;
        draggedLabel = null;
        document.removeEventListener('touchmove', dragLabelTouch);
        document.removeEventListener('touchend', stopDraggingTouch);

        // Сбрасываем флаг через небольшой таймаут
        setTimeout(() => {
            isDragging = false;
            hasMoved = false;
        }, 10);
    }
}

function clearInteractiveLabels() {
    console.log('🗑️ Полностью очищаем интерактивные лейблы');

    const labelsContainer = document.getElementById('interactive-labels');
    if (labelsContainer) {
        // Останавливаем все обработчики событий на лейблах перед удалением
        const labels = labelsContainer.querySelectorAll('.interactive-label');
        labels.forEach(label => {
            // Удаляем все обработчики событий (mouse и touch)
            label.onclick = null;
            label.onmousedown = null;
            label.onmouseup = null;
            label.onmousemove = null;
            label.ontouchstart = null;
            label.ontouchmove = null;
            label.ontouchend = null;
        });

        labelsContainer.innerHTML = '';
        console.log('✅ Очищен контейнер лейблов');
    }

    // Очищаем глобальные переменные
    interactiveLabels = [];
    originalLabelPositions.clear();

    // Сбрасываем переменные перетаскивания
    isDraggingLabel = false;
    draggedLabel = null;

    console.log('✅ Очищены массивы лейблов и позиции');
}

function updateInteractiveLabelsVisibility() {
    if (!currentModalData || !currentModalData.polygons) return;

    interactiveLabels.forEach(labelData => {
        const polygon = currentModalData.polygons.find(p => p.id === labelData.polygon.id);
        if (polygon) {
            if (polygon.visible) {
                labelData.element.style.opacity = '0.9';
                labelData.element.style.textDecoration = 'none';
                labelData.element.classList.remove('label-disabled');
            } else {
                labelData.element.style.opacity = '0.4';
                labelData.element.style.textDecoration = 'line-through';
                labelData.element.classList.add('label-disabled');
            }
            // Лейблы всегда видимы
            labelData.element.style.display = 'block';
        }
    });
}

function togglePolygonByLabel(polygonId) {
    console.log(`🎯 togglePolygonByLabel вызвана для ${polygonId}`);

    if (!currentModalData || !currentModalData.polygons) {
        console.log('❌ currentModalData или polygons отсутствуют');
        return;
    }

    const polygon = currentModalData.polygons.find(p => p.id === polygonId);
    if (!polygon) {
        console.log(`❌ Полигон ${polygonId} не найден`);
        return;
    }

    console.log(`📊 Найден полигон ${polygonId}, текущая видимость: ${polygon.visible}`);

    // Переключаем видимость
    polygon.visible = !polygon.visible;

    // Обновляем кнопку полигона
    const button = document.querySelector(`.polygon-button[data-polygon-id="${polygonId}"]`);
    if (button) {
        button.className = `polygon-button ${polygon.visible ? 'active' : 'inactive'}`;
    }

    // Лейблы всегда остаются видимыми - только меняем их внешний вид
    const labelData = interactiveLabels.find(l => l.polygon.id === polygonId);
    if (labelData) {
        console.log(`🔄 Обновляем лейбл ${polygonId}: visible=${polygon.visible}`);
        if (polygon.visible) {
            labelData.element.style.opacity = '0.9';
            labelData.element.style.textDecoration = 'none';
            labelData.element.classList.remove('label-disabled');
            console.log(`✅ Лейбл ${polygonId} активирован`);
        } else {
            labelData.element.style.opacity = '0.4';
            labelData.element.style.textDecoration = 'line-through';
            labelData.element.classList.add('label-disabled');
            console.log(`❌ Лейбл ${polygonId} деактивирован`);
        }
        // Лейблы всегда видимы
            labelData.element.style.display = 'block';
        } else {
        console.log(`⚠️ Лейбл ${polygonId} не найден в массиве interactiveLabels`);
    }

    // Обновляем изображение если нужно
    const activeButton = document.querySelector('.modal-btn.active');
    console.log(`🔄 Активная кнопка: ${activeButton ? activeButton.className : 'не найдена'}`);

    if (activeButton) {
        if (activeButton === btnOverlay) {
            console.log('🖼️ Обновляем изображение с overlay');
            updateImageWithVisiblePolygons();
        } else if (activeButton === btnMask) {
            console.log('🎭 Обновляем маску');
            updateMaskWithVisiblePolygons();
        } else {
            console.log('ℹ️ Активная кнопка не требует обновления изображения');
        }
    } else {
        console.log('⚠️ Активная кнопка не найдена');
    }

    // Update interactive labels visibility
    updateInteractiveLabelsVisibility();

    // Update polygon masks overlay (only in interactive mode)
    if (currentModalMode === 'interactive') {
        updatePolygonMasksOverlay();
    }
}

function resetInteractiveLabelsPositions() {
    if (!currentModalData || !currentModalData.polygons) {
        console.log('⚠️ Нет данных для сброса позиций лейблов');
        return;
    }

    console.log('🔄 Сбрасываем позиции лейблов и видимость полигонов...');
    console.log(`📊 Текущее количество лейблов в массиве: ${interactiveLabels.length}`);
    console.log(`🎯 Текущий режим модального окна: ${currentModalMode}`);

    // Если лейблы не созданы, но мы в интерактивном режиме, создадим их
    if (interactiveLabels.length === 0 && currentModalMode === 'interactive') {
        console.log('🔄 Лейблы не найдены, но мы в интерактивном режиме. Пересоздаем лейблы...');

        // Очищаем старые элементы
        clearInteractiveLabels();
        removePolygonMasksOverlay();

        // Создаем новые лейблы
        if (currentModalData.polygons && currentModalData.polygons.length > 0) {
            console.log('🏷️ Создаем новые лейблы');
            createInteractiveLabels(currentModalData.polygons);

            console.log('🎭 Создаем наложение масок');
            createPolygonMasksOverlay();

            console.log('✅ Лейблы пересозданы');
        } else {
            console.log('⚠️ Нет полигонов для создания лейблов');
            return;
        }
    }

    if (interactiveLabels.length === 0) {
        console.log('⚠️ Массив interactiveLabels все еще пуст после попытки пересоздания.');
        console.log('💡 Убедитесь, что вы находитесь в режиме "Интерактивные полигоны"');
        return;
    }

    // Сбрасываем видимость всех полигонов (делаем все видимыми)
    console.log('👁️ Сбрасываем видимость полигонов...');
    currentModalData.polygons.forEach(polygon => {
        if (polygon.visible === false) {
            polygon.visible = true;
            console.log(`👁️ Полигон ${polygon.id} сделан видимым`);
        }
    });

    // Обновляем кнопки полигонов
    currentModalData.polygons.forEach(polygon => {
        const button = document.querySelector(`.polygon-button[data-polygon-id="${polygon.id}"]`);
        if (button) {
            button.className = `polygon-button ${polygon.visible ? 'active' : 'inactive'}`;
            console.log(`🔄 Кнопка полигона ${polygon.id} обновлена: ${polygon.visible ? 'активна' : 'неактивна'}`);
        }
    });

    // Сбрасываем позиции существующих лейблов к их оригинальным позициям
    interactiveLabels.forEach(labelData => {
        const { element, originalPosition, polygon } = labelData;
        if (element && originalPosition) {
            element.style.left = `${originalPosition.x}px`;
            element.style.top = `${originalPosition.y}px`;

            // Сбрасываем стиль лейбла (убираем disabled состояние)
            element.style.opacity = '0.9';
            element.style.textDecoration = 'none';
            element.classList.remove('label-disabled');

            console.log(`🔄 Сброшена позиция лейбла ${element.dataset.polygonId}: (${originalPosition.x.toFixed(1)}, ${originalPosition.y.toFixed(1)})`);
        } else {
            console.log(`⚠️ Проблема с лейблом: element=${!!element}, originalPosition=${!!originalPosition}`);
        }
    });

    // Обновляем изображение с новыми настройками видимости
    updateImageWithVisiblePolygons();

    console.log('✅ Позиции лейблов и видимость полигонов сброшены');
}

// Export functions
function exportSingleToExcel(fileId) {
    console.log(`📊 Экспорт одного файла: ${fileId}`);

    // Прямое скачивание через создание ссылки
    const url = `/export/excel/${fileId}`;
    const link = document.createElement('a');
    link.href = url;
    link.download = `damage_report_${fileId}_${Date.now()}.xlsx`;
    link.style.display = 'none';

    // Добавляем в DOM и кликаем
    document.body.appendChild(link);
    link.click();

    // Убираем из DOM
    document.body.removeChild(link);

    console.log(`✅ Запрос на скачивание файла ${fileId} отправлен`);
}

function exportAllToExcel() {
    console.log('📊 Экспорт всех результатов');
    const url = '/export/excel/all';

    // Показываем индикатор загрузки
    const loadingText = document.createElement('div');
    loadingText.innerHTML = '⏳ Создание отчета...';
    loadingText.style.cssText = 'position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: rgba(0,0,0,0.8); color: white; padding: 20px; border-radius: 10px; z-index: 10000;';
    document.body.appendChild(loadingText);

    // Используем fetch для правильного скачивания файла
    fetch(url)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.blob();
        })
        .then(blob => {
            // Создаем URL для blob
            const blobUrl = window.URL.createObjectURL(blob);

            // Создаем временную ссылку для скачивания
            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = `all_reports_${Date.now()}.xlsx`;
            document.body.appendChild(link);
            link.click();

            // Очищаем URL и ссылку
            window.URL.revokeObjectURL(blobUrl);
            document.body.removeChild(link);

            console.log('✅ Файл успешно скачан');
        })
        .catch(error => {
            console.error('❌ Ошибка экспорта:', error);

            // Пытаемся получить текст ошибки из ответа
            if (error.message.includes('HTTP error!')) {
                // Показываем ошибку от сервера
                fetch(url)
                    .then(response => response.text())
                    .then(errorText => {
                        try {
                            const errorData = JSON.parse(errorText);
                            alert(`Ошибка: ${errorData.error || 'Неизвестная ошибка'}`);
                        } catch {
                            alert('Ошибка при создании отчета. Попробуйте еще раз.');
                        }
                    })
                    .catch(() => {
                        alert('Ошибка при создании отчета. Попробуйте еще раз.');
                    });
            } else {
                alert('Ошибка при создании отчета. Попробуйте еще раз.');
            }
        })
        .finally(() => {
            // Убираем индикатор загрузки
            setTimeout(() => {
                if (document.body.contains(loadingText)) {
                    document.body.removeChild(loadingText);
                }
            }, 2000);
        });
}

// Add event listener for export all button when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    const exportAllBtn = document.getElementById('export-excel');
    if (exportAllBtn) {
        exportAllBtn.addEventListener('click', exportAllToExcel);
    }
});

