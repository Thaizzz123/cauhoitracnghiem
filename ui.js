/**
 * ui.js
 * ------------------------------------------------------------------
 * Các hàm thao tác DOM thuần túy: render câu hỏi, hiển thị phản hồi đúng/sai,
 * render lỗi parser, render kết quả cuối, render chip chọn số câu/chế độ.
 * Không chứa logic điều khiển luồng (điều đó nằm ở app.js).
 * ------------------------------------------------------------------
 */

(function (global) {
  'use strict';

  const FEEDBACK_DELAY_MS = 800; // thời gian giữ hiệu ứng đúng/sai trước khi cho phép thao tác tiếp

  function renderErrors(errors) {
    const box = document.getElementById('input-errors');
    if (!errors || errors.length === 0) {
      box.hidden = true;
      box.innerHTML = '';
      return;
    }
    const items = errors.map(e => {
      const label = e.number ? `Câu ${e.number}` : 'Lỗi chung';
      const sourceTag = e.source ? ` <span class="error-source">[${e.source}]</span>` : '';
      const snippet = e.snippet ? ` — "${e.snippet}${e.snippet.length >= 100 ? '...' : ''}"` : '';
      return `<li><strong>${label}:</strong>${sourceTag} ${e.reason}${snippet}</li>`;
    }).join('');
    box.innerHTML = `<strong>Phát hiện ${errors.length} lỗi:</strong><ul>${items}</ul>`;
    box.hidden = false;
  }

  /**
   * Render danh sách file đã tải lên, giữ đúng thứ tự upload (thứ tự này
   * quyết định thứ tự đánh số câu hỏi). Mỗi mục hiển thị số thứ tự, tên file,
   * trạng thái đọc file, và nút xoá khỏi danh sách.
   * @param {Array<{id, name, status: 'reading'|'ready'|'error', text, errorMsg, questionCount}>} files
   * @param {(id: string) => void} onRemove
   */
  function renderFileList(files, onRemove) {
    const container = document.getElementById('file-list');
    container.innerHTML = '';

    files.forEach((f, idx) => {
      const item = document.createElement('div');
      item.className = 'file-item status-' + f.status;

      const order = document.createElement('div');
      order.className = 'file-item-order';
      order.textContent = '#' + (idx + 1);

      const info = document.createElement('div');
      info.className = 'file-item-info';

      const name = document.createElement('div');
      name.className = 'file-item-name';
      name.textContent = f.name;

      const status = document.createElement('div');
      status.className = 'file-item-status';
      if (f.status === 'reading') {
        status.textContent = 'Đang đọc file...';
      } else if (f.status === 'error') {
        status.textContent = f.errorMsg || 'Lỗi đọc file.';
      } else {
        status.textContent = 'Sẵn sàng';
      }

      info.appendChild(name);
      info.appendChild(status);

      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'file-item-remove';
      removeBtn.textContent = '✕';
      removeBtn.title = 'Bỏ file này';
      removeBtn.addEventListener('click', () => onRemove(f.id));

      item.appendChild(order);
      item.appendChild(info);
      item.appendChild(removeBtn);
      container.appendChild(item);
    });
  }

  /**
   * Render danh sách chip chọn số câu hỏi, dựa trên tổng số câu hợp lệ.
   * Ngoài các chip có sẵn (10 câu / 20 câu / Tất cả), luôn có thêm 1 chip
   * "Tự nhập số câu" — bấm vào sẽ hiện ô nhập số, cho phép chọn số câu bất kỳ
   * từ 1 đến tổng số câu hợp lệ.
   */
  function renderCountChips(total, onSelectCount) {
    const container = document.getElementById('count-row');
    const customWrap = document.getElementById('count-custom-wrap');
    const customInput = document.getElementById('count-custom-input');
    const customHint = document.getElementById('count-custom-hint');

    container.innerHTML = '';
    customWrap.hidden = true;
    customInput.value = '';
    customInput.max = String(total);
    customHint.textContent = `Nhập từ 1 đến ${total}.`;
    customHint.className = 'count-custom-hint';

    const options = [];
    if (total > 10) options.push({ label: '10 câu', value: 10 });
    if (total > 20) options.push({ label: '20 câu', value: 20 });
    options.push({ label: `Tất cả (${total})`, value: total });

    const allChips = [];

    function activateChip(chip) {
      allChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
    }

    options.forEach((opt, idx) => {
      const chip = document.createElement('div');
      chip.className = 'chip' + (idx === options.length - 1 ? ' active' : '');
      chip.textContent = opt.label;
      chip.dataset.count = opt.value;
      chip.addEventListener('click', () => {
        activateChip(chip);
        customWrap.hidden = true;
        onSelectCount(opt.value);
      });
      allChips.push(chip);
      container.appendChild(chip);
    });

    // Chip "Tự nhập số câu" — luôn có, để chọn 1 con số bất kỳ ngoài các mốc
    // có sẵn (vd tổng đề có 446 câu nhưng chỉ muốn luyện 10 câu, 15 câu...).
    const customChip = document.createElement('div');
    customChip.className = 'chip';
    customChip.textContent = 'Tự nhập số câu';
    customChip.addEventListener('click', () => {
      activateChip(customChip);
      customWrap.hidden = false;
      customInput.focus();
    });
    allChips.push(customChip);
    container.appendChild(customChip);

    // Dùng .oninput (gán trực tiếp) thay vì addEventListener, vì hàm này có
    // thể được gọi lại nhiều lần (mỗi lần vào lại màn hình cấu hình) trong
    // khi ô input KHÔNG bị tạo lại — addEventListener sẽ chồng listener cũ,
    // còn gán .oninput luôn thay thế đúng 1 listener duy nhất.
    customInput.oninput = () => {
      const raw = customInput.value.trim();

      if (raw === '') {
        customHint.textContent = `Nhập từ 1 đến ${total}.`;
        customHint.className = 'count-custom-hint';
        return;
      }

      let n = parseInt(raw, 10);
      if (!Number.isFinite(n) || Number.isNaN(n)) {
        customHint.textContent = 'Số câu không hợp lệ.';
        customHint.className = 'count-custom-hint error';
        return;
      }

      if (n < 1) {
        n = 1;
        customInput.value = '1';
      } else if (n > total) {
        n = total;
        customInput.value = String(total);
      }

      customHint.textContent = `Sẽ luyện tập ${n} câu.`;
      customHint.className = 'count-custom-hint';
      onSelectCount(n);
    };

    // Mặc định chọn "Tất cả"
    onSelectCount(total);
  }

  function wireModeChips(onSelectMode) {
    const container = document.getElementById('mode-row');
    container.querySelectorAll('.chip').forEach(chip => {
      chip.addEventListener('click', () => {
        container.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        onSelectMode(chip.dataset.mode);
      });
    });
  }

  function renderConfigTotal(total) {
    document.getElementById('config-total-text').textContent = `Tổng cộng: ${total} câu hợp lệ`;
  }

  /** Chỉ render lại danh sách nút đáp án (dùng khi vào câu mới HOẶC xáo lại sau câu sai). */
  function renderOptionsList(question, onSelectOption) {
    const optionsContainer = document.getElementById('quiz-options');
    optionsContainer.innerHTML = '';

    question.options.forEach((text, idx) => {
      const btn = document.createElement('button');
      btn.className = 'option-btn';
      btn.type = 'button';
      btn.textContent = `${String.fromCharCode(65 + idx)}. ${text}`;
      btn.addEventListener('click', () => onSelectOption(idx, btn));
      optionsContainer.appendChild(btn);
    });

    const feedbackEl = document.getElementById('quiz-feedback');
    feedbackEl.hidden = true;
    feedbackEl.className = 'feedback';
  }

  function renderQuestion(question, progress, onSelectOption) {
    document.getElementById('quiz-progress-text').textContent =
      `Câu ${progress.current} / ${progress.total}`;
    document.getElementById('quiz-score-live').textContent = `${progress.correctSoFar} đúng`;
    document.getElementById('progress-bar-fill').style.width =
      `${Math.round(((progress.current - 1) / progress.total) * 100)}%`;

    document.getElementById('quiz-question-text').textContent = question.content;

    renderOptionsList(question, onSelectOption);
  }

  /**
   * Hiển thị hiệu ứng đúng/sai sau khi người dùng chọn 1 đáp án.
   * Chỉ phụ trách hiệu ứng hiển thị; KHÔNG quyết định bước tiếp theo
   * (việc đó do app.js xử lý trong callback onDone).
   */
  function showAnswerFeedback(correct, selectedBtn, onDone) {
    const allButtons = Array.from(document.querySelectorAll('#quiz-options .option-btn'));
    allButtons.forEach(b => (b.disabled = true));

    selectedBtn.classList.add(correct ? 'selected-correct' : 'selected-wrong');

    const feedbackEl = document.getElementById('quiz-feedback');
    feedbackEl.hidden = false;
    feedbackEl.textContent = correct ? 'Chính xác!' : 'Sai rồi, hãy chọn lại.';
    feedbackEl.className = 'feedback ' + (correct ? 'correct' : 'wrong');

    setTimeout(onDone, FEEDBACK_DELAY_MS);
  }

  // ---------------- Coi lại câu hỏi (review mode) ----------------

  /**
   * Render danh sách đáp án ở chế độ CHỈ XEM (đã trả lời trước đó):
   * - Đáp án đúng luôn tô xanh lá.
   * - Đáp án người dùng đã chọn sai (nếu có) tô đỏ.
   * - Tất cả nút đều bị vô hiệu hoá (không cho bấm).
   */
  function renderReviewOptions(question) {
    const optionsContainer = document.getElementById('quiz-options');
    optionsContainer.innerHTML = '';

    const opts = question.reviewOptions || question.options;
    const correctIdx = question.reviewOptions ? question.reviewCorrectIndex : question.correctIndex;
    const selectedIdx = question.reviewOptions ? question.reviewSelectedIndex : null;

    opts.forEach((text, idx) => {
      const btn = document.createElement('button');
      btn.className = 'option-btn';
      btn.type = 'button';
      btn.disabled = true;
      btn.textContent = `${String.fromCharCode(65 + idx)}. ${text}`;

      if (idx === correctIdx) {
        btn.classList.add('review-correct');
      }
      if (selectedIdx !== null && idx === selectedIdx && selectedIdx !== correctIdx) {
        btn.classList.add('review-wrong');
      }

      optionsContainer.appendChild(btn);
    });

    const feedbackEl = document.getElementById('quiz-feedback');
    feedbackEl.hidden = false;
    const wasCorrect = question.attempted ? question.firstAttemptCorrect : null;
    feedbackEl.className = 'feedback ' + (wasCorrect === false ? 'wrong' : 'correct');
    feedbackEl.textContent = wasCorrect === false
      ? 'Bạn đã chọn sai ở lần trả lời đầu tiên.'
      : 'Bạn đã trả lời đúng.';
  }

  /**
   * Render 1 câu hỏi ở chế độ coi lại (read-only).
   * @param {Object} progress - { current, total, correctSoFar, liveCurrent }
   *   current: số thứ tự câu ĐANG XEM (1-based)
   *   liveCurrent: số thứ tự câu ĐANG LÀM THẬT trong phiên (1-based), dùng để
   *   thanh tiến trình không bị lùi lại khi người dùng chỉ đang coi lại.
   */
  function renderQuestionReview(question, progress) {
    document.getElementById('quiz-progress-text').textContent =
      `Câu ${progress.current} / ${progress.total} · Đang xem lại`;
    document.getElementById('quiz-score-live').textContent = `${progress.correctSoFar} đúng`;
    document.getElementById('progress-bar-fill').style.width =
      `${Math.round(((progress.liveCurrent - 1) / progress.total) * 100)}%`;

    document.getElementById('quiz-question-text').textContent = question.content;
    renderReviewOptions(question);
  }

  /** Ẩn/hiện nút "<-" và banner "đang xem lại", tuỳ theo vị trí đang xem. */
  function updateQuizNav(viewedIndex, liveIndex) {
    const backBtn = document.getElementById('btn-quiz-back');
    backBtn.hidden = viewedIndex <= 0;

    const banner = document.getElementById('quiz-review-banner');
    banner.hidden = viewedIndex === liveIndex;
  }

  /**
   * Render lưới các câu trong menu "coi lại câu hỏi".
   * Câu đã qua (đúng): xanh lá. Câu đã qua (sai lần đầu, cuối cùng vẫn phải
   * trả lời đúng mới qua): đỏ viền + số, vẫn bấm được để xem lại đáp án đã
   * chọn sai. Câu đang làm: viền accent. Câu chưa tới: khoá, không bấm được.
   */
  function renderQuestionListMenu(sessionQuestions, liveIndex, onSelect) {
    const grid = document.getElementById('question-list-grid');
    grid.innerHTML = '';

    sessionQuestions.forEach((q, idx) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'qlist-item';
      btn.textContent = String(idx + 1);

      const reached = idx <= liveIndex;

      if (!reached) {
        btn.classList.add('qlist-locked');
        btn.disabled = true;
      } else if (idx === liveIndex) {
        btn.classList.add('qlist-current');
      } else if (q.attempted) {
        btn.classList.add(q.firstAttemptCorrect ? 'qlist-correct' : 'qlist-wrong');
      }

      if (reached) {
        btn.addEventListener('click', () => onSelect(idx));
      }

      grid.appendChild(btn);
    });
  }

  function openQuestionListModal() {
    document.getElementById('question-list-panel').classList.add('qlist-panel-open');
    document.getElementById('app').classList.add('quiz-list-open');
  }

  function closeQuestionListModal() {
    document.getElementById('question-list-panel').classList.remove('qlist-panel-open');
    document.getElementById('app').classList.remove('quiz-list-open');
  }

  /** Đang mở khung danh sách câu hỏi hay không (dùng cho logic "bấm ra ngoài để đóng"). */
  function isQuestionListModalOpen() {
    return document.getElementById('question-list-panel').classList.contains('qlist-panel-open');
  }

  function renderResult(final) {
    document.getElementById('result-score').textContent = final.score;
    document.getElementById('result-detail').textContent =
      `Đúng ${final.correct} / ${final.total} câu`;

    const retryWrongBtn = document.getElementById('btn-retry-wrong');
    retryWrongBtn.hidden = final.wrongOriginalQuestions.length === 0;
  }

  const api = {
    renderErrors,
    renderFileList,
    renderCountChips,
    wireModeChips,
    renderConfigTotal,
    renderQuestion,
    renderOptionsList,
    showAnswerFeedback,
    renderResult,
    renderQuestionReview,
    updateQuizNav,
    renderQuestionListMenu,
    openQuestionListModal,
    closeQuestionListModal,
    isQuestionListModalOpen
  };
  global.QuizUI = api;
})(typeof window !== 'undefined' ? window : globalThis);
