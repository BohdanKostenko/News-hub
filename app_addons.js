// 1. Стилі
const addonStyle = document.createElement('style');
addonStyle.textContent = `
.hide-redundant-actions { display: none !important; }

.source-box-time {
  font-size: 0.75rem; color: #94a3b8; background: rgba(255,255,255,0.06);
  padding: 2px 6px; border-radius: 4px; border: 1px solid rgba(255,255,255,0.08); margin-left: 8px;
}
.source-chip-btn.is-main {
  border-color: #f59e0b !important; color: #fcd34d !important; background: #292010 !important; font-weight: 600;
}
`;
document.head.appendChild(addonStyle);

// 2. Логіка приховування дублюючих кнопок
function cleanupRedundantUI() {
  // Знаходимо всі блоки з пов'язаними джерелами
  const relBoxes = document.querySelectorAll('.related-box, .related-chain-wrap');
  
  relBoxes.forEach(rel => {
    // Шукаємо батьківську картку
    let card = rel.parentElement;
    while (card && !card.classList.contains('news-card') && !card.classList.contains('card') && card.tagName !== 'BODY') {
      card = card.parentElement;
    }
    if (!card || card.tagName === 'BODY') return;

    // Ховаємо блок із кнопками "Читати повністю / Згорнути" та "Джерело ↗"
    const actions = card.querySelector('.card-actions');
    if (actions) actions.style.display = 'none';

    // Ховаємо дублюючий нижній текст
    const full = card.querySelector('[id^="full-"]');
    if (full) full.style.display = 'none';

    // Додаємо зірочку ⭐ до першого посилання/чіпа
    const firstChip = rel.querySelector('button, a');
    if (firstChip && !firstChip.textContent.includes('⭐')) {
      firstChip.innerHTML = '⭐ ' + firstChip.innerHTML;
      firstChip.classList.add('is-main');
    }
  });
}

// Запуск відстеження
const observer = new MutationObserver(cleanupRedundantUI);
observer.observe(document.body, { childList: true, subtree: true });

setInterval(cleanupRedundantUI, 400);
