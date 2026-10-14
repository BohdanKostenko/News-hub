// 1. Стилі оформлення
const addonStyle = document.createElement('style');
addonStyle.textContent = `
.related-chain-wrap { margin-top: 10px; padding-top: 8px; border-top: 1px dashed rgba(255,255,255,0.15); }
.related-chain-label { font-size: 0.78rem; color: #9ca3af; margin-bottom: 6px; }
.related-chips-row { display: flex; flex-wrap: wrap; gap: 6px; }
.source-chip-btn {
  background: #1e293b; color: #38bdf8; border: 1px solid #334155;
  border-radius: 6px; padding: 4px 10px; font-size: 0.78rem; cursor: pointer; transition: all 0.2s;
}
.source-chip-btn.is-main {
  border-color: #f59e0b; color: #fcd34d; background: #292010; font-weight: 600;
}
.source-chip-btn:hover, .source-chip-btn.active {
  background: #0284c7; color: #ffffff; border-color: #38bdf8;
}
.source-expand-box {
  background: #0f172a; border: 1px solid #0284c7; border-radius: 8px;
  padding: 10px; margin-top: 8px; font-size: 0.85rem; color: #f1f5f9; display: none;
}
.source-box-header {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 8px; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 6px;
  flex-wrap: wrap; gap: 6px;
}
.source-header-left { display: flex; align-items: center; gap: 8px; }
.source-box-title { font-weight: 600; color: #38bdf8; font-size: 0.85rem; }
.source-box-time {
  font-size: 0.75rem; color: #94a3b8; background: rgba(255,255,255,0.06);
  padding: 2px 6px; border-radius: 4px; border: 1px solid rgba(255,255,255,0.08);
}
.source-direct-link { color: #f59e0b; text-decoration: none; font-size: 0.8rem; font-weight: 500; }
.source-direct-link:hover { text-decoration: underline; }
.source-box-body { line-height: 1.45; color: #cbd5e1; font-size: 0.82rem; white-space: pre-wrap; margin: 0; }
`;
document.head.appendChild(addonStyle);

// 2. Глобальне перемикання акордеона
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

// 3. Функція обробки карток
function enhanceArticlesWithChain() {
  if (!window.rawData || !window.rawData.articles) return;

  window.rawData.articles.forEach(art => {
    const fullTextEl = document.getElementById('full-' + art.id);
    if (!fullTextEl) return;
    const cardBody = fullTextEl.parentElement;
    if (!cardBody) return;

    const hasRelated = art.related_sources && art.related_sources.length > 0;

    if (hasRelated) {
      // 1. Приховуємо дублюючий сирий текст під новиною
      fullTextEl.style.display = 'none';

      // 2. Приховуємо нижній блок кнопок: "Читати повністю" та "Джерело >"
      const actionsEl = cardBody.querySelector('.card-actions');
      if (actionsEl) {
        actionsEl.style.display = 'none';
      }

      // 3. Видаляємо старий ланцюжок, якщо він був згенерований index.html
      const oldChain = cardBody.querySelector('.related-chain-wrap');
      if (oldChain) oldChain.remove();

      // Перевіряємо, чи вже створено наш новий блок
      if (cardBody.querySelector('.enhanced-chain-wrap')) return;

      // 4. Формуємо повний список каналів: базовий іде першим
      const allSources = [];
      if (art.source_name) {
        allSources.push({
          source_name: art.source_name,
          source_url: art.source_url || '#',
          raw_text: art.raw_text || art.summary || '',
          published_at: art.published_at || '',
          is_base: true
        });
      }
      art.related_sources.forEach(s => allSources.push(s));

      const chips = allSources.map((s, idx) => {
        const sName = s.source_name || ('Джерело ' + (idx + 1));
        const badge = s.is_base ? '⭐ ' : '🔗 ';
        const btnClass = s.is_base ? 'source-chip-btn is-main' : 'source-chip-btn';
        return `<button type="button" id="src-btn-${art.id}-${idx}" class="${btnClass}" onclick="toggleSourceAccordion('${art.id}', ${idx}, event)">${badge}${sName}</button>`;
      }).join(' ');

      const panels = allSources.map((s, idx) => {
        const sName = s.source_name || ('Джерело ' + (idx + 1));
        const sText = s.raw_text ? s.raw_text : 'Оригінальний текст підтягнеться під час наступного автооновлення.';
        const sLink = (s.source_url && s.source_url !== '#') ? `<a href="${s.source_url}" target="_blank" rel="noopener noreferrer" class="source-direct-link">Читати в першоджерелі ↗</a>` : '';
        const timeStr = s.published_at ? `<span class="source-box-time">🕒 ${s.published_at}</span>` : '';

        return `
          <div id="src-box-${art.id}-${idx}" class="source-expand-box">
            <div class="source-box-header">
              <div class="source-header-left">
                <span class="source-box-title">${s.is_base ? '⭐ Базове джерело: ' : ''}${sName}</span>
                ${timeStr}
              </div>
              ${sLink}
            </div>
            <div class="source-box-body">${sText}</div>
          </div>
        `;
      }).join('');

      const wrap = document.createElement('div');
      wrap.className = 'enhanced-chain-wrap related-chain-wrap';
      wrap.innerHTML = `
        <div class="related-chain-label">Джерела події (натисніть для перегляду версії джерела):</div>
        <div class="related-chips-row">${chips}</div>
        <div class="related-panels-container">${panels}</div>
      `;

      cardBody.insertBefore(wrap, fullTextEl);
    }
  });
}

// Слухач змін DOM для миттєвої реакції на фільтри чи оновлення
const observer = new MutationObserver(() => {
  enhanceArticlesWithChain();
});
observer.observe(document.body, { childList: true, subtree: true });

// Запуск при ініціалізації
setTimeout(enhanceArticlesWithChain, 200);
setTimeout(enhanceArticlesWithChain, 800);
setTimeout(enhanceArticlesWithChain, 2000);
