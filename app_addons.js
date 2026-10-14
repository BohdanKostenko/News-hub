// 1. Інжектуємо точні CSS правила приховування та стилізації
const addonStyle = document.createElement('style');
addonStyle.textContent = `
/* Якщо всередині картки є блок пов'язаних джерел — миттєво ховаємо старий блок дій і дублюючий текст */
div:has(> .source-expand-box) .card-actions,
div:has(> .source-box-header) .card-actions,
div:has(> .related-chain-wrap) .card-actions,
div:has(> [id^="src-box-"]) .card-actions,
.card-body:has([id^="src-box-"]) .card-actions,
.news-card:has([id^="src-box-"]) .card-actions {
  display: none !important;
}

/* Ховаємо старий сірий дублюючий текст прямо під акордеоном */
div:has(> [id^="src-box-"]) > div[id^="full-"],
.card-body:has([id^="src-box-"]) > div[id^="full-"] {
  display: none !important;
}

/* Стиль для часу публікації джерела */
.source-box-time {
  font-size: 0.75rem;
  color: #94a3b8;
  background: rgba(255, 255, 255, 0.08);
  padding: 2px 6px;
  border-radius: 4px;
  margin-left: 8px;
  font-weight: normal;
}
`;
document.head.appendChild(addonStyle);

// 2. Додатковий обхід елементів для гарантованого приховування кнопок і додавання зірочки
function applyUIImprovements() {
  const expandBoxes = document.querySelectorAll('[id^="src-box-"]');

  expandBoxes.forEach(box => {
    // Шукаємо батьківський контейнер картки
    const parent = box.closest('.card-body') || box.closest('.news-card') || box.parentElement;
    if (!parent) return;

    // 1. Приховуємо card-actions (кнопки Згорнути / Джерело)
    const actions = parent.querySelector('.card-actions');
    if (actions) {
      actions.style.setProperty('display', 'none', 'important');
    }

    // 2. Приховуємо дублюючий нижній текст full-
    const fullText = parent.querySelector('[id^="full-"]');
    if (fullText) {
      fullText.style.setProperty('display', 'none', 'important');
    }

    // 3. Додаємо мітку базового джерела ⭐ до першої кнопки ланцюжка
    const chips = parent.querySelectorAll('.source-chip-btn, .related-box a, .related-chain-wrap button');
    if (chips.length > 0) {
      const firstChip = chips[0];
      if (!firstChip.textContent.includes('⭐')) {
        firstChip.innerHTML = '⭐ ' + firstChip.innerHTML.replace('🔗', '').trim();
      }
    }
  });
}

// Запускаємо моніторинг DOM
const observer = new MutationObserver(applyUIImprovements);
observer.observe(document.body, { childList: true, subtree: true });

// Періодичний виклик для динамічного оновлення
setInterval(applyUIImprovements, 300);
