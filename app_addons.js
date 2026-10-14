// 1. Інжектуємо стилі
const addonStyle = document.createElement('style');
addonStyle.textContent = `
.related-chain-wrap { margin-top: 10px; padding-top: 8px; border-top: 1px dashed rgba(255,255,255,0.15); }
.related-chain-label { font-size: 0.78rem; color: #9ca3af; margin-bottom: 6px; }
.related-chips-row { display: flex; flex-wrap: wrap; gap: 6px; }
.source-chip-btn {
  background: #1e293b; color: #38bdf8; border: 1px solid #334155;
  border-radius: 6px; padding: 4px 10px; font-size: 0.78rem; cursor: pointer; transition: all 0.2s;
}
.source-chip-btn:hover, .source-chip-btn.active {
  background: #0284c7; color: #ffffff; border-color: #38bdf8;
}
.source-expand-box {
  background: #0f172a; border: 1px solid #0284c7; border-radius: 8px;
  padding: 10px; margin-top: 8px; font-size: 0.85rem; color: #f1f5f9; display: none;
}
.source-box-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; border-bottom: 1px solid rgba(255,255,255,0.06); padding-bottom: 4px; }
.source-box-title { font-weight: 600; color: #38bdf8; }
.source-direct-link { color: #f59e0b; text-decoration: none; font-size: 0.8rem; font-weight: 500; }
.source-direct-link:hover { text-decoration: underline; }
.source-box-body { line-height: 1.45; color: #cbd5e1; font-size: 0.82rem; white-space: pre-wrap; margin: 0; }
`;
document.head.appendChild(addonStyle);

// 2. Функція перемикання блоків джерел
window.toggleSourceAccordion = function(artId, idx, evt) {
  if (evt) {
    evt.preventDefault();
    evt.stopPropagation();
  }
  const box = document.getElementById('src-box-' + artId + '-' + idx);
  if (!box) return;

  const willOpen = (box.style.display === 'none' || box.style.display === '');
  document.querySelectorAll('[id^="src-box-' + artId + '-"]').forEach(el => el.style.display = 'none');
  document.querySelectorAll('[id^="src-btn-' + artId + '-"]').forEach(el => el.classList.remove('active'));

  if (willOpen) {
    box.style.display = 'block';
    const btn = document.getElementById('src-btn-' + artId + '-' + idx);
    if (btn) btn.classList.add('active');
  }
};

// 3. Автоматична трансформація карток після завантаження статей
function enhanceArticlesWithChain() {
  if (!window.rawData || !window.rawData.articles) return;

  window.rawData.articles.forEach(art => {
    if (!art.related_sources || !art.related_sources.length) return;

    // Шукаємо картку
    const fullTextEl = document.getElementById('full-' + art.id);
    if (!fullTextEl) return;
    const cardBody = fullTextEl.parentElement;
    if (!cardBody) return;

    // Перевіряємо, чи вже додано ланцюжок
    if (cardBody.querySelector('.related-chain-wrap')) return;

    // Видаляємо старий текстовий блок "Про це також повідомили"
    const oldBox = cardBody.querySelector('.related-box');
    if (oldBox) oldBox.style.display = 'none';

    // Формуємо джерела: головне першим + всі супутні
    const allSources = [];
    if (art.source_name) {
      allSources.push({
        source_name: art.source_name + ' ⭐ (Головне)',
        source_url: art.source_url || '#',
        raw_text: art.raw_text || art.summary || ''
      });
    }
    art.related_sources.forEach(s => allSources.push(s));

    const chips = allSources.map((s, idx) => {
      const sName = s.source_name || ('Джерело ' + (idx + 1));
      return `<button type="button" id="src-btn-${art.id}-${idx}" class="source-chip-btn" onclick="toggleSourceAccordion('${art.id}', ${idx}, event)">🔗 ${sName}</button>`;
    }).join(' ');

    const panels = allSources.map((s, idx) => {
      const sName = s.source_name || ('Джерело ' + (idx + 1));
      const sText = s.raw_text ? s.raw_text : 'Оригінальний текст збережеться під час наступного автооновлення.';
      const sLink = (s.source_url && s.source_url !== '#') ? `<a href="${s.source_url}" target="_blank" rel="noopener noreferrer" class="source-direct-link">Читати в першоджерелі ↗</a>` : '';
      return `
        <div id="src-box-${art.id}-${idx}" class="source-expand-box">
          <div class="source-box-header">
            <span class="source-box-title">${sName}</span>
            ${sLink}
          </div>
          <div class="source-box-body">${sText}</div>
        </div>
      `;
    }).join('');

    const wrap = document.createElement('div');
    wrap.className = 'related-chain-wrap';
    wrap.innerHTML = `
      <div class="related-chain-label">Джерела цієї події (натисніть, щоб прочитати текст каналу):</div>
      <div class="related-chips-row">${chips}</div>
      <div class="related-panels-container">${panels}</div>
    `;

    // Вставляємо перед повним текстом
    cardBody.insertBefore(wrap, fullTextEl);
  });
}

// Запускаємо перевірку після кожного рендеру або фільтрації
const observer = new MutationObserver(() => {
  enhanceArticlesWithChain();
});
observer.observe(document.body, { childList: true, subtree: true });

// Перший запуск
setTimeout(enhanceArticlesWithChain, 500);
setTimeout(enhanceArticlesWithChain, 1500);
