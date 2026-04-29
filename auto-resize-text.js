/**
 * auto-resize-text.js - исправленная версия
 * Восстанавливаем функциональность переноса текста при сохранении
 * одинакового размера для всех элементов текста
 */
// Конфигурация шрифта (уменьшенная)
const FONT_CONFIG = {
    maxFontSize: 15,    // Уменьшенный размер
    midFontSize: 12,    // Уменьшенный средний размер
    minFontSize: 8,     // Уменьшенный минимальный размер
    fontStep: 0.5,      // Оставляем как есть
    arrowPadding: 5     // Оставляем как есть
};

// Адаптивный конфиг шрифта в зависимости от ширины стрелки
function getFontConfigForArrow(arrowElement) {
    const w = arrowElement.getBoundingClientRect().width;
    if (w === 0) return FONT_CONFIG;
    if (w < 80)  return { maxFontSize: 10, midFontSize: 8, minFontSize: 7 };  // ~1 час
    if (w < 150) return { maxFontSize: 11, midFontSize: 9, minFontSize: 7 };  // ~2 часа
    if (w < 220) return { maxFontSize: 13, midFontSize: 10, minFontSize: 8 }; // ~3 часа
    return FONT_CONFIG;
}

function checkTextFit(textElement, arrowElement) {
    // Немедленно проверяем без задержки для более точного результата
    const textRect = textElement.getBoundingClientRect();
    const arrowRect = arrowElement.getBoundingClientRect();
    
    // Уменьшаем порог для более агрессивного применения переноса
    const buffer = FONT_CONFIG.arrowPadding * 1.8; // Увеличиваем буфер
    
    // Сразу возвращаем результат без Promise для устранения задержек
    return {
        fits: textRect.width <= (arrowRect.width - buffer),
        textWidth: textRect.width,
        arrowWidth: arrowRect.width
    };
}

// Определяет, обрезает ли -webkit-line-clamp текст
function isTextClamped(textElement) {
    return textElement.scrollHeight > textElement.clientHeight + 1;
}

// Убирает line-clamp и увеличивает высоту стрелки, когда текст не помещается при минимальном шрифте
function adjustArrowForOverflow(textElement, arrowElement) {
    // Убираем line-clamp (причину "...")
    textElement.style.display = 'block';
    textElement.style.webkitLineClamp = 'unset';
    textElement.style.lineClamp = 'unset';
    textElement.style.maxHeight = 'none';
    textElement.style.lineHeight = '1.1';

    // Увеличиваем высоту стрелки, чтобы вместить текст
    const textHeight = textElement.scrollHeight;
    const maxArrowHeight = 40; // верхний предел
    const newHeight = Math.min(textHeight + 8, maxArrowHeight);
    arrowElement.style.setProperty('height', newHeight + 'px', 'important');
}

// Вспомогательная функция: включает режим переноса строк
function enableWrapping(textElement, arrowElement) {
    textElement.style.whiteSpace = 'normal';
    textElement.classList.add('wrapped');
    arrowElement.classList.add('has-wrapped-text');
    textElement.style.maxHeight = '28px';
    textElement.style.overflow = 'hidden';
    updateRedTextForWrapping(textElement);
}

// Функция для комбинированного подхода к размещению текста
async function adaptTextToFit(textElement, arrowElement) {
    const cfg = getFontConfigForArrow(arrowElement);
    const arrowWidth = arrowElement.getBoundingClientRect().width;
    const isNarrow = arrowWidth > 0 && arrowWidth < 80; // 1-часовая стрелка

    // Сбрасываем стили с размером, подходящим для данной ширины стрелки
    resetTextStyles(textElement, cfg.maxFontSize);

    textElement.style.display = 'inline-block';
    textElement.style.visibility = 'visible';

    processRedTextStructure(textElement);

    // Для 1-часовых стрелок сразу включаем перенос и уменьшаем шрифт
    if (isNarrow) {
        enableWrapping(textElement, arrowElement);
        let currentSize = cfg.maxFontSize;
        while (isTextClamped(textElement) && currentSize > cfg.minFontSize) {
            currentSize -= FONT_CONFIG.fontStep;
            textElement.style.fontSize = `${currentSize}px`;
        }
        if (isTextClamped(textElement)) {
            adjustArrowForOverflow(textElement, arrowElement);
        }
        return;
    }

    // Проверяем, помещается ли текст с начальным размером шрифта
    let fitResult = checkTextFit(textElement, arrowElement);
    if (fitResult.fits) return;

    // Стадия 1: уменьшаем шрифт max→mid (одна строка)
    let currentSize = cfg.maxFontSize;
    while (!fitResult.fits && currentSize > cfg.midFontSize) {
        currentSize -= FONT_CONFIG.fontStep;
        textElement.style.fontSize = `${currentSize}px`;
        fitResult = checkTextFit(textElement, arrowElement);
        if (fitResult.fits) return;
    }

    // Стадия 2: включаем перенос строк
    enableWrapping(textElement, arrowElement);

    fitResult = checkTextFit(textElement, arrowElement);
    if (fitResult.fits && !isTextClamped(textElement)) return;

    // Стадия 3: уменьшаем шрифт mid→min с переносом
    currentSize = Math.min(currentSize, cfg.midFontSize);
    while (currentSize > cfg.minFontSize) {
        currentSize -= FONT_CONFIG.fontStep;
        textElement.style.fontSize = `${currentSize}px`;
        if (!isTextClamped(textElement)) return;
    }

    // Стадия 4: текст всё ещё обрезается → расширяем стрелку
    if (isTextClamped(textElement)) {
        adjustArrowForOverflow(textElement, arrowElement);
    }
}

// Функция для настройки красного текста в режиме переноса
function updateRedTextForWrapping(textElement) {
    const redTextElements = textElement.querySelectorAll('.red-text');
    
    redTextElements.forEach(redElement => {
        // Убедимся, что красный текст тоже поддерживает перенос
        redElement.style.whiteSpace = 'normal';
        redElement.style.display = 'inline-flex';
        redElement.style.flexWrap = 'wrap';
        redElement.style.alignItems = 'center';
        redElement.style.fontSize = 'inherit'; // ИСПРАВЛЕНО: наследуем размер
        
        // Настраиваем дочерние элементы для правильного переноса
        const numericElements = redElement.querySelectorAll('.numeric-format');
        const wordElements = redElement.querySelectorAll('.word-format');
        
        numericElements.forEach(el => {
            el.style.display = 'inline-block';
            el.style.whiteSpace = 'normal';
            el.style.margin = '0 2px 0 0';
            el.style.fontSize = 'inherit'; // ИСПРАВЛЕНО: наследуем размер
        });
        
        wordElements.forEach(el => {
            el.style.display = 'inline-block';
            el.style.whiteSpace = 'normal';
            el.style.margin = '0 2px 0 0';
            el.style.fontSize = 'inherit'; // ИСПРАВЛЕНО: наследуем размер (было 0.6em)
        });
    });
}

// Функция для сброса текстовых стилей к начальному состоянию
function resetTextStyles(textElement, initialSize = FONT_CONFIG.maxFontSize) {
    textElement.style.fontSize = `${initialSize}px`;
    textElement.style.whiteSpace = 'nowrap';
    textElement.style.maxHeight = '';
    textElement.style.overflow = '';
    textElement.style.display = '';
    textElement.style.webkitLineClamp = '';
    textElement.style.lineClamp = '';
    textElement.style.lineHeight = '';
    textElement.classList.remove('wrapped');

    // Находим родительскую стрелку и убираем класс переноса
    const arrowElement = textElement.closest('.arrow');
    if (arrowElement) {
        arrowElement.classList.remove('has-wrapped-text');
        arrowElement.style.removeProperty('height');
    }

    // Сбрасываем стили для красного текста
    const redTexts = textElement.querySelectorAll('.red-text');
    redTexts.forEach(redText => {
        redText.style.whiteSpace = 'nowrap';
        redText.style.maxHeight = '';
        redText.style.overflow = '';
    });
}

// Функция для проверки, является ли текст числовым форматом
function isNumericFormat(text) {
    // Регулярное выражение для проверки форматов типа "600x6", "50х0.6"
    return /^\d+(?:х|x)\d+(?:\.\d+)?$/.test(text.trim());
}

// Предварительная обработка структуры красного текста
function processRedTextStructure(textElement) {
    const redTextElements = textElement.querySelectorAll('.red-text');
    
    redTextElements.forEach(redTextElement => {
        const content = redTextElement.textContent;
        
        // Создаем новую структуру для красного текста
        const words = content.split(/\s+/);
        
        // Очищаем содержимое
        redTextElement.innerHTML = '';
        
        // Добавляем каждое слово с соответствующим стилем
        words.forEach((word, index) => {
            const wordSpan = document.createElement('span');
            wordSpan.textContent = word;
            
            // ИСПРАВЛЕНИЕ: Все элементы красного текста имеют одинаковый размер
            if (isNumericFormat(word)) {
                // Числовой формат - наследуем размер от родителя
                wordSpan.style.fontSize = 'inherit'; 
                wordSpan.style.lineHeight = 'normal';
                wordSpan.style.verticalAlign = 'baseline';
                wordSpan.classList.add('numeric-format');
            } else {
                // ИЗМЕНЕНО: Текстовый формат тоже наследует размер (было 0.6em)
                wordSpan.style.fontSize = 'inherit'; 
                wordSpan.style.lineHeight = 'normal';
                wordSpan.style.verticalAlign = 'baseline';
                wordSpan.classList.add('word-format');
            }
            
            // Добавляем слово в контейнер
            redTextElement.appendChild(wordSpan);
            
            // Добавляем пробел после слова (кроме последнего)
            if (index < words.length - 1) {
                redTextElement.appendChild(document.createTextNode(' '));
            }
        });
        
        // Устанавливаем стили для самого контейнера красного текста
        redTextElement.style.color = 'red';
        redTextElement.style.fontWeight = 'bold';
        redTextElement.style.display = 'inline-flex';
        redTextElement.style.alignItems = 'center';
        redTextElement.style.flexWrap = 'nowrap';
        redTextElement.style.fontSize = 'inherit'; // ИСПРАВЛЕНО: наследуем размер
    });
}

// Функция для обработки всех стрелок на странице
function applyTextAdaptationToAllArrows() {
    const arrowWrappers = document.querySelectorAll('.arrow-wrapper');
    
    arrowWrappers.forEach(wrapper => {
        const arrow = wrapper.querySelector('.arrow');
        const textContent = arrow.querySelector('.text-content');
        
        if (arrow && textContent) {
            adaptTextToFit(textContent, arrow);
        }
    });
}

// Наблюдатель мутаций DOM для автоматического применения адаптации текста
function setupMutationObserver() {
    const config = { childList: true, subtree: true };
    
    const observer = new MutationObserver((mutationsList) => {
        for (const mutation of mutationsList) {
            if (mutation.type === 'childList') {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === 1) { // Элемент
                        const arrowWrappers = node.classList?.contains('arrow-wrapper') 
                            ? [node] 
                            : node.querySelectorAll?.('.arrow-wrapper');
                            
                        if (arrowWrappers && arrowWrappers.length > 0) {
                            setTimeout(() => {
                                arrowWrappers.forEach(wrapper => {
                                    const arrow = wrapper.querySelector('.arrow');
                                    const textContent = arrow.querySelector('.text-content');
                                    
                                    if (arrow && textContent) {
                                        adaptTextToFit(textContent, arrow);
                                    }
                                });
                            }, 50);
                        }
                    }
                });
            }
        }
    });
    
    return observer;
}

