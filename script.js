// Константы и конфигурация
const CONSTANTS = {
    MAX_ARROW_HOURS: 18,
    MIN_ARROW_HOURS: 1,
    TOTAL_COLUMNS: 18,
    START_HOUR: 7,
    CELL_WIDTH: 60,
    ARROW_HEIGHT: 22,
    TABLE_WIDTH: '100% '
};

// Доступные цвета
const AVAILABLE_COLORS = [
    { name: 'Зеленый', value: '#E9FFEA' },
    { name: 'Синий', value: '#DAE6F4' },
    { name: 'Желтый', value: '#FFFECE' },
    { name: 'Красный', value: '#FDCDC9' },
    { name: 'Фиолетовый', value: '#DEE7F6' }
];
// Функция для расчета актуальной ширины ячейки
function calculateCellWidth() {
    const table = document.getElementById('airports-table');
    if (!table) return 60; // Значение по умолчанию
    
    const tableWidth = table.clientWidth;
    const airportColumnWidth = table.querySelector('.airport-column')?.offsetWidth || 150;
    const actionsColumnWidth = table.querySelector('.actions-column')?.offsetWidth || 100;
    
    // Вычисляем доступную ширину для ячеек с временем
    const availableWidth = tableWidth - airportColumnWidth - actionsColumnWidth;
    
    // Делим на количество колонок времени
    return availableWidth / CONSTANTS.TOTAL_COLUMNS;
}

// Функция для получения данных условия из wrapper
function getWrapperCondition(wrapper) {
    const left = parseInt(wrapper.style.left);
    const width = parseInt(wrapper.style.width);
    const cellWidth = CONSTANTS.CELL_WIDTH;
    
    const arrow = wrapper.querySelector('.arrow');
    if (!arrow) return null;
    
    const textContent = arrow.querySelector('.text-content');
    const redText = arrow.querySelector('.red-text');
    
    return {
        mainText: textContent ? textContent.childNodes[0].textContent.trim() : '',
        redText: redText ? redText.textContent.trim() : '',
        afterText: redText && redText.nextSibling ? redText.nextSibling.textContent.trim() : '',
        arrowHours: width / cellWidth + (2 / cellWidth), // Компенсация отступов
        arrowColor: window.getComputedStyle(arrow).backgroundColor,
        startPosition: left / cellWidth - (1 / cellWidth) // Компенсация отступов
    };
}
// Предопределенные условия
const predefinedConditions = [
    { condition: '600х6', arrowHours: 1, arrowColor: '#E9FFEA' },
    { condition: '300х3', arrowHours: 1, arrowColor: '#DAE6F4' },
    { condition: '200х2', arrowHours: 1, arrowColor: '#FFFECE' },
    { condition: '50х0.6', arrowHours: 1, arrowColor: '#FDCDC9' },
    { condition: 'минус', arrowHours: 1, arrowColor: '#DEE7F6' }
];

// Сервис уведомлений
class NotificationService {
    static #showNotification(message, type) {
        const existingNotifications = document.querySelectorAll('.notification');
        existingNotifications.forEach(notification => notification.remove());

        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        document.body.appendChild(notification);

        setTimeout(() => notification.remove(), 3000);
    }

    static success(message) {
        this.#showNotification(message, 'success');
    }

    static error(message) {
        this.#showNotification(message, 'error');
    }
}

class FileExporter {
	static async exportTableAsPNG() {
		try {
			const table = document.getElementById('airports-table');
			
			// Подготовка к экспорту (скрываем столбец с действиями)
			const actionCells = this.prepareTableForExport(table);
			
			// Экспорт как PNG
			const canvas = await html2canvas(table, {
				scale: 4,
				backgroundColor: '#FFFFFF',
				logging: false
			});
			
			// Создаем и скачиваем файл
			const link = document.createElement('a');
			link.download = `airports-day-${new Date().toISOString().slice(0,10)}.png`;
			link.href = canvas.toDataURL('image/png', 1.0);
			link.click();
			
			// Возвращаем видимость столбца действий
			this.restoreTableAfterExport(actionCells);
			
			NotificationService.success('Изображение сохранено');
		} catch (error) {
			console.error('Export error:', error);
			NotificationService.error('Ошибка при экспорте в PNG');
			
			// В случае ошибки также возвращаем видимость
			const actionCells = document.querySelectorAll('.actions-column, td:last-child');
			actionCells.forEach(cell => cell.style.display = '');
		}
	}
	
	static async exportTableAsPDF() {
		try {
			// 1. Get the original table
			const table = document.getElementById('airports-table');
			if (!table) {
				throw new Error('Table not found');
			}

			// 2. Hide action column
			const actionCells = this.prepareTableForExport(table);

			// 3. Create a temporary container with white background
			const container = document.createElement('div');
			container.style.cssText = `
				position: fixed;
				left: 0;
				top: 0;
				width: ${table.offsetWidth}px;
				height: ${table.offsetHeight}px;
				background: white;
				padding: 20px;
				z-index: -9999;
			`;
			document.body.appendChild(container);

			// 4. Clone the table
			const clonedTable = table.cloneNode(true);
			container.appendChild(clonedTable);

			// 5. Process the arrow heads
			clonedTable.querySelectorAll('.arrow').forEach(arrow => {
				const computed = window.getComputedStyle(arrow);
				const color = computed.backgroundColor;
				const arrowHead = arrow.querySelector('.arrow-head');
				if (arrowHead) {
					arrowHead.innerHTML = `
						<svg width="14" height="22" viewBox="0 0 14 22">
							<path d="M0 0 L14 11 L0 22 Z" fill="${color}" stroke="black"/>
						</svg>
					`;
				}
			});

			// 6. Wait for rendering
			await new Promise(resolve => setTimeout(resolve, 500));

			// 7. Create canvas with specific settings
			const canvas = await html2canvas(clonedTable, {
				scale: 2,
				useCORS: true,
				allowTaint: true,
				backgroundColor: '#ffffff',
				imageTimeout: 0,
				logging: true,
				removeContainer: false,
				onclone: () => {
					return new Promise(resolve => setTimeout(resolve, 500));
				}
			});

			if (!canvas) {
				throw new Error('Canvas creation failed');
			}

			console.log('Canvas created:', canvas.width, 'x', canvas.height);

			// 8. Convert to image with maximum quality
			const imgData = canvas.toDataURL('image/png', 1.0);

			// 9. Create PDF with specific format
			const pdf = new jspdf.jsPDF({
				orientation: 'landscape',
				unit: 'mm',
				format: 'a4',
				compress: false
			});

			// 10. Get page dimensions
			const pageWidth = pdf.internal.pageSize.getWidth();
			const pageHeight = pdf.internal.pageSize.getHeight();

			// 11. Calculate image dimensions
			const margin = 10;
			const maxWidth = pageWidth - (margin * 2);
			const maxHeight = pageHeight - (margin * 2);

			let imgWidth = canvas.width;
			let imgHeight = canvas.height;

			// 12. Calculate scale to fit page
			const scale = Math.min(
				maxWidth / imgWidth,
				maxHeight / imgHeight
			);

			imgWidth = imgWidth * scale;
			imgHeight = imgHeight * scale;

			// 13. Calculate centered position
			const x = (pageWidth - imgWidth) / 2;
			const y = (pageHeight - imgHeight) / 2;

			// 14. Add image to PDF with specific compression
			pdf.addImage(imgData, 'PNG', x, y, imgWidth, imgHeight, undefined, 'FAST');

			// 15. Save PDF
			const fileName = `airports-day-${new Date().toISOString().slice(0,10)}.pdf`;
			pdf.save(fileName);

			// 16. Cleanup
			container.remove();
			
			// 17. Restore action column
			this.restoreTableAfterExport(actionCells);

			NotificationService.success('PDF сохранен');
		} catch (error) {
			console.error('PDF Export Error:', error);
			NotificationService.error(`Ошибка при создании PDF: ${error.message}`);
			
			// Возвращаем видимость в случае ошибки
			const actionCells = document.querySelectorAll('.actions-column, td:last-child');
			actionCells.forEach(cell => cell.style.display = '');
		}
	}
	

// Новый метод для экспорта в SVG с использованием прямого преобразования из HTML2Canvas
static async exportTableAsSVG() {
	try {
			const table = document.getElementById('airports-table');
			if (!table) {
					throw new Error('Table not found');
			}
			
			// Скрываем столбец с действиями
			const actionCells = this.prepareTableForExport(table);
			
			// Используем html2canvas для получения изображения таблицы
			const canvas = await html2canvas(table, {
					scale: 4,
					backgroundColor: '#FFFFFF',
					logging: false
			});
			
			// Получаем размеры canvas
			const width = canvas.width;
			const height = canvas.height;
			
			// Получаем данные изображения в формате PNG
			const imageData = canvas.toDataURL('image/png');
			
			// Создаем SVG документ
			const svgNS = "http://www.w3.org/2000/svg";
			const svg = document.createElementNS(svgNS, "svg");
			svg.setAttribute("width", width);
			svg.setAttribute("height", height);
			svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
			svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
			
			// Добавляем изображение таблицы как основу SVG
			const image = document.createElementNS(svgNS, "image");
			image.setAttribute("width", width);
			image.setAttribute("height", height);
			image.setAttribute("x", 0);
			image.setAttribute("y", 0);
			image.setAttribute("href", imageData);
			svg.appendChild(image);
			
			// Теперь добавляем векторные элементы поверх изображения
			
			// 1. Получаем все строки таблицы
			const rows = table.querySelectorAll('tbody tr');
			
			// 2. Для каждой строки добавляем стрелки как векторные элементы
			rows.forEach((row, rowIndex) => {
					// Находим все стрелки в строке
					const arrows = row.querySelectorAll('.arrow-wrapper');
					
					// Получаем смещение от верха таблицы
					const rowTop = row.offsetTop;
					
					// Получаем смещение от левого края таблицы (для начала стрелок)
					const nameCell = row.cells[0];
					const leftOffset = nameCell.offsetWidth;
					
					// Обрабатываем каждую стрелку
					arrows.forEach((arrowWrapper) => {
							const arrow = arrowWrapper.querySelector('.arrow');
							if (!arrow) return;
							
							// Получаем позицию и размеры стрелки
							const left = parseInt(arrowWrapper.style.left) || 0;
							const width = parseInt(arrowWrapper.style.width) || 0;
							
							// Получаем цвет стрелки
							const arrowStyle = window.getComputedStyle(arrow);
							const color = arrowStyle.backgroundColor;
							
							// Получаем текст стрелки
							const textContent = arrow.querySelector('.text-content');
							let text = textContent ? textContent.textContent.trim() : '';
							
							// Проверяем содержимое текста и особые случаи
							let hasRedText = textContent ? textContent.querySelector('.red-text') !== null : false;
							let isMinusCase = textContent && textContent.dataset && textContent.dataset.text === 'минус';
							
							// В этот раз мы не добавляем векторные стрелки, так как они уже есть в изображении
							// Но мы можем добавить интерактивные элементы, например, подсказки при наведении
							
							if (text) {
									// Добавляем невидимую область для интерактивности
									const interactiveArea = document.createElementNS(svgNS, "rect");
									interactiveArea.setAttribute("x", leftOffset + left);
									interactiveArea.setAttribute("y", rowTop + 3); // Отступ сверху как в CSS
									interactiveArea.setAttribute("width", width - 14); // Уменьшаем для наконечника
									interactiveArea.setAttribute("height", 22); // Высота стрелки
									interactiveArea.setAttribute("fill", "transparent");
									interactiveArea.setAttribute("stroke", "none");
									
									// Добавляем подсказку с текстом при наведении (title)
									const title = document.createElementNS(svgNS, "title");
									title.textContent = text;
									interactiveArea.appendChild(title);
									
									svg.appendChild(interactiveArea);
							}
					});
			});
			
			// Конвертируем SVG в строку
			const serializer = new XMLSerializer();
			let svgString = serializer.serializeToString(svg);
			
			// Добавляем заголовок XML
			svgString = '<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n' + svgString;
			
			// Создаем Blob и URL для загрузки
			const blob = new Blob([svgString], {type: "image/svg+xml;charset=utf-8"});
			const url = URL.createObjectURL(blob);
			
			// Создаем ссылку для скачивания
			const link = document.createElement("a");
			link.href = url;
			link.download = `airports-day-${new Date().toISOString().slice(0,10)}.svg`;
			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);
			
			// Освобождаем URL
			setTimeout(() => URL.revokeObjectURL(url), 100);
			
			// Возвращаем видимость столбца действий
			this.restoreTableAfterExport(actionCells);
			
			NotificationService.success('SVG сохранен');
	} catch (error) {
			console.error('SVG Export Error:', error);
			NotificationService.error(`Ошибка при создании SVG: ${error.message}`);
			
			// Возвращаем видимость в случае ошибки
			const actionCells = document.querySelectorAll('.actions-column, td:last-child');
			actionCells.forEach(cell => cell.style.display = '');
	}
}
	// Вспомогательные методы для скрытия и восстановления столбца действий
	static prepareTableForExport(table) {
		// Скрываем столбец с действиями
		const actionCells = table.querySelectorAll('.actions-column, td:last-child');
		actionCells.forEach(cell => cell.style.display = 'none');
		return actionCells;
	}
	
	static restoreTableAfterExport(actionCells) {
		// Возвращаем видимость столбца с действиями
		actionCells.forEach(cell => cell.style.display = '');
	}
}
const createArrowHead = (color) => `
	<div class="arrow-head">
			<svg width="14" height="22" viewBox="0 0 14 22" xmlns="http://www.w3.org/2000/svg">
			<path 
					d="M1,1 L13,11 L1,21 Z" 
					fill="${color}" 
					stroke="none"
			/>
			<!-- Отдельные линии для контура только нужных сторон -->
			<path 
					d="M1,1 L13,11" 
					stroke="black" 
					stroke-width="1" 
					fill="none"
			/>
			<path 
					d="M13,11 L1,21" 
					stroke="black" 
					stroke-width="1" 
					fill="none"
			/>
			</svg>
	</div>
`;

// Основной класс приложения
class AirportApp {
    #elements = new Map();
        // Метод для применения автоматического изменения размера шрифта к стрелкам
    applyFontAutoResizeToArrows(row) {
        // Выбираем все стрелки в данной строке
        const arrowWrappers = row.querySelectorAll('.arrow-wrapper');
        
        // Обрабатываем каждую стрелку
        arrowWrappers.forEach(wrapper => {
            const arrow = wrapper.querySelector('.arrow');
            const textContent = arrow.querySelector('.text-content');
            
            if (arrow && textContent) {
                // Применяем автоматическое изменение размера шрифта
                autoResizeTextToFit(textContent, arrow);
            }
        });
    }
    applyTextAdaptationToArrows(row) {
        // Выбираем все стрелки в данной строке
        const arrowWrappers = row.querySelectorAll('.arrow-wrapper');
        
        // Обрабатываем каждую стрелку
        arrowWrappers.forEach(wrapper => {
            const arrow = wrapper.querySelector('.arrow');
            const textContent = arrow.querySelector('.text-content');
            
            if (arrow && textContent) {
                // Применяем адаптацию текста (комбинированный подход)
                adaptTextToFit(textContent, arrow);
            }
        });
    }
    
    // Метод для применения адаптации текста ко всем стрелкам в таблице
    applyTextAdaptationToAllArrows() {
        const rows = this.#getElement('table-body').querySelectorAll('tr');
        rows.forEach(row => {
            this.applyTextAdaptationToArrows(row);
        });
    }
    // Метод для применения автоматического изменения размера шрифта ко всем стрелкам в таблице
    applyFontAutoResizeToAllArrows() {
        const rows = this.#getElement('table-body').querySelectorAll('tr');
        rows.forEach(row => {
            this.applyFontAutoResizeToArrows(row);
        });
    }
    constructor() {
        console.log('App initialized');
        this.initElements();
        this.initEventListeners();
        this.loadState();
        this.updateTableDate();
        
        // Добавляем обработчик изменения размера окна
        window.addEventListener('resize', this.handleWindowResize.bind(this));
        
        // Инициализируем размеры таблицы
        setTimeout(() => {
            CONSTANTS.CELL_WIDTH = calculateCellWidth();
            this.updateArrowPositions();
            
            // Применяем адаптацию текста
            this.applyTextAdaptationToAllArrows();
        }, 100);
        
        // Инициализируем наблюдатель мутаций для автоматической адаптации текста
        this.mutationObserver = setupMutationObserver();
        this.mutationObserver.observe(document.body, { childList: true, subtree: true });
        
        setInterval(() => this.updateTableDate(), 60000);
    }

    initElements() {
        const elements = [
            'modal',
            'add-airport-form',
            'table-body',
            'upload-excel',
            'conditions-container'
        ];
        elements.forEach(id => this.#cacheElement(id));
    }

    #cacheElement(id) {
        const element = document.getElementById(id);
        if (!element) throw new Error(`Element with id "${id}" not found`);
        this.#elements.set(id, element);
        return element;
    }

    #getElement(id) {
        return this.#elements.get(id) || this.#cacheElement(id);
    }

    initEventListeners() {
        // Основные кнопки
        document.getElementById('add-airport-btn').addEventListener('click', () => this.showModal());
        document.getElementById('close-modal').addEventListener('click', () => this.closeModal());
        this.#getElement('add-airport-form').addEventListener('submit', (e) => this.handleFormSubmit(e));
        document.getElementById('add-condition-btn').addEventListener('click', () => this.addConditionField());
        
        // Excel импорт
        document.getElementById('upload-excel-btn').addEventListener('click', () => this.#getElement('upload-excel').click());
        this.#getElement('upload-excel').addEventListener('change', (e) => this.handleExcelUpload(e));
        

        document.getElementById('download-png-btn').addEventListener('click', () => FileExporter.exportTableAsPNG());
        document.getElementById('download-pdf-btn').addEventListener('click', () => FileExporter.exportTableAsPDF());
        document.getElementById('download-svg-btn').addEventListener('click', () => FileExporter.exportTableAsSVG());
        
        // Перезагрузка приложения
        document.getElementById('reload-app-btn').addEventListener('click', () => this.handleReload());
        
        // Обработка условий
        this.#getElement('conditions-container').addEventListener('click', (e) => {
            if (e.target.id === 'add-predefined-condition-btn') {
                this.addPredefinedCondition();
            }
            if (e.target.classList.contains('remove-condition-btn')) {
                e.target.closest('.condition-item').remove();
            }
        });

        // Обработка кликов по таблице
        this.#getElement('table-body').addEventListener('click', (e) => this.handleTableClick(e));

        // Закрытие модального окна по клику вне него
        window.addEventListener('click', (e) => {
            if (e.target === this.#getElement('modal')) {
                this.closeModal();
            }
        });
    }
    
    handleWindowResize() {
        CONSTANTS.CELL_WIDTH = calculateCellWidth();
        this.updateArrowPositions();
        
        // После обновления позиций стрелок применяем адаптацию текста
        // с увеличенной задержкой для надежности
        setTimeout(() => {
            this.applyTextAdaptationToAllArrows();
        }, 300); // Увеличиваем задержку до 300мс
    }
// Добавьте этот метод в класс AirportApp в файле script.js

collectConditionsData() {
    const conditions = [];
    const conditionItems = this.#getElement('conditions-container').querySelectorAll('.condition-item');
    
    conditionItems.forEach((item, index) => {
        const mainText = item.querySelector('.conditions-main')?.value.trim() || '';
        const redText = item.querySelector('.conditions-red')?.value.trim() || '';
        const afterText = item.querySelector('.conditions-after')?.value.trim() || '';
        const arrowHours = parseFloat(item.querySelector('.arrow-hours')?.value || 1);
        const arrowColor = item.querySelector('.arrow-color')?.value || '#E9FFEA';

        // Проверяем обязательные поля
        if (!mainText && !redText) return;

        // Создаем объект условия
        conditions.push({
            mainText,
            redText,
            afterText,
            arrowHours: Math.min(Math.max(arrowHours, CONSTANTS.MIN_ARROW_HOURS), CONSTANTS.MAX_ARROW_HOURS),
            arrowColor,
            startPosition: 0 // Будет установлено при добавлении в интерфейс
        });
    });

    return conditions;
}
    // Метод для обновления позиций стрелок
    updateArrowPositions() {
        const rows = this.#getElement('table-body').querySelectorAll('tr');
        rows.forEach(row => {
            const arrowWrappers = row.querySelectorAll('.arrow-wrapper');
            arrowWrappers.forEach(wrapper => {
                const condition = this.getWrapperCondition(wrapper);
                if (condition) {
                    const width = (condition.arrowHours * CONSTANTS.CELL_WIDTH) - 2;
                    const left = (condition.startPosition || 0) * CONSTANTS.CELL_WIDTH + 1;
                    
                    wrapper.style.width = `${width}px`;
                    wrapper.style.left = `${left}px`;
                }
            });
            
            this.updateProgress(row);
        });
    }

    // Метод для получения данных условия из wrapper
    getWrapperCondition(wrapper) {
        return getWrapperCondition(wrapper);
    }

    updateTableDate() {
        const today = new Date();
        const day = String(today.getDate()).padStart(2, '0');
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const year = today.getFullYear();
        
        const dateStr = `${day}.${month}.${year} г.`;
        document.getElementById('table-date').textContent = dateStr;
    
    }

    showModal() {
        this.generateConditionsDropdown();
        this.#getElement('modal').style.display = 'block';
        document.body.style.overflow = 'hidden';
    }

    closeModal() {
        this.#getElement('modal').style.display = 'none';
        this.#getElement('add-airport-form').reset();
        this.#getElement('conditions-container').innerHTML = '';
        document.body.style.overflow = '';
    }

    generateConditionsDropdown() {
        this.#getElement('conditions-container').insertAdjacentHTML('afterbegin', `
            <div class="predefined-conditions">
                <select id="condition-select">
                    ${predefinedConditions.map((condition, index) => 
                        `<option value="${index}">${condition.condition}</option>`
                    ).join('')}
                </select>
                <button type="button" id="add-predefined-condition-btn">
                    Добавить готовое условие
                </button>
            </div>
        `);
    }

    addConditionField() {
        this.#getElement('conditions-container').insertAdjacentHTML('beforeend', `
            <div class="condition-item">
                <div class="condition-text-group">
                    <div class="input-group">
                        <label for="conditions-main">Основной текст:</label>
                        <input type="text" class="conditions-main" name="conditions-main" 
                               placeholder="Основной текст">
                    </div>
                    
                    <div class="input-group">
                        <label for="conditions-red">Красный текст:</label>
                        <input type="text" class="conditions-red" name="conditions-red" 
                               placeholder="Текст красным цветом">
                    </div>
                    
                    <div class="input-group">
                        <label for="conditions-after">Текст после:</label>
                        <input type="text" class="conditions-after" name="conditions-after" 
                               placeholder="Текст после красного">
                    </div>
                </div>
                <div class="input-group">
                    <label for="arrow-hours">Количество часов:</label>
                    <input type="number" class="arrow-hours" name="arrow-hours" 
                           required min="${CONSTANTS.MIN_ARROW_HOURS}" 
                           max="${CONSTANTS.MAX_ARROW_HOURS}" step="0.1" value="1">
                </div>
                
                <div class="input-group">
                    <label for="arrow-color">Цвет стрелки:</label>
                    <select class="arrow-color" name="arrow-color" required>
                        ${AVAILABLE_COLORS.map(color => 
                            `<option value="${color.value}" style="background-color: ${color.value}">
                                ${color.name}
                            </option>`
                        ).join('')}
                    </select>
                </div>
                
                <button type="button" class="remove-condition-btn">Удалить условие</button>
            </div>
        `);
    }
    addNewAirportRow(airportName, conditions) {
        const row = document.createElement('tr');
        row.setAttribute('draggable', 'true');
        
        row.innerHTML = `
            <td class="airport-name-cell">
                <span>${airportName}</span>
            </td>
            <td colspan="${CONSTANTS.TOTAL_COLUMNS}" class="conditions-cell">
                <div class="arrow-container">${this.createArrows(conditions)}</div>
            </td>
            <td>
                <button class="highlight-btn" title="Выделить">✔</button>
                <button class="delete-btn" title="Удалить">🗑</button>
            </td>
        `;
        
        this.#getElement('table-body').appendChild(row);
        this.initDragAndDrop(row);
        this.setArrowSequence(row);
        
        // Добавляем таймаут для применения адаптации текста
        setTimeout(() => {
            this.applyTextAdaptationToArrows(row);
            this.updateProgress(row);
        }, 200);
    }

    // Метод загрузки из Excel
    async handleExcelUpload(e) {
        console.log('Excel upload started');
        try {
            const file = e.target.files[0];
            if (!file) return;
    
            const data = await file.arrayBuffer();
            const workbook = XLSX.read(data, {
                type: 'array',
                cellDates: true,
                cellNF: true,
                cellText: true
            });
    
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];
    
            const jsonData = XLSX.utils.sheet_to_json(sheet, {
                header: 1,
                defval: '',
                raw: false
            });
    
            this.#getElement('table-body').innerHTML = '';
    
            // Сначала добавляем все строки
            for (let i = 1; i < jsonData.length; i++) {
                const row = jsonData[i];
                if (!row[0]) continue;
                
                const airportName = row[0].toString().trim();
                const conditions = this.processConditions(row.slice(1));
                
                if (airportName && conditions.length > 0) {
                    this.addNewAirportRow(airportName, conditions);
                }
            }
    
            // Затем обновляем прогресс для всех строк с небольшой задержкой
            setTimeout(() => {
                const rows = this.#getElement('table-body').querySelectorAll('tr');
                rows.forEach(row => this.updateProgress(row));
            }, 100);
    
            this.saveState();
            NotificationService.success('Данные загружены');
            e.target.value = '';
        } catch (error) {
            console.error('Excel upload error:', error);
            NotificationService.error(`Ошибка загрузки файла: ${error.message}`);
            e.target.value = '';
        }
    }
    
    addPredefinedCondition() {
        const select = document.getElementById('condition-select');
        const selectedCondition = predefinedConditions[select.value];
        
        this.#getElement('conditions-container').insertAdjacentHTML('beforeend', `
            <div class="condition-item">
                <div class="condition-text-group">
                    <div class="input-group">
                        <label for="conditions-main">Основной текст:</label>
                        <input type="text" class="conditions-main" name="conditions-main" 
                               value="${selectedCondition.condition}" placeholder="Основной текст">
                    </div>
                    
                    <div class="input-group">
                        <label for="conditions-red">Красный текст:</label>
                        <input type="text" class="conditions-red" name="conditions-red" 
                               value="" placeholder="Текст красным цветом">
                    </div>
                    
                    <div class="input-group">
                        <label for="conditions-after">Текст после:</label>
                        <input type="text" class="conditions-after" name="conditions-after" 
                               value="" placeholder="Текст после красного">
                    </div>
                </div>
                <div class="input-group">
                    <label for="arrow-hours">Количество часов:</label>
                    <input type="number" class="arrow-hours" name="arrow-hours" 
                           value="${selectedCondition.arrowHours}" required 
                           min="${CONSTANTS.MIN_ARROW_HOURS}" 
                           max="${CONSTANTS.MAX_ARROW_HOURS}" step="1">
                </div>
                
                <div class="input-group">
                    <label for="arrow-color">Цвет стрелки:</label>
                    <select class="arrow-color" name="arrow-color" required>
                        ${AVAILABLE_COLORS.map(color => 
                            `<option value="${color.value}" 
                             ${color.value === selectedCondition.arrowColor ? 'selected' : ''}
                             style="background-color: ${color.value}">${color.name}</option>`
                        ).join('')}
                    </select>
                </div>
                
                <button type="button" class="remove-condition-btn">Удалить условие</button>
            </div>
        `);
    }

    handleFormSubmit(event) {
        event.preventDefault();
        const airportName = document.getElementById('airport-name').value.trim();
        
        if (!airportName) {
            NotificationService.error('Введите название аэродрома');
            return;
        }

        const conditions = this.collectConditionsData();
        if (conditions.length === 0) {
            NotificationService.error('Добавьте хотя бы одно условие');
            return;
        }

        this.addNewAirportRow(airportName, conditions);
        this.closeModal();
        this.saveState();
        NotificationService.success('Аэродром добавлен');
    }


// Исправленный метод updateProgress
updateProgress(row) {
    const nameCell = row.querySelector('.airport-name-cell');
    if (!nameCell) return;

    // Очищаем предыдущие стили
    nameCell.style.removeProperty('--start-progress');
    nameCell.style.removeProperty('--end-progress');

    // Находим все красные стрелки
    const redArrows = Array.from(row.querySelectorAll('.arrow')).filter(arrow => {
        const style = window.getComputedStyle(arrow);
        return style.backgroundColor === 'rgb(253, 205, 201)' || 
               style.backgroundColor === '#FDCDC9';
    });

    if (redArrows.length === 0) return;

    // Находим самую раннюю и самую позднюю красные стрелки
    const redArrowWrappers = redArrows.map(arrow => arrow.closest('.arrow-wrapper'))
                                    .filter(wrapper => wrapper !== null);

    if (redArrowWrappers.length === 0) return;

    // Получаем ячейку с условиями и её размеры
    const conditionsCell = row.querySelector('.conditions-cell');
    if (!conditionsCell) return;
    
    const conditionsCellWidth = conditionsCell.offsetWidth;
    
    // Получаем все позиции и ширины
    const positions = redArrowWrappers.map(wrapper => ({
        left: parseFloat(wrapper.style.left),
        width: parseFloat(wrapper.style.width)
    }));

    // Находим самую раннюю и самую позднюю позиции
    const startPos = Math.min(...positions.map(p => p.left));
    const endPos = Math.max(...positions.map(p => p.left + p.width));
    
    // Вычисляем проценты корректно относительно ширины ячейки с условиями
    const startProgress = (startPos / conditionsCellWidth) * 100;
    const endProgress = (endPos / conditionsCellWidth) * 100;

    // Ограничиваем значения в пределах 0-100%
    const safeStartProgress = Math.max(0, Math.min(100, startProgress));
    const safeEndProgress = Math.max(0, Math.min(100, endProgress));

    requestAnimationFrame(() => {
        nameCell.style.setProperty('--start-progress', `${safeStartProgress}%`);
        nameCell.style.setProperty('--end-progress', `${safeEndProgress}%`);
        
        // Повторно применяем адаптацию текста
        this.applyTextAdaptationToArrows(row);
    });
}

    setArrowSequence(row) {
        const arrowWrappers = row.querySelectorAll('.arrow-wrapper');
        arrowWrappers.forEach((wrapper, index) => {
            wrapper.style.setProperty('--arrow-index', index);
        });
    }
// Метод загрузки из Excel
async handleExcelUpload(e) {
    try {
        const file = e.target.files[0];
        if (!file) return;

        const data = await file.arrayBuffer();
        const workbook = XLSX.read(data, {
            type: 'array',
            cellDates: true,
            cellNF: true,
            cellText: true
        });

        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];

        const jsonData = XLSX.utils.sheet_to_json(sheet, {
            header: 1,
            defval: '',
            raw: false
        });

        this.#getElement('table-body').innerHTML = '';

        // Сначала добавляем все строки
        for (let i = 1; i < jsonData.length; i++) {
            const row = jsonData[i];
            if (!row[0]) continue;
            
            const airportName = row[0].toString().trim();
            const conditions = this.processConditions(row.slice(1));
            
            if (airportName && conditions.length > 0) {
                this.addNewAirportRow(airportName, conditions);
            }
        }

        // Затем обновляем прогресс для всех строк с небольшой задержкой
        setTimeout(() => {
            const rows = this.#getElement('table-body').querySelectorAll('tr');
            rows.forEach(row => this.updateProgress(row));
        }, 100);

        this.saveState();
        NotificationService.success('Данные загружены');
        e.target.value = '';
    } catch (error) {
        console.error('Excel upload error:', error);
        NotificationService.error(`Ошибка загрузки файла: ${error.message}`);
        e.target.value = '';
    }
}

    processConditions(rowData) {
        const conditions = [];
        let currentCondition = null;
        
        rowData.forEach((value, index) => {
            if (!value) {
                if (currentCondition) {
                    conditions.push(currentCondition);
                    currentCondition = null;
                }
                return;
            }
            
            const condition = this.parseCondition(value.toString().trim());
            if (!condition) return;

            if (!currentCondition) {
                currentCondition = {
                    ...condition,
                    startPosition: index,
                    arrowHours: 1
                };
            } else {
                const isSameCondition = this.areConditionsEqual(currentCondition, condition);
                if (isSameCondition && index === currentCondition.startPosition + currentCondition.arrowHours) {
                    currentCondition.arrowHours++;
                } else {
                    conditions.push(currentCondition);
                    currentCondition = {
                        ...condition,
                        startPosition: index,
                        arrowHours: 1
                    };
                }
            }
        });

        if (currentCondition) {
            conditions.push(currentCondition);
        }

        return conditions;
    }

    areConditionsEqual(condition1, condition2) {
        return condition1.mainText === condition2.mainText &&
               condition1.redText === condition2.redText &&
               condition1.afterText === condition2.afterText &&
               condition1.arrowColor === condition2.arrowColor;
    }

// Улучшенная функция parseCondition для поддержки форматирования из Excel
parseCondition(value) {
    if (!value) return null;
    
    // Нормализуем значение
    const text = value.toString().replace(/\s+/g, ' ').trim();
    
    // Проверяем наличие фигурных скобок для выделения красным
    const bracketMatch = text.match(/(.*?)\{(.*?)\}(.*)/);
    if (bracketMatch) {
        const [_, beforeBraces, inBraces, afterBraces] = bracketMatch.map(part => part ? part.trim() : '');
        
        // Создаем структуру условия с правильным форматированием
        return {
            mainText: beforeBraces,
            redText: inBraces,
            afterText: afterBraces,
            arrowHours: 1,
            arrowColor: this.getConditionColor(text)
        };
    }
    
    // Если нет фигурных скобок, используем стандартную обработку опасных явлений
    const processed = processConditionText(text);
    
    return {
        mainText: processed.mainText,
        redText: processed.redText,
        afterText: processed.afterText || '',
        arrowHours: 1,
        arrowColor: this.getConditionColor(text)
    };
}

// Обновляем функцию processConditions для объединения последовательных условий того же типа
processConditions(rowData) {
    const conditions = [];
    let currentCondition = null;
    
    rowData.forEach((value, index) => {
        if (!value) {
            if (currentCondition) {
                conditions.push(currentCondition);
                currentCondition = null;
            }
            return;
        }
        
        const condition = this.parseCondition(value.toString().trim());
        if (!condition) return;

        if (!currentCondition) {
            currentCondition = {
                ...condition,
                startPosition: index,
                arrowHours: 1
            };
        } else {
            const isSameCondition = this.areConditionsEqual(currentCondition, condition);
            if (isSameCondition && index === currentCondition.startPosition + currentCondition.arrowHours) {
                currentCondition.arrowHours++;
            } else {
                conditions.push(currentCondition);
                currentCondition = {
                    ...condition,
                    startPosition: index,
                    arrowHours: 1
                };
            }
        }
    });

    if (currentCondition) {
        conditions.push(currentCondition);
    }

    return conditions;
}

// Проверка равенства условий для объединения в одну стрелку
areConditionsEqual(condition1, condition2) {
    // Проверяем все части текста и цвет
    return condition1.mainText === condition2.mainText &&
           condition1.redText === condition2.redText &&
           condition1.afterText === condition2.afterText &&
           condition1.arrowColor === condition2.arrowColor;
}

// Обновленный метод createArrows для правильного отображения форматирования
createArrows(conditions) {
    return conditions.map(condition => {
        const width = (condition.arrowHours * CONSTANTS.CELL_WIDTH) - 2;
        const left = (condition.startPosition || 0) * CONSTANTS.CELL_WIDTH + 1;
        
        // Создаем безопасный текст без HTML-инъекций
        const mainText = this.escapeHtml(condition.mainText || '');
        const redText = this.escapeHtml(condition.redText || '');
        const afterText = this.escapeHtml(condition.afterText || '');
        
        return `
            <div class="arrow-wrapper" style="left: ${left}px; width: ${width}px;">
                <div class="arrow" style="background-color: ${condition.arrowColor};">
                    <div class="text-container">
                        <div class="text-content ${condition.arrowColor === '#FDCDC9' ? 'red-condition' : ''}" 
                             ${mainText === 'минус' ? 'data-text="минус"' : ''}>
                            ${mainText}
                            ${redText ? `<span class="red-text">${redText}</span>` : ''}
                            ${afterText || ''}
                        </div>
                    </div>
                    ${createArrowHead(condition.arrowColor)}
                </div>
            </div>
        `;
    }).join('');
}

// Добавьте новый метод для безопасного экранирования HTML
escapeHtml(text) {
    if (!text) return '';
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
// Метод получения цвета условия
getConditionColor(text) {
    const normalizedText = text.toLowerCase().trim();
    
    // Если "минус", возвращаем фиолетовый
    if (normalizedText.includes('минус')) return '#DEE7F6';
    
    // Ищем все паттерны вида числоХчисло в тексте
    const matches = normalizedText.match(/\d+(?:х|x)\d+(?:\.\d+)?/g) || [];
    
    // Если паттернов нет, возвращаем красный цвет
    if (matches.length === 0) return '#FDCDC9';
    
    // Для хранения "наихудшего" условия
    let worstPriority = 1; // 1 - зеленый, 2 - синий, 3 - желтый, 4 - красный
    
    for (const match of matches) {
        const [height, visibility] = match.split(/(?:х|x)/).map(Number);
        
        let currentPriority = 4; // По умолчанию красный (наихудший)
                    
            // Зелёный: видимость 4-6, высота 1000/600/500/400
            if (visibility >= 4 && visibility <= 6 && [1000, 600, 500, 400].includes(height)) {
                currentPriority = 1;
            } 
            // Синий: видимость 3, высота 1000/600/500/400/300
            else if (visibility === 3 && [1000, 600, 500, 400, 300].includes(height)) {
                currentPriority = 2;
            } 
            // Жёлтый (случай 1): видимость 1-2, высоты от 100 до 1000
            else if ((visibility === 1 || visibility === 2) && 
                    [1000, 600, 500, 400, 300, 200, 100].includes(height)) {
                currentPriority = 3;
            } 
            // Жёлтый (случай 2): видимость 3-6, высота 200/100
            else if (visibility >= 3 && visibility <= 6 && [200, 100].includes(height)) {
                currentPriority = 3;
            }
        
        // Обновляем приоритет, если текущее условие хуже
        worstPriority = Math.max(worstPriority, currentPriority);
    }
    
    // Возвращаем цвет на основе наихудшего приоритета
    switch (worstPriority) {
        case 1: return '#E9FFEA'; // Зеленый
        case 2: return '#DAE6F4'; // Синий
        case 3: return '#FFFECE'; // Желтый
        case 4: return '#FDCDC9'; // Красный
        default: return '#FDCDC9'; // Красный по умолчанию
    }
}


// Метод создания стрелок
createArrows(conditions) {
    return conditions.map(condition => {
        const width = (condition.arrowHours * CONSTANTS.CELL_WIDTH) - 2;
        const left = (condition.startPosition || 0) * CONSTANTS.CELL_WIDTH + 1;
        
        return `
            <div class="arrow-wrapper" style="left: ${left}px; width: ${width}px;">
                <div class="arrow" style="background-color: ${condition.arrowColor};">
                    <div class="text-container">
                        <div class="text-content ${condition.arrowColor === '#FDCDC9' ? 'red-condition' : ''}" 
                             ${condition.mainText === 'минус' ? 'data-text="минус"' : ''}>
                            ${condition.mainText}
                            ${condition.redText ? `<span class="red-text">${condition.redText}</span>` : ''}
                            ${condition.afterText || ''}
                        </div>
                    </div>
                    ${createArrowHead(condition.arrowColor)}
                </div>
            </div>
        `;
    }).join('');
}
    initDragAndDrop(row) {
        row.addEventListener('dragstart', e => {
            e.dataTransfer.setData('text/plain', row.rowIndex);
        });

        row.addEventListener('dragover', e => e.preventDefault());

        row.addEventListener('drop', e => {
            e.preventDefault();
            const fromIndex = e.dataTransfer.getData('text/plain');
            const toIndex = row.rowIndex;
            
            if (fromIndex !== toIndex) {
                const rows = this.#getElement('table-body').rows;
                const moveRow = rows[fromIndex - 1];
                const referenceRow = toIndex < fromIndex ? row : row.nextSibling;
                this.#getElement('table-body').insertBefore(moveRow, referenceRow);
                this.saveState();
            }
        });
    }

    handleTableClick(event) {
        const target = event.target;
        const row = target.closest('tr');
        
        if (!row) return;
        
        if (target.classList.contains('highlight-btn')) {
            const nameCell = row.cells[0];
            nameCell.classList.toggle('highlighted');
            this.saveState();
            NotificationService.success(
                nameCell.classList.contains('highlighted') ? 
                'Аэродром выделен' : 'Выделение снято'
            );
        } else if (target.classList.contains('delete-btn')) {
            if (confirm('Удалить эту строку?')) {
                row.remove();
                this.saveState();
                NotificationService.success('Строка удалена');
            }
        }
        this.updateProgress(row);
    }
// Метод загрузки состояния
loadState() {
    this.#getElement('table-body').innerHTML = '';
    try {
        const savedState = localStorage.getItem('airportAppState');
        if (!savedState) return;

        const state = JSON.parse(savedState);
        if (!state.rows || !Array.isArray(state.rows)) return;

        // Сначала добавляем все строки
        state.rows.forEach(row => {
            if (!row.name || !row.conditions) return;
            this.addNewAirportRow(row.name, row.conditions);
            
            const lastRow = this.#getElement('table-body').lastElementChild;
            if (lastRow && row.highlighted) {
                lastRow.cells[0].classList.add('highlighted');
            }
        });

        // Затем обновляем прогресс и адаптируем текст для всех строк с задержкой
        setTimeout(() => {
            const rows = this.#getElement('table-body').querySelectorAll('tr');
            rows.forEach(row => {
                this.updateProgress(row);
                this.applyTextAdaptationToArrows(row);
            });
        }, 100);

    } catch (error) {
        console.error('Load state error:', error);
        NotificationService.error('Ошибка загрузки состояния');
    }
}


    saveState() {
        try {
            const rows = Array.from(this.#getElement('table-body').children);
            if (!rows.length) {
                localStorage.setItem('airportAppState', JSON.stringify({ rows: [] }));
                return;
            }

            const state = {
                rows: rows.map(row => {
                    const nameCell = row.cells[0];
                    return {
                        name: nameCell.textContent.trim(),
                        highlighted: nameCell.classList.contains('highlighted'),
                        conditions: this.getRowConditions(row)
                    };
                })
            };

            localStorage.setItem('airportAppState', JSON.stringify(state));
        } catch (error) {
            console.error('Save state error:', error);
            NotificationService.error('Ошибка сохранения состояния');
        }
    }

    getRowConditions(row) {
        return Array.from(row.querySelectorAll('.arrow')).map(arrow => {
            const textContent = arrow.querySelector('.text-content');
            const redText = arrow.querySelector('.red-text');
            const wrapper = arrow.closest('.arrow-wrapper');
            
            return {
                mainText: textContent.childNodes[0].textContent.trim(),
                redText: redText ? redText.textContent.trim() : '',
                afterText: redText && redText.nextSibling ? redText.nextSibling.textContent.trim() : '',
                arrowHours: parseInt(wrapper.style.width) / CONSTANTS.CELL_WIDTH,
                arrowColor: window.getComputedStyle(arrow).backgroundColor,
                startPosition: parseInt(wrapper.style.left) / CONSTANTS.CELL_WIDTH || 0
            };
        });
    }

    handleReload() {
        if (confirm('Перезагрузить приложение? Несохраненные данные будут утеряны.')) {
            try {
                // Очищаем только состояние нашего приложения, а не весь localStorage
                localStorage.removeItem('airportAppState');
                
                // Перезагружаем страницу без кэша
                window.location.reload(true);
                
                NotificationService.success('Приложение перезагружается...');
            } catch (error) {
                console.error('Reload error:', error);
                NotificationService.error('Ошибка при перезагрузке');
            }
        }
    }
}

// Инициализация приложения
document.addEventListener('DOMContentLoaded', () => {
    try {
        window.airportApp = new AirportApp();
    } catch (error) {
        console.error('Application initialization error:', error);
        NotificationService.error('Ошибка при инициализации приложения');
    }
});