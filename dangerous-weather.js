// Список опасных метеоявлений для автоматического выделения
const DANGEROUS_WEATHER_PATTERNS = [
	// Ограниченная видимость
	'туман',

	// Осадки
	 'гроза', 'интенсивный дождь', 'снежные заряды', 'град', 'ледяной дождь','отд.куч.дожд', 
	
	// Ветер
	'шквал',  
	
	// Обледенение
	 'гололед', 'гололёд', 'кр.гололед', 'кр.гололёд',
	

	// Низкая облачность - обрабатывается через числовые значения
	'50х',
];

// Функция для нормализации специального формата видимости
function normalizeVisibilityFormat(text) {
// Проверяем, является ли текст форматом с видимостью вида "0.6 50х 50х0.6"
const regex = /\b(\d+(?:\.\d+)?)\s+(\d+)х\s+(?:\d+)х(\d+(?:\.\d+)?)\b/gi;

// Заменяем формат на стандартный вид
return text.replace(regex, (match, part1, part2, part3) => {
		return `${part2}х${part3}`;
});
}

// Функция для разбора специальных форматов НННхВВ и определения опасности
function parseHeightVisibility(text) {
// Сначала нормализуем формат
const normalizedText = normalizeVisibilityFormat(text);

// Ищем все форматы типа "600х0.4", "50х0.6"
const regex = /(\d+)\s*х\s*(\d+(?:\.\d+)?)/gi;
const matches = [...normalizedText.matchAll(regex)];

if (!matches.length) return null;

const dangerous = [];
const nonDangerous = [];

matches.forEach(match => {
		const fullMatch = match[0];
		const parts = fullMatch.split('х');
		
		// Получаем числа, обрабатывая возможные пробелы
		const height = parseFloat(parts[0].trim());
		const visibility = parts.length > 1 ? parseFloat(parts[1].trim()) : 0;
		
		// Определяем, является ли формат опасным
		if (height <= 100 || visibility < 1) {
				dangerous.push(fullMatch);
		} else {
				nonDangerous.push(fullMatch);
		}
});

return { 
		dangerous, 
		nonDangerous,
		normalizedText
};
}

// Улучшенная функция для точного выделения опасных явлений в тексте
function processWeatherText(text) {
if (!text) return { mainText: '', redText: '' };

// Сначала проверяем наличие фигурных скобок
const bracketsMatch = text.match(/(.*?)\{(.*?)\}(.*)/);
if (bracketsMatch) {
		const [_, beforeBraces, inBraces, afterBraces] = bracketsMatch.map(part => part ? part.trim() : '');
		return {
				mainText: `${beforeBraces} ${afterBraces}`.trim(),
				redText: inBraces
		};
}

// Нормализуем текст для специальных форматов
let normalizedText = normalizeVisibilityFormat(text);
let remainingText = normalizedText;
let dangerousText = '';

// Проверка форматов НННхВВ
const heightVisibility = parseHeightVisibility(normalizedText);
if (heightVisibility) {
		// Добавляем опасные форматы к опасному тексту
		if (heightVisibility.dangerous.length > 0) {
				dangerousText = heightVisibility.dangerous.join(' ');
				
				// Удаляем их из основного текста
				heightVisibility.dangerous.forEach(item => {
						remainingText = remainingText.replace(item, '');
				});
		}
}

// УЛУЧШЕНИЕ: Проверка текстовых паттернов опасных явлений с улучшенным алгоритмом
const words = remainingText.split(/\s+/); // Разбиваем на слова
const dangerousWords = [];
const safeWords = [];

for (const word of words) {
		let isDangerous = false;
		
		// Проверяем совпадение с опасными паттернами
		for (const pattern of DANGEROUS_WEATHER_PATTERNS) {
				// Проверяем точное совпадение (без учета регистра)
				if (word.toLowerCase() === pattern.toLowerCase()) {
						isDangerous = true;
						dangerousWords.push(word);
						break;
				}
				
				// Если содержит опасный паттерн как часть слова (для сложных конструкций)
				if (pattern.includes('.') && word.toLowerCase().includes(pattern.toLowerCase())) {
						isDangerous = true;
						dangerousWords.push(word);
						break;
				}
		}
		
		if (!isDangerous) {
				safeWords.push(word);
		}
}

// Обновляем опасный текст и оставшийся текст
if (dangerousWords.length > 0) {
		dangerousText += (dangerousText ? ' ' : '') + dangerousWords.join(' ');
}
remainingText = safeWords.join(' ');

// Очищаем текст от лишних пробелов
remainingText = remainingText.replace(/\s+/g, ' ').trim();
dangerousText = dangerousText.replace(/\s+/g, ' ').trim();

return {
		mainText: remainingText,
		redText: dangerousText
};
}

// Функция для обработки текста при создании условия
function processConditionText(text) {
const { mainText, redText } = processWeatherText(text);

// Возвращаем структуру для метода parseCondition
return {
		mainText: mainText,
		redText: redText,
		afterText: ''
};
}